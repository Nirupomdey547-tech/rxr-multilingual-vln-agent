"""
Multilingual RxR Dataset containing parallel path-aligned instructions
in English (en), Hindi (hi), and Telugu (te) across Seen and Unseen environments.
Mapped to Google Research's Room-Across-Room (RxR) Challenge formulation.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from .graph_env import ConnectivityGraph
from .environments_data import get_environment_by_id


@dataclass
class MultilingualInstruction:
    language: str               # 'en', 'hi', 'te'
    full_text: str              # Full natural language navigation prompt
    tokens: List[str] = field(default_factory=list) # Pre-segmented token sequence
    subgoal_descriptions: List[str] = field(default_factory=list) # Waypoint step descriptions


@dataclass
class RxREpisode:
    episode_id: str
    env_id: str
    is_unseen: bool
    start_node: str
    initial_heading: float
    goal_node: str
    reference_path: List[str]   # Ground truth human demonstration trajectory
    target_landmarks: List[str] # Key landmarks to recognize at final destination
    instructions: Dict[str, MultilingualInstruction] # 'en', 'hi', 'te'

    def get_instruction(self, lang: str = "en") -> MultilingualInstruction:
        if lang in self.instructions:
            return self.instructions[lang]
        return self.instructions.get("en", list(self.instructions.values())[0])

    def get_reference_distance(self, graph: ConnectivityGraph) -> float:
        """Calculates cumulative ground-truth distance in meters."""
        total = 0.0
        for i in range(len(self.reference_path) - 1):
            total += graph.get_euclidean_distance(self.reference_path[i], self.reference_path[i+1])
        return total


# ==============================================================================
# RxR EPISODES DATASET (Parallel English, Hindi, Telugu)
# ==============================================================================

RXR_EPISODES: List[RxREpisode] = [
    # --------------------------------------------------------------------------
    # EPISODE 1: Seen House 01 (Foyer -> Hallway -> Dining -> Kitchen)
    # --------------------------------------------------------------------------
    RxREpisode(
        episode_id="rxr_seen1_ep01",
        env_id="house_seen_01",
        is_unseen=False,
        start_node="seen1_foyer",
        initial_heading=0.0,
        goal_node="seen1_kitchen",
        reference_path=["seen1_foyer", "seen1_hallway", "seen1_dining", "seen1_kitchen"],
        target_landmarks=["refrigerator", "island_counter", "gas_stove"],
        instructions={
            "en": MultilingualInstruction(
                language="en",
                full_text="Start in the entrance foyer facing forward. Walk straight down the hallway past the shoe rack. Turn right into the dining room through the archway. Pass the wooden dining table and walk straight into the kitchen. Stop in front of the stainless steel refrigerator.",
                subgoal_descriptions=[
                    "Exit foyer and walk straight along hallway",
                    "Turn right into dining room",
                    "Proceed past dining table into kitchen",
                    "Stop at refrigerator"
                ]
            ),
            "hi": MultilingualInstruction(
                language="hi",
                full_text="प्रवेश द्वार से शुरू करें और सामने देखें। जूते के रैक के पास से सीधे गलियारे में चलें। मेहराब से होकर दाईं ओर भोजन कक्ष में मुड़ें। लकड़ी की भोजन मेज के पास से गुजरें और सीधे रसोई में जाएं। स्टेनलेस स्टील के फ्रिज के सामने रुकें।",
                subgoal_descriptions=[
                    "प्रवेश द्वार से गलियारे में सीधे बढ़ें",
                    "दाईं ओर भोजन कक्ष में मुड़ें",
                    "मेज को पार कर रसोई में जाएं",
                    "फ्रिज के पास रुकें"
                ]
            ),
            "te": MultilingualInstruction(
                language="te",
                full_text="ముందు చూస్తూ ప్రవేశ ద్వారం వద్ద ప్రారంభించండి. షూ రాక్ దాటి నేరుగా కారిడార్‌లో ముందుకు నడవండి. తోరణం గుండా కుడివైపు తిరిగి డైనింగ్ గదిలోకి వెళ్ళండి. చెక్క భోజనాల బల్ల దాటి నేరుగా వంటగదిలోకి వెళ్ళండి. స్టెయిన్‌లెస్ స్టీల్ రిఫ్రిజిరేటర్ ముందు ఆగండి.",
                subgoal_descriptions=[
                    "కారిడార్ గుండా నేరుగా నడవండి",
                    "కుడివైపు తిరిగి డైనింగ్ గదికి వెళ్ళండి",
                    "భోజనాల బల్ల దాటి వంటగదికి వెళ్ళండి",
                    "ఫ్రిజ్ ముందు ఆగండి"
                ]
            )
        }
    ),

    # --------------------------------------------------------------------------
    # EPISODE 2: Seen House 01 (Foyer -> Hallway -> Living -> Balcony)
    # --------------------------------------------------------------------------
    RxREpisode(
        episode_id="rxr_seen1_ep02",
        env_id="house_seen_01",
        is_unseen=False,
        start_node="seen1_foyer",
        initial_heading=0.0,
        goal_node="seen1_balcony",
        reference_path=["seen1_foyer", "seen1_hallway", "seen1_living", "seen1_balcony"],
        target_landmarks=["potted_plants", "wicker_chairs", "railing"],
        instructions={
            "en": MultilingualInstruction(
                language="en",
                full_text="Begin at the front entrance. Move forward through the hallway. Walk straight ahead into the spacious living room past the gray sofa. Continue forward through the sliding glass doors onto the balcony. Stop next to the outdoor wicker armchairs.",
                subgoal_descriptions=[
                    "Move along hallway",
                    "Pass through living room near gray sofa",
                    "Step out sliding glass doors to balcony",
                    "Stop at wicker chairs"
                ]
            ),
            "hi": MultilingualInstruction(
                language="hi",
                full_text="मुख्य प्रवेश द्वार से शुरू करें। गलियारे से होते हुए सीधे आगे बढ़ें। भूरे सोफे के पास से गुजरते हुए बड़े लिविंग रूम में सीधे जाएं। कांच के सरकने वाले दरवाजों से होकर बालकनी में आगे बढ़ें। बाहर रखी बेंत की कुर्सियों के पास रुकें।",
                subgoal_descriptions=[
                    "गलियारे में आगे बढ़ें",
                    "लिविंग रूम में सोफे के पास से निकलें",
                    "कांच के दरवाजे से बालकनी में जाएं",
                    "बेंत की कुर्सियों के पास रुकें"
                ]
            ),
            "te": MultilingualInstruction(
                language="te",
                full_text="ప్రధాన ద్వారం వద్ద ప్రారంభించండి. కారిడార్ గుండా ముందుకు సాగండి. బూడిద రంగు సోఫా దాటి విశాలమైన లివింగ్ రూమ్‌లోకి నేరుగా వెళ్ళండి. స్లైడింగ్ గాజు తలుపుల గుండా బాల్కనీలోకి ముందుకు నడవండి. బయట ఉన్న తోలు కుర్చీల పక్కన ఆగండి.",
                subgoal_descriptions=[
                    "కారిడార్‌లో ముందుకు సాగండి",
                    "సోఫా దాటి లివింగ్ రూమ్‌లోకి వెళ్ళండి",
                    "గాజు తలుపుల గుండా బాల్కనీకి చేరుకోండి",
                    "కుర్చీల పక్కన ఆగండి"
                ]
            )
        }
    ),

    # --------------------------------------------------------------------------
    # EPISODE 3: Seen House 01 (Foyer -> Hallway -> Stairs -> Master Bedroom -> Bathroom)
    # --------------------------------------------------------------------------
    RxREpisode(
        episode_id="rxr_seen1_ep03",
        env_id="house_seen_01",
        is_unseen=False,
        start_node="seen1_foyer",
        initial_heading=0.0,
        goal_node="seen1_bathroom",
        reference_path=["seen1_foyer", "seen1_hallway", "seen1_stairs", "seen1_master_bed", "seen1_bathroom"],
        target_landmarks=["marble_vanity", "shower_cabin", "sink"],
        instructions={
            "en": MultilingualInstruction(
                language="en",
                full_text="Start from the entrance. Advance to the hallway and take an immediate left to the wooden staircase. Climb the stairs up to the landing. Enter the master bedroom and walk past the king size bed. Open the en-suite door and step into the bathroom. Stop at the marble vanity sink.",
                subgoal_descriptions=[
                    "Reach hallway and turn left to stairs",
                    "Climb staircase to landing",
                    "Enter master bedroom and pass king bed",
                    "Enter bathroom and stop at marble vanity"
                ]
            ),
            "hi": MultilingualInstruction(
                language="hi",
                full_text="प्रवेश द्वार से शुरू करें। गलियारे तक पहुंचे और लकड़ी की सीढ़ियों की ओर तुरंत बाईं ओर मुड़ें। सीढ़ियों से ऊपर लैंडिंग पर चढ़ें। मास्टर बेडरूम में प्रवेश करें और बड़े बिस्तर के पास से चलें। अंदर के दरवाजे से बाथरूम में जाएं। संगमरमर के वॉशबेसिन के पास रुकें।",
                subgoal_descriptions=[
                    "गलियारे से बाईं ओर सीढ़ियों की ओर जाएं",
                    "सीढ़ियां चढ़ें",
                    "मास्टर बेडरूम में बिस्तर के पास से जाएं",
                    "बाथरूम में संगमरमर के बेसिन पर रुकें"
                ]
            ),
            "te": MultilingualInstruction(
                language="te",
                full_text="ప్రవేశ ద్వారం నుండి ప్రారంభించండి. కారిడార్‌కు చేరుకుని వెంటనే ఎడమవైపు ఉన్న చెక్క మెట్ల వైపు తిరగండి. మెట్లు ఎక్కి పైకి వెళ్ళండి. మాస్టర్ బెడ్‌రూమ్‌లోకి ప్రవేశించి పెద్ద మంచం దాటి నడవండి. బాత్రూమ్ తలుపు తెరిచి లోపలికి అడుగు పెట్టండి. మార్బుల్ సింక్ వద్ద ఆగండి.",
                subgoal_descriptions=[
                    "కారిడార్ నుండి ఎడమవైపు మెట్లకు వెళ్ళండి",
                    "మెట్లు ఎక్కి పైకి చేరుకోండి",
                    "బెడ్‌రూమ్‌లోకి ప్రవేశించి మంచం దాటండి",
                    "బాత్రూమ్‌లో మార్బుల్ సింక్ వద్ద ఆగండి"
                ]
            )
        }
    ),

    # --------------------------------------------------------------------------
    # EPISODE 4: Seen House 02 (Veranda -> Grand Foyer -> Library -> Tea Lounge)
    # --------------------------------------------------------------------------
    RxREpisode(
        episode_id="rxr_seen2_ep01",
        env_id="house_seen_02",
        is_unseen=False,
        start_node="seen2_veranda",
        initial_heading=0.0,
        goal_node="seen2_tea_lounge",
        reference_path=["seen2_veranda", "seen2_grand_foyer", "seen2_library", "seen2_tea_lounge"],
        target_landmarks=["diwan_bed", "tea_table", "stained_glass_window"],
        instructions={
            "en": MultilingualInstruction(
                language="en",
                full_text="Walk from the veranda through the carved wooden door into the grand foyer. Turn right into the library with high bookshelves. Walk past the leather reading chair and continue through the inner passage into the tea lounge. Stop beside the cushioned diwan daybed.",
                subgoal_descriptions=[
                    "Enter grand foyer from veranda",
                    "Turn right into library",
                    "Walk past leather chair into tea lounge",
                    "Stop beside diwan daybed"
                ]
            ),
            "hi": MultilingualInstruction(
                language="hi",
                full_text="बरामदे से नक्काशीदार लकड़ी के दरवाजे से होते हुए भव्य हॉल में जाएं। ऊंची किताबों की अलमारियों वाले पुस्तकालय में दाईं ओर मुड़ें। चमड़े की कुर्सी के पास से गुजरें और भीतरी रास्ते से चाय लाउंज में जाएं। गद्देदार दीवान के पास रुकें।",
                subgoal_descriptions=[
                    "बरामदे से हॉल में जाएं",
                    "पुस्तकालय में दाईं ओर मुड़ें",
                    "कुर्सी के पास से चाय लाउंज में जाएं",
                    "दीवान के पास रुकें"
                ]
            ),
            "te": MultilingualInstruction(
                language="te",
                full_text="వరండా నుండి చెక్కిన చెక్క తలుపు గుండా గ్రాండ్ ఫోయర్‌లోకి నడవండి. పుస్తకాల అల్మారాలు ఉన్న లైబ్రరీలోకి కుడివైపు తిరగండి. తోలు కుర్చీ దాటి లోపలి దారి గుండా టీ లాంజ్‌లోకి వెళ్ళండి. కుషన్లు ఉన్న దివాన్ మంచం పక్కన ఆగండి.",
                subgoal_descriptions=[
                    "ఫోయర్‌లోకి ప్రవేశించండి",
                    "కుడివైపు లైబ్రరీలోకి వెళ్ళండి",
                    "కుర్చీ దాటి టీ లాంజ్‌కు వెళ్ళండి",
                    "దివాన్ పక్కన ఆగండి"
                ]
            )
        }
    ),

    # --------------------------------------------------------------------------
    # EPISODE 5: Unseen House 01 (Vestibule -> Corridor -> Open Kitchen -> Lounge -> Terrace)
    # ZERO-SHOT GENERALIZATION TEST
    # --------------------------------------------------------------------------
    RxREpisode(
        episode_id="rxr_unseen1_ep01",
        env_id="house_unseen_01",
        is_unseen=True,
        start_node="unseen1_vestibule",
        initial_heading=0.0,
        goal_node="unseen1_terrace",
        reference_path=["unseen1_vestibule", "unseen1_corridor", "unseen1_kitchen", "unseen1_lounge", "unseen1_terrace"],
        target_landmarks=["bistro_table", "glass_balustrade", "city_skyline"],
        instructions={
            "en": MultilingualInstruction(
                language="en",
                full_text="Start at the entry vestibule facing down the hallway. Walk straight down the corridor past the office door. Continue into the open concept kitchen passing the marble breakfast counter on your right. Proceed forward into the media lounge past the velvet couch. Exit through the sliding glass doors onto the private terrace and stop at the bistro table.",
                subgoal_descriptions=[
                    "Walk down corridor past office door",
                    "Enter open kitchen past marble counter",
                    "Move through media lounge past couch",
                    "Step onto terrace and stop at bistro table"
                ]
            ),
            "hi": MultilingualInstruction(
                language="hi",
                full_text="प्रवेश कक्ष से गलियारे की ओर मुंह करके शुरू करें। कार्यालय के दरवाजे के पास से गलियारे में सीधे चलें। अपने दाहिने हाथ पर संगमरमर के काउंटर के पास से खुली रसोई में जाएं। मखमली सोफे के पास से मीडिया लाउंज में आगे बढ़ें। कांच के दरवाजे से निजी छत पर बाहर निकलें और बिस्ट्रो टेबल पर रुकें।",
                subgoal_descriptions=[
                    "कार्यालय के पास से गलियारे में आगे बढ़ें",
                    "संगमरमर काउंटर के पास से रसोई में जाएं",
                    "सोफे के पास से लाउंज में जाएं",
                    "छत पर बिस्ट्रो टेबल के पास रुकें"
                ]
            ),
            "te": MultilingualInstruction(
                language="te",
                full_text="ప్రవేశ గది వద్ద ప్రారంభించి కారిడార్‌లో ముందుకు నడవండి. ఆఫీస్ తలుపు దాటి నేరుగా ముందుకు సాగండి. మీ కుడివైపున ఉన్న మార్బుల్ కౌంటర్ దాటి ఓపెన్ కిచెన్‌లోకి వెళ్ళండి. వెల్వెట్ సోఫా దాటి మీడియా లాంజ్‌లోకి ముందుకు నడవండి. స్లైడింగ్ గాజు తలుపుల గుండా ప్రైవేట్ టెర్రస్‌పైకి వెళ్లి బిస్ట్రో టేబుల్ వద్ద ఆగండి.",
                subgoal_descriptions=[
                    "కారిడార్ గుండా నేరుగా నడవండి",
                    "మార్బుల్ కౌంటర్ దాటి వంటగదికి వెళ్ళండి",
                    "సోఫా దాటి లాంజ్‌లోకి వెళ్ళండి",
                    "టెర్రస్‌పై బిస్ట్రో టేబుల్ వద్ద ఆగండి"
                ]
            )
        }
    ),

    # --------------------------------------------------------------------------
    # EPISODE 6: Unseen House 01 (Vestibule -> Corridor -> Home Office)
    # ZERO-SHOT SHORT PATH
    # --------------------------------------------------------------------------
    RxREpisode(
        episode_id="rxr_unseen1_ep02",
        env_id="house_unseen_01",
        is_unseen=True,
        start_node="unseen1_vestibule",
        initial_heading=0.0,
        goal_node="unseen1_office",
        reference_path=["unseen1_vestibule", "unseen1_corridor", "unseen1_office"],
        target_landmarks=["standing_desk", "dual_monitors", "ergonomic_chair"],
        instructions={
            "en": MultilingualInstruction(
                language="en",
                full_text="Begin at the front entryway. Walk forward into the corridor. At the first junction, make a sharp right turn through the open doorway into the home office. Stop right in front of the standing desk with dual monitors.",
                subgoal_descriptions=[
                    "Move from entryway into corridor",
                    "Turn right into home office",
                    "Stop in front of standing desk"
                ]
            ),
            "hi": MultilingualInstruction(
                language="hi",
                full_text="मुख्य प्रवेश द्वार से शुरू करें। गलियारे में आगे बढ़ें। पहले मोड़ पर खुले दरवाजे से दाईं ओर होम ऑफिस में मुड़ें। दोहरे मॉनिटर वाले स्टैंडिंग डेस्क के ठीक सामने रुकें।",
                subgoal_descriptions=[
                    "प्रवेश द्वार से गलियारे में जाएं",
                    "दाईं ओर होम ऑफिस में मुड़ें",
                    "स्टैंडिंग डेस्क के सामने रुकें"
                ]
            ),
            "te": MultilingualInstruction(
                language="te",
                full_text="ముందు ప్రవేశ ద్వారం వద్ద ప్రారంభించండి. కారిడార్‌లోకి ముందుకు నడవండి. మొదటి జంక్షన్ వద్ద కుడివైపునకు తిరిగి హోమ్ ఆఫీస్‌లోకి వెళ్ళండి. రెండు మానిటర్లు ఉన్న స్టాండింగ్ డెస్క్ ముందు సరిగ్గా ఆగండి.",
                subgoal_descriptions=[
                    "కారిడార్‌లోకి వెళ్ళండి",
                    "కుడివైపు తిరిగి హోమ్ ఆఫీస్‌కు చేరుకోండి",
                    "స్టాండింగ్ డెస్క్ వద్ద ఆగండి"
                ]
            )
        }
    ),

    # --------------------------------------------------------------------------
    # EPISODE 7: Unseen House 02 (Elevator -> Atrium -> Kitchen -> Roof Deck)
    # ZERO-SHOT PENTHOUSE
    # --------------------------------------------------------------------------
    RxREpisode(
        episode_id="rxr_unseen2_ep01",
        env_id="house_unseen_02",
        is_unseen=True,
        start_node="unseen2_elevator",
        initial_heading=0.0,
        goal_node="unseen2_roof_deck",
        reference_path=["unseen2_elevator", "unseen2_atrium", "unseen2_kitchen", "unseen2_roof_deck"],
        target_landmarks=["pergola", "outdoor_sofa", "fire_pit"],
        instructions={
            "en": MultilingualInstruction(
                language="en",
                full_text="Exit the elevator landing straight ahead into the glass atrium with the ficus tree. Continue straight through the broad opening into the chef kitchen. Pass the concrete waterfall island and go through the glass doors out onto the roof deck. Stop under the cedar pergola near the outdoor sofa.",
                subgoal_descriptions=[
                    "Enter atrium from elevator",
                    "Walk past ficus tree into chef kitchen",
                    "Walk past waterfall island through glass doors",
                    "Stop under pergola on roof deck"
                ]
            ),
            "hi": MultilingualInstruction(
                language="hi",
                full_text="लिफ्ट से सीधे अंजीर के पेड़ वाले कांच के आलिंद में निकलें। शेफ रसोई में चौड़े रास्ते से सीधे आगे बढ़ें। कंक्रीट के वाटरफॉल द्वीप के पास से गुजरें और कांच के दरवाजों से छत के डेक पर जाएं। देवदार के मंडप के नीचे सोफे के पास रुकें।",
                subgoal_descriptions=[
                    "लिफ्ट से आलिंद में प्रवेश करें",
                    "पेड़ के पास से शेफ रसोई में जाएं",
                    "द्वीप को पार कर छत के डेक पर निकलें",
                    "मंडप के नीचे सोफे के पास रुकें"
                ]
            ),
            "te": MultilingualInstruction(
                language="te",
                full_text="లిఫ్ట్ ల్యాండింగ్ నుండి నేరుగా అత్తి చెట్టు ఉన్న గాజు ఏట్రియమ్‌లోకి వెళ్ళండి. విశాలమైన ద్వారం గుండా చెఫ్ కిచెన్‌లోకి నేరుగా సాగండి. కాంక్రీట్ ఐలాండ్ దాటి గాజు తలుపుల గుండా రూఫ్ డెక్‌పైకి వెళ్ళండి. బయటి సోఫా దగ్గర దేవదారు పెర్గోలా క్రింద ఆగండి.",
                subgoal_descriptions=[
                    "ఏట్రియమ్‌లోకి ప్రవేశించండి",
                    "చెట్టు దాటి చెఫ్ కిచెన్‌కు వెళ్ళండి",
                    "గాజు తలుపుల గుండా రూఫ్ డెక్‌కు చేరుకోండి",
                    "పెర్గోలా క్రింద సోఫా వద్ద ఆగండి"
                ]
            )
        }
    )
]


def get_rxr_episodes(seen_only: Optional[bool] = None) -> List[RxREpisode]:
    if seen_only is None:
        return list(RXR_EPISODES)
    return [ep for ep in RXR_EPISODES if ep.is_unseen != seen_only]


def get_episode_by_id(episode_id: str) -> RxREpisode:
    for ep in RXR_EPISODES:
        if ep.episode_id == episode_id:
            return ep
    raise KeyError(f"Episode '{episode_id}' not found. Available: {[ep.episode_id for ep in RXR_EPISODES]}")
