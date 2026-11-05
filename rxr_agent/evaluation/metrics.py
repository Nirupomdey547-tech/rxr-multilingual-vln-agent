"""
Official RxR VLN Benchmark Evaluation Metrics.
Implements:
- SR: Success Rate (<= 3.0m to goal)
- SPL: Success weighted by Path Length
- NE: Geodesic Navigation Error
- TL: Trajectory Length
- OSR: Oracle Success Rate
- nDTW: normalized Dynamic Time Warping (trajectory path fidelity)
- sDTW: Success weighted by Dynamic Time Warping
"""

from __future__ import annotations
import math
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import numpy as np

from ..env.graph_env import ConnectivityGraph


@dataclass
class EpisodeMetrics:
    episode_id: str
    language: str
    is_unseen: bool
    success: bool               # Final node within 3.0m of goal
    oracle_success: bool        # Any visited node within 3.0m
    navigation_error: float     # Meters from final node to goal
    trajectory_length: float    # Traversed path length in meters
    reference_length: float     # Ground truth path length in meters
    spl: float                  # Success weighted by Path Length [0, 1]
    dtw: float                  # Raw DTW cost
    ndtw: float                 # Normalized DTW score [0, 1]
    sdtw: float                 # Success weighted by DTW [0, 1]
    steps_taken: int
    unreliable_step_count: int  # Number of steps with unreliability alert


def compute_dtw_distance(
    agent_path: List[str],
    reference_path: List[str],
    graph: ConnectivityGraph
) -> float:
    """
    Computes standard Dynamic Time Warping (DTW) distance between
    the agent trajectory and ground-truth human demonstration.
    """
    M = len(agent_path)
    N = len(reference_path)
    if M == 0 or N == 0:
        return float('inf')

    # Cost matrix
    cost = np.zeros((M, N), dtype=np.float64)
    for i in range(M):
        for j in range(N):
            cost[i, j] = graph.get_euclidean_distance(agent_path[i], reference_path[j])

    # Accumulated cost matrix DP
    dp = np.full((M, N), float('inf'), dtype=np.float64)
    dp[0, 0] = cost[0, 0]

    for i in range(1, M):
        dp[i, 0] = dp[i-1, 0] + cost[i, 0]

    for j in range(1, N):
        dp[0, j] = dp[0, j-1] + cost[0, j]

    for i in range(1, M):
        for j in range(1, N):
            dp[i, j] = cost[i, j] + min(dp[i-1, j], dp[i, j-1], dp[i-1, j-1])

    return float(dp[M-1, N-1])


def compute_ndtw(
    agent_path: List[str],
    reference_path: List[str],
    graph: ConnectivityGraph,
    threshold: float = 3.0
) -> Tuple[float, float]:
    """
    Calculates normalized Dynamic Time Warping (nDTW) as defined in RxR:
    nDTW = exp( - DTW(P, R) / (threshold * len(R)) )
    Returns: (raw_dtw, ndtw)
    """
    dtw_val = compute_dtw_distance(agent_path, reference_path, graph)
    if math.isinf(dtw_val):
        return dtw_val, 0.0

    N = max(len(reference_path), 1)
    ndtw = math.exp(-dtw_val / (threshold * N))
    return dtw_val, float(np.clip(ndtw, 0.0, 1.0))


def evaluate_episode_metrics(
    episode_id: str,
    language: str,
    is_unseen: bool,
    agent_trajectory: List[str],
    reference_path: List[str],
    goal_node: str,
    graph: ConnectivityGraph,
    unreliable_steps: int = 0,
    success_threshold: float = 3.0
) -> EpisodeMetrics:
    final_node = agent_trajectory[-1] if agent_trajectory else ""

    # 1. Navigation Error (geodesic distance from final node to goal)
    nav_error = graph.geodesic_distance(final_node, goal_node) if final_node else float('inf')

    # 2. Success Criteria
    is_success = nav_error <= success_threshold

    # 3. Oracle Success Criteria (any node along trajectory within threshold)
    oracle_success = any(
        graph.geodesic_distance(node, goal_node) <= success_threshold
        for node in agent_trajectory
    )

    # 4. Trajectory lengths
    traj_len = 0.0
    for i in range(len(agent_trajectory) - 1):
        traj_len += graph.get_euclidean_distance(agent_trajectory[i], agent_trajectory[i+1])

    ref_len = 0.0
    for i in range(len(reference_path) - 1):
        ref_len += graph.get_euclidean_distance(reference_path[i], reference_path[i+1])

    # 5. SPL (Success weighted by Path Length)
    if is_success:
        spl = ref_len / max(traj_len, ref_len, 1e-4)
    else:
        spl = 0.0

    # 6. nDTW and sDTW
    dtw_val, ndtw_val = compute_ndtw(agent_trajectory, reference_path, graph, threshold=3.0)
    sdtw_val = (1.0 if is_success else 0.0) * ndtw_val

    return EpisodeMetrics(
        episode_id=episode_id,
        language=language,
        is_unseen=is_unseen,
        success=is_success,
        oracle_success=oracle_success,
        navigation_error=float(nav_error),
        trajectory_length=float(traj_len),
        reference_length=float(ref_len),
        spl=float(spl),
        dtw=float(dtw_val),
        ndtw=float(ndtw_val),
        sdtw=float(sdtw_val),
        steps_taken=max(len(agent_trajectory) - 1, 0),
        unreliable_step_count=unreliable_steps
    )


def aggregate_metrics(metrics_list: List[EpisodeMetrics]) -> Dict[str, float]:
    """Computes mean performance across a collection of evaluated episodes."""
    if not metrics_list:
        return {}

    N = len(metrics_list)
    return {
        "num_episodes": N,
        "sr": float(sum(1.0 for m in metrics_list if m.success) / N * 100.0),
        "osr": float(sum(1.0 for m in metrics_list if m.oracle_success) / N * 100.0),
        "spl": float(sum(m.spl for m in metrics_list) / N * 100.0),
        "ndtw": float(sum(m.ndtw for m in metrics_list) / N * 100.0),
        "sdtw": float(sum(m.sdtw for m in metrics_list) / N * 100.0),
        "mean_nav_error": float(sum(m.navigation_error for m in metrics_list) / N),
        "mean_trajectory_len": float(sum(m.trajectory_length for m in metrics_list) / N),
        "mean_steps": float(sum(m.steps_taken for m in metrics_list) / N),
        "unreliability_rate": float(sum(1.0 for m in metrics_list if m.unreliable_step_count > 0) / N * 100.0),
    }
