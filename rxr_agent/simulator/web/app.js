// RxR VLN Interactive Simulator Client Application
(function() {
  let simState = null;
  let isPlaying = false;
  let playTimer = null;
  let currentLanguage = "en";

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
  const elEntropyValue = document.getElementById("entropy-value");
  const elEntropyBar = document.getElementById("entropy-bar");
  const elConfidenceValue = document.getElementById("confidence-value");
  const elConfidenceBar = document.getElementById("confidence-bar");
  const elDiagnosticText = document.getElementById("diagnostic-text");
  const elBacktrackAlert = document.getElementById("backtrack-alert");
  const elBtnBacktrackAlert = document.getElementById("btn-backtrack-alert");

  const elVpHeadingTag = document.getElementById("viewport-heading-tag");
  const elRoomIconContainer = document.getElementById("room-icon-container");
  const elVpRoomName = document.getElementById("vp-room-name");
  const elVpDesc = document.getElementById("vp-description");
  const elVpActionArrows = document.getElementById("viewport-action-arrows");

  const elCandidatesList = document.getElementById("candidates-list");
  const elProgressPercent = document.getElementById("progress-percent");
  const elProgressBarFill = document.getElementById("progress-bar-fill");

  const elMetricSr = document.getElementById("metric-sr");
  const elMetricSpl = document.getElementById("metric-spl");
  const elMetricNdtw = document.getElementById("metric-ndtw");
  const elMetricNe = document.getElementById("metric-ne");

  const elCanvas = document.getElementById("graph-canvas");
  const ctx = elCanvas.getContext("2d");

  const elBtnReset = document.getElementById("btn-reset");
  const elBtnStep = document.getElementById("btn-step");
  const elBtnPlay = document.getElementById("btn-play");
  const elBtnBacktrack = document.getElementById("btn-backtrack");
  const elSpeedSelect = document.getElementById("speed-select");

  const langButtons = {
    en: document.getElementById("lang-en"),
    hi: document.getElementById("lang-hi"),
    te: document.getElementById("lang-te")
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
      console.error("Failed to fetch initial state:", err);
    }
  }

  async function resetEpisode(episodeId, lang) {
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode_id: episodeId, language: lang })
      });
      const data = await res.json();
      updateUI(data);
    } catch (err) {
      console.error("Reset failed:", err);
    }
  }

  async function stepSimulation(overrideIdx = null) {
    try {
      const body = overrideIdx !== null ? { override_action_index: overrideIdx } : {};
      const res = await fetch("/api/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      updateUI(data);

      if (data.state.is_terminal && isPlaying) {
        stopAutoPlay();
      }
    } catch (err) {
      console.error("Step failed:", err);
      stopAutoPlay();
    }
  }

  async function switchLanguage(lang) {
    currentLanguage = lang;
    // Update button active states
    Object.keys(langButtons).forEach(k => {
      if (k === lang) {
        langButtons[k].classList.add("bg-cyan-600", "text-white");
        langButtons[k].classList.remove("text-slate-300");
      } else {
        langButtons[k].classList.remove("bg-cyan-600", "text-white");
        langButtons[k].classList.add("text-slate-300");
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
      console.error("Switch language failed:", err);
    }
  }

  async function backtrack() {
    try {
      const res = await fetch("/api/backtrack", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      updateUI(data);
    } catch (err) {
      console.error("Backtrack failed:", err);
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
      return;
    }
    isPlaying = true;
    elBtnPlay.innerText = "Pause";
    elBtnPlay.classList.replace("bg-emerald-600", "bg-amber-600");
    elBtnPlay.classList.replace("hover:bg-emerald-500", "hover:bg-amber-500");

    const speed = parseInt(elSpeedSelect.value, 10) || 700;
    playTimer = setInterval(() => {
      stepSimulation();
    }, speed);
  }

  function stopAutoPlay() {
    isPlaying = false;
    clearInterval(playTimer);
    playTimer = null;
    elBtnPlay.innerText = "Auto Play";
    elBtnPlay.classList.replace("bg-amber-600", "bg-emerald-600");
    elBtnPlay.classList.replace("hover:bg-amber-500", "hover:bg-emerald-500");
  }

  // Update UI with simulation state
  function updateUI(state) {
    simState = state;
    if (!state || !state.episode) return;

    // 1. Header & Episode
    elEpisodeSelect.value = state.episode.id;
    if (state.episode.is_unseen) {
      elSplitBadge.innerText = "Val-Unseen (Zero-Shot)";
      elSplitBadge.className = "px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-950 text-purple-300 border border-purple-800";
    } else {
      elSplitBadge.innerText = "Val-Seen";
      elSplitBadge.className = "px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800";
    }

    // 2. Multilingual Instruction with Word Attention Heatmap
    elTargetRoom.innerText = state.episode.goal_node.replace(/.*_/, "");
    elTargetLms.innerText = (state.episode.target_landmarks || []).join(", ");

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

    // 3. Current State
    elStepCounter.innerText = `Step: ${state.state.step_count} / ${state.state.max_steps}`;
    elCurrentRoomText.innerText = state.state.current_room.replace(/_/g, " ");
    elCurrentNodeText.innerText = state.state.current_node;
    elHeadingText.innerHTML = `${state.state.heading}&deg;`;
    elDistanceText.innerText = `${state.state.trajectory_length} m`;

    // Detected landmarks
    const lms = state.state.current_landmarks || [];
    if (lms.length > 0) {
      elDetectedLandmarks.innerHTML = lms.map(lm =>
        `<span class="text-xs bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">${lm.replace(/_/g, " ")}</span>`
      ).join(" ");
    } else {
      elDetectedLandmarks.innerHTML = `<span class="text-xs text-slate-500 italic">No salient landmarks</span>`;
    }

    // 4. Uncertainty & Reliability
    const rel = state.reliability || {};
    elEntropyValue.innerText = `${rel.normalized_entropy !== undefined ? rel.normalized_entropy.toFixed(2) : "--"}`;
    elEntropyBar.style.width = `${Math.min(100, (rel.normalized_entropy || 0) * 100)}%`;

    const conf = (rel.confidence || 0) * 100;
    elConfidenceValue.innerText = `${conf.toFixed(1)}%`;
    elConfidenceBar.style.width = `${conf}%`;

    elDiagnosticText.innerText = rel.diagnostic_message || "Analyzing perception and trajectory alignment...";

    // Badge styling
    if (rel.status === "UNRELIABLE") {
      elReliabilityBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full badge-unreliable";
      elReliabilityBadge.innerText = "UNRELIABLE";
      elEntropyBar.className = "bg-rose-500 h-full rounded-full transition-all duration-300";
      elBacktrackAlert.classList.remove("hidden");
    } else if (rel.status === "CAUTIOUS") {
      elReliabilityBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full badge-cautious";
      elReliabilityBadge.innerText = "CAUTIOUS";
      elEntropyBar.className = "bg-amber-500 h-full rounded-full transition-all duration-300";
      elBacktrackAlert.classList.add("hidden");
    } else {
      elReliabilityBadge.className = "px-2.5 py-0.5 text-xs font-bold rounded-full badge-reliable";
      elReliabilityBadge.innerText = "RELIABLE";
      elEntropyBar.className = "bg-cyan-500 h-full rounded-full transition-all duration-300";
      elBacktrackAlert.classList.add("hidden");
    }

    // 5. First-Person Viewport
    elVpHeadingTag.innerText = `View Heading: ${state.state.heading}°`;
    const icon = ROOM_ICONS[state.state.current_room] || "🏠";
    elRoomIconContainer.innerText = icon;
    elVpRoomName.innerText = state.state.current_room.replace(/_/g, " ");
    elVpDesc.innerText = `"${state.state.current_view_desc}"`;

    // Viewport candidate action arrows overlay
    elVpActionArrows.innerHTML = "";
    (state.candidates || []).forEach((c, idx) => {
      const btn = document.createElement("button");
      btn.className = `px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
        c.is_selected
          ? "bg-cyan-600 text-white ring-2 ring-cyan-300 shadow-md shadow-cyan-900"
          : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
      }`;
      const arrowIcon = c.action_type === "STOP" ? "🛑" : (c.relative_heading < -15 ? "↖" : (c.relative_heading > 15 ? "↗" : "↑"));
      const label = c.action_type === "STOP" ? "STOP" : `${arrowIcon} ${c.target_room} (${(c.probability * 100).toFixed(0)}%)`;
      btn.innerHTML = label;
      btn.title = `Manual override: choose candidate ${idx}`;
      btn.onclick = () => stepSimulation(idx);
      elVpActionArrows.appendChild(btn);
    });

    // 6. Action Policy Distribution
    elCandidatesList.innerHTML = "";
    (state.candidates || []).forEach((c, idx) => {
      const item = document.createElement("div");
      item.className = `p-2 rounded-lg border transition cursor-pointer flex flex-col gap-1 ${
        c.is_selected
          ? "bg-cyan-950/40 border-cyan-600/80 shadow-sm"
          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
      }`;
      item.onclick = () => stepSimulation(idx);

      const headingLabel = c.action_type === "STOP" ? "Declare Destination" : `${c.relative_heading >= 0 ? "+" : ""}${c.relative_heading.toFixed(0)}° relative`;
      const actionName = c.action_type === "STOP" ? "🛑 [STOP]" : `➡️ Move to ${c.target_room}`;

      item.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5">
            <span class="font-bold ${c.is_selected ? "text-cyan-300" : "text-white"}">${actionName}</span>
            <span class="text-[10px] text-slate-400">(${headingLabel})</span>
          </div>
          <div class="flex items-center gap-2">
            ${c.is_selected ? '<span class="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">Agent Choice</span>' : ''}
            <span class="font-mono text-xs font-bold ${c.is_selected ? "text-cyan-300" : "text-slate-300"}">${(c.probability * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
          <div class="h-full rounded-full transition-all duration-300 ${c.is_selected ? "bg-cyan-400" : "bg-slate-600"}" style="width: ${(c.probability * 100).toFixed(1)}%"></div>
        </div>
      `;
      elCandidatesList.appendChild(item);
    });

    // 7. Route Progression & Metrics
    const progVal = Math.min(100, Math.round(state.progress * 100));
    elProgressPercent.innerText = `${progVal}%`;
    elProgressBarFill.style.width = `${progVal}%`;

    const m = state.metrics || {};
    if (state.state.is_terminal) {
      if (m.success) {
        elMetricSr.innerText = "SUCCESS (100%)";
        elMetricSr.className = "text-sm font-bold text-emerald-400";
      } else {
        elMetricSr.innerText = "FAILED (0%)";
        elMetricSr.className = "text-sm font-bold text-rose-400";
      }
    } else {
      elMetricSr.innerText = "In Progress";
      elMetricSr.className = "text-sm font-bold text-amber-400";
    }

    elMetricSpl.innerText = state.state.is_terminal ? `${m.spl}%` : "--";
    elMetricNdtw.innerText = `${m.ndtw}%`;
    elMetricNe.innerText = `${m.navigation_error} m`;

    // 8. Render Canvas Graph
    renderGraph(state);
  }

  // Draw 2D Floorplan Graph
  function renderGraph(state) {
    if (!state || !state.graph) return;
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

    const pad = 35;
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
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // 2. Draw Reference Ground Truth Trajectory (Dashed Gold)
    const refPath = state.episode.reference_path || [];
    if (refPath.length >= 2) {
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
      ctx.lineWidth = 3;
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
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(6, 182, 212, 0.8)";
      ctx.shadowBlur = 8;
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
      ctx.arc(cx, cy, 10, 0, 2 * Math.PI);

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
      ctx.lineWidth = 2;
      ctx.stroke();

      // Goal target ring
      if (n.is_goal) {
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, 2 * Math.PI);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Room label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      const cleanName = n.room_type.replace(/_/g, " ");
      ctx.fillText(cleanName, cx, cy - 14);
    });

    // 5. Draw Agent with Directional Heading Cone at Current Node
    const currNode = nodes[state.state.current_node];
    if (currNode) {
      const ax = toCanvasX(currNode.x);
      const ay = toCanvasY(currNode.y);
      const headingRad = (state.state.heading - 90) * (Math.PI / 180); // 0=North is -Y on canvas

      // Heading FOV Cone
      const fovAngle = Math.PI / 3; // 60 degrees
      const coneLength = 32;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.arc(ax, ay, coneLength, headingRad - fovAngle / 2, headingRad + fovAngle / 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(6, 182, 212, 0.35)";
      ctx.fill();

      // Agent marker circle
      ctx.beginPath();
      ctx.arc(ax, ay, 7, 0, 2 * Math.PI);
      ctx.fillStyle = "#22d3ee";
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Event Listeners
  elEpisodeSelect.addEventListener("change", (e) => {
    stopAutoPlay();
    resetEpisode(e.target.value, currentLanguage);
  });

  elBtnReset.addEventListener("click", () => {
    stopAutoPlay();
    resetEpisode(elEpisodeSelect.value, currentLanguage);
  });

  elBtnStep.addEventListener("click", () => {
    stepSimulation();
  });

  elBtnPlay.addEventListener("click", () => {
    toggleAutoPlay();
  });

  elBtnBacktrack.addEventListener("click", () => {
    stopAutoPlay();
    backtrack();
  });

  elBtnBacktrackAlert.addEventListener("click", () => {
    stopAutoPlay();
    backtrack();
  });

  langButtons.en.addEventListener("click", () => switchLanguage("en"));
  langButtons.hi.addEventListener("click", () => switchLanguage("hi"));
  langButtons.te.addEventListener("click", () => switchLanguage("te"));

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
