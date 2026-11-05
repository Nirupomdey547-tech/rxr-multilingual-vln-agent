import pytest
import numpy as np
from rxr_agent.env.graph_env import NavigationEnv
from rxr_agent.env.environments_data import get_environment_by_id
from rxr_agent.language.tokenizer import MultilingualTokenizer
from rxr_agent.language.multilingual_encoder import MultilingualEncoder
from rxr_agent.model.policy_network import VLNDecisionPolicy
from rxr_agent.model.uncertainty import UncertaintyEstimator, ReliabilityStatus


def test_agent_policy_decision():
    graph = get_environment_by_id("house_seen_01")
    env = NavigationEnv(graph)
    state = env.reset("seen1_foyer", initial_heading=0.0)

    tokenizer = MultilingualTokenizer()
    encoder = MultilingualEncoder(embed_dim=64)
    tokenized = tokenizer.tokenize("Walk straight down the hallway past the shoe rack", language="en")
    encoded = encoder.encode(tokenized)

    policy = VLNDecisionPolicy(embed_dim=64)
    decision = policy.evaluate_candidates(state=state, encoded_inst=encoded, current_progress=0.1)

    assert len(decision.probabilities) == len(state.available_actions)
    assert abs(sum(decision.probabilities) - 1.0) < 1e-4
    assert decision.selected_action is not None
    assert decision.fusion_output is not None

    # Attention weights over words should sum to 1.0
    attn_weights = decision.fusion_output.word_attention_weights
    assert abs(np.sum(attn_weights) - 1.0) < 1e-4


def test_uncertainty_estimator():
    estimator = UncertaintyEstimator()
    graph = get_environment_by_id("house_seen_01")
    env = NavigationEnv(graph)
    state = env.reset("seen1_foyer", initial_heading=0.0)

    tokenizer = MultilingualTokenizer()
    encoder = MultilingualEncoder(embed_dim=64)
    tokenized = tokenizer.tokenize("Walk straight down the hallway", language="en")
    encoded = encoder.encode(tokenized)

    policy = VLNDecisionPolicy(embed_dim=64)
    decision = policy.evaluate_candidates(state=state, encoded_inst=encoded, current_progress=0.1)

    rel_report = estimator.evaluate(state=state, decision=decision)

    assert rel_report.status in (ReliabilityStatus.RELIABLE, ReliabilityStatus.CAUTIOUS, ReliabilityStatus.UNRELIABLE)
    assert 0.0 <= rel_report.normalized_entropy <= 1.0
    assert 0.0 <= rel_report.confidence <= 1.0
    assert isinstance(rel_report.diagnostic_message, str)
