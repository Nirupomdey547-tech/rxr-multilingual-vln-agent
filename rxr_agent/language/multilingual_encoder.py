"""
Multilingual Text Encoder for RxR Instructions.
Maps English, Hindi, and Telugu token sequences into a unified cross-lingual
semantic vector space with positional encoding and multi-head self-attention.
"""

from __future__ import annotations
import math
import hashlib
from dataclasses import dataclass
from typing import List, Dict, Optional
import numpy as np

from .tokenizer import TokenizedInstruction, Token
from .lexicon import get_canonical_concept, MULTILINGUAL_LEXICON


@dataclass
class EncodedInstruction:
    raw_text: str
    language: str
    tokens: List[str]
    token_embeddings: np.ndarray  # Shape: (seq_len, embed_dim)
    sentence_embedding: np.ndarray # Shape: (embed_dim,)
    canonical_concepts: List[Optional[str]]


def _get_sinusoidal_positional_encoding(seq_len: int, d_model: int) -> np.ndarray:
    """Generates standard sinusoidal positional encoding."""
    pe = np.zeros((seq_len, d_model), dtype=np.float32)
    position = np.arange(0, seq_len)[:, np.newaxis]
    div_term = np.exp(np.arange(0, d_model, 2) * -(math.log(10000.0) / d_model))
    pe[:, 0::2] = np.sin(position * div_term)
    pe[:, 1::2] = np.cos(position * div_term)
    return pe


class MultilingualEncoder:
    """
    Cross-lingual encoder that aligns English, Hindi, and Telugu navigation instructions.
    Uses shared conceptual space + self-attention to contextualize navigational actions.
    """
    def __init__(self, embed_dim: int = 64, num_heads: int = 4):
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.concept_embeddings: Dict[str, np.ndarray] = self._init_concept_embeddings()

        # Deterministic projection weights for self-attention
        rng = np.random.RandomState(42)
        self.W_q = rng.randn(embed_dim, embed_dim).astype(np.float32) / math.sqrt(embed_dim)
        self.W_k = rng.randn(embed_dim, embed_dim).astype(np.float32) / math.sqrt(embed_dim)
        self.W_v = rng.randn(embed_dim, embed_dim).astype(np.float32) / math.sqrt(embed_dim)
        self.W_o = rng.randn(embed_dim, embed_dim).astype(np.float32) / math.sqrt(embed_dim)

    def _init_concept_embeddings(self) -> Dict[str, np.ndarray]:
        """Precomputes language-agnostic vectors for all spatial and landmark concepts."""
        embeddings = {}
        for idx, concept in enumerate(MULTILINGUAL_LEXICON.keys()):
            seed = int.from_bytes(hashlib.md5(concept.encode('utf-8')).digest()[:4], 'little')
            rng = np.random.RandomState(seed)
            vec = rng.randn(self.embed_dim).astype(np.float32)
            norm = np.linalg.norm(vec) + 1e-7
            embeddings[concept] = vec / norm
        return embeddings

    def _word_to_embedding(self, word: str) -> np.ndarray:
        """Embeds a single word into the shared semantic space."""
        concept = get_canonical_concept(word)
        if concept and concept in self.concept_embeddings:
            return self.concept_embeddings[concept].copy()

        # Out-of-lexicon or general function words
        seed = int.from_bytes(hashlib.sha256(word.encode('utf-8')).digest()[:4], 'little')
        rng = np.random.RandomState(seed)
        vec = rng.randn(self.embed_dim).astype(np.float32) * 0.4
        norm = np.linalg.norm(vec) + 1e-7
        return (vec / norm) * 0.5

    def _self_attention(self, X: np.ndarray) -> np.ndarray:
        """
        Scaled dot-product multi-head self-attention:
        Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V
        """
        seq_len, d_model = X.shape
        d_k = d_model // self.num_heads

        Q = np.dot(X, self.W_q)
        K = np.dot(X, self.W_k)
        V = np.dot(X, self.W_v)

        # Multi-head reshape
        Q_heads = Q.reshape(seq_len, self.num_heads, d_k).swapaxes(0, 1) # (H, L, d_k)
        K_heads = K.reshape(seq_len, self.num_heads, d_k).swapaxes(0, 1)
        V_heads = V.reshape(seq_len, self.num_heads, d_k).swapaxes(0, 1)

        # Scores: (H, L, L)
        scores = np.matmul(Q_heads, K_heads.swapaxes(-1, -2)) / math.sqrt(d_k)
        # Softmax along last dimension
        exp_scores = np.exp(scores - np.max(scores, axis=-1, keepdims=True))
        attn_weights = exp_scores / (np.sum(exp_scores, axis=-1, keepdims=True) + 1e-7)

        # Context: (H, L, d_k)
        context = np.matmul(attn_weights, V_heads)
        context = context.swapaxes(0, 1).reshape(seq_len, d_model)

        # Output projection and residual connection + LayerNorm
        out = np.dot(context, self.W_o) + X
        mean = np.mean(out, axis=-1, keepdims=True)
        std = np.std(out, axis=-1, keepdims=True) + 1e-6
        return (out - mean) / std

    def encode(self, tokenized: TokenizedInstruction) -> EncodedInstruction:
        tokens = tokenized.words
        seq_len = len(tokens)

        # 1. Base token embeddings
        raw_embeds = np.zeros((seq_len, self.embed_dim), dtype=np.float32)
        concepts = []
        for i, word in enumerate(tokens):
            raw_embeds[i] = self._word_to_embedding(word)
            concepts.append(get_canonical_concept(word))

        # 2. Add sinusoidal positional encoding
        pe = _get_sinusoidal_positional_encoding(seq_len, self.embed_dim)
        X = raw_embeds + pe * 0.3

        # 3. Contextual self-attention
        contextual_embeds = self._self_attention(X)

        # 4. Global sentence pooled embedding
        sentence_vec = np.mean(contextual_embeds, axis=0)
        sentence_norm = np.linalg.norm(sentence_vec) + 1e-7
        sentence_vec = sentence_vec / sentence_norm

        return EncodedInstruction(
            raw_text=tokenized.raw_text,
            language=tokenized.language,
            tokens=tokens,
            token_embeddings=contextual_embeds,
            sentence_embedding=sentence_vec,
            canonical_concepts=concepts
        )
