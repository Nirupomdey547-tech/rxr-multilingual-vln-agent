"""
Uncertainty Quantification and Reliability State Machine for RxR VLN.
Exposes real-time policy entropy, visual-linguistic alignment dissonance,
loop detection, and unreliability diagnostic alerts.
"""

from __future__ import annotations
import math
from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Optional, Any
import numpy as np

from ..env.graph_env import AgentState
from .policy_network import PolicyDecision


class ReliabilityStatus(str, Enum):
    RELIABLE = "RELIABLE"       # Green: High confidence, solid visual-textual grounding
    CAUTIOUS = "CAUTIOUS"       # Yellow: Moderate entropy or minor ambiguity
    UNRELIABLE = "UNRELIABLE"   # Red: High uncertainty, potential loop, or landmark mismatch


@dataclass
class ReliabilityReport:
    status: ReliabilityStatus
    entropy: float               # Shannon entropy of action distribution (nats)
    normalized_entropy: float    # Entropy normalized by log(K) in [0, 1]
    confidence: float            # Top action probability [0, 1]
    semantic_dissonance: float   # Discrepancy between visual and textual expectation [0, 1]
    is_looping: bool             # Whether agent is revisiting recent nodes
    diagnostic_message: str      # Human-readable explanation of reliability state
    recommended_backtrack_node: Optional[str] # Safe checkpoint node if unreliable


class UncertaintyEstimator:
    """
    Evaluates real-time agent uncertainty and reliability during sequential decision making.
    """
    def __init__(
        self,
        entropy_caution_threshold: float = 0.55,
        entropy_unreliable_threshold: float = 0.80,
        min_confidence_threshold: float = 0.35
    ):
        self.entropy_caution_threshold = entropy_caution_threshold
        self.entropy_unreliable_threshold = entropy_unreliable_threshold
        self.min_confidence_threshold = min_confidence_threshold

    def evaluate(
        self,
        state: AgentState,
        decision: PolicyDecision,
        target_landmarks: Optional[List[str]] = None
    ) -> ReliabilityReport:
        probs = np.array(decision.probabilities, dtype=np.float64)
        K = len(probs)

        # 1. Shannon Entropy
        # Avoid log(0)
        safe_probs = np.clip(probs, 1e-12, 1.0)
        entropy = -float(np.sum(safe_probs * np.log(safe_probs)))

        max_possible_entropy = math.log(K) if K > 1 else 1.0
        norm_entropy = float(entropy / max_possible_entropy) if max_possible_entropy > 0 else 0.0

        # 2. Confidence (Max Softmax Probability)
        confidence = float(np.max(probs))

        # 3. Loop / Oscillation Detection
        history = state.trajectory_nodes
        is_looping = False
        revisit_count = history.count(state.current_node)
        if revisit_count >= 2:
            is_looping = True
        elif len(history) >= 4 and history[-1] == history[-3]:
            # Ping-pong oscillation: A -> B -> A
            is_looping = True

        # 4. Semantic Dissonance
        # If instruction explicitly looks for a landmark but current view has none
        dissonance = max(0.0, 1.0 - (decision.alignment_score + 1.0) / 2.0)

        # 5. Determine Reliability State & Diagnostics
        diagnostics: List[str] = []
        status = ReliabilityStatus.RELIABLE

        if is_looping:
            status = ReliabilityStatus.UNRELIABLE
            diagnostics.append(f"Looping detected: Node '{state.current_node}' revisited multiple times without progress.")

        if norm_entropy >= self.entropy_unreliable_threshold:
            status = ReliabilityStatus.UNRELIABLE
            diagnostics.append(
                f"High decision entropy ({norm_entropy:.2f}): Policy is split across multiple diverging hallways/rooms."
            )
        elif norm_entropy >= self.entropy_caution_threshold:
            if status != ReliabilityStatus.UNRELIABLE:
                status = ReliabilityStatus.CAUTIOUS
            diagnostics.append(
                f"Moderate entropy ({norm_entropy:.2f}): Minor ambiguity among candidate headings."
            )

        if confidence < self.min_confidence_threshold:
            status = ReliabilityStatus.UNRELIABLE
            diagnostics.append(
                f"Low top-choice confidence ({confidence*100:.1f}%): No single candidate clearly satisfies instruction."
            )

        # If STOP action is chosen but destination landmarks are absent
        if decision.selected_action.action_type == "STOP" and target_landmarks:
            curr_lms = set(state.current_observation.detected_landmarks)
            matched = set(target_landmarks).intersection(curr_lms)
            if not matched and state.step < 3:
                status = ReliabilityStatus.UNRELIABLE
                diagnostics.append(
                    f"Premature STOP: Destination landmarks {target_landmarks} not confirmed in current room '{state.current_room}'."
                )

        if not diagnostics:
            diagnostic_msg = "Agent is reliable. Visual perception strongly aligns with instruction trajectory."
        else:
            diagnostic_msg = " | ".join(diagnostics)

        # Backtrack recommendation: find the last non-revisited checkpoint
        backtrack_node = None
        if status == ReliabilityStatus.UNRELIABLE and len(history) >= 2:
            # Recommend preceding distinct node
            for prev_n in reversed(history[:-1]):
                if prev_n != state.current_node:
                    backtrack_node = prev_n
                    break

        return ReliabilityReport(
            status=status,
            entropy=entropy,
            normalized_entropy=norm_entropy,
            confidence=confidence,
            semantic_dissonance=dissonance,
            is_looping=is_looping,
            diagnostic_message=diagnostic_msg,
            recommended_backtrack_node=backtrack_node
        )
