// RxR VLN Interactive Simulator Client Application with Google Maps Navigation & Live Lyrics
(function() {
  let simState = null;
  let isPlaying = false;
  let playTimer = null;
  let currentLanguage = "en";
  let activeTab = "action";
  let studioViewMode = "camera"; // "camera" or "map"

  // AI Voice & Lyrics State
  let isVoiceEnabled = true;
  let lastSpokenLyric = "";

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

  // ---- Inline icon set (replaces emoji) ----
  const svg = (d, size = 16, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON_PLAY  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 001.5.86l12.4-7.5a1 1 0 000-1.72L8.5 3.64A1 1 0 007 4.5z"/></svg>';
  const ICON_PAUSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  const TURN = {
    straight: svg('<path d="M12 20V5M6 11l6-6 6 6"/>', 26, 2),
    right:    svg('<path d="M6 20v-7a4 4 0 014-4h8M14 5l4 4-4 4"/>', 26, 2),
    left:     svg('<path d="M18 20v-7a4 4 0 00-4-4H6M10 5L6 9l4 4"/>', 26, 2),
    flag:     svg('<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>', 24, 2),
    back:     svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>', 24, 2)
  };
  const ARROW = {
    stop:  svg('<rect x="6" y="6" width="12" height="12" rx="2"/>', 13, 2),
    left:  svg('<path d="M17 17L7 7M7 15V7h8"/>', 13, 2),
    right: svg('<path d="M7 17L17 7M9 7h8v8"/>', 13, 2),
    up:    svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 13, 2)
  };

  // ---- Theme (light / dark) & canvas palette ----
  let PAL = {};
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    PAL = {
      bg: v("--canvas-bg"), grid: v("--canvas-grid"), road: v("--canvas-road"), roadEdge: v("--canvas-road-edge"),
      node: v("--canvas-node"), nodeEdge: v("--canvas-node-edge"), label: v("--canvas-label"),
      route: v("--canvas-route"), routeSoft: v("--canvas-route-soft"), track: v("--canvas-track"), danger: v("--canvas-danger")
    };
  }
  function withAlpha(hex, a) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
  }
  function syncThemeIcon() {
    const el = document.getElementById("theme-icon");
    if (!el) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    el.innerHTML = dark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
      : '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>';
  }
  window.toggleTheme = function() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("rxr_theme", next);
    readPalette();
    syncThemeIcon();
  };
  readPalette();
  syncThemeIcon();

  // DOM Elements
  const elEpisodeSelect = document.getElementById("episode-select");
  const elSplitBadge = document.getElementById("split-badge");
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

  // Synchronized Live Lyrics & AI Voice Elements
  const elLiveLyricsContainer = document.getElementById("live-lyrics-container");
  const elAiVoiceEqualizer = document.getElementById("ai-voice-equalizer");
  const elAiVoiceStatus = document.getElementById("ai-voice-status");
  const elVoiceIcon = document.getElementById("voice-icon");
  const elVoiceStatusText = document.getElementById("voice-status-text");

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
    const isMap = mode === "map";
    if (elViewportStage) elViewportStage.classList.toggle("hidden", isMap);
    if (elStudioMapStage) elStudioMapStage.classList.toggle("hidden", !isMap);
    if (elViewModeMap) elViewModeMap.classList.toggle("active", isMap);
    if (elViewModeCamera) elViewModeCamera.classList.toggle("active", !isMap);
  };

  // AI Speech Synthesis Narration Engine
  window.speakNavigationInstruction = function(text, lang) {
    if (!isVoiceEnabled || !window.speechSynthesis || !text) return;
    if (text === lastSpokenLyric && window.speechSynthesis.speaking) return;

    window.speechSynthesis.cancel();
    lastSpokenLyric = text;

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap = { en: "en-US", hi: "hi-IN", te: "te-IN" };
    utterance.lang = langMap[lang] || "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang && v.lang.startsWith(langMap[lang] || "en"));
    if (matchedVoice) utterance.voice = matchedVoice;

    if (elAiVoiceEqualizer) elAiVoiceEqualizer.classList.remove("hidden");
    if (elAiVoiceStatus) {
      elAiVoiceStatus.classList.remove("hidden");
      elAiVoiceStatus.innerText = "Speaking…";
    }

    utterance.onend = () => {
      if (elAiVoiceEqualizer) elAiVoiceEqualizer.classList.add("hidden");
      if (elAiVoiceStatus) elAiVoiceStatus.classList.add("hidden");
    };

    utterance.onerror = () => {
      if (elAiVoiceEqualizer) elAiVoiceEqualizer.classList.add("hidden");
      if (elAiVoiceStatus) elAiVoiceStatus.classList.add("hidden");
    };

    window.speechSynthesis.speak(utterance);
  };

  window.toggleVoiceNarration = function() {
    isVoiceEnabled = !isVoiceEnabled;
    if (elVoiceIcon) elVoiceIcon.className = isVoiceEnabled ? "dot ok" : "dot";
    if (elVoiceStatusText) elVoiceStatusText.innerText = isVoiceEnabled ? "Voice on" : "Voice muted";
    if (!isVoiceEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      if (elAiVoiceEqualizer) elAiVoiceEqualizer.classList.add("hidden");
      if (elAiVoiceStatus) elAiVoiceStatus.classList.add("hidden");
    }
  };

  // Synchronized Live Lyrics Rendering (Apple Music / Spotify Style)
  function updateLiveLyrics(state) {
    if (!elLiveLyricsContainer || !state || !state.episode) return;
    const sentences = state.episode.sentences && state.episode.sentences.length > 0
      ? state.episode.sentences
      : (state.episode.instruction_text ? state.episode.instruction_text.split(/[।\.!\?]\s*/).filter(s => s.trim()) : []);

    if (sentences.length === 0) return;

    const refPath = state.episode.reference_path || [];
    const currNodeIndex = refPath.indexOf(state.state.current_node);

    // Map current progress along reference trajectory to corresponding sentence
    let activeIdx = 0;
    if (state.state.is_terminal || (currNodeIndex === refPath.length - 1 && refPath.length > 0)) {
      activeIdx = sentences.length - 1;
    } else if (currNodeIndex > 0 && refPath.length > 1) {
      activeIdx = Math.min(sentences.length - 1, Math.floor((currNodeIndex / (refPath.length - 1)) * sentences.length));
    }

    elLiveLyricsContainer.innerHTML = "";
    sentences.forEach((sent, idx) => {
      const line = document.createElement("div");
      const isPast = idx < activeIdx;
      const isActive = idx === activeIdx;

      line.className = `lyric-line ${isActive ? "active" : (isPast ? "past" : "future")}`;

      const cleanSent = sent.trim();
      const escapedSent = cleanSent.replace(/'/g, "\\'");

      if (isActive) {
        line.innerHTML = `
          <div class="lead">
            <span class="idx">${idx + 1}</span>
            <span class="txt">${cleanSent}</span>
          </div>
          <button onclick="event.stopPropagation(); speakNavigationInstruction('${escapedSent}', '${currentLanguage}')" class="btn btn-sm" aria-label="Hear instruction">
            ${svg('<path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14"/>', 14, 1.8)}
            <span>Hear</span>
          </button>
        `;
      } else if (isPast) {
        line.innerHTML = `
          <div class="lead">
            <span class="idx">${svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 13, 2.4)}</span>
            <span class="txt">${cleanSent}</span>
          </div>
        `;
      } else {
        line.innerHTML = `
          <div class="lead">
            <span class="idx">${idx + 1}</span>
            <span class="txt">${cleanSent}</span>
          </div>
        `;
      }

      line.onclick = () => {
        window.speakNavigationInstruction(cleanSent, currentLanguage);
      };

      elLiveLyricsContainer.appendChild(line);

      // Smooth auto-scroll active lyric into center view
      if (isActive) {
        setTimeout(() => {
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    });

    // Auto-speak active instruction if changed and audio enabled
    const activeText = sentences[activeIdx] ? sentences[activeIdx].trim() : "";
    if (activeText && activeText !== lastSpokenLyric) {
      window.speakNavigationInstruction(activeText, currentLanguage);
    }
  }

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
        opt.innerText = n.room_type.replace(/_/g, " ");
        if (n.id === currentGoal) opt.selected = true;
        elDestinationSelect.appendChild(opt);
      });
    }

    if (elQuickLocationChips) {
      elQuickLocationChips.innerHTML = "";
      Object.values(nodes).forEach(n => {
        const chip = document.createElement("button");
        chip.className = `chip ${n.id === currentGoal ? "active" : ""}`;
        chip.innerText = n.room_type.replace(/_/g, " ");
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
      if (btn) btn.classList.toggle("active", k === lang);
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
        if (elPlayIcon) elPlayIcon.innerHTML = ICON_PAUSE;
        if (elPlayText) elPlayText.innerText = "Pause";
        if (elBtnPlay) elBtnPlay.classList.add("is-playing");
        stepSimulation();
      });
      return;
    }

    isPlaying = true;
    if (elPlayIcon) elPlayIcon.innerHTML = ICON_PAUSE;
    if (elPlayText) elPlayText.innerText = "Pause";
    if (elBtnPlay) elBtnPlay.classList.add("is-playing");
    stepSimulation();
  }

  function stopAutoPlay() {
    isPlaying = false;
    clearTimeout(playTimer);
    playTimer = null;
    if (elPlayIcon) elPlayIcon.innerHTML = ICON_PLAY;
    if (elPlayText) elPlayText.innerText = "Auto walk";
    if (elBtnPlay) elBtnPlay.classList.remove("is-playing");
  }

  // Update UI with simulation state
  function updateUI(state) {
    simState = state;
    if (!state || !state.episode) return;

    // 1. Header & Episode
    if (elEpisodeSelect) elEpisodeSelect.value = state.episode.id;
    if (elSplitBadge) {
      if (state.episode.is_unseen) {
        elSplitBadge.innerText = "Val-Unseen · zero-shot";
        elSplitBadge.className = "badge info";
      } else {
        elSplitBadge.innerText = "Val-Seen";
        elSplitBadge.className = "badge ok";
      }
    }

    // Origin in Google Maps search bar
    if (elGmapSearchFrom) {
      elGmapSearchFrom.innerText = state.state.current_room.replace(/_/g, " ");
    }

    // 2. Synchronized Live Navigation Lyrics & Audio
    const goalClean = state.episode.goal_node.replace(/.*_/, "");
    if (elTargetRoom) elTargetRoom.innerText = goalClean;
    if (elTargetLms) elTargetLms.innerText = (state.episode.target_landmarks || []).join(", ");

    updateLiveLyrics(state);

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
          `<span class="tag">${lm.replace(/_/g, " ")}</span>`
        ).join(" ");
      } else {
        elDetectedLandmarks.innerHTML = `<span class="faint" style="font-size:12.5px">None detected</span>`;
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
        badgeEl.className = "badge badge-unreliable";
        badgeEl.innerText = "UNRELIABLE";
      } else if (rel.status === "CAUTIOUS") {
        badgeEl.className = "badge badge-cautious";
        badgeEl.innerText = "CAUTIOUS";
      } else {
        badgeEl.className = "badge badge-reliable";
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
    if (elVpHeadingTag) elVpHeadingTag.innerText = `Heading ${state.state.heading}°`;
    if (elVpRoomName) elVpRoomName.innerText = state.state.current_room.replace(/_/g, " ");
    if (elVpDesc) elVpDesc.innerText = state.state.current_view_desc;

    if (elOverviewRoomName) elOverviewRoomName.innerText = state.state.current_room.replace(/_/g, " ");
    if (elOverviewRoomTag) elOverviewRoomTag.innerText = state.state.current_room.replace(/_/g, " ");
    if (elOverviewRoomDesc) elOverviewRoomDesc.innerText = state.state.current_view_desc;

    // Viewport candidate action arrows overlay
    if (elVpActionArrows) {
      elVpActionArrows.innerHTML = "";
      (state.candidates || []).forEach((c, idx) => {
        const btn = document.createElement("button");
        btn.className = `arrow-btn ${c.is_selected ? "selected" : ""}`;
        const dir = c.action_type === "STOP" ? "stop" : (c.relative_heading < -15 ? "left" : (c.relative_heading > 15 ? "right" : "up"));
        btn.innerHTML = c.action_type === "STOP"
          ? `${ARROW.stop}<span>Stop</span>`
          : `${ARROW[dir]}<span>${c.target_room.replace(/_/g, " ")}</span><span class="pct">${(c.probability * 100).toFixed(0)}%</span>`;
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

        item.className = `candidate-row ${c.is_selected ? "selected" : ""}`;
        item.onclick = () => stepSimulation(idx);

        const headingLabel = c.action_type === "STOP" ? "Declare destination" : `${c.relative_heading >= 0 ? "+" : ""}${c.relative_heading.toFixed(0)}° relative`;
        const actionName = c.action_type === "STOP" ? "Stop" : `Move to <span class="cap">${c.target_room.replace(/_/g, " ")}</span>`;

        let routeBadge = "";
        if (isRecommended) routeBadge = '<span class="badge ok">On route</span>';
        else if (isDeviation) routeBadge = '<span class="badge bad">Avoid</span>';

        const pct = (c.probability * 100).toFixed(1);
        item.innerHTML = `
          <div class="top">
            <div>
              <div class="name">${actionName}</div>
              <div class="sub">${headingLabel}</div>
            </div>
            <div class="right">
              ${routeBadge}
              ${c.is_selected ? '<span class="badge info">Agent choice</span>' : ''}
              <span class="pct">${pct}%</span>
            </div>
          </div>
          <div class="meter ${isRecommended ? "ok" : (c.is_selected ? "" : "muted")}"><div style="width: ${pct}%"></div></div>
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
          elMetricSr.innerText = "Success";
          elMetricSr.className = "metric-value v-ok";
        } else {
          elMetricSr.innerText = "Failed";
          elMetricSr.className = "metric-value v-bad";
        }
      } else {
        elMetricSr.innerText = "In progress";
        elMetricSr.className = "metric-value v-warn";
      }
    }

    if (elMetricSpl) elMetricSpl.innerText = state.state.is_terminal ? `${m.spl}%` : "—";
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

        row.className = `list-row ${isCurrent ? "current" : ""}`;
        row.innerHTML = `
          <div class="lead">
            <span class="step-num ${isCurrent ? "current" : (isStart ? "start" : "")}">${idx}</span>
            <span class="name">${roomName}</span>
            <span class="id mono">${nodeId}</span>
          </div>
          <div>
            ${isCurrent ? '<span class="badge info">Current</span>' : (isStart ? '<span class="badge">Start</span>' : '')}
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
      elGmapEtaDist.innerText = `${distToGoal.toFixed(1)} m · ${remainingSteps} step${remainingSteps === 1 ? "" : "s"}`;
    }

    const landmarkText = (state.episode.target_landmarks || [])[0] || state.episode.goal_node.replace(/.*_/, "");
    if (elGmapLandmarkPrompt) elGmapLandmarkPrompt.innerText = landmarkText;

    if (isAtGoal) {
      if (elGmapTurnIcon) elGmapTurnIcon.innerHTML = TURN.flag;
      elGmapPrimaryInst.innerText = `You have arrived: ${state.state.current_room.replace(/_/g, " ")}`;
      if (elGmapSecondaryInst) elGmapSecondaryInst.innerHTML = `<span>Landmark reached:</span> <strong>${landmarkText}</strong>`;
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

        let icon = "straight";
        let maneuver = "head straight along";
        if (relAngle > 25) {
          icon = "right";
          maneuver = "turn right into";
        } else if (relAngle < -25) {
          icon = "left";
          maneuver = "turn left into";
        }

        if (elGmapTurnIcon) elGmapTurnIcon.innerHTML = TURN[icon];
        elGmapPrimaryInst.innerText = `In ${stepDist} m, ${maneuver} ${nextNode.room_type.replace(/_/g, " ")}`;
      }
    } else {
      if (elGmapTurnIcon) elGmapTurnIcon.innerHTML = TURN.back;
      elGmapPrimaryInst.innerText = `Recalculating: follow the blue route toward ${state.episode.goal_node.replace(/.*_/, "")}`;
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
      item.className = `list-row ${isCurrent ? "current" : (isPast ? "past" : "")}`;

      const mark = isPast
        ? svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 12, 2.6)
        : (isGoal ? svg('<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>', 12, 2.2) : `${idx + 1}`);

      item.innerHTML = `
        <div class="lead">
          <span class="step-num ${isCurrent ? "current" : (isPast ? "done" : "")}">${mark}</span>
          <div>
            <div class="name">${nodeData.room_type.replace(/_/g, " ")}</div>
            <div class="id mono">${nodeId}</div>
          </div>
        </div>
        <div>
          ${isCurrent ? '<span class="badge info">You are here</span>' : ''}
          ${isGoal && !isCurrent ? '<span class="badge">Destination</span>' : ''}
        </div>
      `;
      elGmapRouteStepsContainer.appendChild(item);
    });
  }

  // ==============================================================================
  // FLOORPLAN RENDERING ENGINE (theme-aware)
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
    targetCtx.fillStyle = PAL.bg;
    targetCtx.fillRect(0, 0, W, H);

    // Subtle Google Maps Grid Texture
    targetCtx.strokeStyle = PAL.grid;
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
      targetCtx.strokeStyle = PAL.roadEdge;
      targetCtx.lineWidth = W > 600 ? 18 : 14;
      targetCtx.lineCap = "round";
      targetCtx.stroke();

      // Road Inner
      targetCtx.beginPath();
      targetCtx.moveTo(ux, uy);
      targetCtx.lineTo(vx, vy);
      targetCtx.strokeStyle = PAL.road;
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
      targetCtx.strokeStyle = withAlpha(PAL.danger, 0.8);
      targetCtx.lineWidth = 2;
      targetCtx.stroke();
      targetCtx.setLineDash([]);

      // Draw ⛔ NO-ENTRY badge at edge midpoint
      const mx = (ux + vx) / 2;
      const my = (uy + vy) / 2;

      targetCtx.beginPath();
      targetCtx.arc(mx, my, 7, 0, 2 * Math.PI);
      targetCtx.fillStyle = PAL.danger;
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
      targetCtx.beginPath();
      const startP = nodes[refPath[0]];
      if (startP) {
        targetCtx.moveTo(toCanvasX(startP.x), toCanvasY(startP.y));
        for (let i = 1; i < refPath.length; i++) {
          const pt = nodes[refPath[i]];
          if (pt) targetCtx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y));
        }
        targetCtx.strokeStyle = PAL.routeSoft;
        targetCtx.lineWidth = W > 600 ? 12 : 9;
        targetCtx.lineCap = "round";
        targetCtx.lineJoin = "round";
        targetCtx.stroke();

        targetCtx.strokeStyle = PAL.route;
        targetCtx.lineWidth = W > 600 ? 7 : 5;
        targetCtx.stroke();

        targetCtx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        targetCtx.lineWidth = 2;
        targetCtx.stroke();

        // Animated streaming chevrons (>>>)
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
      targetCtx.strokeStyle = PAL.track;
      targetCtx.lineWidth = 3;
      targetCtx.lineCap = "round";
      targetCtx.lineJoin = "round";
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
      targetCtx.fillStyle = withAlpha(PAL.track, ageAlpha);
      targetCtx.fill();
    });

    // 6. Draw Viewpoint Room Nodes & Google Maps POI markers
    Object.values(nodes).forEach(n => {
      const cx = toCanvasX(n.x);
      const cy = toCanvasY(n.y);

      const isGoalNode = n.id === simState.episode.goal_node;
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, 9, 0, 2 * Math.PI);
      targetCtx.fillStyle = PAL.node;
      targetCtx.fill();
      targetCtx.strokeStyle = isGoalNode ? PAL.danger : PAL.nodeEdge;
      targetCtx.lineWidth = isGoalNode ? 2.5 : 1.75;
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.arc(cx, cy, 2.5, 0, 2 * Math.PI);
      targetCtx.fillStyle = isGoalNode ? PAL.danger : PAL.nodeEdge;
      targetCtx.fill();

      targetCtx.fillStyle = PAL.label;
      targetCtx.font = '500 11px Inter, system-ui, sans-serif';
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "top";
      targetCtx.fillText(n.room_type.replace(/_/g, " "), cx, cy + 14);
    });

    // 7. Draw Destination Pin (teardrop marker)
    const goalNode = nodes[simState.episode.goal_node];
    if (goalNode) {
      const gx = toCanvasX(goalNode.x);
      const gy = toCanvasY(goalNode.y);

      const bob = Math.sin(timestamp * 0.004) * 4;
      const pinY = gy - 16 + bob;

      targetCtx.beginPath();
      targetCtx.ellipse(gx, gy + 3, 9, 3.5, 0, 0, 2 * Math.PI);
      targetCtx.fillStyle = "rgba(0, 0, 0, 0.18)";
      targetCtx.fill();

      targetCtx.save();
      targetCtx.translate(gx, pinY);

      targetCtx.beginPath();
      targetCtx.arc(0, -11, 11, Math.PI, 0, false);
      targetCtx.bezierCurveTo(11, -3, 0, 9, 0, 15);
      targetCtx.bezierCurveTo(0, 9, -11, -3, -11, -11);
      targetCtx.closePath();
      targetCtx.fillStyle = PAL.danger;
      targetCtx.fill();
      targetCtx.strokeStyle = "#ffffff";
      targetCtx.lineWidth = 1.8;
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.arc(0, -11, 4, 0, 2 * Math.PI);
      targetCtx.fillStyle = "#ffffff";
      targetCtx.fill();

      targetCtx.restore();

      targetCtx.fillStyle = PAL.danger;
      targetCtx.font = '600 9px Inter, system-ui, sans-serif';
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "alphabetic";
      targetCtx.fillText("DESTINATION", gx, pinY - 26);
    }

    // 8. Draw Google Maps Navigation GPS Puck
    const ax = toCanvasX(animAgent.x);
    const ay = toCanvasY(animAgent.y);
    const headingRad = (animAgent.heading - 90) * (Math.PI / 180);

    const pulseRadius = 13 + 9 * ((Math.sin(timestamp * 0.005) + 1) / 2);
    const pulseAlpha = Math.max(0.1, 0.45 - (pulseRadius - 13) / 22);
    targetCtx.beginPath();
    targetCtx.arc(ax, ay, pulseRadius, 0, 2 * Math.PI);
    targetCtx.fillStyle = withAlpha(PAL.route, pulseAlpha * 0.6);
    targetCtx.fill();

    const fovAngle = Math.PI / 3;
    const coneLen = 38;
    targetCtx.beginPath();
    targetCtx.moveTo(ax, ay);
    targetCtx.arc(ax, ay, coneLen, headingRad - fovAngle / 2, headingRad + fovAngle / 2);
    targetCtx.closePath();
    const coneGrad = targetCtx.createRadialGradient(ax, ay, 4, ax, ay, coneLen);
    coneGrad.addColorStop(0, withAlpha(PAL.route, 0.55));
    coneGrad.addColorStop(1, withAlpha(PAL.route, 0));
    targetCtx.fillStyle = coneGrad;
    targetCtx.fill();

    targetCtx.beginPath();
    targetCtx.arc(ax, ay, 7.5, 0, 2 * Math.PI);
    targetCtx.fillStyle = PAL.route;
    targetCtx.fill();
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
          const av = document.getElementById('user-avatar');
          if (av) av.textContent = sess.username.trim().charAt(0) || 'R';
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

  if (elPlayIcon) elPlayIcon.innerHTML = ICON_PLAY;
  if (elGmapTurnIcon) elGmapTurnIcon.innerHTML = TURN.straight;

  // Start continuous 60fps render loop
  startAnimationLoop();

  // Initial boot
  fetchInitialState();
})();
