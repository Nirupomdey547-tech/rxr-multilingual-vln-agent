import pytest
from rxr_agent.env.environments_data import get_environment_by_id
from rxr_agent.evaluation.metrics import (
    compute_dtw_distance,
    compute_ndtw,
    evaluate_episode_metrics,
    aggregate_metrics
)


def test_dtw_and_ndtw_identical_path():
    graph = get_environment_by_id("house_seen_01")
    path = ["seen1_foyer", "seen1_hallway", "seen1_dining", "seen1_kitchen"]

    # Identical path should have DTW = 0 and nDTW = 1.0
    dtw_val, ndtw_val = compute_ndtw(path, path, graph)
    assert dtw_val == 0.0
    assert abs(ndtw_val - 1.0) < 1e-4


def test_dtw_divergent_path():
    graph = get_environment_by_id("house_seen_01")
    path_a = ["seen1_foyer", "seen1_hallway", "seen1_dining"]
    path_b = ["seen1_foyer", "seen1_hallway", "seen1_stairs", "seen1_master_bed"]

    dtw_val, ndtw_val = compute_ndtw(path_a, path_b, graph)
    assert dtw_val > 0.0
    assert 0.0 <= ndtw_val < 1.0


def test_evaluate_episode_metrics():
    graph = get_environment_by_id("house_seen_01")
    ref_path = ["seen1_foyer", "seen1_hallway", "seen1_dining", "seen1_kitchen"]
    goal_node = "seen1_kitchen"

    metrics = evaluate_episode_metrics(
        episode_id="test_ep01",
        language="en",
        is_unseen=False,
        agent_trajectory=ref_path,
        reference_path=ref_path,
        goal_node=goal_node,
        graph=graph
    )

    assert metrics.success is True
    assert metrics.navigation_error == 0.0
    assert abs(metrics.spl - 1.0) < 1e-4
    assert abs(metrics.ndtw - 1.0) < 1e-4
    assert abs(metrics.sdtw - 1.0) < 1e-4


def test_aggregate_metrics():
    graph = get_environment_by_id("house_seen_01")
    ref = ["seen1_foyer", "seen1_hallway", "seen1_kitchen"]
    m1 = evaluate_episode_metrics("ep1", "en", False, ref, ref, "seen1_kitchen", graph)
    m2 = evaluate_episode_metrics("ep2", "en", False, ["seen1_foyer"], ref, "seen1_kitchen", graph)

    agg = aggregate_metrics([m1, m2])
    assert agg["num_episodes"] == 2
    assert agg["sr"] == 50.0 # 1 out of 2
    assert 0.0 <= agg["spl"] <= 100.0
