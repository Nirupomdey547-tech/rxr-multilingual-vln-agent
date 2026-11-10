# Multilingual Vision-and-Language Navigation (VLN) Decision Agent
### Mapped to Google Research Room-Across-Room (RxR) Benchmark

Developed an AI-assisted multilingual navigation agent integrating language understanding with goal-based sequential decision making. The system connects natural-language instructions to environmental actions while exposing route progress and uncertainty throughout execution.

---

## Key Features

1. **Explicit Sequential Decision Formulation (State-Space / MDP)**:
   - Formulates indoor navigation on discrete topological connectivity graphs $G = (V, E)$ with 3D coordinates, room types, multi-heading panoramic viewpoints, and candidate action spaces ($\text{MOVE\_TO\_NODE}$ & $\text{STOP}$).
2. **Multilingual Language Understanding**:
   - Native script processing for **English (en-IN/US)**, **Hindi (hi-IN)** (Devanagari), and **Telugu (te-IN)** (Telugu script).
   - Cross-lingual semantic alignment mapping spatial directional phrases (*"turn left"*, *"बाएं मुड़ें"*, *"ఎడమవైపు తిరగండి"*) and landmarks (*"refrigerator"*, *"फ्रिज"*, *"రిఫ్రిజిరేటర్"*) into a unified latent space.
3. **Multimodal Instruction-Conditioned Decision Policy**:
   - Cross-attention between visual directional views and instruction tokens.
   - Bilinear action matching over candidate edges + goal-progress estimation.
4. **Real-time Uncertainty Quantification & Reliability State Machine**:
   - Predictive Shannon action entropy $H(\pi)$ and normalized entropy $\bar{H}$.
   - Visual-linguistic grounding dissonance and trajectory loop/oscillation detection.
   - Dynamic reliability states: `RELIABLE` (Green), `CAUTIOUS` (Yellow), and `UNRELIABLE` (Red).
   - Diagnostic reasoning generator and automated backtracking recovery.
5. **Comprehensive RxR Benchmark Evaluation**:
   - Calculates **SR** (Success Rate), **SPL** (Success weighted by Path Length), **nDTW** (normalized Dynamic Time Warping path fidelity), **sDTW** (Success weighted by DTW), and **NE** (Navigation Error).
   - Evaluates performance across Seen environments and Unseen environments (zero-shot generalization).
6. **Interactive Web Simulator**:
   - First-person panoramic viewport with detected landmarks and directional overlays.
   - 2D floorplan graph canvas showing reference paths and real-time agent trajectories.
   - Word-level cross-attention heatmaps dynamically highlighting grounded instruction words.
   - Live uncertainty cockpit with action entropy gauges and counterfactual manual override.

---

## Quickstart

### 1. Requirements
Ensure Python 3.9+ is installed.
```bash
pip install -r requirements.txt
```

### 2. Run Automated Unit Tests
```bash
pytest tests/
```

### 3. Run Benchmark Evaluation Matrix
```bash
python run_benchmark.py
```
This executes sequential episodic rollouts across English, Hindi, and Telugu instructions in both Seen and Unseen environments, saving results to `benchmark_results.json` and printing the RxR comparison table.

### 4. Launch Interactive Simulator
```bash
python run_simulator.py --port 8080
```
Open your browser at **[http://localhost:8080](http://localhost:8080)**.

- **Authentication Terminal**: Access the modern minimalistic login interface at `/login.html` or sign in with 1-click **Guest Access** / demo credentials (`researcher` / `rxr-vln-2026`).
- **Cockpit Dashboard**: Experience panoramic indoor viewpoints, 2D floorplan graph, word-level cross-attention heatmaps across English, Hindi, and Telugu, and real-time uncertainty quantification.

---

## Citation & Reference
- **Google Research RxR Benchmark**: Ku, Alexander, et al. *"Room-Across-Room: Multilingual Vision-and-Language Navigation with Dense Spatiotemporal Grounding."* EMNLP 2020.
