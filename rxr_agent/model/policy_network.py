"""
Goal-Based Instruction-Conditioned Decision Policy for RxR VLN.
Selects next spatial navigation action or STOP from discrete candidates
conditioned on visual state and multilingual instruction cross-attention.
"""

from __future__ import annotations
import math
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple, Any
import numpy as np

from ..env.graph_env import AgentState, CandidateAction, NavigationAction
from ..language.multilingual_encoder import EncodedInstruction
from .visual_encoder import VisualHeadingEncoder, get_room_canonical_concept, get_landmark_concept
from .multimodal_fusion import MultimodalCrossAttention, FusionOutput
from ..language.lexicon import get_canonical_concept


@dataclass
class ActionCandidateScore:
    candidate: CandidateAction
    action_type: str
    target_node_id: Optional[str]
    target_room_type: str
    target_landmarks: List[str]
    relative_heading: float
    distance_meters: float
    probability: float
    logit: float


@dataclass
class PolicyDecision:
    selected_action: NavigationAction
    action_scores: List[ActionCandidateScore]
    probabilities: List[float]
    selected_index: int
    predicted_progress: float
    fusion_output: FusionOutput
    alignment_score: float


class VLNDecisionPolicy:
    """
    Multimodal Policy Network:
    pi(a_t | s_t, I) = Softmax(Candidate_Embeddings @ Fused_State / tau)
    """
    def __init__(self, embed_dim: int = 64, temperature: float = 0.35, concept_embeddings: Optional[Dict[str, np.ndarray]] = None):
        self.embed_dim = embed_dim
        self.temperature = temperature
        self.visual_encoder = VisualHeadingEncoder(embed_dim=embed_dim, concept_embeddings=concept_embeddings)
        self.fusion = MultimodalCrossAttention(embed_dim=embed_dim)

        rng = np.random.RandomState(303)
        self.W_prog = rng.randn(embed_dim, 1).astype(np.float32) / math.sqrt(embed_dim)
        self.b_prog = 0.0

    def evaluate_candidates(
        self,
        state: AgentState,
        encoded_inst: EncodedInstruction,
        current_progress: float = 0.0,
        temperature_override: Optional[float] = None
    ) -> PolicyDecision:
        tau = temperature_override if temperature_override is not None else self.temperature
        candidates = state.available_actions
        K = len(candidates)

        # 1. Encode visual observation
        obs_vec = self.visual_encoder.encode_observation(state.current_observation)

        # 2. Cross-modal fusion with multilingual instruction
        fusion_out = self.fusion.fuse(
            visual_query=obs_vec,
            token_embeddings=encoded_inst.token_embeddings,
            word_tokens=encoded_inst.tokens,
            progress_bias=current_progress
        )

        fused = fusion_out.fused_state

        # 3. Dynamic progress estimation:
        # Based on steps taken, distance, and remaining milestones
        step_factor = len(state.trajectory_nodes) - 1
        est_prog = min(1.0, max(current_progress, (step_factor + 1) / max(step_factor + 3, 4.0)))

        # 4. Encode candidate actions
        cand_embeds = self.visual_encoder.encode_candidates(candidates) # (K, embed_dim)

        # 5. Compute action logits
        attended_text_norm = fusion_out.attended_text / (np.linalg.norm(fusion_out.attended_text) + 1e-7)

        logits = np.zeros(K, dtype=np.float32)

        # Extract canonical goal concepts across English, Hindi, and Telugu from the instruction
        all_concepts = [get_canonical_concept(tok) for tok in encoded_inst.tokens if get_canonical_concept(tok)]
        room_sequence = [c for c in all_concepts if c.startswith('ROOM_')]
        landmark_sequence = [c for c in all_concepts if c.startswith('LM_')]

        final_goal_room = room_sequence[-1] if room_sequence else None
        final_goal_landmark = landmark_sequence[-1] if landmark_sequence else None

        curr_lms = set(state.current_observation.detected_landmarks)
        curr_room_concept = get_room_canonical_concept(state.current_room)
        curr_lm_concepts = set(get_landmark_concept(lm) for lm in curr_lms)

        for i, cand in enumerate(candidates):
            if cand.action_type == "STOP":
                # Goal destination check: current room or detected landmarks match the FINAL instruction goal
                at_final_room = (final_goal_room is not None and curr_room_concept == final_goal_room)
                has_final_landmark = (final_goal_landmark is not None and final_goal_landmark in curr_lm_concepts)

                stop_match = float(np.dot(cand_embeds[i], attended_text_norm))

                if (at_final_room or has_final_landmark) and step_factor >= 2:
                    # Successfully arrived at destination!
                    logits[i] = stop_match * 2.0 + 6.0
                elif est_prog > 0.85 and step_factor >= 4 and (at_final_room or has_final_landmark):
                    logits[i] = stop_match * 1.5 + 4.0
                else:
                    # Premature stop penalty
                    logits[i] = -8.0
            else:
                # Directional candidate move
                cand_match = float(np.dot(cand_embeds[i], attended_text_norm))
                fused_match = float(np.dot(cand_embeds[i], fused))

                logits[i] = cand_match * 2.5 + fused_match * 1.5

                # Encourage moving toward milestones or final goal rooms mentioned in instruction
                target_room_c = get_room_canonical_concept(cand.target_room_type)
                if target_room_c in room_sequence:
                    logits[i] += 1.5
                if target_room_c == final_goal_room:
                    logits[i] += 2.0

                # Loop prevention: penalize immediately bouncing back to the previous node
                if len(state.trajectory_nodes) >= 2 and cand.target_node_id == state.trajectory_nodes[-2]:
                    logits[i] -= 4.0

        # Softmax with temperature
        scaled_logits = logits / max(tau, 1e-3)
        max_logit = np.max(scaled_logits)
        exp_logits = np.exp(scaled_logits - max_logit)
        probs = exp_logits / (np.sum(exp_logits) + 1e-7)

        # Build candidate score objects
        action_scores: List[ActionCandidateScore] = []
        for i, cand in enumerate(candidates):
            action_scores.append(ActionCandidateScore(
                candidate=cand,
                action_type=cand.action_type,
                target_node_id=cand.target_node_id,
                target_room_type=cand.target_room_type,
                target_landmarks=cand.target_landmarks,
                relative_heading=cand.relative_heading,
                distance_meters=cand.distance_meters,
                probability=float(probs[i]),
                logit=float(logits[i])
            ))

        # Select greedy best action
        selected_idx = int(np.argmax(probs))
        chosen_cand = candidates[selected_idx]

        selected_action = NavigationAction(
            action_type=chosen_cand.action_type,
            target_node_id=chosen_cand.target_node_id,
            delta_heading=chosen_cand.relative_heading,
            confidence=float(probs[selected_idx])
        )

        overall_alignment = float(np.dot(obs_vec, encoded_inst.sentence_embedding))

        return PolicyDecision(
            selected_action=selected_action,
            action_scores=action_scores,
            probabilities=[float(p) for p in probs],
            selected_index=selected_idx,
            predicted_progress=float(est_prog),
            fusion_output=fusion_out,
            alignment_score=overall_alignment
        )
