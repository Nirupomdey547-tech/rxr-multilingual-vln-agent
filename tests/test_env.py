import pytest
import math
from rxr_agent.env.graph_env import (
    ConnectivityGraph,
    Viewpoint,
    HeadingObservation,
    NavigationEnv,
    NavigationAction
)
from rxr_agent.env.environments_data import get_environment_by_id, list_available_environments
from rxr_agent.env.rxr_dataset import get_rxr_episodes


def test_connectivity_graph_shortest_path():
    graph = get_environment_by_id("house_seen_01")
    path = graph.shortest_path("seen1_foyer", "seen1_kitchen")
    assert len(path) >= 2
    assert path[0] == "seen1_foyer"
    assert path[-1] == "seen1_kitchen"

    geodesic_dist = graph.geodesic_distance("seen1_foyer", "seen1_kitchen")
    assert geodesic_dist > 0.0


def test_navigation_env_lifecycle():
    graph = get_environment_by_id("house_seen_01")
    env = NavigationEnv(graph, max_steps=10)

    # Reset
    state = env.reset("seen1_foyer", initial_heading=0.0)
    assert state.step == 0
    assert state.current_node == "seen1_foyer"
    assert len(state.trajectory_nodes) == 1
    assert not state.is_terminal

    # Candidate actions should have moves and STOP
    actions = state.available_actions
    assert len(actions) > 0
    assert any(a.action_type == "STOP" for a in actions)
    move_action = next(a for a in actions if a.action_type == "MOVE_TO_NODE")

    # Step move
    next_state, reward, done, info = env.step(NavigationAction(
        action_type="MOVE_TO_NODE",
        target_node_id=move_action.target_node_id,
        delta_heading=move_action.relative_heading
    ))
    assert next_state.step == 1
    assert next_state.current_node == move_action.target_node_id
    assert len(next_state.trajectory_nodes) == 2
    assert not done

    # Step stop
    final_state, reward, done, info = env.step(NavigationAction(action_type="STOP"))
    assert done
    assert final_state.is_terminal


def test_environments_and_dataset_integrity():
    envs = list_available_environments()
    assert len(envs) >= 4
    seen_envs = [e for e in envs if not e["is_unseen"]]
    unseen_envs = [e for e in envs if e["is_unseen"]]
    assert len(seen_envs) >= 2
    assert len(unseen_envs) >= 2

    episodes = get_rxr_episodes()
    assert len(episodes) >= 7
    for ep in episodes:
        assert "en" in ep.instructions
        assert "hi" in ep.instructions
        assert "te" in ep.instructions
        assert len(ep.reference_path) >= 2
