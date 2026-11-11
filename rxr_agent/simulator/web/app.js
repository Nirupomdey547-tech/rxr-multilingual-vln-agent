// RxR VLN Interactive Simulator Client Application
(function() {
  let simState = null;
  let isPlaying = false;
  let playTimer = null;
  let currentLanguage = "en";
  let activeTab = "action";

  // Room Icons mapping
  const ROOM_ICONS = {
    entrance_foyer: "🚪",
    foyer: "🚪",
    hallway: "🚶",
    corridor: "🚶",
    living_room: "🛋️",
    dining_room: "🍽️",
    kitchen: "🍳",
    open_kitchen: "🍳",
    chef_kitchen: "🍳",
    balcony: "🌿",
    private_terrace: "🌿",
    roof_deck: "☀️",
    staircase_landing: "🪜",
    master_bedroom: "🛏️",
    guest_bedroom: "🛏️",
    master_suite: "🛏️",
    bathroom: "🚿",
    powder_room: "🚿",
    library: "📚",
    central_courtyard: "⛲",
    dining_hall: "🍷",
    tea_lounge: "☕",
    pantry: "🧂",
    home_office: "💻",
    elevator_landing: "🛗",
    glass_atrium: "🌴",
    art_gallery: "🎨",
    glass_sunroom: "🪟"
  };

  // DOM Elements
  const elEpisodeSelect = document.getElementById("episode-select");
  const elSplitBadge = document.getElementById("split-badge");
  const elInstruction = document.getElementById("instruction-container");
  const elTargetRoom = document.getElementById("target-room");
  const elTargetLms = document.getElementById("target-lms");
  const elStepCounter = document.getElementById("step-counter");
  const elCurrentRoomText = document.getElementById("current-room-text");
  const elCurrentNodeText = document.getElementById("current-node-text");
  const elHeadingText = document.getElementById("heading-text");
  const elDistanceText = document.getElementById("distance-text");
  const elDetectedLandmarks = document.getElementById("detected-landmarks");
  const elReliabilityBadge = document.getElementById("reliability-badge");
  const elUncertaintyStatusBadge = document.getElementById("uncertainty-status-badge");
  const elEntropyValue = document.getElementById("entropy-value");
  const elEntropyBar = document.getElementById("entropy-bar");
  const elConfidenceValue = document.getElementById("confidence-value");
  const elConfidenceBar = document.getElementById("confidence-bar");
  const elDiagnosticText = document.getElementById("diagnostic-text");
  const elBacktrackAlert = document.getElementById("backtrack-alert");
  const elBtnBacktrackAlert = document.getElementById("btn-backtrack-alert");

  const elStudioEntropyValue = document.getElementById("studio-entropy-value");
  const elStudioEntropyBar = document.getElementById("studio-entropy-bar");
  const elStudioConfValue = document.getElementById("studio-conf-value");
  const elStudioConfBar = document.getElementById("studio-conf-bar");

  const elVpHeadingTag = document.getElementById("viewport-heading-tag");
  const elRoomIconContainer = document.getElementById("room-icon-container");
  const elVpRoomName = document.getElementById("vp-room-name");
  const elVpDesc = document.getElementById("vp-description");
  const elVpActionArrows = document.getElementById("viewport-action-arrows");

  const elCandidatesList = document.getElementById("candidates-list");
  const elProgressPercent = document.getElementById("progress-percent");
  const elProgressBarFill = document.getElementById("progress-bar-fill");
  const elFloorplanProgressPercent = document.getElementById("floorplan-progress-percent");
  const elFloorplanDistText = document.getElementById("floorplan-dist-text");
  const elFloorplanGoalDist = document.getElementById("floorplan-goal-dist");
  const elFloorplanHistoryList = document.getElementById("floorplan-history-list");
  const elVisitedCountTag = document.getElementById("visited-count-tag");

  const elOverviewInstructionCopy = document.getElementById("overview-instruction-copy");
  const elOverviewNodeText = document.getElementById("overview-node-text");
  const elOverviewHeadingText = document.getElementById("overview-heading-text");
  const elOverviewRoomTag = document.getElementById("overview-room-tag");
  const elOverviewRoomIcon = document.getElementById("overview-room-icon");
  const elOverviewRoomName = document.getElementById("overview-room-name");
  const elOverviewRoomDesc = document.getElementById("overview-room-desc");
  const elOverviewDistText = document.getElementById("overview-dist-text");

  const elMetricSr = document.getElementById("metric-sr");
  const elMetricSpl = document.getElementById("metric-spl");
  const elMetricNdtw = document.getElementById("metric-ndtw");
  const elMetricNe = document.getElementById("metric-ne");

  const elCanvas = document.getElementById("graph-canvas");
  const ctx = elCanvas ? elCanvas.getContext("2d") : null;

  const elBtnReset = document.getElementById("btn-reset");
  const elBtnStep = document.getElementById("btn-step");
  const elBtnPlay = document.getElementById("btn-play");
  const elPlayIcon = document.getElementById("play-icon");
  const elPlayText = document.getElementById("play-text");
  const elBtnBacktrack = document.getElementById("btn-backtrack");
  const elSpeedSelect = document.getElementById("speed-select");

  const langButtons = {
    en: document.getElementById("lang-en"),
    hi: document.getElementById("lang-hi"),
    te: document.getElementById("lang-te")
  };

  // Dedicated Sections Tab Switching
  window.switchTab = function(tabId) {
    activeTab = tabId;
    const tabIds = ["action", "floorplan", "uncertainty", "benchmark", "overview"];
    tabIds.forEach(id => {
      const btn = document.getElementById(`tab-${id}`);
      const sec = document.getElementById(`section-${id}`);
      if (btn) {
        if (id === tabId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
      if (sec) {
        if (id === tabId) {
          sec.classList.remove("hidden");
        } else {
          sec.classList.add("hidden");
        }
      }
    });

    // If switching to floorplan or overview, redraw canvas immediately
    if ((tabId === "floorplan" || tabId === "overview") && simState) {
      setTimeout(() => {
        renderGraph(simState);
      }, 50);
    }
  };

  // API Calls
  async function fetchInitialState() {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      if (data && data.episode) {
        updateUI(data);
      } else {
        await resetEpisode(elEpisodeSelect.value, currentLanguage);
      }
    } catch (err) {
      console.warn("Falling back to fresh episode init:", err);
      await resetEpisode(elEpisodeSelect.value, currentLanguage);
    }
  }

  async function resetEpisode(episodeId, language) {
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: episodeId, language: language })
      });
      const data = await res.json();
      updateUI(data);
    } catch (err) {
      console.error("Failed to reset episode:", err);
    }
  }

  async function stepSimulation(actionIndex) {
    try {
      const payload = actionIndex !== undefined ? { action_index: actionIndex } : {};
      const res = await fetch("/api/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      updateUI(data);

      if (data.state && data.state.is_terminal) {
        stopAutoPlay();
      }
    } catch (err) {
      console.error("Failed to step simulation:", err);
      stopAutoPlay();
    }
  }

  async function backtrack() {
    try {
      const res = await fetch("/api/backtrack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      updateUI(data);
    } catch (err) {
      console.error("Failed to backtrack:", err);
    }
  }

  async function switchLanguage(lang) {
    currentLanguage = lang;
    Object.keys(langButtons).forEach(k => {
      const btn = langButtons[k];
      if (btn) {
        if (k === lang) {
          btn.className = "lang-btn px-2.5 py-1 rounded-lg font-medium bg-cyan-600 text-white transition shadow-sm";
        } else {
          btn.className = "lang-btn px-2.5 py-1 rounded-lg font-medium text-slate-300 hover:text-white transition";
        }
      }
    });

    try {
      const res = await fetch("/api/switch_language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang })
      });
      const data = await res.json();
      updateUI(data);
    } catch (err) {
      console.error("Failed to switch language:", err);
    }
  }

  function toggleAutoPlay() {
    if (isPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  }

  function startAutoPlay() {
    if (simState && simState.state && simState.state.is_terminal) {
      resetEpisode(elEpisodeSelect.value, currentLanguage).then(() => {
        isPlaying = true;
        if (elPlayIcon) elPlayIcon.innerText = "⏸";
        if (elPlayText) elPlayText.innerText = "Pause";
        if (elBtnPlay) {
          elBtnPlay.classList.replace("bg-emerald-600", "bg-amber-600");
          elBtnPlay.classList.replace("hover:bg-emerald-500", "hover:bg-amber-500");
        }
        const speed = parseInt(elSpeedSelect.value, 10) || 700;
        playTimer = setInterval(() => stepSimulation(), speed);
      });
      return;
    }

    isPlaying = true;
    if (elPlayIcon) elPlayIcon.innerText = "⏸";
    if (elPlayText) elPlayText.innerText = "Pause";
    if (elBtnPlay) {
      elBtnPlay.classList.replace("bg-emerald-600", "bg-amber-600");
      elBtnPlay.classList.replace("hover:bg-emerald-500", "hover:bg-amber-500");
    }
    const speed = parseInt(elSpeedSelect.value, 10) || 700;
    playTimer = setInterval(() => stepSimulation(), speed);
  }

  function stopAutoPlay() {
    isPlaying = false;
    clearInterval(playTimer);
    playTimer = null;
    if (elPlayIcon) elPlayIcon.innerText = "▶";
    if (elPlayText) elPlayText.innerText = "Auto Play";
    if (elBtnPlay) {
      elBtnPlay.classList.replace("bg-amber-600", "bg-emerald-600");
      elBtnPlay.classList.replace("hover:bg-amber-500", "hover:bg-emerald-500");
    }
  }

  // Update UI with simulation state
  function updateUI(state) {
    simState = state;
    if (!state || !state.episode) return;

    // 1. Header & Episode
    if (elEpisodeSelect) elEpisodeSelect.value = state.episode.id;
    if (elSplitBadge) {
      if (state.episode.is_unseen) {
        elSplitBadge.innerText = "Val-Unseen (Zero-Shot)";
        elSplitBadge.className = "px-2 py-0.5 text-[10px] font-semibold rounded bg-purple-950 text-purple-300 border border-purple-800";
      } else {
        elSplitBadge.innerText = "Val-Seen";
        elSplitBadge.className = "px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-950 text-emerald-400 border border-emerald-800";
      }
    }

    // 2. Multilingual Instruction with Word Attention Heatmap
    if (elTargetRoom) elTargetRoom.innerText = state.episode.goal_node.replace(/.*_/, "");
    if (elTargetLms) elTargetLms.innerText = (state.episode.target_landmarks || []).join(", ");

    if (elInstruction) {
      if (state.word_attention && state.word_attention.length > 0) {
        elInstruction.innerHTML = state.word_attention.map(item => {
          const alpha = Math.min(0.85, Math.max(0.08, item.weight * 3.5));
          const isHighAttn = item.weight > 0.15;
          const borderStyle = isHighAttn ? "border: 1px solid rgba(6,182,212,0.8);" : "border: 1px solid transparent;";
          const textColor = isHighAttn ? "color: #ffffff; font-weight: 600;" : "color: #cbd5e1;";
          return `<span class="attn-word" style="background-color: rgba(6, 182, 212, ${alpha}); ${borderStyle} ${textColor}" title="Attention: ${(item.weight * 100).toFixed(1)}%">${item.word}</span>`;
        }).join(" ");
      } else {
        elInstruction.innerText = state.episode.instruction_text;
      }
    }

    if (elOverviewInstructionCopy) {
      elOverviewInstructionCopy.innerText = state.episode.instruction_text;
    }

    // 3. Current State
    if (elStepCounter) elStepCounter.innerText = `Step: ${state.state.step_count} / ${state.state.max_steps}`;
    if (elCurrentRoomText) elCurrentRoomText.innerText = state.state.current_room.replace(/_/g, " ");
    if (elCurrentNodeText) elCurrentNodeText.innerText = state.state.current_node;
    if (elHeadingText) elHeadingText.innerHTML = `${state.state.heading}&deg;`;
    if (elDistanceText) elDistanceText.innerText = `${state.state.trajectory_length} m`;

    if (elOverviewNodeText) elOverviewNodeText.innerText = state.state.current_node;
    if (elOverviewHeadingText) elOverviewHeadingText.innerHTML = `${state.state.heading}&deg;`;
    if (elOverviewDistText) elOverviewDistText.innerText = `${state.state.trajectory_length} m`;

    // Detected landmarks
    const lms = state.state.current_landmarks || [];
    if (elDetectedLandmarks) {
      if (lms.length > 0) {
        elDetectedLandmarks.innerHTML = lms.map(lm =>
          `<span class="text-[11px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">${lm.replace(/_/g, " ")}</span>`
        ).join(" ");
      } else {
        elDetectedLandmarks.innerHTML = `<span class="text-xs text-slate-500 italic">No salient landmarks</span>`;
      }
    }

    // 4. Uncertainty & Reliability
    const rel = state.reliability || {};
    const normEntropy = rel.normalized_entropy !== undefined ? rel.normalized_entropy.toFixed(2) : "--";
    if (elEntropyValue) elEntropyValue.innerText = `${normEntropy} (${rel.normalized_entropy < 0.5 ? "Low" : (rel.normalized_entropy < 0.8 ? "Medium" : "High")})`;
    if (elEntropyBar) elEntropyBar.style.width = `${Math.min(100, (rel.normalized_entropy || 0) * 100)}%`;

    if (elStudioEntropyValue) elStudioEntropyValue.innerText = normEntropy;
    if (elStudioEntropyBar) elStudioEntropyBar.style.width = `${Math.min(100, (rel.normalized_entropy || 0) * 100)}%`;

    const conf = (rel.confidence || 0) * 100;
    if (elConfidenceValue) elConfidenceValue.innerText = `${conf.toFixed(1)}%`;
    if (elConfidenceBar) elConfidenceBar.style.width = `${conf}%`;

    if (elStudioConfValue) elStudioConfValue.innerText = `${conf.toFixed(1)}%`;
    if (elStudioConfBar) elStudioConfBar.style.width = `${conf}%`;

    if (elDiagnosticText) elDiagnosticText.innerText = rel.diagnostic_message || "Analyzing perception and trajectory alignment...";

    // Badge styling
    const applyBadge = (badgeEl) => {
      if (!badgeEl) return;
      if (rel.status === "UNRELIABLE") {
        badgeEl.className = "px-2.5 py-0.5 text-[10px] font-bold rounded-full badge-unreliable";
        badgeEl.innerText = "UNRELIABLE";
      } else if (rel.status === "CAUTIOUS") {
        badgeEl.className = "px-2.5 py-0.5 text-[10px] font-bold rounded-full badge-cautious";
        badgeEl.innerText = "CAUTIOUS";
      } else {
        badgeEl.className = "px-2.5 py-0.5 text-[10px] font-bold rounded-full badge-reliable";
        badgeEl.innerText = "RELIABLE";
      }
    };
    applyBadge(elReliabilityBadge);
    applyBadge(elUncertaintyStatusBadge);

    if (elBacktrackAlert) {
      if (rel.status === "UNRELIABLE") {
        elBacktrackAlert.classList.remove("hidden");
      } else {
        elBacktrackAlert.classList.add("hidden");
      }
    }

    // 5. First-Person Viewport
    if (elVpHeadingTag) elVpHeadingTag.innerText = `View Heading: ${state.state.heading}°`;
    const icon = ROOM_ICONS[state.state.current_room] || "🏠";
    if (elRoomIconContainer) elRoomIconContainer.innerText = icon;
    if (elVpRoomName) elVpRoomName.innerText = state.state.current_room.replace(/_/g, " ");
    if (elVpDesc) elVpDesc.innerText = `"${state.state.current_view_desc}"`;

    if (elOverviewRoomIcon) elOverviewRoomIcon.innerText = icon;
    if (elOverviewRoomName) elOverviewRoomName.innerText = state.state.current_room.replace(/_/g, " ");
    if (elOverviewRoomTag) elOverviewRoomTag.innerText = state.state.current_room.replace(/_/g, " ");
    if (elOverviewRoomDesc) elOverviewRoomDesc.innerText = `"${state.state.current_view_desc}"`;

    // Viewport candidate action arrows overlay
    if (elVpActionArrows) {
      elVpActionArrows.innerHTML = "";
      (state.candidates || []).forEach((c, idx) => {
        const btn = document.createElement("button");
        btn.className = `px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
          c.is_selected
            ? "bg-cyan-600 text-white ring-2 ring-cyan-300 shadow-md shadow-cyan-900"
            : "bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700"
        }`;
        const arrowIcon = c.action_type === "STOP" ? "🛑" : (c.relative_heading < -15 ? "↖" : (c.relative_heading > 15 ? "↗" : "↑"));
        const label = c.action_type === "STOP" ? "STOP" : `${arrowIcon} ${c.target_room} (${(c.probability * 100).toFixed(0)}%)`;
        btn.innerHTML = label;
        btn.title = `Manual override: choose candidate ${idx}`;
        btn.onclick = () => stepSimulation(idx);
        elVpActionArrows.appendChild(btn);
      });
    }

    // 6. Action Policy Distribution
    if (elCandidatesList) {
      elCandidatesList.innerHTML = "";
      (state.candidates || []).forEach((c, idx) => {
        const item = document.createElement("div");
        item.className = `p-2.5 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 candidate-row ${
          c.is_selected
            ? "bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-950/40"
            : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
        }`;
        item.onclick = () => stepSimulation(idx);

        const headingLabel = c.action_type === "STOP" ? "Declare Destination" : `${c.relative_heading >= 0 ? "+" : ""}${c.relative_heading.toFixed(0)}° relative`;
        const actionName = c.action_type === "STOP" ? "🛑 [STOP Action]" : `➡️ Move to ${c.target_room.replace(/_/g, " ")}`;

        item.innerHTML = `
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5">
              <span class="font-bold ${c.is_selected ? "text-cyan-300" : "text-white"}">${actionName}</span>
              <span class="text-[10px] text-slate-400">(${headingLabel})</span>
            </div>
            <div class="flex items-center gap-2">
              ${c.is_selected ? '<span class="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">Agent Choice</span>' : ''}
              <span class="font-mono text-xs font-bold ${c.is_selected ? "text-cyan-300" : "text-slate-300"}">${(c.probability * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div class="h-full rounded-full transition-all duration-300 ${c.is_selected ? "bg-cyan-400" : "bg-slate-600"}" style="width: ${(c.probability * 100).toFixed(1)}%"></div>
          </div>
        `;
        elCandidatesList.appendChild(item);
      });
    }

    // 7. Route Progression & Metrics
    const progVal = Math.min(100, Math.round(state.progress * 100));
    if (elProgressPercent) elProgressPercent.innerText = `${progVal}%`;
    if (elFloorplanProgressPercent) elFloorplanProgressPercent.innerText = `${progVal}%`;
    if (elProgressBarFill) elProgressBarFill.style.width = `${progVal}%`;

    const m = state.metrics || {};
    if (elFloorplanDistText) elFloorplanDistText.innerText = `${state.state.trajectory_length} m`;
    if (elFloorplanGoalDist) elFloorplanGoalDist.innerText = `${m.navigation_error !== undefined ? m.navigation_error : "--"} m`;

    if (elMetricSr) {
      if (state.state.is_terminal) {
        if (m.success) {
          elMetricSr.innerText = "SUCCESS (100%)";
          elMetricSr.className = "text-2xl font-black text-emerald-400 font-mono";
        } else {
          elMetricSr.innerText = "FAILED (0%)";
          elMetricSr.className = "text-2xl font-black text-rose-400 font-mono";
        }
      } else {
        elMetricSr.innerText = "In Progress";
        elMetricSr.className = "text-2xl font-black text-amber-400 font-mono";
      }
    }

    if (elMetricSpl) elMetricSpl.innerText = state.state.is_terminal ? `${m.spl}%` : "--";
    if (elMetricNdtw) elMetricNdtw.innerText = `${m.ndtw}%`;
    if (elMetricNe) elMetricNe.innerText = `${m.navigation_error} m`;

    // 8. Traversal History Log in Floorplan section
    if (elFloorplanHistoryList && state.state.trajectory_nodes) {
      elFloorplanHistoryList.innerHTML = "";
      const traj = state.state.trajectory_nodes;
      if (elVisitedCountTag) elVisitedCountTag.innerText = `${traj.length} node${traj.length === 1 ? "" : "s"}`;

      traj.forEach((nodeId, idx) => {
        const row = document.createElement("div");
        const isCurrent = idx === traj.length - 1;
        const isStart = idx === 0;
        const nodeData = (state.graph && state.graph.nodes) ? state.graph.nodes[nodeId] : null;
        const roomName = nodeData ? nodeData.room_type.replace(/_/g, " ") : nodeId;

        row.className = `p-2 rounded-lg flex items-center justify-between border ${
          isCurrent 
            ? "bg-cyan-950/40 border-cyan-700/60 text-cyan-200" 
            : "bg-slate-900/60 border-slate-800/80 text-slate-300"
        }`;
        row.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
              isCurrent ? "bg-cyan-600 text-white" : (isStart ? "bg-blue-900 text-blue-300" : "bg-slate-800 text-slate-400")
            }">
              ${idx}
            </span>
            <span class="font-medium capitalize text-xs">${roomName}</span>
            <span class="text-[10px] font-mono text-slate-500">(${nodeId})</span>
          </div>
          <div>
            ${isCurrent ? '<span class="text-[10px] bg-cyan-900/50 text-cyan-300 px-1.5 py-0.5 rounded font-bold">CURRENT</span>' : ''}
            ${isStart ? '<span class="text-[10px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded">START</span>' : ''}
          </div>
        `;
        elFloorplanHistoryList.appendChild(row);
      });
    }

    // 9. Render Canvas Graph
    renderGraph(state);
  }

  // Draw 2D Floorplan Graph
  function renderGraph(state) {
    if (!state || !state.graph || !ctx || !elCanvas) return;
    const { nodes, edges } = state.graph;
    const W = elCanvas.width;
    const H = elCanvas.height;

    ctx.clearRect(0, 0, W, H);

    // Compute bounding box to fit canvas
    const xs = Object.values(nodes).map(n => n.x);
    const ys = Object.values(nodes).map(n => n.y);
    const minX = Math.min(...xs) - 1.5;
    const maxX = Math.max(...xs) + 1.5;
    const minY = Math.min(...ys) - 1.5;
    const maxY = Math.max(...ys) + 1.5;

    const spanX = Math.max(maxX - minX, 1.0);
    const spanY = Math.max(maxY - minY, 1.0);

    const pad = 45;
    const toCanvasX = (x) => pad + ((x - minX) / spanX) * (W - 2 * pad);
    // Invert Y so North (+Y) points UP
    const toCanvasY = (y) => H - (pad + ((y - minY) / spanY) * (H - 2 * pad));

    // 1. Draw Edges
    edges.forEach(e => {
      const u = nodes[e.from];
      const v = nodes[e.to];
      if (!u || !v) return;

      const ux = toCanvasX(u.x), uy = toCanvasY(u.y);
      const vx = toCanvasX(v.x), vy = toCanvasY(v.y);

      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(vx, vy);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 4;
      ctx.stroke();
    });

    // 2. Draw Reference Ground Truth Trajectory (Dashed Gold)
    const refPath = state.episode.reference_path || [];
    if (refPath.length >= 2) {
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
      ctx.lineWidth = 3.5;
      const startP = nodes[refPath[0]];
      if (startP) {
        ctx.moveTo(toCanvasX(startP.x), toCanvasY(startP.y));
        for (let i = 1; i < refPath.length; i++) {
          const pt = nodes[refPath[i]];
          if (pt) ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 3. Draw Traversed Agent Trajectory (Solid Glowing Cyan)
    const traj = state.state.trajectory_nodes || [];
    if (traj.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 4.5;
      ctx.shadowColor = "rgba(6, 182, 212, 0.9)";
      ctx.shadowBlur = 10;
      const startN = nodes[traj[0]];
      if (startN) {
        ctx.moveTo(toCanvasX(startN.x), toCanvasY(startN.y));
        for (let i = 1; i < traj.length; i++) {
          const pt = nodes[traj[i]];
          if (pt) ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // 4. Draw Viewpoint Nodes
    Object.values(nodes).forEach(n => {
      const cx = toCanvasX(n.x);
      const cy = toCanvasY(n.y);

      // Node base circle
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, 2 * Math.PI);

      if (n.is_goal) {
        ctx.fillStyle = "#10b981";
      } else if (n.is_start) {
        ctx.fillStyle = "#3b82f6";
      } else if (n.is_visited) {
        ctx.fillStyle = "#0891b2";
      } else {
        ctx.fillStyle = "#334155";
      }
      ctx.fill();
      ctx.strokeStyle = n.is_current ? "#ffffff" : "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Goal target ring
      if (n.is_goal) {
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.8)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Room label
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      const cleanName = n.room_type.replace(/_/g, " ");
      ctx.fillText(cleanName, cx, cy - 16);
    });

    // 5. Draw Agent with Directional Heading Cone at Current Node
    const currNode = nodes[state.state.current_node];
    if (currNode) {
      const ax = toCanvasX(currNode.x);
      const ay = toCanvasY(currNode.y);
      const headingRad = (state.state.heading - 90) * (Math.PI / 180); // 0=North is -Y on canvas

      // Heading FOV Cone
      const fovAngle = Math.PI / 3; // 60 degrees
      const coneLength = 40;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.arc(ax, ay, coneLength, headingRad - fovAngle / 2, headingRad + fovAngle / 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(6, 182, 212, 0.4)";
      ctx.fill();

      // Agent marker circle
      ctx.beginPath();
      ctx.arc(ax, ay, 8, 0, 2 * Math.PI);
      ctx.fillStyle = "#22d3ee";
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // Event Listeners
  if (elEpisodeSelect) {
    elEpisodeSelect.addEventListener("change", (e) => {
      stopAutoPlay();
      resetEpisode(e.target.value, currentLanguage);
    });
  }

  if (elBtnReset) {
    elBtnReset.addEventListener("click", () => {
      stopAutoPlay();
      resetEpisode(elEpisodeSelect.value, currentLanguage);
    });
  }

  if (elBtnStep) {
    elBtnStep.addEventListener("click", () => {
      stepSimulation();
    });
  }

  if (elBtnPlay) {
    elBtnPlay.addEventListener("click", () => {
      toggleAutoPlay();
    });
  }

  if (elBtnBacktrack) {
    elBtnBacktrack.addEventListener("click", () => {
      stopAutoPlay();
      backtrack();
    });
  }

  if (elBtnBacktrackAlert) {
    elBtnBacktrackAlert.addEventListener("click", () => {
      stopAutoPlay();
      backtrack();
    });
  }

  if (langButtons.en) langButtons.en.addEventListener("click", () => switchLanguage("en"));
  if (langButtons.hi) langButtons.hi.addEventListener("click", () => switchLanguage("hi"));
  if (langButtons.te) langButtons.te.addEventListener("click", () => switchLanguage("te"));

  // User session sync
  (function initUserSession() {
    const raw = localStorage.getItem('rxr_session') || sessionStorage.getItem('rxr_session');
    if (raw) {
      try {
        const sess = JSON.parse(raw);
        const nameEl = document.getElementById('user-display-name');
        if (nameEl && sess.username) {
          nameEl.textContent = sess.username;
        }
      } catch (_) {}
    }
  })();

  // Global logout handler
  window.logout = function() {
    localStorage.removeItem('rxr_session');
    sessionStorage.removeItem('rxr_session');
    window.location.href = 'login.html?logout=true';
  };

  // Initial boot
  fetchInitialState();
})();
