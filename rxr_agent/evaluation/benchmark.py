"""
Comprehensive RxR Benchmark Runner.
Executes batch evaluations across English, Hindi, Telugu and Seen vs Unseen splits.
Generates evaluation tables matching Google Research RxR Leaderboard criteria.
"""

from __future__ import annotations
import json
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import numpy as np

from ..env.graph_env import NavigationEnv
from ..env.environments_data import get_environment_by_id
from ..env.rxr_dataset import get_rxr_episodes, RxREpisode
from ..language.tokenizer import MultilingualTokenizer
from ..language.multilingual_encoder import MultilingualEncoder
from ..model.policy_network import VLNDecisionPolicy
from ..model.uncertainty import UncertaintyEstimator, ReliabilityStatus
from .metrics import EpisodeMetrics, evaluate_episode_metrics, aggregate_metrics


@dataclass
class BenchmarkResult:
    overall: Dict[str, float]
    by_language: Dict[str, Dict[str, float]]
    by_split: Dict[str, Dict[str, float]]
    matrix: Dict[str, Dict[str, float]]
    episodes_metrics: List[EpisodeMetrics]

    def to_markdown_table(self) -> str:
        """Formats the results as a Markdown table for reports and logs."""
        lines = [
            "### Room-Across-Room (RxR) Benchmark Results",
            "",
            "| Split / Language | Episodes | SR (%) | SPL (%) | nDTW (%) | sDTW (%) | NE (m) | TL (m) | Unreliable (%) |",
            "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |"
        ]

        # Overall row
        ov = self.overall
        lines.append(
            f"| **OVERALL** | {ov['num_episodes']} | **{ov['sr']:.1f}** | **{ov['spl']:.1f}** | **{ov['ndtw']:.1f}** | **{ov['sdtw']:.1f}** | **{ov['mean_nav_error']:.2f}** | {ov['mean_trajectory_len']:.2f} | {ov['unreliability_rate']:.1f}% |"
        )

        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")

        # By Language
        for lang, m in self.by_language.items():
            lang_label = {"en": "English (en-IN/US)", "hi": "Hindi (hi-IN)", "te": "Telugu (te-IN)"}.get(lang, lang)
            lines.append(
                f"| {lang_label} | {m['num_episodes']} | {m['sr']:.1f} | {m['spl']:.1f} | {m['ndtw']:.1f} | {m['sdtw']:.1f} | {m['mean_nav_error']:.2f} | {m['mean_trajectory_len']:.2f} | {m['unreliability_rate']:.1f}% |"
            )

        lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")

        # By Environment Split
        for split, m in self.by_split.items():
            split_label = "Val-Seen Environments" if split == "seen" else "Val-Unseen Environments (Zero-Shot)"
            lines.append(
                f"| *{split_label}* | {m['num_episodes']} | {m['sr']:.1f} | {m['spl']:.1f} | {m['ndtw']:.1f} | {m['sdtw']:.1f} | {m['mean_nav_error']:.2f} | {m['mean_trajectory_len']:.2f} | {m['unreliability_rate']:.1f}% |"
            )

        return "\n".join(lines)


class RxRBenchmarkRunner:
    """
    Orchestrates batch episodic rollouts of the Multilingual Decision Agent
    across all RxR challenge configurations.
    """
    def __init__(self, embed_dim: int = 64):
        self.tokenizer = MultilingualTokenizer()
        self.encoder = MultilingualEncoder(embed_dim=embed_dim)
        self.policy = VLNDecisionPolicy(embed_dim=embed_dim, concept_embeddings=self.encoder.concept_embeddings)
        self.uncertainty_estimator = UncertaintyEstimator()

    def run_single_episode(
        self,
        episode: RxREpisode,
        language: str = "en",
        max_steps: int = 15
    ) -> Tuple[EpisodeMetrics, List[Dict[str, Any]]]:
        """Runs a complete sequential rollout for one episode and language."""
        graph = get_environment_by_id(episode.env_id)
        env = NavigationEnv(graph, max_steps=max_steps)
        state = env.reset(episode.start_node, episode.initial_heading)

        # 1. Linguistic encoding
        inst = episode.get_instruction(language)
        tokenized = self.tokenizer.tokenize(inst.full_text, language=language)
        encoded_inst = self.encoder.encode(tokenized)

        # 2. Sequential Decision Loop
        trajectory_log: List[Dict[str, Any]] = []
        unreliable_step_count = 0
        current_progress = 0.0

        while not state.is_terminal and env.step_count < max_steps:
            # Policy evaluation
            decision = self.policy.evaluate_candidates(
                state=state,
                encoded_inst=encoded_inst,
                current_progress=current_progress
            )

            # Uncertainty & Reliability assessment
            rel_report = self.uncertainty_estimator.evaluate(
                state=state,
                decision=decision,
                target_landmarks=episode.target_landmarks
            )

            if rel_report.status == ReliabilityStatus.UNRELIABLE:
                unreliable_step_count += 1

            # Log step
            trajectory_log.append({
                "step": state.step,
                "current_node": state.current_node,
                "current_room": state.current_room,
                "heading": state.heading,
                "selected_action": decision.selected_action.action_type,
                "target_node": decision.selected_action.target_node_id,
                "confidence": decision.selected_action.confidence,
                "entropy": rel_report.entropy,
                "reliability_status": rel_report.status.value,
                "diagnostics": rel_report.diagnostic_message,
                "predicted_progress": decision.predicted_progress,
                "candidate_count": len(decision.action_scores)
            })

            current_progress = decision.predicted_progress

            # Environment transition
            next_state, reward, done, info = env.step(decision.selected_action)
            state = next_state

        # 3. Compute RxR Metrics
        metrics = evaluate_episode_metrics(
            episode_id=episode.episode_id,
            language=language,
            is_unseen=episode.is_unseen,
            agent_trajectory=env.trajectory_nodes,
            reference_path=episode.reference_path,
            goal_node=episode.goal_node,
            graph=graph,
            unreliable_steps=unreliable_step_count
        )

        return metrics, trajectory_log

    def run_benchmark(
        self,
        languages: Optional[List[str]] = None,
        episodes: Optional[List[RxREpisode]] = None
    ) -> BenchmarkResult:
        if languages is None:
            languages = ["en", "hi", "te"]
        if episodes is None:
            episodes = get_rxr_episodes()

        all_metrics: List[EpisodeMetrics] = []

        for ep in episodes:
            for lang in languages:
                m, _ = self.run_single_episode(ep, language=lang)
                all_metrics.append(m)

        # Aggregations
        overall = aggregate_metrics(all_metrics)

        by_lang = {}
        for lang in languages:
            subset = [m for m in all_metrics if m.language == lang]
            by_lang[lang] = aggregate_metrics(subset)

        by_split = {
            "seen": aggregate_metrics([m for m in all_metrics if not m.is_unseen]),
            "unseen": aggregate_metrics([m for m in all_metrics if m.is_unseen]),
        }

        matrix = {}
        for lang in languages:
            for split in ["seen", "unseen"]:
                is_un = (split == "unseen")
                sub = [m for m in all_metrics if m.language == lang and m.is_unseen == is_un]
                matrix[f"{lang}_{split}"] = aggregate_metrics(sub)

        return BenchmarkResult(
            overall=overall,
            by_language=by_lang,
            by_split=by_split,
            matrix=matrix,
            episodes_metrics=all_metrics
        )
