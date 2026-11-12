"""
Rich Matterport3D-style Seen and Unseen Indoor Environments for RxR VLN.
Each environment contains 3D topological viewpoints, panoramic headings,
room taxonomies, and visual landmark descriptions.
"""

from typing import Dict, List
import numpy as np
import hashlib
from .graph_env import ConnectivityGraph, Viewpoint, HeadingObservation


def _generate_synthetic_visual_embedding(room: str, heading: float, landmarks: List[str]) -> np.ndarray:
    """
    Generates a deterministic 64-dimensional multimodal visual embedding
    reflecting room category, heading orientation, and landmark presence.
    """
    seed_str = f"{room}_{int(heading)}_{'_'.join(sorted(landmarks))}"
    hash_digest = hashlib.sha256(seed_str.encode('utf-8')).digest()
    # Create deterministic pseudo-random vector
    rng = np.random.RandomState(int.from_bytes(hash_digest[:4], 'little'))
    vec = rng.randn(64).astype(np.float32)

    # Inject semantic components for room and landmarks
    room_hash = int.from_bytes(hashlib.md5(room.encode('utf-8')).digest()[:4], 'little')
    room_rng = np.random.RandomState(room_hash)
    room_vec = room_rng.randn(64).astype(np.float32)

    landmark_sum = np.zeros(64, dtype=np.float32)
    for lm in landmarks:
        lm_hash = int.from_bytes(hashlib.md5(lm.encode('utf-8')).digest()[:4], 'little')
        lm_rng = np.random.RandomState(lm_hash)
        landmark_sum += lm_rng.randn(64).astype(np.float32)

    combined = vec * 0.3 + room_vec * 0.4 + landmark_sum * 0.5
    # Normalize to unit length
    norm = np.linalg.norm(combined) + 1e-7
    return combined / norm


def _create_panoramic_views(room_type: str, headings_dict: Dict[float, Dict]) -> List[HeadingObservation]:
    """Builds 360-degree discrete heading observations."""
    views: List[HeadingObservation] = []
    # All 12 headings in 30 degree steps
    for h_deg in range(0, 360, 30):
        closest_key = min(headings_dict.keys(), key=lambda k: min(abs(k - h_deg), 360 - abs(k - h_deg)))
        data = headings_dict[closest_key]
        desc = data.get("desc", f"Looking at {room_type} at heading {h_deg} degrees")
        landmarks = data.get("landmarks", [])
        feat = _generate_synthetic_visual_embedding(room_type, float(h_deg), landmarks)

        views.append(HeadingObservation(
            heading_deg=float(h_deg),
            elevation_deg=0.0,
            description=desc,
            detected_landmarks=list(landmarks),
            feature_vector=feat
        ))
    return views


# ==============================================================================
# ENVIRONMENT 1 (SEEN): Contemporary Duplex (house_seen_01)
# ==============================================================================
def build_house_seen_01() -> ConnectivityGraph:
    g = ConnectivityGraph("house_seen_01", "Contemporary Duplex (Seen)", is_unseen=False)

    # 1. Entrance Foyer (x=0, y=0, z=0)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_foyer",
        x=0.0, y=0.0, z=0.0,
        room_id="r_foyer", room_type="entrance_foyer",
        panoramic_views=_create_panoramic_views("entrance_foyer", {
            0.0: {"desc": "Ahead is the open hallway leading deeper into the house", "landmarks": ["hallway_arch", "coat_rack"]},
            90.0: {"desc": "To the right is a modern wooden shoe rack and key console", "landmarks": ["shoe_rack", "mirror"]},
            180.0: {"desc": "Behind is the heavy wooden entrance door with smart lock", "landmarks": ["entrance_door"]},
            270.0: {"desc": "To the left is a decorative stone planter with bamboo", "landmarks": ["stone_planter"]}
        })
    ))

    # 2. Central Hallway (x=0, y=3.2, z=0)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_hallway",
        x=0.0, y=3.2, z=0.0,
        room_id="r_hallway", room_type="hallway",
        panoramic_views=_create_panoramic_views("hallway", {
            0.0: {"desc": "Straight ahead the corridor leads to the living room", "landmarks": ["living_room_entrance"]},
            90.0: {"desc": "To the right is an arched entryway into the dining room", "landmarks": ["dining_arch"]},
            180.0: {"desc": "Behind is the entrance foyer", "landmarks": ["foyer"]},
            270.0: {"desc": "To the left is the staircase going to the upper floor", "landmarks": ["staircase_steps", "wooden_handrail"]}
        })
    ))

    # 3. Living Room (x=0, y=7.0, z=0)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_living",
        x=0.0, y=7.0, z=0.0,
        room_id="r_living", room_type="living_room",
        panoramic_views=_create_panoramic_views("living_room", {
            0.0: {"desc": "Floor-to-ceiling glass doors opening onto the balcony", "landmarks": ["balcony_glass_doors", "curtains"]},
            90.0: {"desc": "Large wall-mounted flat-screen television above a low credenza", "landmarks": ["tv", "credenza"]},
            180.0: {"desc": "Behind is the hallway leading back toward the entrance", "landmarks": ["hallway"]},
            270.0: {"desc": "Spacious L-shaped gray sectional sofa with colorful throw cushions", "landmarks": ["gray_sofa", "coffee_table", "area_rug"]}
        })
    ))

    # 4. Dining Room (x=3.5, y=3.2, z=0)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_dining",
        x=3.5, y=3.2, z=0.0,
        room_id="r_dining", room_type="dining_room",
        panoramic_views=_create_panoramic_views("dining_room", {
            0.0: {"desc": "Open threshold connecting directly into the kitchen", "landmarks": ["kitchen_threshold", "breakfast_bar"]},
            90.0: {"desc": "Glass cabinet displaying fine dinnerware", "landmarks": ["glass_cabinet"]},
            180.0: {"desc": "Large six-seater oak dining table with modern pendant lighting above", "landmarks": ["dining_table", "chandelier", "dining_chairs"]},
            270.0: {"desc": "Arched passageway leading back to the central hallway", "landmarks": ["hallway_arch"]}
        })
    ))

    # 5. Kitchen (x=3.5, y=6.8, z=0)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_kitchen",
        x=3.5, y=6.8, z=0.0,
        room_id="r_kitchen", room_type="kitchen",
        panoramic_views=_create_panoramic_views("kitchen", {
            0.0: {"desc": "Granite countertop island with gas cooktop and ventilation hood", "landmarks": ["island_counter", "gas_stove", "range_hood"]},
            90.0: {"desc": "Double-door stainless steel refrigerator", "landmarks": ["refrigerator", "pantry_door"]},
            180.0: {"desc": "Opening leading back into the dining room", "landmarks": ["dining_area"]},
            270.0: {"desc": "Kitchen sink with gooseneck faucet overlooking window", "landmarks": ["kitchen_sink", "window"]}
        })
    ))

    # 6. Balcony (x=0, y=10.2, z=0)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_balcony",
        x=0.0, y=10.2, z=0.0,
        room_id="r_balcony", room_type="balcony",
        panoramic_views=_create_panoramic_views("balcony", {
            0.0: {"desc": "Balcony railing with scenic garden view and outdoor plants", "landmarks": ["railing", "potted_plants", "garden_view"]},
            90.0: {"desc": "Two wicker armchairs with small glass table", "landmarks": ["wicker_chairs", "patio_table"]},
            180.0: {"desc": "Glass sliding doors leading back inside to the living room", "landmarks": ["glass_doors", "living_room"]},
            270.0: {"desc": "Wall planter with vertical green herbs", "landmarks": ["vertical_garden"]}
        })
    ))

    # 7. Staircase Landing (x=-3.2, y=3.2, z=1.5)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_stairs",
        x=-3.2, y=3.2, z=1.5,
        room_id="r_stairs", room_type="staircase_landing",
        panoramic_views=_create_panoramic_views("staircase_landing", {
            0.0: {"desc": "Flight of wooden stairs ascending toward the master bedroom", "landmarks": ["upper_stairs", "handrail"]},
            90.0: {"desc": "Stairs descending back to the central hallway", "landmarks": ["lower_stairs"]},
            180.0: {"desc": "Window providing natural daylight along stairwell", "landmarks": ["stair_window"]},
            270.0: {"desc": "Framed family photo gallery on wall", "landmarks": ["photo_gallery"]}
        })
    ))

    # 8. Master Bedroom (x=-3.2, y=6.8, z=3.0)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_master_bed",
        x=-3.2, y=6.8, z=3.0,
        room_id="r_master_bed", room_type="master_bedroom",
        panoramic_views=_create_panoramic_views("master_bedroom", {
            0.0: {"desc": "King size bed with beige headboard and bedside reading lamps", "landmarks": ["king_bed", "nightstand", "bedside_lamp"]},
            90.0: {"desc": "Door opening into the en-suite master bathroom", "landmarks": ["bathroom_door"]},
            180.0: {"desc": "Doorway opening onto the upper stairs landing", "landmarks": ["stairs_landing"]},
            270.0: {"desc": "Full-height mirrored sliding wardrobe", "landmarks": ["mirrored_wardrobe"]}
        })
    ))

    # 9. Bathroom (x=-3.2, y=9.8, z=3.0)
    g.add_node(Viewpoint(
        viewpoint_id="seen1_bathroom",
        x=-3.2, y=9.8, z=3.0,
        room_id="r_bathroom", room_type="bathroom",
        panoramic_views=_create_panoramic_views("bathroom", {
            0.0: {"desc": "Glass walk-in shower cabin with rain showerhead", "landmarks": ["shower_cabin", "tiled_wall"]},
            90.0: {"desc": "Wall-mounted towel warming rack", "landmarks": ["towel_rack"]},
            180.0: {"desc": "Doorway leading back into the master bedroom", "landmarks": ["bedroom_door"]},
            270.0: {"desc": "Marble vanity sink with illuminated LED mirror", "landmarks": ["marble_vanity", "sink", "led_mirror"]}
        })
    ))

    # Connect edges
    g.add_edge("seen1_foyer", "seen1_hallway")
    g.add_edge("seen1_hallway", "seen1_living")
    g.add_edge("seen1_hallway", "seen1_dining")
    g.add_edge("seen1_hallway", "seen1_stairs")
    g.add_edge("seen1_dining", "seen1_kitchen")
    g.add_edge("seen1_living", "seen1_balcony")
    g.add_edge("seen1_living", "seen1_kitchen") # Pass-through between living and kitchen
    g.add_edge("seen1_stairs", "seen1_master_bed")
    g.add_edge("seen1_master_bed", "seen1_bathroom")

    return g


# ==============================================================================
# ENVIRONMENT 2 (SEEN): Heritage Villa (house_seen_02)
# ==============================================================================
def build_house_seen_02() -> ConnectivityGraph:
    g = ConnectivityGraph("house_seen_02", "Heritage Villa (Seen)", is_unseen=False)

    g.add_node(Viewpoint(
        viewpoint_id="seen2_veranda",
        x=0.0, y=0.0, z=0.0, room_id="r_veranda", room_type="veranda",
        panoramic_views=_create_panoramic_views("veranda", {
            0.0: {"desc": "Carved wooden double door leading into the grand foyer", "landmarks": ["carved_door", "brass_handles"]},
            90.0: {"desc": "Terracotta planters along the outer veranda edge", "landmarks": ["terracotta_pots"]},
            180.0: {"desc": "Garden lawn view", "landmarks": ["lawn_garden"]},
            270.0: {"desc": "Cane armchairs and wooden porch swing", "landmarks": ["cane_chairs", "porch_swing"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="seen2_grand_foyer",
        x=0.0, y=3.5, z=0.0, room_id="r_grand_foyer", room_type="grand_foyer",
        panoramic_views=_create_panoramic_views("grand_foyer", {
            0.0: {"desc": "Sunlit central courtyard with stone water fountain", "landmarks": ["stone_fountain", "courtyard_arch"]},
            90.0: {"desc": "Entryway leading to the home library", "landmarks": ["library_entrance"]},
            180.0: {"desc": "Front entrance door to veranda", "landmarks": ["veranda_door"]},
            270.0: {"desc": "Antique grandfather clock standing against column", "landmarks": ["grandfather_clock"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="seen2_library",
        x=3.8, y=3.5, z=0.0, room_id="r_library", room_type="library",
        panoramic_views=_create_panoramic_views("library", {
            0.0: {"desc": "Floor-to-ceiling wooden bookshelves filled with books", "landmarks": ["bookshelves", "rolling_ladder"]},
            90.0: {"desc": "Deep leather armchair with brass reading lamp", "landmarks": ["leather_chair", "reading_lamp"]},
            180.0: {"desc": "Arched threshold back to the grand foyer", "landmarks": ["foyer_arch"]},
            270.0: {"desc": "Teak study desk with green banker lamp", "landmarks": ["study_desk", "banker_lamp"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="seen2_courtyard",
        x=0.0, y=7.2, z=0.0, room_id="r_courtyard", room_type="central_courtyard",
        panoramic_views=_create_panoramic_views("central_courtyard", {
            0.0: {"desc": "Archway into the dining hall", "landmarks": ["dining_hall_arch"]},
            90.0: {"desc": "Tea lounge with cushioned diwan", "landmarks": ["tea_lounge_entrance"]},
            180.0: {"desc": "Stone water fountain and foyer arch", "landmarks": ["stone_fountain", "foyer"]},
            270.0: {"desc": "Potted jasmine and flowering frangipani trees", "landmarks": ["jasmine_plants", "stone_benches"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="seen2_dining_hall",
        x=0.0, y=10.8, z=0.0, room_id="r_dining_hall", room_type="dining_hall",
        panoramic_views=_create_panoramic_views("dining_hall", {
            0.0: {"desc": "Door into the spice pantry", "landmarks": ["pantry_door"]},
            90.0: {"desc": "Sideboard buffet with copper tableware", "landmarks": ["sideboard", "copper_vessels"]},
            180.0: {"desc": "Courtyard entry with breeze", "landmarks": ["courtyard_view"]},
            270.0: {"desc": "Long polished teak dining table with eight high-back chairs", "landmarks": ["teak_dining_table", "chandelier"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="seen2_tea_lounge",
        x=3.8, y=7.2, z=0.0, room_id="r_tea_lounge", room_type="tea_lounge",
        panoramic_views=_create_panoramic_views("tea_lounge", {
            0.0: {"desc": "Traditional carved diwan daybed with silk bolsters", "landmarks": ["diwan_bed", "silk_pillows"]},
            90.0: {"desc": "Brass tea service table with teapot", "landmarks": ["tea_table", "brass_tea_service"]},
            180.0: {"desc": "Opening back to the central courtyard", "landmarks": ["courtyard_arch"]},
            270.0: {"desc": "Stained glass bay window facing morning light", "landmarks": ["stained_glass_window"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="seen2_pantry",
        x=0.0, y=14.0, z=0.0, room_id="r_pantry", room_type="pantry",
        panoramic_views=_create_panoramic_views("pantry", {
            0.0: {"desc": "Open wooden shelves with glass spice jars and ceramic containers", "landmarks": ["spice_jars", "wooden_shelves"]},
            90.0: {"desc": "Stone grinding mortar and pestle on slab", "landmarks": ["stone_mortar"]},
            180.0: {"desc": "Doorway back into dining hall", "landmarks": ["dining_hall_door"]},
            270.0: {"desc": "Copper water dispenser on pedestal", "landmarks": ["copper_dispenser"]}
        })
    ))

    # Connect edges
    g.add_edge("seen2_veranda", "seen2_grand_foyer")
    g.add_edge("seen2_grand_foyer", "seen2_library")
    g.add_edge("seen2_grand_foyer", "seen2_courtyard")
    g.add_edge("seen2_courtyard", "seen2_dining_hall")
    g.add_edge("seen2_courtyard", "seen2_tea_lounge")
    g.add_edge("seen2_dining_hall", "seen2_pantry")
    g.add_edge("seen2_library", "seen2_tea_lounge")

    return g


# ==============================================================================
# ENVIRONMENT 3 (UNSEEN): Modern Apartment (house_unseen_01)
# Zero-shot testing environment: novel floorplan and unseen visual layout!
# ==============================================================================
def build_house_unseen_01() -> ConnectivityGraph:
    g = ConnectivityGraph("house_unseen_01", "Modern Apartment (Unseen)", is_unseen=True)

    g.add_node(Viewpoint(
        viewpoint_id="unseen1_vestibule",
        x=0.0, y=0.0, z=0.0, room_id="u_vestibule", room_type="entry_vestibule",
        panoramic_views=_create_panoramic_views("entry_vestibule", {
            0.0: {"desc": "Straight ahead leads down the long corridor toward the open living area", "landmarks": ["corridor_hall", "ceiling_lights"]},
            90.0: {"desc": "Acoustic wood slatted wall with black coat hooks", "landmarks": ["wood_slat_wall", "coat_hooks"]},
            180.0: {"desc": "Matte black front door with digital keypad", "landmarks": ["matte_black_door"]},
            270.0: {"desc": "Full-length LED backlit mirror", "landmarks": ["backlit_mirror"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen1_corridor",
        x=0.0, y=3.0, z=0.0, room_id="u_corridor", room_type="corridor",
        panoramic_views=_create_panoramic_views("corridor", {
            0.0: {"desc": "Continuing into the bright open concept kitchen and lounge", "landmarks": ["open_kitchen_arch"]},
            90.0: {"desc": "Door on the right to the home office", "landmarks": ["office_door"]},
            180.0: {"desc": "Corridor heading back to the entry vestibule", "landmarks": ["vestibule"]},
            270.0: {"desc": "Door on the left leading to the guest bedroom", "landmarks": ["guest_bed_door"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen1_kitchen",
        x=0.0, y=6.5, z=0.0, room_id="u_kitchen", room_type="open_kitchen",
        panoramic_views=_create_panoramic_views("open_kitchen", {
            0.0: {"desc": "Spacious media lounge with low sectional sofa and TV", "landmarks": ["media_lounge", "sectional_couch"]},
            90.0: {"desc": "Calacatta marble breakfast counter with three bar stools", "landmarks": ["marble_breakfast_counter", "bar_stools"]},
            180.0: {"desc": "Passage leading back to the corridor", "landmarks": ["corridor"]},
            270.0: {"desc": "Induction cooktop and built-in stainless steel double oven", "landmarks": ["induction_stove", "wall_oven", "black_cabinets"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen1_lounge",
        x=0.0, y=10.0, z=0.0, room_id="u_lounge", room_type="media_lounge",
        panoramic_views=_create_panoramic_views("media_lounge", {
            0.0: {"desc": "Sliding glass doors leading out to the private terrace", "landmarks": ["terrace_glass_doors", "curtains"]},
            90.0: {"desc": "Bookshelf with decorative ceramics and modern artwork", "landmarks": ["display_shelf", "ceramic_vases"]},
            180.0: {"desc": "The open kitchen breakfast counter", "landmarks": ["kitchen_island"]},
            270.0: {"desc": "Emerald velvet couch facing OLED television on floating console", "landmarks": ["velvet_couch", "floating_tv_console"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen1_terrace",
        x=0.0, y=13.2, z=0.0, room_id="u_terrace", room_type="private_terrace",
        panoramic_views=_create_panoramic_views("private_terrace", {
            0.0: {"desc": "Panoramic city skyline view beyond glass balustrade", "landmarks": ["glass_balustrade", "city_skyline"]},
            90.0: {"desc": "Small herb garden in raised wooden planters", "landmarks": ["herb_planters"]},
            180.0: {"desc": "Glass sliding doors into the lounge", "landmarks": ["lounge_doors"]},
            270.0: {"desc": "Compact bistro table with two metal chairs", "landmarks": ["bistro_table", "metal_chairs"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen1_office",
        x=3.4, y=3.0, z=0.0, room_id="u_office", room_type="home_office",
        panoramic_views=_create_panoramic_views("home_office", {
            0.0: {"desc": "Standing desk with dual widescreen monitors and mechanical keyboard", "landmarks": ["standing_desk", "dual_monitors", "ergonomic_chair"]},
            90.0: {"desc": "Window looking into the courtyard garden", "landmarks": ["office_window"]},
            180.0: {"desc": "Door opening back into the corridor", "landmarks": ["corridor_door"]},
            270.0: {"desc": "White metal filing cabinet with indoor pothos plant", "landmarks": ["filing_cabinet", "pothos_plant"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen1_guest_bed",
        x=-3.2, y=3.0, z=0.0, room_id="u_guest_bed", room_type="guest_bedroom",
        panoramic_views=_create_panoramic_views("guest_bedroom", {
            0.0: {"desc": "Queen bed with navy blue duvet and walnut headboard", "landmarks": ["queen_bed", "nightstands", "duvet"]},
            90.0: {"desc": "Door leading to corridor", "landmarks": ["corridor_exit"]},
            180.0: {"desc": "Door opening into small powder room", "landmarks": ["powder_room_door"]},
            270.0: {"desc": "Window with sheer linen curtains", "landmarks": ["linen_curtains", "window"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen1_powder_room",
        x=-3.2, y=0.0, z=0.0, room_id="u_powder_room", room_type="powder_room",
        panoramic_views=_create_panoramic_views("powder_room", {
            0.0: {"desc": "Door back into guest bedroom", "landmarks": ["bedroom_door"]},
            90.0: {"desc": "Wall-hung toilet with matte black dual flush plate", "landmarks": ["wall_toilet"]},
            180.0: {"desc": "Dark stone mosaic feature wall", "landmarks": ["mosaic_wall"]},
            270.0: {"desc": "Floating oak vanity with black round ceramic basin", "landmarks": ["oak_vanity", "ceramic_basin", "round_mirror"]}
        })
    ))

    # Connect edges
    g.add_edge("unseen1_vestibule", "unseen1_corridor")
    g.add_edge("unseen1_corridor", "unseen1_kitchen")
    g.add_edge("unseen1_corridor", "unseen1_office")
    g.add_edge("unseen1_corridor", "unseen1_guest_bed")
    g.add_edge("unseen1_kitchen", "unseen1_lounge")
    g.add_edge("unseen1_lounge", "unseen1_terrace")
    g.add_edge("unseen1_guest_bed", "unseen1_powder_room")

    return g


# ==============================================================================
# ENVIRONMENT 4 (UNSEEN): Penthouse Loft (house_unseen_02)
# ==============================================================================
def build_house_unseen_02() -> ConnectivityGraph:
    g = ConnectivityGraph("house_unseen_02", "Penthouse Loft (Unseen)", is_unseen=True)

    g.add_node(Viewpoint(
        viewpoint_id="unseen2_elevator",
        x=0.0, y=0.0, z=0.0, room_id="u2_elevator", room_type="elevator_landing",
        panoramic_views=_create_panoramic_views("elevator_landing", {
            0.0: {"desc": "Entrance into the spectacular double-height glass atrium", "landmarks": ["atrium_opening"]},
            90.0: {"desc": "Brushed brass console table with contemporary sculpture", "landmarks": ["brass_console", "sculpture"]},
            180.0: {"desc": "Private elevator brushed steel double doors", "landmarks": ["elevator_doors"]},
            270.0: {"desc": "Dark fluted wall paneling", "landmarks": ["fluted_wall"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen2_atrium",
        x=0.0, y=3.8, z=0.0, room_id="u2_atrium", room_type="glass_atrium",
        panoramic_views=_create_panoramic_views("glass_atrium", {
            0.0: {"desc": "Broad passage leading to the chef kitchen", "landmarks": ["kitchen_passage"]},
            90.0: {"desc": "Art gallery corridor with spot lighting", "landmarks": ["gallery_corridor"]},
            180.0: {"desc": "Elevator landing entryway", "landmarks": ["elevator_landing"]},
            270.0: {"desc": "Mature indoor ficus lyrata tree under glass skylight", "landmarks": ["indoor_tree", "skylight_ceiling", "pendant_light"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen2_gallery",
        x=3.6, y=3.8, z=0.0, room_id="u2_gallery", room_type="art_gallery",
        panoramic_views=_create_panoramic_views("art_gallery", {
            0.0: {"desc": "Door opening into the master penthouse suite", "landmarks": ["master_suite_door"]},
            90.0: {"desc": "Large abstract colorful oil painting illuminated by spotlights", "landmarks": ["abstract_painting", "track_lights"]},
            180.0: {"desc": "Back toward the central atrium", "landmarks": ["atrium_view"]},
            270.0: {"desc": "Low marble display bench with bronze statue", "landmarks": ["marble_bench", "bronze_statue"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen2_kitchen",
        x=0.0, y=7.6, z=0.0, room_id="u2_kitchen", room_type="chef_kitchen",
        panoramic_views=_create_panoramic_views("chef_kitchen", {
            0.0: {"desc": "Glass double doors leading out onto the roof garden deck", "landmarks": ["roof_deck_doors"]},
            90.0: {"desc": "Professional gas range stove with custom brass hood", "landmarks": ["gas_range", "brass_hood"]},
            180.0: {"desc": "Atrium view through open doorway", "landmarks": ["atrium"]},
            270.0: {"desc": "Monolithic concrete kitchen island with waterfall countertop", "landmarks": ["waterfall_island", "sink_fixture"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen2_master_suite",
        x=3.6, y=7.6, z=0.0, room_id="u2_master", room_type="master_suite",
        panoramic_views=_create_panoramic_views("master_suite", {
            0.0: {"desc": "Access into the glass sunroom", "landmarks": ["sunroom_door"]},
            90.0: {"desc": "Low platform king bed with floating walnut bedside tables", "landmarks": ["platform_bed", "floating_tables"]},
            180.0: {"desc": "Passage back to the art gallery", "landmarks": ["gallery_door"]},
            270.0: {"desc": "Walk-in dressing room with open closets", "landmarks": ["walk_in_closet"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen2_sunroom",
        x=3.6, y=11.2, z=0.0, room_id="u2_sunroom", room_type="glass_sunroom",
        panoramic_views=_create_panoramic_views("glass_sunroom", {
            0.0: {"desc": "Sliding glass door leading directly to the roof deck", "landmarks": ["deck_slider"]},
            90.0: {"desc": "Floor-to-ceiling glass wall overlooking city hills", "landmarks": ["panoramic_windows"]},
            180.0: {"desc": "Doorway back into the master suite", "landmarks": ["master_suite_entrance"]},
            270.0: {"desc": "Linen upholstered chaise lounge with throw blanket", "landmarks": ["chaise_lounge", "side_table"]}
        })
    ))

    g.add_node(Viewpoint(
        viewpoint_id="unseen2_roof_deck",
        x=0.0, y=11.2, z=0.0, room_id="u2_roof_deck", room_type="roof_deck",
        panoramic_views=_create_panoramic_views("roof_deck", {
            0.0: {"desc": "Cedar pergola with climbing wisteria vines and outdoor sofa", "landmarks": ["pergola", "outdoor_sofa", "fire_pit"]},
            90.0: {"desc": "Connecting slider into the glass sunroom", "landmarks": ["sunroom_slider"]},
            180.0: {"desc": "Doors leading back into the chef kitchen", "landmarks": ["kitchen_doors"]},
            270.0: {"desc": "Outdoor stainless steel barbecue kitchen station", "landmarks": ["bbq_grill", "outdoor_counter"]}
        })
    ))

    # Connect edges
    g.add_edge("unseen2_elevator", "unseen2_atrium")
    g.add_edge("unseen2_atrium", "unseen2_gallery")
    g.add_edge("unseen2_atrium", "unseen2_kitchen")
    g.add_edge("unseen2_gallery", "unseen2_master_suite")
    g.add_edge("unseen2_kitchen", "unseen2_roof_deck")
    g.add_edge("unseen2_master_suite", "unseen2_sunroom")
    g.add_edge("unseen2_sunroom", "unseen2_roof_deck")

    return g


# Registry of all environments
ENVIRONMENTS: Dict[str, ConnectivityGraph] = {
    "house_seen_01": build_house_seen_01(),
    "house_seen_02": build_house_seen_02(),
    "house_unseen_01": build_house_unseen_01(),
    "house_unseen_02": build_house_unseen_02(),
}


def get_environment_by_id(env_id: str) -> ConnectivityGraph:
    if env_id not in ENVIRONMENTS:
        raise KeyError(f"Unknown environment ID '{env_id}'. Available: {list(ENVIRONMENTS.keys())}")
    return ENVIRONMENTS[env_id]


def list_available_environments() -> List[Dict[str, Any]]:
    return [
        {
            "id": env_id,
            "name": env.name,
            "is_unseen": env.is_unseen,
            "num_viewpoints": len(env.nodes),
            "room_types": list(set(v.room_type for v in env.nodes.values()))
        }
        for env_id, env in ENVIRONMENTS.items()
    ]
