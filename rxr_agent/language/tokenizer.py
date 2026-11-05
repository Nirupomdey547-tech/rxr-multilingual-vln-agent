"""
Multilingual Tokenizer supporting Latin, Devanagari (Hindi), and Telugu scripts.
Preserves word bounds for cross-modal attention visualization.
"""

from __future__ import annotations
import re
import unicodedata
from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class Token:
    text: str
    original_word: str
    token_id: int
    start_char: int
    end_char: int


@dataclass
class TokenizedInstruction:
    raw_text: str
    language: str
    tokens: List[Token]
    token_ids: List[int]
    words: List[str]


class MultilingualTokenizer:
    """
    Tokenizer designed for Vision-and-Language Navigation in English, Hindi, and Telugu.
    Normalizes Unicode (NFC), handles punctuation (including Devanagari danda '।'),
    and manages token-to-word alignment for heatmap visualization.
    """
    def __init__(self, vocab: Optional[Dict[str, int]] = None):
        self.vocab: Dict[str, int] = vocab if vocab is not None else {
            "<pad>": 0,
            "<unk>": 1,
            "<bos>": 2,
            "<eos>": 3,
        }
        self.inv_vocab: Dict[int, str] = {idx: token for token, idx in self.vocab.items()}

    def _clean_and_split(self, text: str) -> List[tuple[str, int, int]]:
        """Splits text into words while keeping track of character spans."""
        # Normalize Unicode
        text = unicodedata.normalize("NFC", text)
        # Matches word tokens across Latin, Devanagari, Telugu scripts excluding punctuation/whitespace
        pattern = re.compile(r'[^\s\.,!?;:।॥"“”‘’\'\(\)\[\]{}—–\-]+')
        matches = []
        for match in pattern.finditer(text):
            word = match.group(0).lower()
            matches.append((word, match.start(), match.end()))
        return matches

    def tokenize(self, text: str, language: str = "en") -> TokenizedInstruction:
        raw_words = self._clean_and_split(text)
        tokens: List[Token] = []
        token_ids: List[int] = [self.vocab["<bos>"]]
        words_list: List[str] = ["<bos>"]

        for word, s_idx, e_idx in raw_words:
            if word not in self.vocab:
                # Add to vocab dynamically if not present
                new_id = len(self.vocab)
                self.vocab[word] = new_id
                self.inv_vocab[new_id] = word

            t_id = self.vocab[word]
            token = Token(
                text=word,
                original_word=word,
                token_id=t_id,
                start_char=s_idx,
                end_char=e_idx
            )
            tokens.append(token)
            token_ids.append(t_id)
            words_list.append(word)

        token_ids.append(self.vocab["<eos>"])
        words_list.append("<eos>")

        return TokenizedInstruction(
            raw_text=text,
            language=language,
            tokens=tokens,
            token_ids=token_ids,
            words=words_list
        )

    def decode(self, token_ids: List[int]) -> str:
        words = []
        for tid in token_ids:
            if tid in self.inv_vocab and self.inv_vocab[tid] not in ("<pad>", "<bos>", "<eos>"):
                words.append(self.inv_vocab[tid])
        return " ".join(words)
