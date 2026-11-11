// RxR VLN Interactive Simulator Client Application with Google Maps Navigation
(function() {
  let simState = null;
  let isPlaying = false;
  let playTimer = null;
  let currentLanguage = "en";
  let activeTab = "action";

  // Google Maps & Smooth Motion State
  let animAgent = {
    x: 0,
    y: 0,
    heading: 0,
    fromX: 0,
    fromY: 0,
    fromHeading: 0,
    targetX: 0,
    targetY: 0,
    targetHeading: 0,
    startTime: 0,
    duration: 1600, // Default slow walking pace
    isMoving: false,
    speedMps: 1.1,
    footsteps: []
  };

  let mapZoom = 1.0;
  let mapPanX = 0;
  let mapPanY = 0;
  let animFrameId = null;

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

  const elTopPaceText = document.getElementById("top-pace-text");
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

  // Google Maps Banner Elements
  const elGmapTurnIcon = document.getElementById("gmap-turn-icon");
  const elGmapPrimaryInst = document.getElementById("gmap-primary-instruction");
  const elGmapSecondaryInst = document.getElementById("gmap-secondary-instruction");
  const elGmapLandmarkPrompt = document.getElementById("gmap-landmark-prompt");
  const elGmapEtaDist = document.getElementById("gmap-eta-dist");
  const elGmapLiveSpeed = document.getElementById("gmap-live-speed");
  const elHudSpeedometerVal = document.getElementById("hud-speedometer-val");
  const elHudNextRoom = document.getElementById("hud-next-room");
  const elGmapRouteStepsContainer = document.getElementById("gmap-route-steps-container");
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

    if (tabId === "floorplan" && simState) {
      setTimeout(() => {
        window.recenterMap();
      }, 50);
    }
  };

  // Google Maps Zoom & Recenter controls
  window.zoomMap = function(factor) {
    mapZoom = Math.max(0.6, Math.min(2.5, mapZoom * factor));
  };

  window.recenterMap = function() {
    mapZoom = 1.0;
    mapPanX = 0;
    mapPanY = 0;
  };

  // Cubic ease-in-out
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Shortest angular difference (-180 to +180)
  function angleDiff(a, b) {
    let diff = (b - a) % 360;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    return diff;
  }

  // Continuous animation loop for Google Maps canvas rendering (60 FPS)
  function startAnimationLoop() {
    function loop(timestamp) {
      if (animAgent.isMoving) {
        const elapsed = timestamp - animAgent.startTime;
        const rawT = Math.min(1.0, elapsed / animAgent.duration);
        const t = easeInOutCubic(rawT);

        // Interpolate position
        animAgent.x = animAgent.fromX + (animAgent.targetX - animAgent.fromX) * t;
        animAgent.y = animAgent.fromY + (animAgent.targetY - animAgent.fromY) * t;

        // Interpolate heading along shortest arc
        const deltaH = angleDiff(animAgent.fromHeading, animAgent.targetHeading);
        animAgent.heading = (animAgent.fromHeading + deltaH * t + 360) % 360;

        // Leave footstep crumbs along the route
        if (Math.random() < 0.25) {
          animAgent.footsteps.push({
            x: animAgent.x,
            y: animAgent.y,
            heading: animAgent.heading,
            time: timestamp
          });
          if (animAgent.footsteps.length > 25) animAgent.footsteps.shift();
        }

        // Update live speedometer HUD
        if (elHudSpeedometerVal) {
          elHudSpeedometerVal.innerText = `Walking: ${animAgent.speedMps} m/s (Moving)`;
        }
        if (elGmapLiveSpeed) {
          elGmapLiveSpeed.innerText = `${animAgent.speedMps} m/s`;
        }
        if (elTopPaceText) {
          elTopPaceText.innerText = `${animAgent.speedMps} m/s (Moving 🚶)`;
        }

        if (rawT >= 1.0) {
          animAgent.isMoving = false;
          animAgent.x = animAgent.targetX;
          animAgent.y = animAgent.targetY;
          animAgent.heading = animAgent.targetHeading;

          if (elHudSpeedometerVal) {
            elHudSpeedometerVal.innerText = `Pace: ${animAgent.speedMps} m/s (Paused)`;
          }
          if (elTopPaceText) {
            elTopPaceText.innerText = `${animAgent.speedMps} m/s (Walking)`;
          }

          // If auto-play active, trigger next step after short pause
          if (isPlaying && simState && !simState.state.is_terminal) {
            playTimer = setTimeout(() => {
              stepSimulation();
            }, 350);
          }
        }
      }

      // Draw Google Maps Frame
      if (simState && ctx && elCanvas && activeTab === "floorplan") {
        renderGoogleMap(timestamp);
      }

      animFrameId = requestAnimationFrame(loop);
    }
    animFrameId = requestAnimationFrame(loop);
  }

  // Initiate smooth transition when agent moves to a new node
  function triggerSmoothMovement(fromNodeId, toNodeId, targetHeadingDeg) {
    if (!simState || !simState.graph || !simState.graph.nodes) return;
    const nodes = simState.graph.nodes;
    const fromNode = nodes[fromNodeId];
    const toNode = nodes[toNodeId];
    if (!fromNode || !toNode) return;

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const distMeters = Math.sqrt(dx * dx + dy * dy);

    // Duration based on speed selector (slow walking pace is default)
    const selectedDuration = parseInt(elSpeedSelect.value, 10) || 1600;
    const duration = distMeters > 0 ? selectedDuration : 600;
    const speed = distMeters > 0 ? (distMeters / (duration / 1000)).toFixed(1) : "1.0";

    animAgent.fromX = animAgent.x || fromNode.x;
    animAgent.fromY = animAgent.y || fromNode.y;
    animAgent.fromHeading = animAgent.heading !== undefined ? animAgent.heading : fromNode.heading || 0;

    animAgent.targetX = toNode.x;
    animAgent.targetY = toNode.y;
    animAgent.targetHeading = targetHeadingDeg !== undefined ? targetHeadingDeg : toNode.heading || 0;

    animAgent.startTime = performance.now();
    animAgent.duration = duration;
    animAgent.speedMps = speed;
    animAgent.isMoving = true;

    if (elHudNextRoom) {
      elHudNextRoom.innerText = toNode.room_type.replace(/_/g, " ");
    }
  }

  // API Calls
  async function fetchInitialState() {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      if (data && data.episode) {
        initPositionFromState(data);
        updateUI(data);
      } else {
        await resetEpisode(elEpisodeSelect.value, currentLanguage);
      }
    } catch (err) {
      console.warn("Falling back to fresh episode init:", err);
      await resetEpisode(elEpisodeSelect.value, currentLanguage);
    }
  }

  function initPositionFromState(state) {
    if (state && state.graph && state.graph.nodes && state.state) {
      const curr = state.graph.nodes[state.state.current_node];
      if (curr) {
        animAgent.x = curr.x;
        animAgent.y = curr.y;
        animAgent.fromX = curr.x;
        animAgent.fromY = curr.y;
        animAgent.targetX = curr.x;
        animAgent.targetY = curr.y;
        animAgent.heading = state.state.heading || 0;
        animAgent.fromHeading = state.state.heading || 0;
        animAgent.targetHeading = state.state.heading || 0;
        animAgent.isMoving = false;
      }
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
      animAgent.footsteps = [];
      initPositionFromState(data);
      updateUI(data);
    } catch (err) {
      console.error("Failed to reset episode:", err);
    }
  }

  async function stepSimulation(actionIndex) {
    if (animAgent.isMoving) return; // Prevent double stepping during animation

    try {
      const prevNodeId = simState ? simState.state.current_node : null;
      const payload = actionIndex !== undefined ? { action_index: actionIndex } : {};
      const res = await fetch("/api/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      const nextNodeId = data.state.current_node;
      const nextHeading = data.state.heading;

      // Start smooth interpolated movement from prevNode to nextNode
      if (prevNodeId && nextNodeId) {
        triggerSmoothMovement(prevNodeId, nextNodeId, nextHeading);
      }

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
      const prevNodeId = simState ? simState.state.current_node : null;
      const res = await fetch("/api/backtrack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      const nextNodeId = data.state.current_node;
      if (prevNodeId && nextNodeId) {
        triggerSmoothMovement(prevNodeId, nextNodeId, data.state.heading);
      }
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
        stepSimulation();
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
    stepSimulation();
  }

  function stopAutoPlay() {
    isPlaying = false;
    clearTimeout(playTimer);
    playTimer = null;
    if (elPlayIcon) elPlayIcon.innerText = "▶";
    if (elPlayText) elPlayText.innerText = "Auto Walk";
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
    const goalClean = state.episode.goal_node.replace(/.*_/, "");
    if (elTargetRoom) elTargetRoom.innerText = goalClean;
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

    // 6. Action Policy Distribution with "Where to Go" vs "Where NOT to go"
    const refPath = state.episode.reference_path || [];
    const currNodeIndex = refPath.indexOf(state.state.current_node);
    const recommendedNextNode = currNodeIndex >= 0 && currNodeIndex < refPath.length - 1 ? refPath[currNodeIndex + 1] : null;

    if (elCandidatesList) {
      elCandidatesList.innerHTML = "";
      (state.candidates || []).forEach((c, idx) => {
        const item = document.createElement("div");
        const isRecommended = (c.target_node === recommendedNextNode) || (c.action_type === "STOP" && currNodeIndex === refPath.length - 1);
        const isDeviation = !isRecommended && c.action_type !== "STOP";

        item.className = `p-2.5 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 candidate-row ${
          c.is_selected
            ? "bg-cyan-950/50 border-cyan-500/80 shadow-md shadow-cyan-950/40"
            : (isRecommended ? "bg-emerald-950/30 border-emerald-800/60" : "bg-slate-900/70 border-slate-800 hover:border-slate-700")
        }`;
        item.onclick = () => stepSimulation(idx);

        const headingLabel = c.action_type === "STOP" ? "Declare Destination" : `${c.relative_heading >= 0 ? "+" : ""}${c.relative_heading.toFixed(0)}° relative`;
        const actionName = c.action_type === "STOP" ? "🛑 [STOP Action]" : `➡️ Move to ${c.target_room.replace(/_/g, " ")}`;

        // Badge indicating Where to go vs Where NOT to go
        let routeBadge = "";
        if (isRecommended) {
          routeBadge = '<span class="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1"><span>✅</span> Where to Go</span>';
        } else if (isDeviation) {
          routeBadge = '<span class="text-[10px] uppercase font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800 flex items-center gap-1"><span>⛔</span> Avoid (Deviation)</span>';
        }

        item.innerHTML = `
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="font-bold ${c.is_selected ? "text-cyan-300" : (isRecommended ? "text-emerald-300" : "text-white")}">${actionName}</span>
              <span class="text-[10px] text-slate-400 font-mono">(${headingLabel})</span>
            </div>
            <div class="flex items-center gap-2">
              ${routeBadge}
              ${c.is_selected ? '<span class="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">Agent Choice</span>' : ''}
              <span class="font-mono text-xs font-bold ${c.is_selected ? "text-cyan-300" : "text-slate-300"}">${(c.probability * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div class="h-full rounded-full transition-all duration-300 ${c.is_selected ? "bg-cyan-400" : (isRecommended ? "bg-emerald-500" : "bg-slate-600")}" style="width: ${(c.probability * 100).toFixed(1)}%"></div>
          </div>
        `;
        elCandidatesList.appendChild(item);
      });
    }

    // 7. Update Google Maps Turn-by-Turn Guidance Banner
    updateGoogleMapsBanner(state, refPath, currNodeIndex);

    // 8. Update Metrics
    const m = state.metrics || {};
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

    // 9. Traversal History Log in Floorplan section
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

    // 10. Update Google Maps Itinerary steps
    updateGoogleMapsItinerary(state, refPath, currNodeIndex);
  }

  // Google Maps Turn-by-Turn Banner calculation
  function updateGoogleMapsBanner(state, refPath, currNodeIndex) {
    if (!elGmapPrimaryInst || !state) return;
    const isAtGoal = state.state.is_terminal || currNodeIndex === refPath.length - 1;
    const remainingSteps = Math.max(0, refPath.length - 1 - Math.max(0, currNodeIndex));
    const distToGoal = state.metrics && state.metrics.navigation_error !== undefined ? state.metrics.navigation_error : 0;

    if (elGmapEtaDist) {
      elGmapEtaDist.innerText = `${distToGoal.toFixed(1)} m • ${remainingSteps} step${remainingSteps === 1 ? "" : "s"}`;
    }

    const landmarkText = (state.episode.target_landmarks || [])[0] || state.episode.goal_node.replace(/.*_/, "");
    if (elGmapLandmarkPrompt) elGmapLandmarkPrompt.innerText = landmarkText;

    if (isAtGoal) {
      if (elGmapTurnIcon) elGmapTurnIcon.innerText = "🏁";
      elGmapPrimaryInst.innerText = `You have arrived at your destination: ${state.state.current_room.replace(/_/g, " ")}`;
      if (elGmapSecondaryInst) elGmapSecondaryInst.innerHTML = `<span>Target landmark reached:</span> <strong class="underline">${landmarkText}</strong>`;
      return;
    }

    if (currNodeIndex >= 0 && currNodeIndex < refPath.length - 1) {
      const nextNodeId = refPath[currNodeIndex + 1];
      const nextNode = state.graph.nodes[nextNodeId];
      const currNode = state.graph.nodes[state.state.current_node];

      if (currNode && nextNode) {
        const dx = nextNode.x - currNode.x;
        const dy = nextNode.y - currNode.y;
        const stepDist = Math.sqrt(dx * dx + dy * dy).toFixed(1);
        const targetBearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
        const relAngle = angleDiff(state.state.heading, targetBearing);

        let icon = "⬆";
        let maneuver = "Head straight along";
        if (relAngle > 25) {
          icon = "↱";
          maneuver = "Turn right into";
        } else if (relAngle < -25) {
          icon = "↰";
          maneuver = "Turn left into";
        }

        if (elGmapTurnIcon) elGmapTurnIcon.innerText = icon;
        elGmapPrimaryInst.innerText = `In ${stepDist}m, ${maneuver} ${nextNode.room_type.replace(/_/g, " ")}`;
      }
    } else {
      // Off-route / Deviation detected
      if (elGmapTurnIcon) elGmapTurnIcon.innerText = "↩";
      elGmapPrimaryInst.innerText = `Off Route: Re-route or backtrack to rejoin the recommended path`;
    }
  }

  // Google Maps Itinerary steps in sidebar
  function updateGoogleMapsItinerary(state, refPath, currNodeIndex) {
    if (!elGmapRouteStepsContainer || !state.graph || !state.graph.nodes) return;
    elGmapRouteStepsContainer.innerHTML = "";

    refPath.forEach((nodeId, idx) => {
      const nodeData = state.graph.nodes[nodeId];
      if (!nodeData) return;
      const isPast = currNodeIndex >= 0 && idx < currNodeIndex;
      const isCurrent = idx === currNodeIndex;
      const isFuture = currNodeIndex < 0 || idx > currNodeIndex;
      const isGoal = idx === refPath.length - 1;

      const item = document.createElement("div");
      item.className = `p-2 rounded-xl flex items-center justify-between border ${
        isCurrent 
          ? "bg-[#1a73e8]/20 border-[#4285f4] text-white shadow-sm ring-1 ring-[#4285f4]" 
          : (isPast ? "bg-slate-900/40 border-slate-800 text-slate-400" : "bg-slate-900/80 border-slate-800 text-slate-200")
      }`;

      const icon = isGoal ? "📍" : (isPast ? "✓" : `${idx + 1}`);

      item.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
            isCurrent ? "bg-[#1a73e8] text-white" : (isPast ? "bg-emerald-950 text-emerald-400" : "bg-slate-800 text-slate-400")
          }">
            ${icon}
          </span>
          <div>
            <div class="font-semibold text-xs capitalize ${isCurrent ? "text-cyan-300 font-bold" : "text-white"}">${nodeData.room_type.replace(/_/g, " ")}</div>
            <div class="text-[10px] text-slate-500 font-mono">${nodeId}</div>
          </div>
        </div>
        <div>
          ${isCurrent ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-[#1a73e8] text-white font-bold">YOU ARE HERE</span>' : ''}
          ${isGoal && !isCurrent ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">DESTINATION</span>' : ''}
        </div>
      `;
      elGmapRouteStepsContainer.appendChild(item);
    });
  }

  // ==============================================================================
  // GOOGLE MAPS RENDERING ENGINE (Authentic Google Maps Dark Palette & Visuals)
  // ==============================================================================
  function renderGoogleMap(timestamp) {
    if (!simState || !simState.graph || !ctx || !elCanvas) return;
    const { nodes, edges } = simState.graph;
    const W = elCanvas.width;
    const H = elCanvas.height;

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // Compute bounding box
    const xs = Object.values(nodes).map(n => n.x);
    const ys = Object.values(nodes).map(n => n.y);
    const minX = Math.min(...xs) - 1.5;
    const maxX = Math.max(...xs) + 1.5;
    const minY = Math.min(...ys) - 1.5;
    const maxY = Math.max(...ys) + 1.5;

    const spanX = Math.max(maxX - minX, 1.0);
    const spanY = Math.max(maxY - minY, 1.0);

    const pad = 55;
    const toCanvasX = (x) => pad + ((x - minX) / spanX) * (W - 2 * pad);
    const toCanvasY = (y) => H - (pad + ((y - minY) / spanY) * (H - 2 * pad));

    // Google Maps Dark background
    ctx.fillStyle = "#1e2430";
    ctx.fillRect(0, 0, W, H);

    // Subtle Google Maps Grid Texture
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let gx = 0; gx < W; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    // Determine Reference Route Edges vs Non-Route Edges
    const refPath = simState.episode.reference_path || [];
    const refEdgeKeys = new Set();
    for (let i = 0; i < refPath.length - 1; i++) {
      refEdgeKeys.add(`${refPath[i]}->${refPath[i+1]}`);
      refEdgeKeys.add(`${refPath[i+1]}->${refPath[i]}`);
    }

    // 1. Draw Base Walkable Corridors (Google Maps Gray Roads)
    edges.forEach(e => {
      const u = nodes[e.from];
      const v = nodes[e.to];
      if (!u || !v) return;

      const ux = toCanvasX(u.x), uy = toCanvasY(u.y);
      const vx = toCanvasX(v.x), vy = toCanvasY(v.y);

      // Road Casing
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(vx, vy);
      ctx.strokeStyle = "#2e384d";
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.stroke();

      // Road Inner
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(vx, vy);
      ctx.strokeStyle = "#252d3d";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.stroke();
    });

    // 2. Draw "Where NOT to Go" (Dead Ends / Deviations / Forbidden branches)
    edges.forEach(e => {
      const isRef = refEdgeKeys.has(`${e.from}->${e.to}`);
      if (isRef) return; // Only process non-recommended branches

      const u = nodes[e.from];
      const v = nodes[e.to];
      if (!u || !v) return;

      const ux = toCanvasX(u.x), uy = toCanvasY(u.y);
      const vx = toCanvasX(v.x), vy = toCanvasY(v.y);

      // Red dashed warning route line
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(vx, vy);
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(234, 67, 53, 0.75)"; // Google Maps Red
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw ⛔ NO-ENTRY badge at edge midpoint
      const mx = (ux + vx) / 2;
      const my = (uy + vy) / 2;

      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, 2 * Math.PI);
      ctx.fillStyle = "#ea4335";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // White minus sign in red circle
      ctx.beginPath();
      ctx.moveTo(mx - 4, my);
      ctx.lineTo(mx + 4, my);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 3. Draw "Where to Go" (Recommended Route - Google Maps Vibrant Blue with Moving Chevrons)
    if (refPath.length >= 2) {
      // Glow casing
      ctx.beginPath();
      const startP = nodes[refPath[0]];
      if (startP) {
        ctx.moveTo(toCanvasX(startP.x), toCanvasY(startP.y));
        for (let i = 1; i < refPath.length; i++) {
          const pt = nodes[refPath[i]];
          if (pt) ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
        }
        ctx.strokeStyle = "rgba(66, 133, 244, 0.4)";
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        // Solid Google Blue Route Ribbon
        ctx.strokeStyle = "#4285F4";
        ctx.lineWidth = 7;
        ctx.stroke();

        // Inner lighter highlight
        ctx.strokeStyle = "#8ab4f8";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw animated streaming chevrons (>>>) along recommended route
        const phase = (timestamp * 0.04) % 30;
        for (let i = 0; i < refPath.length - 1; i++) {
          const p1 = nodes[refPath[i]];
          const p2 = nodes[refPath[i+1]];
          if (!p1 || !p2) continue;

          const x1 = toCanvasX(p1.x), y1 = toCanvasY(p1.y);
          const x2 = toCanvasX(p2.x), y2 = toCanvasY(p2.y);
          const segDist = Math.hypot(x2 - x1, y2 - y1);
          const angle = Math.atan2(y2 - y1, x2 - x1);

          for (let d = phase; d < segDist - 15; d += 30) {
            const cx = x1 + Math.cos(angle) * d;
            const cy = y1 + Math.sin(angle) * d;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);

            // Chevron shape
            ctx.beginPath();
            ctx.moveTo(-4, -4);
            ctx.lineTo(3, 0);
            ctx.lineTo(-4, 4);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.stroke();

            ctx.restore();
          }
        }
      }
    }

    // 4. Draw Traversed Agent Trajectory (Glowing Cyan Track)
    const traj = simState.state.trajectory_nodes || [];
    if (traj.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(0, 229, 255, 0.8)";
      ctx.shadowBlur = 8;
      const startN = nodes[traj[0]];
      if (startN) {
        ctx.moveTo(toCanvasX(startN.x), toCanvasY(startN.y));
        for (let i = 1; i < traj.length - 1; i++) {
          const pt = nodes[traj[i]];
          if (pt) ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
        }
        // Connect to real-time moving agent puck position!
        ctx.lineTo(toCanvasX(animAgent.x), toCanvasY(animAgent.y));
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // 5. Draw Footstep breadcrumbs
    animAgent.footsteps.forEach((fs, fIdx) => {
      const fx = toCanvasX(fs.x);
      const fy = toCanvasY(fs.y);
      const ageAlpha = Math.max(0.1, 0.7 - (animAgent.footsteps.length - fIdx) * 0.025);
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(0, 229, 255, ${ageAlpha})`;
      ctx.fill();
    });

    // 6. Draw Viewpoint Room Nodes & Google Maps POI markers
    Object.values(nodes).forEach(n => {
      const cx = toCanvasX(n.x);
      const cy = toCanvasY(n.y);

      // Node background pill
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Room Icon emoji inside node
      const icon = ROOM_ICONS[n.room_type] || "🏠";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, cx, cy + 1);

      // Room Name Tag below node
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const cleanName = n.room_type.replace(/_/g, " ");
      ctx.fillText(cleanName, cx, cy + 18);
    });

    // 7. Draw Destination Pin (Authentic Google Maps Red Teardrop Marker 📍)
    const goalNode = nodes[simState.episode.goal_node];
    if (goalNode) {
      const gx = toCanvasX(goalNode.x);
      const gy = toCanvasY(goalNode.y);

      // Animated gentle bobbing
      const bob = Math.sin(timestamp * 0.004) * 4;
      const pinY = gy - 18 + bob;

      // Pin shadow
      ctx.beginPath();
      ctx.ellipse(gx, gy + 4, 10, 4, 0, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fill();

      // Google Red Droplet Pin
      ctx.save();
      ctx.translate(gx, pinY);

      // Red pin body
      ctx.beginPath();
      ctx.arc(0, -12, 12, Math.PI, 0, false);
      ctx.bezierCurveTo(12, -4, 0, 10, 0, 16);
      ctx.bezierCurveTo(0, 10, -12, -4, -12, -12);
      ctx.closePath();
      ctx.fillStyle = "#ea4335"; // Google Red
      ctx.shadowColor = "rgba(234, 67, 53, 0.7)";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // White inner dot
      ctx.beginPath();
      ctx.arc(0, -12, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.restore();

      // Google Maps Destination Label Bubble
      ctx.fillStyle = "#ea4335";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("DESTINATION", gx, pinY - 30);
    }

    // 8. Draw Google Maps Navigation GPS Puck (Current Real-Time Agent Position)
    const ax = toCanvasX(animAgent.x);
    const ay = toCanvasY(animAgent.y);
    const headingRad = (animAgent.heading - 90) * (Math.PI / 180);

    // Dynamic Pulsating Light Blue Radar Wave
    const pulseRadius = 14 + 10 * ((Math.sin(timestamp * 0.005) + 1) / 2);
    const pulseAlpha = Math.max(0.1, 0.45 - (pulseRadius - 14) / 25);
    ctx.beginPath();
    ctx.arc(ax, ay, pulseRadius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(66, 133, 244, ${pulseAlpha})`;
    ctx.fill();

    // Directional Navigation Flashlight Cone (60° FOV)
    const fovAngle = Math.PI / 3;
    const coneLen = 42;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.arc(ax, ay, coneLen, headingRad - fovAngle / 2, headingRad + fovAngle / 2);
    ctx.closePath();
    const coneGrad = ctx.createRadialGradient(ax, ay, 4, ax, ay, coneLen);
    coneGrad.addColorStop(0, "rgba(66, 133, 244, 0.65)");
    coneGrad.addColorStop(1, "rgba(66, 133, 244, 0.0)");
    ctx.fillStyle = coneGrad;
    ctx.fill();

    // Solid Google Maps Blue GPS Puck
    ctx.beginPath();
    ctx.arc(ax, ay, 8.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a73e8"; // Google Blue
    ctx.shadowColor = "#1a73e8";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
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

  // Start continuous 60fps render loop
  startAnimationLoop();

  // Initial boot
  fetchInitialState();
})();
