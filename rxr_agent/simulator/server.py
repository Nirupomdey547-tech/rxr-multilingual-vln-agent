"""
Interactive Simulator Server for RxR VLN Decision Agent.
Serves the web UI and provides REST APIs for episodic rollouts,
language switching, candidate action evaluation, and uncertainty monitoring.
"""

from __future__ import annotations
import os
import json
import http.server
import socketserver
from urllib.parse import urlparse, parse_qs
from typing import Dict, Any, Optional

from ..env.graph_env import NavigationEnv, NavigationAction
from ..env.environments_data import get_environment_by_id, list_available_environments
from ..env.rxr_dataset import get_rxr_episodes, get_episode_by_id, RxREpisode
from ..language.tokenizer import MultilingualTokenizer
from ..language.multilingual_encoder import MultilingualEncoder, EncodedInstruction
from ..model.policy_network import VLNDecisionPolicy, PolicyDecision
from ..model.uncertainty import UncertaintyEstimator, ReliabilityReport, ReliabilityStatus
from ..evaluation.metrics import evaluate_episode_metrics


class SimulationSession:
    """Manages active interactive simulation state."""
    def __init__(self):
        self.tokenizer = MultilingualTokenizer()
        self.encoder = MultilingualEncoder(embed_dim=64)
        self.policy = VLNDecisionPolicy(embed_dim=64, concept_embeddings=self.encoder.concept_embeddings)
        self.uncertainty_estimator = UncertaintyEstimator()

        self.current_episode: Optional[RxREpisode] = None
        self.current_language: str = "en"
        self.env: Optional[NavigationEnv] = None
        self.encoded_inst: Optional[EncodedInstruction] = None
        self.current_progress: float = 0.0
        self.latest_decision: Optional[PolicyDecision] = None
        self.latest_reliability: Optional[ReliabilityReport] = None
        self.step_history: list = []

    def load_episode(self, episode_id: str, language: str = "en") -> Dict[str, Any]:
        self.current_episode = get_episode_by_id(episode_id)
        self.current_language = language
        graph = get_environment_by_id(self.current_episode.env_id)
        self.env = NavigationEnv(graph, max_steps=15)
        state = self.env.reset(self.current_episode.start_node, self.current_episode.initial_heading)

        inst = self.current_episode.get_instruction(language)
        tokenized = self.tokenizer.tokenize(inst.full_text, language=language)
        self.encoded_inst = self.encoder.encode(tokenized)

        self.current_progress = 0.0
        self.step_history = []

        # Initial policy evaluation at starting state
        self.latest_decision = self.policy.evaluate_candidates(
            state=state,
            encoded_inst=self.encoded_inst,
            current_progress=0.0
        )
        self.latest_reliability = self.uncertainty_estimator.evaluate(
            state=state,
            decision=self.latest_decision,
            target_landmarks=self.current_episode.target_landmarks
        )

        return self.get_simulation_state()

    def switch_language(self, new_lang: str) -> Dict[str, Any]:
        if not self.current_episode or not self.env:
            raise RuntimeError("No active simulation")
        self.current_language = new_lang
        inst = self.current_episode.get_instruction(new_lang)
        tokenized = self.tokenizer.tokenize(inst.full_text, language=new_lang)
        self.encoded_inst = self.encoder.encode(tokenized)

        # Re-evaluate current state with the new language instruction
        state = self.env.get_state()
        self.latest_decision = self.policy.evaluate_candidates(
            state=state,
            encoded_inst=self.encoded_inst,
            current_progress=self.current_progress
        )
        self.latest_reliability = self.uncertainty_estimator.evaluate(
            state=state,
            decision=self.latest_decision,
            target_landmarks=self.current_episode.target_landmarks
        )

        return self.get_simulation_state()

    def step(self, override_action_idx: Optional[int] = None) -> Dict[str, Any]:
        if not self.env or not self.current_episode or not self.latest_decision:
            raise RuntimeError("Simulation not initialized")

        if self.env.is_terminal:
            return self.get_simulation_state()

        # Determine action to take (agent autonomous choice or manual user override)
        if override_action_idx is not None and 0 <= override_action_idx < len(self.latest_decision.action_scores):
            chosen_score = self.latest_decision.action_scores[override_action_idx]
            cand = chosen_score.candidate
            action = NavigationAction(
                action_type=cand.action_type,
                target_node_id=cand.target_node_id,
                delta_heading=cand.relative_heading,
                confidence=chosen_score.probability
            )
        else:
            action = self.latest_decision.selected_action

        # Record pre-step snapshot into history for rollback/backtrack
        self.step_history.append({
            "node": self.env.current_node,
            "heading": self.env.heading,
            "progress": self.current_progress,
            "trajectory": list(self.env.trajectory_nodes),
            "trajectory_length": self.env.trajectory_length,
            "step_count": self.env.step_count
        })

        # Execute transition in environment
        next_state, reward, done, info = self.env.step(action)
        self.current_progress = self.latest_decision.predicted_progress

        # Evaluate candidate actions for next state if not terminal
        if not next_state.is_terminal:
            self.latest_decision = self.policy.evaluate_candidates(
                state=next_state,
                encoded_inst=self.encoded_inst,
                current_progress=self.current_progress
            )
            self.latest_reliability = self.uncertainty_estimator.evaluate(
                state=next_state,
                decision=self.latest_decision,
                target_landmarks=self.current_episode.target_landmarks
            )

        return self.get_simulation_state()

    def backtrack(self) -> Dict[str, Any]:
        """Rolls back the agent to the previous decision checkpoint."""
        if not self.step_history or not self.env:
            return self.get_simulation_state()

        prev = self.step_history.pop()
        self.env.current_node = prev["node"]
        self.env.heading = prev["heading"]
        self.env.trajectory_nodes = prev["trajectory"]
        self.env.trajectory_length = prev["trajectory_length"]
        self.env.step_count = prev["step_count"]
        self.env.is_terminal = False
        self.current_progress = prev["progress"]

        state = self.env.get_state()
        self.latest_decision = self.policy.evaluate_candidates(
            state=state,
            encoded_inst=self.encoded_inst,
            current_progress=self.current_progress
        )
        self.latest_reliability = self.uncertainty_estimator.evaluate(
            state=state,
            decision=self.latest_decision,
            target_landmarks=self.current_episode.target_landmarks
        )
        return self.get_simulation_state()

    def get_simulation_state(self) -> Dict[str, Any]:
        if not self.env or not self.current_episode:
            return {}

        state = self.env.get_state()
        graph = self.env.graph

        # Current metrics
        metrics = evaluate_episode_metrics(
            episode_id=self.current_episode.episode_id,
            language=self.current_language,
            is_unseen=self.current_episode.is_unseen,
            agent_trajectory=self.env.trajectory_nodes,
            reference_path=self.current_episode.reference_path,
            goal_node=self.current_episode.goal_node,
            graph=graph,
            unreliable_steps=sum(1 for h in self.step_history if getattr(self.latest_reliability, "status", None) == ReliabilityStatus.UNRELIABLE)
        )

        # Graph nodes and edges for 2D rendering
        nodes_data = {}
        for nid, vp in graph.nodes.items():
            nodes_data[nid] = {
                "id": nid,
                "x": vp.x,
                "y": vp.y,
                "z": vp.z,
                "room_type": vp.room_type,
                "is_start": nid == self.current_episode.start_node,
                "is_goal": nid == self.current_episode.goal_node,
                "is_current": nid == state.current_node,
                "is_visited": nid in state.trajectory_nodes
            }

        edges_data = []
        for u, neighbors in graph.adjacency.items():
            for v, dist in neighbors:
                if u < v: # Avoid duplicates for undirected graph
                    edges_data.append({"from": u, "to": v, "distance": dist})

        # Candidates formatting
        candidates_data = []
        if self.latest_decision:
            for i, score in enumerate(self.latest_decision.action_scores):
                candidates_data.append({
                    "index": i,
                    "action_type": score.action_type,
                    "target_node": score.target_node_id,
                    "target_room": score.target_room_type,
                    "target_landmarks": score.target_landmarks,
                    "relative_heading": score.relative_heading,
                    "distance": score.distance_meters,
                    "probability": round(score.probability, 4),
                    "is_selected": i == self.latest_decision.selected_index
                })

        # Word attention
        word_attns = []
        if self.latest_decision and self.latest_decision.fusion_output:
            words = self.latest_decision.fusion_output.word_tokens
            weights = self.latest_decision.fusion_output.word_attention_weights
            for w, wt in zip(words, weights):
                if w not in ("<bos>", "<eos>"):
                    word_attns.append({"word": w, "weight": float(wt)})

        # Uncertainty formatting
        rel_data = {}
        if self.latest_reliability:
            rel = self.latest_reliability
            rel_data = {
                "status": rel.status.value,
                "entropy": round(rel.entropy, 3),
                "normalized_entropy": round(rel.normalized_entropy, 3),
                "confidence": round(rel.confidence, 3),
                "semantic_dissonance": round(rel.semantic_dissonance, 3),
                "is_looping": rel.is_looping,
                "diagnostic_message": rel.diagnostic_message,
                "recommended_backtrack_node": rel.recommended_backtrack_node
            }

        inst = self.current_episode.get_instruction(self.current_language)

        return {
            "episode": {
                "id": self.current_episode.episode_id,
                "env_id": self.current_episode.env_id,
                "env_name": graph.name,
                "is_unseen": self.current_episode.is_unseen,
                "language": self.current_language,
                "start_node": self.current_episode.start_node,
                "goal_node": self.current_episode.goal_node,
                "target_landmarks": self.current_episode.target_landmarks,
                "instruction_text": inst.full_text,
                "reference_path": self.current_episode.reference_path
            },
            "state": {
                "current_node": state.current_node,
                "current_room": state.current_room,
                "heading": round(state.heading, 1),
                "elevation": round(state.elevation, 1),
                "step_count": state.step,
                "max_steps": self.env.max_steps,
                "is_terminal": state.is_terminal,
                "trajectory_nodes": state.trajectory_nodes,
                "trajectory_length": round(state.trajectory_length, 2),
                "current_view_desc": state.current_observation.description,
                "current_landmarks": state.current_observation.detected_landmarks
            },
            "candidates": candidates_data,
            "word_attention": word_attns,
            "reliability": rel_data,
            "progress": round(self.current_progress, 3),
            "metrics": {
                "success": metrics.success,
                "navigation_error": round(metrics.navigation_error, 2),
                "spl": round(metrics.spl * 100.0, 1),
                "ndtw": round(metrics.ndtw * 100.0, 1),
                "sdtw": round(metrics.sdtw * 100.0, 1),
                "trajectory_len": round(metrics.trajectory_length, 2),
                "reference_len": round(metrics.reference_length, 2)
            },
            "graph": {
                "nodes": nodes_data,
                "edges": edges_data
            }
        }


# Global session instance
GLOBAL_SESSION = SimulationSession()


class ThreadedSimulatorServer(socketserver.ThreadingTCPServer):
    """Multi-threaded server to handle concurrent browser asset & API requests seamlessly."""
    allow_reuse_address = True
    daemon_threads = True


class SimulatorRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Handles static files and JSON REST endpoints."""

    def __init__(self, *args, **kwargs):
        web_dir = os.path.join(os.path.dirname(__file__), "web")
        super().__init__(*args, directory=web_dir, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("", "/"):
            # Serve login.html by default on root
            self.path = "/login.html"
            super().do_GET()
        elif parsed.path in ("/login", "/login/"):
            self.path = "/login.html"
            super().do_GET()
        elif parsed.path in ("/simulator", "/simulator/"):
            self.path = "/index.html"
            super().do_GET()
        elif parsed.path == "/api/episodes":
            episodes = get_rxr_episodes()
            payload = [
                {
                    "id": ep.episode_id,
                    "env_id": ep.env_id,
                    "is_unseen": ep.is_unseen,
                    "goal_node": ep.goal_node,
                    "languages": list(ep.instructions.keys())
                }
                for ep in episodes
            ]
            self._send_json(payload)
        elif parsed.path == "/api/state":
            state = GLOBAL_SESSION.get_simulation_state()
            self._send_json(state)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        data = json.loads(body.decode('utf-8')) if body else {}

        if parsed.path == "/api/reset":
            ep_id = data.get("episode_id", "rxr_seen1_ep01")
            lang = data.get("language", "en")
            res = GLOBAL_SESSION.load_episode(ep_id, lang)
            self._send_json(res)

        elif parsed.path == "/api/step":
            override_idx = data.get("override_action_index", None)
            res = GLOBAL_SESSION.step(override_idx)
            self._send_json(res)

        elif parsed.path == "/api/switch_language":
            lang = data.get("language", "en")
            res = GLOBAL_SESSION.switch_language(lang)
            self._send_json(res)

        elif parsed.path == "/api/backtrack":
            res = GLOBAL_SESSION.backtrack()
            self._send_json(res)

        elif parsed.path == "/api/login":
            username = data.get("username", "").strip()
            password = data.get("password", "").strip()
            if username:
                role = "Guest Explorer" if "guest" in username.lower() else "Lead Researcher"
                self._send_json({"authenticated": True, "username": username, "role": role})
            else:
                self._send_json({"authenticated": False, "error": "Username required"})

        elif parsed.path == "/api/logout":
            self._send_json({"logged_out": True})

        else:
            self.send_error(404, "Endpoint not found")

    def _send_json(self, payload: Any):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Suppress routine request logs to keep terminal clean
        pass


def run_simulator_server(port: int = 8080, initial_episode: str = "rxr_seen1_ep01", initial_lang: str = "en"):
    """Starts the interactive simulator server with multi-threading."""
    GLOBAL_SESSION.load_episode(initial_episode, initial_lang)
    server_address = ("", port)
    with ThreadedSimulatorServer(server_address, SimulatorRequestHandler) as httpd:
        print(f"=================================================================")
        print(f"  RxR Multilingual VLN Interactive Simulator running at:")
        print(f"  http://localhost:{port} (or http://127.0.0.1:{port})")
        print(f"=================================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down simulator server.")
