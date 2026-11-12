"""
Topological Connectivity Graph and State-Space Navigation Environment for RxR VLN.
Formalizes Matterport3D-style viewpoints, 3D coordinates, panoramic observations,
and discrete sequential transitions.
"""

from __future__ import annotations
import math
import heapq
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Any
import numpy as np


@dataclass
class HeadingObservation:
    """A directional heading slice within a 360-degree panoramic viewpoint."""
    heading_deg: float          # 0 to 360 degrees (0 = North, 90 = East, etc.)
    elevation_deg: float        # Elevation angle (-30 to +30 degrees)
    description: str            # Natural language visual description of what is seen
    detected_landmarks: List[str] # Visual landmark objects recognized in this heading
    feature_vector: np.ndarray  # Precomputed multimodal visual embedding (normalized 64-dim)


@dataclass
class Viewpoint:
    """A discrete 3D spatial viewpoint node in the navigation graph."""
    viewpoint_id: str
    x: float
    y: float
    z: float
    room_id: str
    room_type: str             # e.g., 'hallway', 'kitchen', 'living_room', 'bedroom', etc.
    panoramic_views: List[HeadingObservation] = field(default_factory=list)
    visual_features: Optional[np.ndarray] = None # Aggregated 360 panoramic feature

    def get_observation_at(self, heading_deg: float, elevation_deg: float = 0.0) -> HeadingObservation:
        """Find the closest discrete heading slice to the agent's current view."""
        norm_heading = heading_deg % 360.0
        best_obs = self.panoramic_views[0]
        min_diff = 360.0
        for obs in self.panoramic_views:
            diff = abs(obs.heading_deg - norm_heading)
            diff = min(diff, 360.0 - diff)
            elev_diff = abs(obs.elevation_deg - elevation_deg)
            total_diff = diff + 0.5 * elev_diff
            if total_diff < min_diff:
                min_diff = total_diff
                best_obs = obs
        return best_obs


@dataclass
class NavigationAction:
    """Action representation in the sequential decision space."""
    action_type: str            # 'MOVE_TO_NODE', 'TURN_LEFT', 'TURN_RIGHT', 'STOP'
    target_node_id: Optional[str] = None
    delta_heading: float = 0.0
    confidence: float = 1.0


class ConnectivityGraph:
    """
    Topological connectivity graph G = (V, E) of an indoor environment.
    Each node is a Viewpoint. Edges represent direct line-of-sight navigable pathways.
    """
    def __init__(self, graph_id: str, name: str, is_unseen: bool = False):
        self.graph_id = graph_id
        self.name = name
        self.is_unseen = is_unseen
        self.nodes: Dict[str, Viewpoint] = {}
        self.adjacency: Dict[str, List[Tuple[str, float]]] = {} # node_id -> [(neighbor_id, distance_meters)]

    def add_node(self, viewpoint: Viewpoint) -> None:
        self.nodes[viewpoint.viewpoint_id] = viewpoint
        if viewpoint.viewpoint_id not in self.adjacency:
            self.adjacency[viewpoint.viewpoint_id] = []

    def add_edge(self, node_a: str, node_b: str, bidirectional: bool = True) -> None:
        if node_a not in self.nodes or node_b not in self.nodes:
            raise ValueError(f"Nodes {node_a} or {node_b} not found in graph {self.graph_id}")

        vp_a = self.nodes[node_a]
        vp_b = self.nodes[node_b]
        dist = math.sqrt((vp_a.x - vp_b.x)**2 + (vp_a.y - vp_b.y)**2 + (vp_a.z - vp_b.z)**2)

        if not any(n == node_b for n, _ in self.adjacency[node_a]):
            self.adjacency[node_a].append((node_b, dist))

        if bidirectional and not any(n == node_a for n, _ in self.adjacency[node_b]):
            self.adjacency[node_b].append((node_a, dist))

    def get_euclidean_distance(self, node_a: str, node_b: str) -> float:
        """Euclidean distance in meters between two viewpoints."""
        vp_a = self.nodes[node_a]
        vp_b = self.nodes[node_b]
        return math.sqrt((vp_a.x - vp_b.x)**2 + (vp_a.y - vp_b.y)**2 + (vp_a.z - vp_b.z)**2)

    def get_relative_heading_elevation(self, from_node: str, to_node: str) -> Tuple[float, float]:
        """Calculates relative azimuth (heading in [0, 360)) and elevation degrees from node_a to node_b."""
        vp_a = self.nodes[from_node]
        vp_b = self.nodes[to_node]
        dx = vp_b.x - vp_a.x
        dy = vp_b.y - vp_a.y
        dz = vp_b.z - vp_a.z

        # In standard 2D cartesian coordinate system:
        # dx = East (+X), dy = North (+Y)
        # Azimuth 0 = North (+Y), 90 = East (+X), 180 = South (-Y), 270 = West (-X)
        angle_rad = math.atan2(dx, dy)
        heading_deg = math.degrees(angle_rad) % 360.0

        horiz_dist = math.hypot(dx, dy)
        elev_deg = math.degrees(math.atan2(dz, max(horiz_dist, 1e-4)))
        return heading_deg, elev_deg

    def shortest_path(self, start_node: str, goal_node: str) -> List[str]:
        """Dijkstra algorithm to compute optimal geodesic shortest path."""
        if start_node == goal_node:
            return [start_node]

        dist: Dict[str, float] = {node: float('inf') for node in self.nodes}
        prev: Dict[str, Optional[str]] = {node: None for node in self.nodes}
        dist[start_node] = 0.0

        pq = [(0.0, start_node)]

        while pq:
            d, u = heapq.heappop(pq)
            if d > dist[u]:
                continue
            if u == goal_node:
                break

            for v, weight in self.adjacency.get(u, []):
                new_d = dist[u] + weight
                if new_d < dist[v]:
                    dist[v] = new_d
                    prev[v] = u
                    heapq.heappush(pq, (new_d, v))

        if dist[goal_node] == float('inf'):
            return []

        path = []
        curr = goal_node
        while curr is not None:
            path.append(curr)
            curr = prev[curr]
        path.reverse()
        return path

    def geodesic_distance(self, start_node: str, goal_node: str) -> float:
        """Geodesic distance along the graph edges."""
        path = self.shortest_path(start_node, goal_node)
        if not path or len(path) == 1:
            return 0.0
        total_dist = 0.0
        for i in range(len(path) - 1):
            total_dist += self.get_euclidean_distance(path[i], path[i+1])
        return total_dist


@dataclass
class CandidateAction:
    """A feasible candidate transition from the current state."""
    action_type: str            # 'MOVE_TO_NODE' or 'STOP'
    target_node_id: Optional[str]
    target_room_type: str
    target_landmarks: List[str]
    relative_heading: float     # Heading offset relative to current agent heading [-180, 180]
    absolute_heading: float     # [0, 360)
    distance_meters: float
    feature_vector: np.ndarray


@dataclass
class AgentState:
    """Full state representation s_t at timestep t."""
    step: int
    current_node: str
    current_room: str
    heading: float              # [0, 360) degrees
    elevation: float            # [-30, 30] degrees
    trajectory_nodes: List[str] # Trajectory of viewpoints visited
    trajectory_length: float    # Trajectory path length traversed in meters
    current_observation: HeadingObservation
    available_actions: List[CandidateAction]
    is_terminal: bool = False


class NavigationEnv:
    """
    Sequential Decision Navigation Environment.
    Wraps the ConnectivityGraph with agent pose, trajectory tracking,
    discrete action execution, and candidate generation.
    """
    def __init__(self, graph: ConnectivityGraph, max_steps: int = 15):
        self.graph = graph
        self.max_steps = max_steps
        self.current_node: str = ""
        self.heading: float = 0.0
        self.elevation: float = 0.0
        self.step_count: int = 0
        self.trajectory_nodes: List[str] = []
        self.trajectory_length: float = 0.0
        self.is_terminal: bool = False

    def reset(self, start_node_id: str, initial_heading: float = 0.0) -> AgentState:
        if start_node_id not in self.graph.nodes:
            raise ValueError(f"Start node {start_node_id} not in graph {self.graph.graph_id}")

        self.current_node = start_node_id
        self.heading = initial_heading % 360.0
        self.elevation = 0.0
        self.step_count = 0
        self.trajectory_nodes = [start_node_id]
        self.trajectory_length = 0.0
        self.is_terminal = False

        return self.get_state()

    def get_candidate_actions(self) -> List[CandidateAction]:
        """
        Extracts navigable candidate actions from the current viewpoint.
        Always includes:
        1. Navigable neighbor edges (with relative heading, distance, visual features).
        2. Terminal `[STOP]` action representing declaring arrival at destination.
        """
        candidates: List[CandidateAction] = []
        curr_vp = self.graph.nodes[self.current_node]

        # 1. Neighbor moves
        for neighbor_id, dist in self.graph.adjacency.get(self.current_node, []):
            abs_heading, abs_elev = self.graph.get_relative_heading_elevation(self.current_node, neighbor_id)
            # Relative heading in range [-180, 180]
            rel_heading = (abs_heading - self.heading + 180.0) % 360.0 - 180.0

            target_vp = self.graph.nodes[neighbor_id]
            # Get observation in that direction from current node
            dir_obs = curr_vp.get_observation_at(abs_heading, abs_elev)

            # Feature vector: concatenate visual features + directional encoding
            dir_encoding = np.array([
                math.sin(math.radians(rel_heading)),
                math.cos(math.radians(rel_heading)),
                dist / 5.0,  # Normalized distance
                1.0          # Non-stop indicator
            ], dtype=np.float32)

            combined_feature = np.concatenate([dir_obs.feature_vector, dir_encoding])

            candidates.append(CandidateAction(
                action_type="MOVE_TO_NODE",
                target_node_id=neighbor_id,
                target_room_type=target_vp.room_type,
                target_landmarks=dir_obs.detected_landmarks,
                relative_heading=rel_heading,
                absolute_heading=abs_heading,
                distance_meters=dist,
                feature_vector=combined_feature
            ))

        # 2. STOP action candidate
        curr_obs = curr_vp.get_observation_at(self.heading, self.elevation)
        stop_encoding = np.array([0.0, 1.0, 0.0, 0.0], dtype=np.float32) # STOP indicator
        stop_feature = np.concatenate([curr_obs.feature_vector, stop_encoding])

        candidates.append(CandidateAction(
            action_type="STOP",
            target_node_id=None,
            target_room_type=curr_vp.room_type,
            target_landmarks=curr_obs.detected_landmarks,
            relative_heading=0.0,
            absolute_heading=self.heading,
            distance_meters=0.0,
            feature_vector=stop_feature
        ))

        return candidates

    def get_state(self) -> AgentState:
        curr_vp = self.graph.nodes[self.current_node]
        obs = curr_vp.get_observation_at(self.heading, self.elevation)
        candidates = self.get_candidate_actions()

        return AgentState(
            step=self.step_count,
            current_node=self.current_node,
            current_room=curr_vp.room_type,
            heading=self.heading,
            elevation=self.elevation,
            trajectory_nodes=list(self.trajectory_nodes),
            trajectory_length=self.trajectory_length,
            current_observation=obs,
            available_actions=candidates,
            is_terminal=self.is_terminal
        )

    def step(self, action: NavigationAction) -> Tuple[AgentState, float, bool, Dict[str, Any]]:
        """
        Executes action in the environment.
        Returns: (next_state, reward, done, info)
        """
        if self.is_terminal:
            return self.get_state(), 0.0, True, {"info": "Already terminal"}

        self.step_count += 1
        reward = -0.05 # Small step penalty to encourage route efficiency

        if action.action_type == "STOP":
            self.is_terminal = True
            return self.get_state(), reward, True, {"reason": "Agent executed STOP"}

        elif action.action_type == "MOVE_TO_NODE":
            target = action.target_node_id
            if target is None or not any(n == target for n, _ in self.graph.adjacency.get(self.current_node, [])):
                # Invalid action penalty
                reward -= 0.5
                return self.get_state(), reward, False, {"error": f"Invalid transition to {target}"}

            # Valid move
            move_dist = self.graph.get_euclidean_distance(self.current_node, target)
            # Update heading to face the target node
            new_heading, new_elev = self.graph.get_relative_heading_elevation(self.current_node, target)
            self.heading = new_heading
            self.elevation = new_elev
            self.current_node = target
            self.trajectory_nodes.append(target)
            self.trajectory_length += move_dist

        elif action.action_type == "TURN_LEFT":
            self.heading = (self.heading - 30.0) % 360.0
        elif action.action_type == "TURN_RIGHT":
            self.heading = (self.heading + 30.0) % 360.0

        if self.step_count >= self.max_steps:
            self.is_terminal = True

        return self.get_state(), reward, self.is_terminal, {"step": self.step_count}
