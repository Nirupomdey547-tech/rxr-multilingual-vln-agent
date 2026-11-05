"""
Visual & Directional Heading Encoder for panoramic observations and candidate actions.
Projects 3D spatial orientations and visual landmark cues into the multimodal latent space.
"""

from __future__ import annotations
import math
import hashlib
from typing import List, Dict, Optional
import numpy as np
from ..env.graph_env import CandidateAction, HeadingObservation
from ..language.lexicon import MULTILINGUAL_LEXICON, get_canonical_concept


def get_room_canonical_concept(room_type: str) -> str:
    direct = get_canonical_concept(room_type)
    if direct and direct.startswith("ROOM_"):
        return direct
    r = room_type.lower()
    if "kitchen" in r:
        return "ROOM_KITCHEN"
    if "dining" in r:
        return "ROOM_DINING"
    if "living" in r or "lounge" in r:
        return "ROOM_LIVING"
    if any(k in r for k in ["balcony", "terrace", "deck", "veranda"]):
        return "ROOM_BALCONY"
    if "bed" in r:
        return "ROOM_BEDROOM"
    if "bath" in r or "powder" in r:
        return "ROOM_BATHROOM"
    if any(k in r for k in ["library", "office", "study"]):
        return "ROOM_LIBRARY"
    if any(k in r for k in ["foyer", "vestibule", "entrance", "elevator"]):
        return "ROOM_FOYER"
    if any(k in r for k in ["hallway", "corridor", "gallery"]):
        return "ROOM_HALLWAY"
    if "stairs" in r:
        return "ROOM_STAIRS"
    return "ROOM_HALLWAY"


def get_heading_concept(rel_heading: float) -> str:
    # rel_heading in [-180, 180]
    if -35.0 <= rel_heading <= 35.0:
        return "DIR_FORWARD"
    elif 35.0 < rel_heading <= 145.0:
        return "DIR_RIGHT"
    elif -145.0 <= rel_heading < -35.0:
        return "DIR_LEFT"
    else:
        return "DIR_FORWARD"


def get_landmark_concept(lm_name: str) -> Optional[str]:
    direct = get_canonical_concept(lm_name)
    if direct and direct.startswith("LM_"):
        return direct
    lm = lm_name.lower()
    if any(k in lm for k in ["refrigerator", "fridge"]):
        return "LM_REFRIGERATOR"
    if any(k in lm for k in ["sofa", "couch", "sectional", "diwan", "chair"]):
        return "LM_SOFA"
    if any(k in lm for k in ["table", "desk", "counter", "island", "vanity"]):
        return "LM_TABLE"
    if any(k in lm for k in ["door", "arch", "entrance"]):
        return "LM_DOOR"
    if any(k in lm for k in ["plant", "tree", "garden"]):
        return "LM_PLANTS"
    return None


class VisualHeadingEncoder:
    """
    Encodes visual observation features, spatial directional angles,
    and candidate action representations into dimension D.
    """
    def __init__(self, in_visual_dim: int = 64, embed_dim: int = 64, concept_embeddings: Optional[Dict[str, np.ndarray]] = None):
        self.in_visual_dim = in_visual_dim
        self.embed_dim = embed_dim

        # Load or generate shared concept embeddings
        if concept_embeddings is not None:
            self.concept_embeddings = concept_embeddings
        else:
            self.concept_embeddings = {}
            for concept in MULTILINGUAL_LEXICON.keys():
                seed = int.from_bytes(hashlib.md5(concept.encode('utf-8')).digest()[:4], 'little')
                rng = np.random.RandomState(seed)
                vec = rng.randn(embed_dim).astype(np.float32)
                self.concept_embeddings[concept] = vec / (np.linalg.norm(vec) + 1e-7)

        rng = np.random.RandomState(101)
        self.W_vis = rng.randn(in_visual_dim, embed_dim).astype(np.float32) / math.sqrt(in_visual_dim)
        in_cand_dim = in_visual_dim + 4
        self.W_cand = rng.randn(in_cand_dim, embed_dim).astype(np.float32) / math.sqrt(in_cand_dim)

    def encode_observation(self, obs: HeadingObservation) -> np.ndarray:
        """Projects current directional view observation to embed_dim."""
        feat = np.dot(obs.feature_vector, self.W_vis)
        # Blend landmark concept embeddings
        lm_vec = np.zeros(self.embed_dim, dtype=np.float32)
        for lm in obs.detected_landmarks:
            c = get_landmark_concept(lm)
            if c and c in self.concept_embeddings:
                lm_vec += self.concept_embeddings[c]
        combined = feat * 0.7 + lm_vec * 0.3
        norm = np.linalg.norm(combined) + 1e-7
        return combined / norm

    def encode_candidates(self, candidates: List[CandidateAction]) -> np.ndarray:
        """
        Encodes list of K candidate actions into matrix of shape (K, embed_dim).
        Semantically binds spatial directional angles, room taxonomies, and landmarks.
        """
        K = len(candidates)
        if K == 0:
            return np.zeros((0, self.embed_dim), dtype=np.float32)

        cand_vectors = np.zeros((K, self.embed_dim), dtype=np.float32)
        for i, cand in enumerate(candidates):
            if cand.action_type == "STOP":
                stop_vec = self.concept_embeddings.get("ACTION_STOP", np.zeros(self.embed_dim, dtype=np.float32))
                room_c = get_room_canonical_concept(cand.target_room_type)
                room_vec = self.concept_embeddings.get(room_c, np.zeros(self.embed_dim, dtype=np.float32))
                lm_vec = np.zeros(self.embed_dim, dtype=np.float32)
                for lm in cand.target_landmarks:
                    c = get_landmark_concept(lm)
                    if c and c in self.concept_embeddings:
                        lm_vec += self.concept_embeddings[c]
                vec = stop_vec * 0.6 + room_vec * 0.2 + lm_vec * 0.2
            else:
                dir_c = get_heading_concept(cand.relative_heading)
                dir_vec = self.concept_embeddings.get(dir_c, np.zeros(self.embed_dim, dtype=np.float32))
                room_c = get_room_canonical_concept(cand.target_room_type)
                room_vec = self.concept_embeddings.get(room_c, np.zeros(self.embed_dim, dtype=np.float32))
                lm_vec = np.zeros(self.embed_dim, dtype=np.float32)
                for lm in cand.target_landmarks:
                    c = get_landmark_concept(lm)
                    if c and c in self.concept_embeddings:
                        lm_vec += self.concept_embeddings[c]
                # Visual projection
                vis_proj = np.dot(cand.feature_vector[:self.in_visual_dim], self.W_vis)
                vis_norm = vis_proj / (np.linalg.norm(vis_proj) + 1e-7)
                vec = dir_vec * 0.35 + room_vec * 0.35 + lm_vec * 0.15 + vis_norm * 0.15

            norm = np.linalg.norm(vec) + 1e-7
            cand_vectors[i] = vec / norm

        return cand_vectors
