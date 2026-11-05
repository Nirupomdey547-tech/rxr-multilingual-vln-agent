import pytest
import numpy as np
from rxr_agent.language.tokenizer import MultilingualTokenizer
from rxr_agent.language.lexicon import get_canonical_concept
from rxr_agent.language.multilingual_encoder import MultilingualEncoder


def test_multilingual_tokenizer_scripts():
    tokenizer = MultilingualTokenizer()

    # English
    en_tok = tokenizer.tokenize("Walk straight past the table", language="en")
    assert len(en_tok.tokens) == 5
    assert en_tok.words[0] == "<bos>"
    assert en_tok.words[-1] == "<eos>"

    # Hindi (Devanagari)
    hi_tok = tokenizer.tokenize("सीधे चलें और मेज के पास रुकें", language="hi")
    assert len(hi_tok.tokens) == 7
    assert hi_tok.language == "hi"

    # Telugu (Telugu script)
    te_tok = tokenizer.tokenize("నేరుగా నడవండి మరియు బల్ల దగ్గర ఆగండి", language="te")
    assert len(te_tok.tokens) == 6
    assert te_tok.language == "te"


def test_cross_lingual_concept_mapping():
    # Left
    assert get_canonical_concept("left") == "DIR_LEFT"
    assert get_canonical_concept("बाएं") == "DIR_LEFT"
    assert get_canonical_concept("ఎడమవైపు") == "DIR_LEFT"

    # Right
    assert get_canonical_concept("right") == "DIR_RIGHT"
    assert get_canonical_concept("दाएं") == "DIR_RIGHT"
    assert get_canonical_concept("కుడివైపు") == "DIR_RIGHT"

    # Stop
    assert get_canonical_concept("stop") == "ACTION_STOP"
    assert get_canonical_concept("रुकें") == "ACTION_STOP"
    assert get_canonical_concept("ఆగండి") == "ACTION_STOP"

    # Kitchen
    assert get_canonical_concept("kitchen") == "ROOM_KITCHEN"
    assert get_canonical_concept("रसोई") == "ROOM_KITCHEN"
    assert get_canonical_concept("వంటగది") == "ROOM_KITCHEN"


def test_multilingual_encoder_similarity():
    tokenizer = MultilingualTokenizer()
    encoder = MultilingualEncoder(embed_dim=64)

    # Parallel instructions
    en_t = tokenizer.tokenize("Turn left into the kitchen and stop near the refrigerator", language="en")
    hi_t = tokenizer.tokenize("रसोई में बाईं ओर मुड़ें और फ्रिज के पास रुकें", language="hi")
    te_t = tokenizer.tokenize("వంటగదిలోకి ఎడమవైపు తిరిగి రిఫ్రిజిరేటర్ దగ్గర ఆగండి", language="te")

    en_enc = encoder.encode(en_t)
    hi_enc = encoder.encode(hi_t)
    te_enc = encoder.encode(te_t)

    assert en_enc.token_embeddings.shape[0] == len(en_t.words)
    assert en_enc.token_embeddings.shape[1] == 64

    # Cross-lingual cosine similarity should be substantially positive
    sim_en_hi = float(np.dot(en_enc.sentence_embedding, hi_enc.sentence_embedding))
    sim_en_te = float(np.dot(en_enc.sentence_embedding, te_enc.sentence_embedding))
    sim_hi_te = float(np.dot(hi_enc.sentence_embedding, te_enc.sentence_embedding))

    assert sim_en_hi > 0.4
    assert sim_en_te > 0.4
    assert sim_hi_te > 0.4
