// RxR VLN Interactive Simulator Client Application with Google Maps Navigation
(function() {
  let simState = null;
  let isPlaying = false;
  let playTimer = null;
  let currentLanguage = "en";
  let activeTab = "action";
  let studioViewMode = "camera"; // "camera" or "map"

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

  // Destination Search Elements
  const elGmapSearchFrom = document.getElementById("gmap-search-from");
  const elDestinationSelect = document.getElementById("destination-select");
  const elQuickLocationChips = document.getElementById("quick-location-chips");
  const elViewportStage = document.getElementById("viewport-stage");
  const elStudioMapStage = document.getElementById("studio-map-stage");
  const elViewModeCamera = document.getElementById("view-mode-camera");
  const elViewModeMap = document.getElementById("view-mode-map");

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

  const elStudioCanvas = document.getElementById("studio-canvas");
  const studioCtx = elStudioCanvas ? elStudioCanvas.getContext("2d") : null;

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

  // Switch between Panoramic Camera View and Embedded Google Map in Action Studio
  window.switchStudioView = function(mode) {
    studioViewMode = mode;
    if (mode === "map") {
      if (elViewportStage) elViewportStage.classList.add("hidden");
      if (elStudioMapStage) elStudioMapStage.classList.remove("hidden");
      if (elViewModeMap) {
        elViewModeMap.className = "px-2 py-0.5 rounded font-medium bg-cyan-600 text-white transition";
      }
      if (elViewModeCamera) {
        elViewModeCamera.className = "px-2 py-0.5 rounded font-medium text-slate-300 hover:text-white transition";
      }
    } else {
      if (elViewportStage) elViewportStage.classList.remove("hidden");
      if (elStudioMapStage) elStudioMapStage.classList.add("hidden");
      if (elViewModeCamera) {
        elViewModeCamera.className = "px-2 py-0.5 rounded font-medium bg-cyan-600 text-white transition";
      }
      if (elViewModeMap) {
        elViewModeMap.className = "px-2 py-0.5 rounded font-medium text-slate-300 hover:text-white transition";
      }
    }
  };

  // Choose Destination Handler (Google Maps feature)
  window.onSelectDestination = async function(destNodeId) {
    if (!destNodeId || !simState) return;

    try {
      const res = await fetch("/api/set_destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination_node: destNodeId })
      });
      const data = await res.json();
      updateUI(data);

      // Auto switch to Google Map view to immediately show the calculated way
      if (activeTab === "action" && studioViewMode !== "map") {
        window.switchStudioView("map");
      }
    } catch (err) {
      console.error("Failed to set destination:", err);
    }
  };

  window.calculateAndShowRoute = function() {
    if (elDestinationSelect) {
      window.onSelectDestination(elDestinationSelect.value);
    }
  };

  // Google Maps Zoom & Recenter controls
  window.zoomMap = function(factor) {
    mapZoom = Math.max(0.6, Math.min(2.5, mapZoom * factor));
  };

  window.recenterMap = function() {
    mapZoom = 1.0;
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

  // Setup click interaction on canvases to choose destination directly
  function setupCanvasClick(canvas) {
    if (!canvas) return;
    canvas.addEventListener("click", (evt) => {
      if (!simState || !simState.graph || !simState.graph.nodes) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = (evt.clientX - rect.left) * (canvas.width / rect.width);
      const clickY = (evt.clientY - rect.top) * (canvas.height / rect.height);

      const nodes = simState.graph.nodes;
      const xs = Object.values(nodes).map(n => n.x);
      const ys = Object.values(nodes).map(n => n.y);
      const minX = Math.min(...xs) - 1.5;
      const maxX = Math.max(...xs) + 1.5;
      const minY = Math.min(...ys) - 1.5;
      const maxY = Math.max(...ys) + 1.5;
      const spanX = Math.max(maxX - minX, 1.0);
      const spanY = Math.max(maxY - minY, 1.0);
      const pad = canvas.width > 600 ? 55 : 35;

      const toCanvasX = (x) => pad + ((x - minX) / spanX) * (canvas.width - 2 * pad);
      const toCanvasY = (y) => canvas.height - (pad + ((y - minY) / spanY) * (canvas.height - 2 * pad));

      let closestNode = null;
      let minDist = 32;

      Object.values(nodes).forEach(n => {
        const nx = toCanvasX(n.x);
        const ny = toCanvasY(n.y);
        const d = Math.hypot(clickX - nx, clickY - ny);
        if (d < minDist) {
          minDist = d;
          closestNode = n;
        }
      });

      if (closestNode) {
        window.onSelectDestination(closestNode.id);
      }
    });
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

      // Draw Google Maps on Floorplan canvas
      if (simState && ctx && elCanvas && activeTab === "floorplan") {
        renderGoogleMapToTarget(ctx, elCanvas, timestamp);
      }

      // Draw Google Maps on Studio canvas if Studio Map mode is active
      if (simState && studioCtx && elStudioCanvas && activeTab === "action" && studioViewMode === "map") {
        renderGoogleMapToTarget(studioCtx, elStudioCanvas, timestamp);
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
        populateDestinationPicker(data);
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

  // Populate Destination Dropdown & Quick Chips
  function populateDestinationPicker(state) {
    if (!state || !state.graph || !state.graph.nodes) return;
    const nodes = state.graph.nodes;
    const currentGoal = state.episode.goal_node;

    if (elDestinationSelect) {
      elDestinationSelect.innerHTML = "";
      Object.values(nodes).forEach(n => {
        const opt = document.createElement("option");
        opt.value = n.id;
        opt.className = "bg-slate-900 text-white";
        const icon = ROOM_ICONS[n.room_type] || "📍";
        opt.innerText = `${icon} ${n.room_type.replace(/_/g, " ")} (${n.id})`;
        if (n.id === currentGoal) opt.selected = true;
        elDestinationSelect.appendChild(opt);
      });
    }

    if (elQuickLocationChips) {
      elQuickLocationChips.innerHTML = "";
      Object.values(nodes).forEach(n => {
        const chip = document.createElement("button");
        const icon = ROOM_ICONS[n.room_type] || "📍";
        chip.className = `destination-chip ${n.id === currentGoal ? "active" : ""}`;
        chip.innerHTML = `<span>${icon}</span><span>${n.room_type.replace(/_/g, " ")}</span>`;
        chip.onclick = () => window.onSelectDestination(n.id);
        elQuickLocationChips.appendChild(chip);
      });
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
      populateDestinationPicker(data);
      updateUI(data);
    } catch (err) {
      console.error("Failed to reset episode:", err);
    }
  }

  async function stepSimulation(actionIndex) {
    if (animAgent.isMoving) return;

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

      // Start smooth interpolated movement
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
        if (elPlayText) elPlayText.innerText = "Pause Walk";
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
    if (elPlayText) elPlayText.innerText = "Pause Walk";
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
    if (elPlayText) elPlayText.innerText = "Auto Walk to Destination";
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

    // Origin in Google Maps search bar
    if (elGmapSearchFrom) {
      elGmapSearchFrom.innerText = state.state.current_room.replace(/_/g, " ");
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
          routeBadge = '<span class="text-[10px] uppercase font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800 flex items-center gap-1"><span>⛔</span> Avoid</span>';
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

    // 7. Update Destination Dropdown & Chips active states
    if (elDestinationSelect) {
      elDestinationSelect.value = state.episode.goal_node;
    }
    if (elQuickLocationChips) {
      Array.from(elQuickLocationChips.children).forEach(chip => {
        if (chip.innerText.toLowerCase().includes(goalClean.toLowerCase())) {
          chip.classList.add("active");
        } else {
          chip.classList.remove("active");
        }
      });
    }

    // 8. Update Google Maps Turn-by-Turn Guidance Banner
    updateGoogleMapsBanner(state, refPath, currNodeIndex);

    // 9. Update Metrics
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

    // 10. Traversal History Log in Floorplan section
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

    // 11. Update Google Maps Itinerary steps
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
      if (elGmapTurnIcon) elGmapTurnIcon.innerText = "↩";
      elGmapPrimaryInst.innerText = `Recalculating: Follow blue route toward ${state.episode.goal_node.replace(/.*_/, "")}`;
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
  function renderGoogleMapToTarget(targetCtx, targetCanvas, timestamp) {
    if (!simState || !simState.graph || !targetCtx || !targetCanvas) return;
    const { nodes, edges } = simState.graph;
    const W = targetCanvas.width;
    const H = targetCanvas.height;

    targetCtx.save();
    targetCtx.clearRect(0, 0, W, H);

    // Compute bounding box
    const xs = Object.values(nodes).map(n => n.x);
    const ys = Object.values(nodes).map(n => n.y);
    const minX = Math.min(...xs) - 1.5;
    const maxX = Math.max(...xs) + 1.5;
    const minY = Math.min(...ys) - 1.5;
    const maxY = Math.max(...ys) + 1.5;

    const spanX = Math.max(maxX - minX, 1.0);
    const spanY = Math.max(maxY - minY, 1.0);

    const pad = W > 600 ? 55 : 35;
    const toCanvasX = (x) => pad + ((x - minX) / spanX) * (W - 2 * pad);
    const toCanvasY = (y) => H - (pad + ((y - minY) / spanY) * (H - 2 * pad));

    // Google Maps Dark background
    targetCtx.fillStyle = "#1e2430";
    targetCtx.fillRect(0, 0, W, H);

    // Subtle Google Maps Grid Texture
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    targetCtx.lineWidth = 1;
    const gridSize = 40;
    for (let gx = 0; gx < W; gx += gridSize) {
      targetCtx.beginPath();
      targetCtx.moveTo(gx, 0);
      targetCtx.lineTo(gx, H);
      targetCtx.stroke();
    }
    for (let gy = 0; gy < H; gy += gridSize) {
      targetCtx.beginPath();
      targetCtx.moveTo(0, gy);
      targetCtx.lineTo(W, gy);
      targetCtx.stroke();
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
      targetCtx.beginPath();
      targetCtx.moveTo(ux, uy);
      targetCtx.lineTo(vx, vy);
      targetCtx.strokeStyle = "#2e384d";
      targetCtx.lineWidth = W > 600 ? 18 : 14;
      targetCtx.lineCap = "round";
      targetCtx.stroke();

      // Road Inner
      targetCtx.beginPath();
      targetCtx.moveTo(ux, uy);
      targetCtx.lineTo(vx, vy);
      targetCtx.strokeStyle = "#252d3d";
      targetCtx.lineWidth = W > 600 ? 14 : 10;
      targetCtx.lineCap = "round";
      targetCtx.stroke();
    });

    // 2. Draw "Where NOT to Go" (Dead Ends / Deviations / Forbidden branches)
    edges.forEach(e => {
      const isRef = refEdgeKeys.has(`${e.from}->${e.to}`);
      if (isRef) return;

      const u = nodes[e.from];
      const v = nodes[e.to];
      if (!u || !v) return;

      const ux = toCanvasX(u.x), uy = toCanvasY(u.y);
      const vx = toCanvasX(v.x), vy = toCanvasY(v.y);

      // Red dashed warning route line
      targetCtx.beginPath();
      targetCtx.moveTo(ux, uy);
      targetCtx.lineTo(vx, vy);
      targetCtx.setLineDash([5, 5]);
      targetCtx.strokeStyle = "rgba(234, 67, 53, 0.75)";
      targetCtx.lineWidth = 3;
      targetCtx.stroke();
      targetCtx.setLineDash([]);

      // Draw ⛔ NO-ENTRY badge at edge midpoint
      const mx = (ux + vx) / 2;
      const my = (uy + vy) / 2;

      targetCtx.beginPath();
      targetCtx.arc(mx, my, 7, 0, 2 * Math.PI);
      targetCtx.fillStyle = "#ea4335";
      targetCtx.fill();
      targetCtx.strokeStyle = "#ffffff";
      targetCtx.lineWidth = 1.5;
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.moveTo(mx - 3.5, my);
      targetCtx.lineTo(mx + 3.5, my);
      targetCtx.strokeStyle = "#ffffff";
      targetCtx.lineWidth = 2;
      targetCtx.stroke();
    });

    // 3. Draw "Where to Go" (Recommended Route - Google Maps Vibrant Blue with Moving Chevrons)
    if (refPath.length >= 2) {
      // Glow casing
      targetCtx.beginPath();
      const startP = nodes[refPath[0]];
      if (startP) {
        targetCtx.moveTo(toCanvasX(startP.x), toCanvasY(startP.y));
        for (let i = 1; i < refPath.length; i++) {
          const pt = nodes[refPath[i]];
          if (pt) targetCtx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
        }
        targetCtx.strokeStyle = "rgba(66, 133, 244, 0.4)";
        targetCtx.lineWidth = W > 600 ? 12 : 9;
        targetCtx.lineCap = "round";
        targetCtx.lineJoin = "round";
        targetCtx.stroke();

        // Solid Google Blue Route Ribbon
        targetCtx.strokeStyle = "#4285F4";
        targetCtx.lineWidth = W > 600 ? 7 : 5;
        targetCtx.stroke();

        // Inner lighter highlight
        targetCtx.strokeStyle = "#8ab4f8";
        targetCtx.lineWidth = 2;
        targetCtx.stroke();

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

          for (let d = phase; d < segDist - 12; d += 28) {
            const cx = x1 + Math.cos(angle) * d;
            const cy = y1 + Math.sin(angle) * d;

            targetCtx.save();
            targetCtx.translate(cx, cy);
            targetCtx.rotate(angle);

            targetCtx.beginPath();
            targetCtx.moveTo(-3.5, -3.5);
            targetCtx.lineTo(3, 0);
            targetCtx.lineTo(-3.5, 3.5);
            targetCtx.strokeStyle = "#ffffff";
            targetCtx.lineWidth = 1.8;
            targetCtx.lineCap = "round";
            targetCtx.stroke();

            targetCtx.restore();
          }
        }
      }
    }

    // 4. Draw Traversed Agent Trajectory (Glowing Cyan Track)
    const traj = simState.state.trajectory_nodes || [];
    if (traj.length >= 2) {
      targetCtx.beginPath();
      targetCtx.strokeStyle = "#00e5ff";
      targetCtx.lineWidth = 3.5;
      targetCtx.lineCap = "round";
      targetCtx.lineJoin = "round";
      targetCtx.shadowColor = "rgba(0, 229, 255, 0.8)";
      targetCtx.shadowBlur = 8;
      const startN = nodes[traj[0]];
      if (startN) {
        targetCtx.moveTo(toCanvasX(startN.x), toCanvasY(startN.y));
        for (let i = 1; i < traj.length - 1; i++) {
          const pt = nodes[traj[i]];
          if (pt) targetCtx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
        }
        targetCtx.lineTo(toCanvasX(animAgent.x), toCanvasY(animAgent.y));
        targetCtx.stroke();
      }
      targetCtx.shadowBlur = 0;
    }

    // 5. Draw Footstep breadcrumbs
    animAgent.footsteps.forEach((fs, fIdx) => {
      const fx = toCanvasX(fs.x);
      const fy = toCanvasY(fs.y);
      const ageAlpha = Math.max(0.1, 0.7 - (animAgent.footsteps.length - fIdx) * 0.025);
      targetCtx.beginPath();
      targetCtx.arc(fx, fy, 2, 0, 2 * Math.PI);
      targetCtx.fillStyle = `rgba(0, 229, 255, ${ageAlpha})`;
      targetCtx.fill();
    });

    // 6. Draw Viewpoint Room Nodes & Google Maps POI markers
    Object.values(nodes).forEach(n => {
      const cx = toCanvasX(n.x);
      const cy = toCanvasY(n.y);

      // Node background pill
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, 13, 0, 2 * Math.PI);
      targetCtx.fillStyle = "#1e293b";
      targetCtx.fill();
      targetCtx.strokeStyle = n.id === simState.episode.goal_node ? "#ea4335" : "#475569";
      targetCtx.lineWidth = n.id === simState.episode.goal_node ? 3 : 2;
      targetCtx.stroke();

      // Room Icon emoji inside node
      const icon = ROOM_ICONS[n.room_type] || "🏠";
      targetCtx.font = "12px sans-serif";
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "middle";
      targetCtx.fillText(icon, cx, cy + 1);

      // Room Name Tag below node
      targetCtx.fillStyle = "#e2e8f0";
      targetCtx.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif";
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "top";
      const cleanName = n.room_type.replace(/_/g, " ");
      targetCtx.fillText(cleanName, cx, cy + 16);
    });

    // 7. Draw Destination Pin (Authentic Google Maps Red Teardrop Marker 📍)
    const goalNode = nodes[simState.episode.goal_node];
    if (goalNode) {
      const gx = toCanvasX(goalNode.x);
      const gy = toCanvasY(goalNode.y);

      const bob = Math.sin(timestamp * 0.004) * 4;
      const pinY = gy - 16 + bob;

      // Pin shadow
      targetCtx.beginPath();
      targetCtx.ellipse(gx, gy + 3, 9, 3.5, 0, 0, 2 * Math.PI);
      targetCtx.fillStyle = "rgba(0, 0, 0, 0.45)";
      targetCtx.fill();

      // Google Red Droplet Pin
      targetCtx.save();
      targetCtx.translate(gx, pinY);

      targetCtx.beginPath();
      targetCtx.arc(0, -11, 11, Math.PI, 0, false);
      targetCtx.bezierCurveTo(11, -3, 0, 9, 0, 15);
      targetCtx.bezierCurveTo(0, 9, -11, -3, -11, -11);
      targetCtx.closePath();
      targetCtx.fillStyle = "#ea4335";
      targetCtx.shadowColor = "rgba(234, 67, 53, 0.7)";
      targetCtx.shadowBlur = 8;
      targetCtx.fill();
      targetCtx.shadowBlur = 0;
      targetCtx.strokeStyle = "#ffffff";
      targetCtx.lineWidth = 1.8;
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.arc(0, -11, 4, 0, 2 * Math.PI);
      targetCtx.fillStyle = "#ffffff";
      targetCtx.fill();

      targetCtx.restore();

      targetCtx.fillStyle = "#ea4335";
      targetCtx.font = "bold 9px sans-serif";
      targetCtx.textAlign = "center";
      targetCtx.fillText("DESTINATION", gx, pinY - 26);
    }

    // 8. Draw Google Maps Navigation GPS Puck
    const ax = toCanvasX(animAgent.x);
    const ay = toCanvasY(animAgent.y);
    const headingRad = (animAgent.heading - 90) * (Math.PI / 180);

    // Dynamic Pulsating Light Blue Radar Wave
    const pulseRadius = 13 + 9 * ((Math.sin(timestamp * 0.005) + 1) / 2);
    const pulseAlpha = Math.max(0.1, 0.45 - (pulseRadius - 13) / 22);
    targetCtx.beginPath();
    targetCtx.arc(ax, ay, pulseRadius, 0, 2 * Math.PI);
    targetCtx.fillStyle = `rgba(66, 133, 244, ${pulseAlpha})`;
    targetCtx.fill();

    // Directional Navigation Flashlight Cone (60° FOV)
    const fovAngle = Math.PI / 3;
    const coneLen = 38;
    targetCtx.beginPath();
    targetCtx.moveTo(ax, ay);
    targetCtx.arc(ax, ay, coneLen, headingRad - fovAngle / 2, headingRad + fovAngle / 2);
    targetCtx.closePath();
    const coneGrad = targetCtx.createRadialGradient(ax, ay, 4, ax, ay, coneLen);
    coneGrad.addColorStop(0, "rgba(66, 133, 244, 0.65)");
    coneGrad.addColorStop(1, "rgba(66, 133, 244, 0.0)");
    targetCtx.fillStyle = coneGrad;
    targetCtx.fill();

    // Solid Google Maps Blue GPS Puck
    targetCtx.beginPath();
    targetCtx.arc(ax, ay, 7.5, 0, 2 * Math.PI);
    targetCtx.fillStyle = "#1a73e8";
    targetCtx.shadowColor = "#1a73e8";
    targetCtx.shadowBlur = 10;
    targetCtx.fill();
    targetCtx.shadowBlur = 0;
    targetCtx.strokeStyle = "#ffffff";
    targetCtx.lineWidth = 2.2;
    targetCtx.stroke();

    targetCtx.restore();
  }

  // Bind Canvas Click Events
  setupCanvasClick(elCanvas);
  setupCanvasClick(elStudioCanvas);

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
