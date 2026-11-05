"""
Multimodal Cross-Attention Fusion module.
Fuses linguistic instructions with visual panoramic observations and agent state.
Provides word-level attention distributions for grounding visualization.
"""

from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Tuple, List
import numpy as np


@dataclass
class FusionOutput:
    fused_state: np.ndarray       # Shape: (embed_dim,)
    attended_text: np.ndarray     # Shape: (embed_dim,)
    word_attention_weights: np.ndarray # Shape: (seq_len,)
    word_tokens: List[str]


class MultimodalCrossAttention:
    """
    Computes cross-attention between current visual state (Query)
    and instruction token embeddings (Keys, Values).
    """
    def __init__(self, embed_dim: int = 64):
        self.embed_dim = embed_dim
        rng = np.random.RandomState(202)

        self.W_q = rng.randn(embed_dim, embed_dim).astype(np.float32) / math.sqrt(embed_dim)
        self.W_k = rng.randn(embed_dim, embed_dim).astype(np.float32) / math.sqrt(embed_dim)
        self.W_v = rng.randn(embed_dim, embed_dim).astype(np.float32) / math.sqrt(embed_dim)
        self.W_fuse = rng.randn(embed_dim * 2, embed_dim).astype(np.float32) / math.sqrt(embed_dim * 2)

    def fuse(
        self,
        visual_query: np.ndarray,          # (embed_dim,)
        token_embeddings: np.ndarray,      # (seq_len, embed_dim)
        word_tokens: List[str],
        progress_bias: float = 0.0         # Expected fraction through instruction [0, 1]
    ) -> FusionOutput:
        seq_len, d_model = token_embeddings.shape

        # Query projection
        Q = np.dot(visual_query, self.W_q) # (embed_dim,)
        # Keys and Values projection
        K = np.dot(token_embeddings, self.W_k) # (seq_len, embed_dim)
        V = np.dot(token_embeddings, self.W_v) # (seq_len, embed_dim)

        # Scaled dot-product scores
        scores = np.dot(K, Q) / math.sqrt(d_model) # (seq_len,)

        # Spatial-temporal progress prior:
        # As agent progresses, attention shifts smoothly from earlier tokens to later tokens
        token_progress = np.linspace(0.0, 1.0, seq_len)
        temporal_prior = -2.0 * ((token_progress - progress_bias) ** 2)
        adjusted_scores = scores + temporal_prior

        # Softmax over token sequence
        max_s = np.max(adjusted_scores)
        exp_s = np.exp(adjusted_scores - max_s)
        attn_weights = exp_s / (np.sum(exp_s) + 1e-7) # (seq_len,)

        # Attended textual context vector
        attended_text = np.dot(attn_weights, V) # (embed_dim,)

        # Multimodal fusion layer: concatenate visual query and attended text
        concat = np.concatenate([visual_query, attended_text])
        fused = np.dot(concat, self.W_fuse)
        fused = np.tanh(fused)
        norm = np.linalg.norm(fused) + 1e-7
        fused = fused / norm

        return FusionOutput(
            fused_state=fused,
            attended_text=attended_text,
            word_attention_weights=attn_weights,
            word_tokens=word_tokens
        )
