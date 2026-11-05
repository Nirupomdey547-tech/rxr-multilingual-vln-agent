"""
Cross-lingual Lexicon and Semantic Concept Alignment for RxR VLN.
Maps lexical items across English, Hindi (Devanagari), and Telugu
to language-agnostic spatial concepts and object landmarks.
"""

from typing import Dict, Optional, Set

# Canonical concept -> set of surface forms across [en, hi, te]
MULTILINGUAL_LEXICON: Dict[str, Set[str]] = {
    # 1. Directions
    "DIR_LEFT": {
        "left", "leftward", "leftwards",
        "बाएं", "बाईं", "बायां", "बाई",
        "ఎడమ", "ఎడమవైపు", "ఎడమపక్క"
    },
    "DIR_RIGHT": {
        "right", "rightward", "rightwards",
        "दाएं", "दाईं", "दायां", "दाई",
        "కుడి", "కుడివైపు", "కుడిపక్క"
    },
    "DIR_FORWARD": {
        "forward", "straight", "ahead", "advance", "proceed", "along",
        "सीधे", "आगे", "बढ़ें", "चलें", "सामने",
        "ముందుకు", "నేరుగా", "సాగిపోండి", "నడవండి", "ముందు"
    },
    "ACTION_STOP": {
        "stop", "halt", "finish", "wait", "end",
        "रुकें", "रुक", "ठहरें", "समाप्त",
        "ఆగండి", "నిలబడండి", "ముగించండి"
    },
    "ACTION_TURN": {
        "turn", "head", "veer", "pivot",
        "मुड़ें", "घूमें", "मुड़",
        "తిరగండి", "మలుపు"
    },
    "ACTION_ENTER": {
        "enter", "step", "walk", "pass", "through",
        "प्रवेश", "जाएं", "गुजरें", "पार",
        "ప్రవేశించండి", "వెళ్ళండి", "దాటండి", "గుండా"
    },

    # 2. Rooms
    "ROOM_FOYER": {
        "foyer", "entrance", "entryway", "entry", "vestibule",
        "प्रवेश", "द्वार", "दहलीज़",
        "ప్రవేశ", "ద్వారం", "ఫోయర్"
    },
    "ROOM_HALLWAY": {
        "hallway", "corridor", "passage", "aisle",
        "गलियारे", "गलियारा", "रास्ता",
        "కారిడార్", "దారి", "వరండా"
    },
    "ROOM_LIVING": {
        "living", "lounge", "salon", "parlor",
        "लिविंग", "बैठक",
        "లివింగ్", "హాలు", "లాంజ్"
    },
    "ROOM_DINING": {
        "dining", "dinner",
        "भोजन", "डाइनिंग",
        "డైనింగ్", "భోజనాల"
    },
    "ROOM_KITCHEN": {
        "kitchen", "cookhouse",
        "रसोई", "रसोईघर",
        "వంటగది", "కిచెన్"
    },
    "ROOM_BEDROOM": {
        "bedroom", "bed", "suite",
        "बेडरूम", "शयनकक्ष", "कमरे",
        "బెడ్‌రూమ్", "పడుకునే", "గది"
    },
    "ROOM_BATHROOM": {
        "bathroom", "washroom", "restroom", "powder",
        "बाथरूम", "शौचालय", "स्नानघर",
        "బాత్రూమ్", "స్నానాల"
    },
    "ROOM_BALCONY": {
        "balcony", "terrace", "patio", "veranda", "deck",
        "बालकनी", "छत", "बरामदा",
        "బాల్కనీ", "టెర్రస్", "వరండా"
    },
    "ROOM_LIBRARY": {
        "library", "study", "office",
        "पुस्तकालय", "कार्यालय", "ऑफिस",
        "లైబ్రరీ", "ఆఫీస్", "గ్రంథాలయం"
    },
    "ROOM_STAIRS": {
        "stairs", "staircase", "landing", "steps",
        "सीढ़ियां", "सीढ़ियों", "सीढ़ी",
        "మెట్లు", "మెట్ల"
    },

    # 3. Key Landmarks
    "LM_REFRIGERATOR": {
        "refrigerator", "fridge", "freezer",
        "फ्रिज", "रेफ्रिजरेटर",
        "రిఫ్రిజిరేటర్", "ఫ్రిజ్"
    },
    "LM_SOFA": {
        "sofa", "couch", "sectional", "diwan", "armchair", "chairs",
        "सोफा", "सोफे", "कुर्सी", "कुर्सियों", "दीवान",
        "సోఫా", "కుర్చీ", "కుర్చీల", "దివాన్"
    },
    "LM_TABLE": {
        "table", "desk", "counter", "island", "vanity",
        "मेज", "टेबल", "काउंटर", "डेस्क", "बेसिन",
        "బల్ల", "టేబుల్", "కౌంటర్", "డెస్క్", "సింక్"
    },
    "LM_DOOR": {
        "door", "doors", "doorway", "archway", "threshold",
        "दरवाजा", "दरवाजे", "दरवाजों", "मेहराब",
        "తలుపు", "తలుపుల", "ద్వారం", "తోరణం"
    },
    "LM_PLANTS": {
        "plants", "planter", "garden", "flowers", "tree",
        "पौधों", "पौधे", "पेड़", "बगीचा",
        "మొక్కలు", "చెట్టు", "తోట"
    }
}

# Reverse lookup dictionary: surface form word -> canonical concept
WORD_TO_CONCEPT: Dict[str, str] = {}
for concept, words in MULTILINGUAL_LEXICON.items():
    for word in words:
        WORD_TO_CONCEPT[word.lower()] = concept


# Common agglutinative and postpositional suffixes in Telugu and Hindi
INFLECTION_SUFFIXES = [
    # Telugu postpositions and case markers
    "లోకి", "లోనికి", "లోని", "లో", "పైకి", "పై", "దగ్గర", "వద్ద", "ముందు", "నుండి", "గుండా", "వైపు", "కి", "కు", "న", "తో", "లు", "ల", "ను", "ని",
    # Hindi inflections
    "घर", "कक्ष", "शाला", "वाले", "वाली", "कर"
]


def get_canonical_concept(word: str) -> Optional[str]:
    """
    Retrieves canonical concept ID for an English, Hindi, or Telugu word.
    Handles exact lexical lookup and morphological/agglutinative suffix stripping.
    """
    w = word.lower().strip()
    if w in WORD_TO_CONCEPT:
        return WORD_TO_CONCEPT[w]

    # Morphological stemming for agglutinative Telugu and compound Hindi words
    for suffix in INFLECTION_SUFFIXES:
        if w.endswith(suffix) and len(w) > len(suffix) + 1:
            stem = w[:-len(suffix)].strip("’'- ")
            if stem in WORD_TO_CONCEPT:
                return WORD_TO_CONCEPT[stem]

    # Prefix stem matching
    for base_word, concept in WORD_TO_CONCEPT.items():
        if len(base_word) >= 3 and w.startswith(base_word):
            return concept

    return None
