// Timeline Playback and Animation System
// Handles timeline playback, keyframe animations, screen effects, and audio transitions

        // Screen panel variables
        let isFullscreen = false;

        // Keyframe system variables
        let keyframes = [];
        let currentKeyframeIndex = 0;
        let isTimelinePlaying = false;
        let timelineStartTime = 0;
        let timelineCurrentTime = 0;
        let timelineInterval = null;
        let animationIntervals = {}; // Track active animations

        // Screen Flashing System - Continuous Animation Approach
        // Uses requestAnimationFrame for smooth, continuous flashing without phase disruption

        // Future extension possibilities:
        // Option 2: Web Audio API integration - sync flashing with audio timeline for precise timing
        // Option 3: CSS animation approach - use CSS variables and animations for browser-optimized performance

        let screenFlashState = {
            isActive: false,
            startTime: 0,
            lastTimestamp: 0, // Track last frame for incremental phase calculation
            phase: 0, // Continuous phase tracking (0-1, where dutyCycle = transition point)
            currentRate: 10,
            currentColor: '#ffffff',
            currentDutyCycle: 0.5, // 50% default duty cycle (0.01-0.99)
            currentMode: 'screen', // 'screen', 'flashlight', or 'auto'
            animationId: null,

            // Animation properties
            isAnimating: false,
            animationStart: 0,
            animationDuration: 0,
            fromRate: 10,
            toRate: 10,
            fromColor: '#ffffff',
            toColor: '#ffffff',
            fromRGB: { r: 255, g: 255, b: 255 },
            toRGB: { r: 255, g: 255, b: 255 },
            fromDutyCycle: 0.5,
            toDutyCycle: 0.5
        };

        // Flashlight control state
        let flashlightState = {
            isSupported: false,
            hasPermission: false,
            stream: null,
            track: null,
            imageCapture: null,
            isOn: false
        };

        async function startScreenFlashing(screenSettings) {
            if (!screenSettings || !screenSettings.enabled) return;

            const mode = screenSettings.mode || 'screen';
            const effectiveMode = await determineEffectiveMode(mode);

            console.log(`🎬 Starting visual flashing (${effectiveMode}): ${screenSettings.rate}Hz, duty: ${(screenSettings.dutyCycle || 50)}%`);

            // Initialize or update state
            screenFlashState.isActive = true;
            screenFlashState.currentRate = parseFloat(screenSettings.rate);
            screenFlashState.currentColor = screenSettings.color;
            screenFlashState.currentDutyCycle = (screenSettings.dutyCycle || 50) / 100; // Convert percentage to 0-1
            screenFlashState.currentMode = effectiveMode;

            // Only reset timing if we're starting fresh (not during animation)
            if (!screenFlashState.isAnimating) {
                screenFlashState.startTime = performance.now();
                screenFlashState.lastTimestamp = performance.now();
                screenFlashState.phase = 0;
            }

            // Start the appropriate flashing method
            if (effectiveMode === 'flashlight') {
                if (!flashlightState.hasPermission) {
                    const success = await requestFlashlightAccess();
                    if (!success) {
                        console.warn('⚠️ Flashlight failed, falling back to screen');
                        screenFlashState.currentMode = 'screen';
                    }
                }
            }

            // Start the continuous animation loop if not already running
            if (!screenFlashState.animationId) {
                screenFlashState.animationId = requestAnimationFrame(updateVisualFlashing);
            }
        }

        async function determineEffectiveMode(requestedMode) {
            switch (requestedMode) {
                case 'screen':
                    return 'screen';

                case 'flashlight':
                    // Check if flashlight is potentially available
                    if (navigator.mediaDevices && window.ImageCapture) {
                        return 'flashlight';
                    } else {
                        console.warn('⚠️ Flashlight API not supported, using screen');
                        return 'screen';
                    }

                case 'auto':
                    // Use flashlight on mobile devices with support, screen elsewhere
                    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobile && navigator.mediaDevices && window.ImageCapture) {
                        return 'flashlight';
                    } else {
                        return 'screen';
                    }

                default:
                    return 'screen';
            }
        }

        function stopScreenFlashing() {
            console.log('⏹️ Stopping visual flashing');

            screenFlashState.isActive = false;
            screenFlashState.isAnimating = false;

            if (screenFlashState.animationId) {
                cancelAnimationFrame(screenFlashState.animationId);
                screenFlashState.animationId = null;
            }

            // Turn off flashlight if it was being used
            if (screenFlashState.currentMode === 'flashlight') {
                setFlashlightState(false);
            }

            // Reset overlay to black
            const overlay = document.getElementById('fullscreenOverlay');
            if (overlay) {
                overlay.style.backgroundColor = '#000000';
            }
        }

        function updateVisualFlashing(timestamp) {
            if (!screenFlashState.isActive) return;

            // Handle animation interpolation
            if (screenFlashState.isAnimating) {
                const animationElapsed = (timestamp - screenFlashState.animationStart) / 1000;
                const animationProgress = Math.min(animationElapsed / screenFlashState.animationDuration, 1);

                // Interpolate rate smoothly
                screenFlashState.currentRate = screenFlashState.fromRate +
                    (screenFlashState.toRate - screenFlashState.fromRate) * animationProgress;

                // Interpolate color smoothly (for screen mode)
                const currentR = Math.round(screenFlashState.fromRGB.r +
                    (screenFlashState.toRGB.r - screenFlashState.fromRGB.r) * animationProgress);
                const currentG = Math.round(screenFlashState.fromRGB.g +
                    (screenFlashState.toRGB.g - screenFlashState.fromRGB.g) * animationProgress);
                const currentB = Math.round(screenFlashState.fromRGB.b +
                    (screenFlashState.toRGB.b - screenFlashState.fromRGB.b) * animationProgress);

                screenFlashState.currentColor = `rgb(${currentR}, ${currentG}, ${currentB})`;

                // Interpolate duty cycle smoothly
                screenFlashState.currentDutyCycle = screenFlashState.fromDutyCycle +
                    (screenFlashState.toDutyCycle - screenFlashState.fromDutyCycle) * animationProgress;

                // End animation when complete
                if (animationProgress >= 1) {
                    screenFlashState.isAnimating = false;
                    screenFlashState.currentRate = screenFlashState.toRate;
                    screenFlashState.currentColor = screenFlashState.toColor;
                    screenFlashState.currentDutyCycle = screenFlashState.toDutyCycle;
                }
            }

            // Calculate incremental phase change since last frame (for smooth continuous animation)
            const deltaTime = (timestamp - screenFlashState.lastTimestamp) / 1000;
            const phaseDelta = deltaTime * screenFlashState.currentRate;
            screenFlashState.phase = (screenFlashState.phase + phaseDelta) % 1; // Keep fractional part (0-1)
            screenFlashState.lastTimestamp = timestamp;

            // Determine if we're in the "on" or "off" phase using configurable duty cycle
            const isOn = screenFlashState.phase < screenFlashState.currentDutyCycle;

            // Update the appropriate visual output
            if (screenFlashState.currentMode === 'flashlight') {
                updateFlashlightState(isOn);
            } else {
                updateScreenState(isOn);
            }

            // Continue the animation loop
            screenFlashState.animationId = requestAnimationFrame(updateVisualFlashing);
        }

        function updateScreenState(isOn) {
            const overlay = document.getElementById('fullscreenOverlay');
            if (!overlay) return;
            overlay.style.backgroundColor = isOn ? screenFlashState.currentColor : '#000000';
        }

        function updateFlashlightState(isOn) {
            // Only update flashlight if state has changed (avoid excessive API calls)
            if (flashlightState.isOn !== isOn) {
                setFlashlightState(isOn);
            }

            // Also update screen to show current state (dim visualization)
            const overlay = document.getElementById('fullscreenOverlay');
            if (overlay) {
                overlay.style.backgroundColor = isOn ? '#333333' : '#000000'; // Dim visualization
            }
        }

        function animateScreenPanel(fromSettings, toSettings, duration) {
            console.log(`🎬 Visual animation: ${fromSettings.rate}Hz → ${toSettings.rate}Hz over ${duration}s`);
            console.log(`🎨 Color animation: ${fromSettings.color} → ${toSettings.color}`);
            console.log(`⚡ Duty cycle animation: ${fromSettings.dutyCycle || 50}% → ${toSettings.dutyCycle || 50}%`);
            console.log(`📱 Mode: ${toSettings.mode || 'screen'}`);

            // Set up animation parameters
            screenFlashState.isAnimating = true;
            screenFlashState.animationStart = performance.now();
            screenFlashState.animationDuration = duration;
            screenFlashState.fromRate = parseFloat(fromSettings.rate);
            screenFlashState.toRate = parseFloat(toSettings.rate);
            screenFlashState.fromColor = fromSettings.color;
            screenFlashState.toColor = toSettings.color;
            screenFlashState.fromDutyCycle = (fromSettings.dutyCycle || 50) / 100;
            screenFlashState.toDutyCycle = (toSettings.dutyCycle || 50) / 100;

            // Convert colors to RGB for smooth interpolation (used for screen mode)
            screenFlashState.fromRGB = hexToRgb(fromSettings.color);
            screenFlashState.toRGB = hexToRgb(toSettings.color);

            // Start or continue the flashing with animation
            startScreenFlashing({
                enabled: true,
                rate: fromSettings.rate,
                color: fromSettings.color,
                dutyCycle: fromSettings.dutyCycle || 50,
                mode: toSettings.mode || 'screen'
            });
        }

        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : { r: 0, g: 0, b: 0 };
        }

        // Flashlight Control Functions
        async function requestFlashlightAccess() {
            console.log('🔦 Requesting flashlight access...');

            try {
                // Check if getUserMedia is available
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Camera API not supported');
                }

                // Request camera access with torch support
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment', // Back camera (usually has flash)
                        torch: true
                    }
                });

                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities();

                if (!capabilities.torch) {
                    throw new Error('Torch not supported on this device');
                }

                // Try to create ImageCapture for better flash control
                let imageCapture = null;
                try {
                    imageCapture = new ImageCapture(track);
                } catch (e) {
                    console.warn('ImageCapture not supported, using track constraints');
                }

                flashlightState = {
                    isSupported: true,
                    hasPermission: true,
                    stream: stream,
                    track: track,
                    imageCapture: imageCapture,
                    isOn: false
                };

                console.log('✅ Flashlight access granted');
                return true;

            } catch (error) {
                console.warn('❌ Flashlight access failed:', error.message);
                flashlightState = {
                    isSupported: false,
                    hasPermission: false,
                    stream: null,
                    track: null,
                    imageCapture: null,
                    isOn: false
                };
                return false;
            }
        }

        async function setFlashlightState(enabled) {
            if (!flashlightState.hasPermission || !flashlightState.track) {
                console.warn('⚠️ No flashlight access available');
                return false;
            }

            try {
                if (flashlightState.imageCapture) {
                    // Use ImageCapture API (preferred)
                    await flashlightState.imageCapture.setOptions({ torch: enabled });
                } else {
                    // Use track constraints (fallback)
                    await flashlightState.track.applyConstraints({
                        advanced: [{ torch: enabled }]
                    });
                }

                flashlightState.isOn = enabled;
                return true;

            } catch (error) {
                console.warn(`❌ Failed to ${enabled ? 'enable' : 'disable'} flashlight:`, error.message);
                return false;
            }
        }

        function releaseFlashlight() {
            console.log('🔦 Releasing flashlight...');

            if (flashlightState.stream) {
                flashlightState.stream.getTracks().forEach(track => track.stop());
            }

            flashlightState = {
                isSupported: false,
                hasPermission: false,
                stream: null,
                track: null,
                imageCapture: null,
                isOn: false
            };
        }

        function enterFullscreen() {
            const currentScreenSettings = keyframes[currentKeyframeIndex]?.screenPanel;
            console.log("🔍 enterFullscreen called:", currentScreenSettings);

            if (!currentScreenSettings || !currentScreenSettings.enabled) {
                console.log("❌ Screen panel not enabled, skipping fullscreen");
                return;
            }

            console.log("✅ Entering fullscreen with screen panel");

            isFullscreen = true;
            const overlay = document.getElementById('fullscreenOverlay');
            const mainContent = document.getElementById('mainContent');
            const topControls = document.querySelector('.top-controls');

            console.log("🔍 Elements found:", {
                overlay: !!overlay,
                mainContent: !!mainContent,
                topControls: !!topControls
            });

            mainContent.classList.add('hidden');
            overlay.classList.add('active');

            if (topControls) {
                topControls.classList.add('visible');
                console.log("✅ Added 'visible' class to top-controls");
            } else {
                console.error("❌ Could not find .top-controls element!");
            }

            // Update display with current keyframe info
            updateCurrentKeyframeDisplay();

            // Only start screen flashing if not in timeline mode
            // Timeline mode will handle screen flashing through its own logic
            if (!isTimelinePlaying) {
                startScreenFlashing({
                    enabled: currentScreenSettings.enabled,
                    rate: currentScreenSettings.rate,
                    color: currentScreenSettings.color,
                    dutyCycle: currentScreenSettings.dutyCycle || 50,
                    mode: currentScreenSettings.mode || 'auto'
                });
            } else {
                console.log(`⏸️ Timeline mode active - screen flashing will be handled by timeline system`);
            }
        }

        function exitFullscreen() {
            isFullscreen = false;
            const overlay = document.getElementById('fullscreenOverlay');
            const mainContent = document.getElementById('mainContent');
            const topControls = document.querySelector('.top-controls');

            stopScreenFlashing();
            overlay.classList.remove('active');
            overlay.style.backgroundColor = '#000000';
            mainContent.classList.remove('hidden');
            topControls.classList.remove('visible');
        }

        // Keyframe System Functions
        function initializeKeyframes() {
            // Create initial keyframe (Key0) with current settings
            const initialKeyframe = createKeyframeFromCurrentState();
            initialKeyframe.title = 'Key0';
            initialKeyframe.description = 'Initial state';
            initialKeyframe.length = 10;
            initialKeyframe.guideText = 'Starting configuration';

            keyframes = [initialKeyframe];
            currentKeyframeIndex = 0;
            updateKeyframeTabs();
            updateKeyframeDetails();
            updateTimelineInfo();
        }

        function createKeyframeFromCurrentState() {
            console.log(`🔍 ROOT CAUSE INVESTIGATION - createKeyframeFromCurrentState()`);

            const currentScreenSettings = keyframes.length > 0 && keyframes[currentKeyframeIndex]?.screenPanel
                ? keyframes[currentKeyframeIndex].screenPanel
                : { enabled: false, color: '#ffffff', rate: 10, dutyCycle: 50, mode: 'auto' };

            const keyframe = {
                title: '',
                description: '',
                length: 10,
                guideText: '',
                screenPanel: {
                    enabled: currentScreenSettings.enabled,
                    color: currentScreenSettings.color,
                    rate: currentScreenSettings.rate,
                    dutyCycle: currentScreenSettings.dutyCycle || 50,
                    mode: currentScreenSettings.mode || 'auto'
                },
                panels: {}
            };

            Object.keys(generators).forEach(panelId => {
                const generator = generators[panelId];

                // INVESTIGATE: Check generator values BEFORE creating keyframe
                console.log(`🔎 Generator ${panelId} state:`, {
                    frequency: generator.frequency,
                    volume: generator.volume,
                    pan: generator.pan,
                    types: {
                        frequency: typeof generator.frequency,
                        volume: typeof generator.volume,
                        pan: typeof generator.pan
                    }
                });

                // Check for invalid values at the source
                if (!isFinite(generator.frequency) || generator.frequency === null || generator.frequency === undefined) {
                    console.error(`💥 GENERATOR HAS INVALID FREQUENCY: ${generator.frequency} (${typeof generator.frequency})`);
                }
                if (!isFinite(generator.volume) || generator.volume === null || generator.volume === undefined) {
                    console.error(`💥 GENERATOR HAS INVALID VOLUME: ${generator.volume} (${typeof generator.volume})`);
                }
                if (!isFinite(generator.pan) || generator.pan === null || generator.pan === undefined) {
                    console.error(`💥 GENERATOR HAS INVALID PAN: ${generator.pan} (${typeof generator.pan})`);
                }

                keyframe.panels[panelId] = {
                    frequency: Math.round(generator.frequency * 100) / 100,
                    waveType: generator.waveType,
                    volume: generator.volume,
                    pan: generator.pan,
                    lockTarget: generator.lockTarget,
                    frequencyOffset: Math.round(generator.frequencyOffset * 100) / 100,
                    isIsochronic: generator.isIsochronic,
                    isochronicRate: generator.isochronicRate,
                    isDelayedTone: generator.isDelayedTone,
                    delayTime: generator.delayTime,
                    animate: generator.animate,
                    fade: generator.fade,
                    fadeDuration: generator.fadeDuration
                };
            });

            return keyframe;
        }

        function saveCurrentKeyframe() {
            if (keyframes.length === 0) return;

            const currentKeyframe = createKeyframeFromCurrentState();
            // Preserve keyframe metadata
            currentKeyframe.title = keyframes[currentKeyframeIndex].title;
            currentKeyframe.description = keyframes[currentKeyframeIndex].description;
            currentKeyframe.length = keyframes[currentKeyframeIndex].length;
            currentKeyframe.guideText = keyframes[currentKeyframeIndex].guideText;

            keyframes[currentKeyframeIndex] = currentKeyframe;
            updateTimelineInfo();
        }

        function addKeyframe() {
            const newKeyframe = createKeyframeFromCurrentState();
            newKeyframe.title = `Key${keyframes.length}`;
            newKeyframe.description = 'New keyframe';
            newKeyframe.length = 10;
            newKeyframe.guideText = '';

            keyframes.push(newKeyframe);
            currentKeyframeIndex = keyframes.length - 1;
            updateKeyframeTabs();
            updateKeyframeDetails();
            updateTimelineInfo();
        }

        function switchToKeyframe(index) {
            if (index < 0 || index >= keyframes.length) return;

            saveCurrentKeyframe(); // Save current state
            currentKeyframeIndex = index;
            loadKeyframeState(keyframes[index]);
            updateKeyframeTabs();
            updateKeyframeDetails();
            updateAnimateControlsVisibility();
        }

        function loadKeyframeState(keyframe) {
            console.log(`🔍 ROOT CAUSE INVESTIGATION - loadKeyframeState()`);
            console.log(`🔎 Loading keyframe:`, keyframe);

            // Screen panel is now per-keyframe, no need to update global elements

            // Update all panels
            Object.keys(keyframe.panels).forEach(panelId => {
                if (generators[panelId]) {
                    const panelData = keyframe.panels[panelId];
                    const generator = generators[panelId];

                    console.log(`🔎 Loading panel ${panelId} data:`, panelData);

                    // INVESTIGATE: Check keyframe data BEFORE loading into generator
                    if (!isFinite(panelData.frequency) || panelData.frequency === null || panelData.frequency === undefined) {
                        console.error(`💥 KEYFRAME HAS INVALID FREQUENCY: ${panelData.frequency} (${typeof panelData.frequency})`);
                    }
                    if (!isFinite(panelData.volume) || panelData.volume === null || panelData.volume === undefined) {
                        console.error(`💥 KEYFRAME HAS INVALID VOLUME: ${panelData.volume} (${typeof panelData.volume})`);
                    }
                    if (!isFinite(panelData.pan) || panelData.pan === null || panelData.pan === undefined) {
                        console.error(`💥 KEYFRAME HAS INVALID PAN: ${panelData.pan} (${typeof panelData.pan})`);
                    }

                    // Update generator state
                    generator.frequency = panelData.frequency;
                    generator.waveType = panelData.waveType;
                    generator.volume = panelData.volume;
                    generator.pan = panelData.pan;
                    generator.lockTarget = panelData.lockTarget;
                    generator.frequencyOffset = panelData.frequencyOffset;
                    generator.isIsochronic = panelData.isIsochronic;
                    generator.isochronicRate = panelData.isochronicRate;
                    generator.isDelayedTone = panelData.isDelayedTone || false;
                    generator.delayTime = panelData.delayTime || 100;
                    generator.animate = panelData.animate || false;
                    generator.fade = panelData.fade !== undefined ? panelData.fade : true;
                    generator.fadeDuration = panelData.fadeDuration || 2;

                    console.log(`🔎 Generator ${panelId} after loading:`, {
                        frequency: generator.frequency,
                        volume: generator.volume,
                        pan: generator.pan
                    });

                    // Update UI
                    updateFrequencyDisplay(panelId, panelData.frequency);
                    document.getElementById(`${panelId}-slider`).value = panelData.frequency;
                    document.getElementById(`${panelId}-wave`).value = panelData.waveType;
                    document.getElementById(`${panelId}-volume`).value = panelData.volume;
                    document.getElementById(`${panelId}-volume-display`).textContent = Math.round(panelData.volume * 100) + '%';
                    document.getElementById(`${panelId}-pan`).value = panelData.pan;

                    let panDisplayText;
                    if (panelData.pan < -0.1) {
                        panDisplayText = `Left ${Math.round(-panelData.pan * 100)}%`;
                    } else if (panelData.pan > 0.1) {
                        panDisplayText = `Right ${Math.round(panelData.pan * 100)}%`;
                    } else {
                        panDisplayText = 'Center';
                    }
                    document.getElementById(`${panelId}-pan-display`).textContent = panDisplayText;

                    document.getElementById(`${panelId}-isochronic`).checked = panelData.isIsochronic;
                    document.getElementById(`${panelId}-iso-rate`).value = panelData.isochronicRate;
                    document.getElementById(`${panelId}-iso-rate-display`).textContent = panelData.isochronicRate.toFixed(1) + ' Hz';

                    document.getElementById(`${panelId}-delayed-tone`).checked = panelData.isDelayedTone || false;
                    document.getElementById(`${panelId}-delay-time`).value = panelData.delayTime || 100;
                    document.getElementById(`${panelId}-delay-time-display`).textContent = (panelData.delayTime || 100) + 'ms';

                    // Update delayed tone UI state
                    const isDelayed = panelData.isDelayedTone || false;
                    document.getElementById(`${panelId}-pan`).disabled = isDelayed;
                    document.getElementById(`${panelId}-pan-display`).style.opacity = isDelayed ? '0.5' : '1';
                    document.getElementById(`${panelId}-isochronic`).disabled = isDelayed;
                    document.getElementById(`${panelId}-delay-time`).disabled = !isDelayed;

                    document.getElementById(`${panelId}-animate`).checked = panelData.animate || false;
                    document.getElementById(`${panelId}-fade`).checked = panelData.fade !== undefined ? panelData.fade : true;
                    document.getElementById(`${panelId}-fade-duration`).value = panelData.fadeDuration || 2;
                    document.getElementById(`${panelId}-fade-duration-display`).textContent = (panelData.fadeDuration || 2).toFixed(1) + 's';
                }
            });

            // Update lock dropdowns
            updateLockDropdowns();
            Object.keys(keyframe.panels).forEach(panelId => {
                if (generators[panelId] && keyframe.panels[panelId].lockTarget) {
                    const dropdown = document.getElementById(`${panelId}-lock-dropdown`);
                    const indicator = document.getElementById(`${panelId}-lock-indicator`);
                    dropdown.value = keyframe.panels[panelId].lockTarget;
                    const targetLabel = getPanelLabel(keyframe.panels[panelId].lockTarget);
                    indicator.textContent = `→ ${targetLabel}`;
                    indicator.classList.add('active');
                }
            });
        }

        function updateAnimateControlsVisibility() {
            Object.keys(generators).forEach(panelId => {
                const animateCheckbox = document.getElementById(`${panelId}-animate`);
                if (currentKeyframeIndex === 0) {
                    // Disable animate on Key0
                    animateCheckbox.disabled = true;
                    animateCheckbox.checked = false;
                    generators[panelId].animate = false;
                } else {
                    animateCheckbox.disabled = false;
                }
            });
        }

        function updateKeyframeTabs() {
            const tabsContainer = document.getElementById('keyframe-tabs');
            tabsContainer.innerHTML = keyframes.map((keyframe, index) => `
                <button class="keyframe-tab ${index === currentKeyframeIndex ? 'active' : ''}"
                        onclick="switchToKeyframe(${index})">
                    ${keyframe.title}
                </button>
            `).join('');
        }

        function updateKeyframeDetails() {
            const detailsContainer = document.getElementById('keyframe-details');
            const currentKeyframe = keyframes[currentKeyframeIndex];

            detailsContainer.innerHTML = `
                <div class="keyframe-input">
                    <label>Title</label>
                    <input type="text" value="${currentKeyframe.title}"
                           onchange="updateKeyframeProperty('title', this.value)">
                </div>
                <div class="keyframe-input">
                    <label>Description</label>
                    <input type="text" value="${currentKeyframe.description}"
                           onchange="updateKeyframeProperty('description', this.value)">
                </div>
                <div class="keyframe-input">
                    <label>Length (seconds)</label>
                    <input type="number" min="0.1" step="0.1" value="${currentKeyframe.length}"
                           onchange="updateKeyframeProperty('length', parseFloat(this.value))">
                </div>
                <div class="keyframe-input">
                    <label>Guide Text</label>
                    <textarea placeholder="Instructions or guidance for this phase"
                              onchange="updateKeyframeProperty('guideText', this.value)">${currentKeyframe.guideText}</textarea>
                </div>
                <div class="keyframe-input">
                    <label>Visual Enabled</label>
                    <input type="checkbox" ${currentKeyframe.screenPanel?.enabled ? 'checked' : ''}
                           onchange="updateScreenProperty('enabled', this.checked)">
                </div>
                <div class="keyframe-input">
                    <label>Visual Color</label>
                    <input type="color" value="${currentKeyframe.screenPanel?.color || '#ffffff'}"
                           onchange="updateScreenProperty('color', this.value)">
                </div>
                <div class="keyframe-input">
                    <label>Visual Rate (Hz)</label>
                    <input type="number" class="frequency-input-field"
                           id="screen-rate-input"
                           min="0.01" max="100" step="0.01" value="${(currentKeyframe.screenPanel?.rate || 10).toFixed(2)}"
                           onchange="updateScreenRateFromInput(this.value)"
                           onkeydown="handleScreenRateKeydown(event)">
                    <div class="frequency-slider-container">
                        <input type="range" class="frequency-slider"
                               id="screen-rate-slider"
                               min="0.01" max="100" value="${currentKeyframe.screenPanel?.rate || 10}"
                               oninput="updateScreenRateFromSlider(this.value)">
                    </div>
                </div>
                <div class="keyframe-input">
                    <label>Duty Cycle (%)</label>
                    <input type="number" class="frequency-input-field"
                           id="screen-duty-input"
                           min="1" max="99" step="1" value="${currentKeyframe.screenPanel?.dutyCycle || 50}"
                           onchange="updateScreenDutyCycleFromInput(this.value)"
                           onkeydown="handleScreenDutyCycleKeydown(event)">
                    <div class="frequency-slider-container">
                        <input type="range" class="frequency-slider"
                               id="screen-duty-slider"
                               min="1" max="99" value="${currentKeyframe.screenPanel?.dutyCycle || 50}"
                               oninput="updateScreenDutyCycleFromSlider(this.value)">
                    </div>
                </div>
                <div class="keyframe-input">
                    <label>Visual Mode</label>
                    <select class="wave-select" id="screen-mode-select"
                            onchange="updateScreenProperty('mode', this.value)">
                        <option value="screen" ${(currentKeyframe.screenPanel?.mode || 'auto') === 'screen' ? 'selected' : ''}>🖥️ Screen Flash</option>
                        <option value="flashlight" ${(currentKeyframe.screenPanel?.mode || 'auto') === 'flashlight' ? 'selected' : ''}>🔦 Flashlight</option>
                        <option value="auto" ${(currentKeyframe.screenPanel?.mode || 'auto') === 'auto' ? 'selected' : ''}>🔄 Auto (Smart)</option>
                    </select>
                    <div class="visual-mode-info">
                        <small>Screen: Always works | Flashlight: Mobile only | Auto: Smart detection</small>
                    </div>
                </div>
            `;
        }

        function updateKeyframeProperty(property, value) {
            keyframes[currentKeyframeIndex][property] = value;
            updateKeyframeTabs();
            updateTimelineInfo();
        }

        function updateScreenProperty(property, value) {
            if (!keyframes[currentKeyframeIndex].screenPanel) {
                keyframes[currentKeyframeIndex].screenPanel = {
                    enabled: false,
                    color: '#ffffff',
                    rate: 10,
                    dutyCycle: 50,
                    mode: 'auto'
                };
            }
            keyframes[currentKeyframeIndex].screenPanel[property] = value;

            // Update the display for rate, dutyCycle, or mode
            if (property === 'rate' || property === 'dutyCycle' || property === 'mode') {
                updateKeyframeDetails();
            }

            saveCurrentKeyframe();
        }

        function updateScreenRateFromInput(inputValue) {
            let rate = parseFloat(inputValue);
            if (isNaN(rate)) rate = 10;
            rate = Math.max(0.01, Math.min(100, rate));
            rate = Math.round(rate * 100) / 100;

            // Update keyframe data
            updateScreenProperty('rate', rate);

            // Update slider
            const slider = document.getElementById('screen-rate-slider');
            if (slider) slider.value = rate;
        }

        function updateScreenRateFromSlider(value) {
            const rate = parseFloat(value);

            // Update keyframe data directly without triggering UI regeneration
            if (!keyframes[currentKeyframeIndex].screenPanel) {
                keyframes[currentKeyframeIndex].screenPanel = {
                    enabled: false,
                    color: '#ffffff',
                    rate: 10,
                    dutyCycle: 50
                };
            }
            keyframes[currentKeyframeIndex].screenPanel.rate = rate;

            // Update input field only
            const input = document.getElementById('screen-rate-input');
            if (input) input.value = rate.toFixed(2);
        }

        function handleScreenRateKeydown(event) {
            if (event.key === 'Enter') {
                updateScreenRateFromInput(event.target.value);
            }
        }

        function updateScreenDutyCycleFromInput(inputValue) {
            let dutyCycle = parseInt(inputValue);
            if (isNaN(dutyCycle)) dutyCycle = 50;
            dutyCycle = Math.max(1, Math.min(99, dutyCycle));

            // Update keyframe data
            updateScreenProperty('dutyCycle', dutyCycle);

            // Update slider
            const slider = document.getElementById('screen-duty-slider');
            if (slider) slider.value = dutyCycle;
        }

        function updateScreenDutyCycleFromSlider(value) {
            const dutyCycle = parseInt(value);

            // Update keyframe data directly without triggering UI regeneration
            if (!keyframes[currentKeyframeIndex].screenPanel) {
                keyframes[currentKeyframeIndex].screenPanel = {
                    enabled: false,
                    color: '#ffffff',
                    rate: 10,
                    dutyCycle: 50,
                    mode: 'auto'
                };
            }
            keyframes[currentKeyframeIndex].screenPanel.dutyCycle = dutyCycle;

            // Update input field only
            const input = document.getElementById('screen-duty-input');
            if (input) input.value = dutyCycle;
        }

        function handleScreenDutyCycleKeydown(event) {
            if (event.key === 'Enter') {
                updateScreenDutyCycleFromInput(event.target.value);
            }
        }

        function updateTimelineInfo() {
            const totalDuration = keyframes.reduce((sum, kf) => sum + kf.length, 0);
            document.getElementById('timeline-current').textContent = `Current: ${keyframes[currentKeyframeIndex]?.title || 'None'}`;
            document.getElementById('timeline-duration').textContent = `Total Duration: ${totalDuration}s`;
        }

        function testCurrentKeyframe() {
            // Play just the current keyframe for testing without visual effects
            Object.keys(generators).forEach(panelId => {
                if (!generators[panelId].isPlaying) {
                    togglePlay(panelId);
                }
            });
            // Skip enterFullscreen() to keep settings visible and avoid visual flicker
        }

        // Quick test setup for screen animation timing
        function setupScreenAnimationTest() {
            keyframes = [
                {
                    title: "Key0 - Fast Start",
                    description: "5Hz flicker for 15 seconds",
                    length: 15,
                    guideText: "Should visibly slow down from 5Hz to 0.5Hz during these 15 seconds",
                    screenPanel: { enabled: true, color: "#FFD700", rate: 5, dutyCycle: 50, mode: 'auto' },
                    panels: {}
                },
                {
                    title: "Key1 - Slow End",
                    description: "0.5Hz flicker for 10 seconds",
                    length: 10,
                    guideText: "Should stay at slow 0.5Hz (2 second cycle) for 10 seconds",
                    screenPanel: { enabled: true, color: "#FFD700", rate: 0.5, dutyCycle: 50, mode: 'auto' },
                    panels: {}
                }
            ];
            currentKeyframeIndex = 0;
            updateKeyframeTabs();
            switchToKeyframe(0);
            console.log('✅ Visual animation test setup complete - Key0: 5Hz→0.5Hz over 15s (will auto-detect best visual mode)');
        }

        function playTimeline() {
            if (isTimelinePlaying) return;

            isTimelinePlaying = true;
            timelineStartTime = Date.now();
            currentKeyframeIndex = 0;

            // Reset tracking variables
            window.lastTimelineKeyframe = -1; // Force initial keyframe load

            // Auto-enter fullscreen if any keyframe has screen panels
            const hasScreenPanels = keyframes.some(kf => kf.screenPanel?.enabled);
            if (hasScreenPanels && !isFullscreen) {
                console.log('🎬 Auto-entering fullscreen for screen panel animations');
                enterFullscreen();
            }

            // Load first keyframe
            loadKeyframeState(keyframes[0]);
            playAll();

            // Start timeline progression
            timelineInterval = setInterval(updateTimeline, 100);
            document.getElementById('play-timeline').textContent = 'Playing...';

            // Update display
            updateCurrentKeyframeDisplay();
        }

        function stopTimeline() {
            console.log("⏹️ Stopping timeline...");

            isTimelinePlaying = false;
            if (timelineInterval) {
                clearInterval(timelineInterval);
                timelineInterval = null;
            }

            // Clear all animation intervals
            Object.values(animationIntervals).forEach(interval => clearInterval(interval));
            animationIntervals = {};

            // Stop screen flashing animation
            stopScreenFlashing();

            // CRITICAL: Restore clean keyframe state to prevent corruption
            restoreCleanKeyframeState();

            stopAll();
            exitFullscreen();
            document.getElementById('play-timeline').textContent = 'Play Timeline';
            document.getElementById('timeline-bar').style.width = '0%';

            // Update display
            updateCurrentKeyframeDisplay();

            console.log("✅ Timeline stopped and state restored");
        }

        function restoreCleanKeyframeState() {
            console.log("🧹 Restoring clean keyframe state...");

            // Clear animation tracking
            window.originalKeyframeValues = {};
            window.lastTimelineKeyframe = -1;

            // Restore current keyframe's clean state
            if (keyframes.length > 0) {
                const currentKF = keyframes[currentKeyframeIndex];
                console.log(`Restoring to keyframe ${currentKeyframeIndex}: ${currentKF.title}`);
                loadKeyframeState(currentKF);
            }
        }

        function stopEverything() {
            console.log("🛑 Stopping everything...");
            console.log(`Timeline playing: ${isTimelinePlaying}`);

            // Stop timeline if running
            if (isTimelinePlaying) {
                console.log("Calling stopTimeline()...");
                stopTimeline();
            } else {
                console.log("Timeline not playing, skipping stopTimeline()");
            }

            // Stop all individual frequencies
            console.log("Calling stopAll()...");
            stopAll();

            // Update display
            updateCurrentKeyframeDisplay();

            console.log("✅ Everything stopped");
        }

        function updateCurrentKeyframeDisplay() {
            const titleEl = document.getElementById('current-keyframe-title');
            const descEl = document.getElementById('current-keyframe-description');

            if (isTimelinePlaying && keyframes.length > 0) {
                const currentKF = keyframes[currentKeyframeIndex];
                titleEl.textContent = currentKF.title || `Keyframe ${currentKeyframeIndex}`;
                descEl.textContent = currentKF.description || currentKF.guideText || 'Playing timeline...';
            } else if (keyframes.length > 0) {
                const currentKF = keyframes[currentKeyframeIndex];
                titleEl.textContent = currentKF.title || `Keyframe ${currentKeyframeIndex}`;
                descEl.textContent = 'Ready to play';
            } else {
                titleEl.textContent = 'Frequency Generator';
                descEl.textContent = 'Click Play Timeline to start';
            }
        }

        function updateTimeline() {
            if (!isTimelinePlaying) return;

            const elapsed = (Date.now() - timelineStartTime) / 1000;
            let totalTime = 0;
            let currentKeyframe = 0;

            // Find which keyframe we should be in
            for (let i = 0; i < keyframes.length; i++) {
                if (elapsed >= totalTime && elapsed < totalTime + keyframes[i].length) {
                    currentKeyframe = i;
                    break;
                }
                totalTime += keyframes[i].length;

                if (i === keyframes.length - 1 && elapsed >= totalTime) {
                    // Timeline finished
                    stopTimeline();
                    return;
                }
            }

            // Update progress bar
            const totalDuration = keyframes.reduce((sum, kf) => sum + kf.length, 0);
            const progress = (elapsed / totalDuration) * 100;
            document.getElementById('timeline-bar').style.width = Math.min(progress, 100) + '%';

            // Check if we need to transition to a new keyframe
            if (window.lastTimelineKeyframe !== currentKeyframe) {
                console.log(`🎬 Timeline: Switching to keyframe ${currentKeyframe} (${keyframes[currentKeyframe]?.title})`);
                window.lastTimelineKeyframe = currentKeyframe;
                currentKeyframeIndex = currentKeyframe; // Update global index

                // Load the current keyframe's base state
                loadKeyframeState(keyframes[currentKeyframe]);
                console.log(`📋 Loaded keyframe ${currentKeyframe} base state`);

                // Update display
                updateCurrentKeyframeDisplay();

                // Handle screen panel transitions
                if (isFullscreen) {
                    const currentScreenSettings = keyframes[currentKeyframe]?.screenPanel;
                    if (currentScreenSettings?.enabled) {
                        // Check if we'll start an animation (to avoid static flashing conflicts)
                        const hasNextKeyframe = currentKeyframe < keyframes.length - 1;
                        const nextScreenSettings = hasNextKeyframe ? keyframes[currentKeyframe + 1]?.screenPanel : null;
                        const willAnimateScreen = hasNextKeyframe && nextScreenSettings?.enabled;

                        if (willAnimateScreen) {
                            console.log(`⏸️ Skipping static screen flashing - animation will start soon`);
                            // Don't start static flashing if animation is coming
                        } else if (currentKeyframe > 0) {
                            // For non-first keyframes, just start static flashing
                            // Animation should have happened during the PREVIOUS keyframe, not when switching TO this one
                            console.log(`🎬 Switching to keyframe ${currentKeyframe}: Starting static flashing at ${currentScreenSettings.rate}Hz`);
                            stopScreenFlashing();
                            startScreenFlashing({
                                enabled: currentScreenSettings.enabled,
                                rate: currentScreenSettings.rate,
                                color: currentScreenSettings.color,
                                dutyCycle: currentScreenSettings.dutyCycle || 50,
                                mode: currentScreenSettings.mode || 'auto'
                            });
                        } else {
                            // First keyframe with screen - only start static if no animation coming
                            if (!willAnimateScreen) {
                                startScreenFlashing({
                                    enabled: currentScreenSettings.enabled,
                                    rate: currentScreenSettings.rate,
                                    color: currentScreenSettings.color,
                                    dutyCycle: currentScreenSettings.dutyCycle || 50,
                                    mode: currentScreenSettings.mode || 'auto'
                                });
                            }
                        }
                    } else {
                        exitFullscreen();
                    }
                }

                // Start animations towards NEXT keyframe if current keyframe has animate enabled
                if (currentKeyframe < keyframes.length - 1) {
                    const currentKF = keyframes[currentKeyframe];
                    const nextKF = keyframes[currentKeyframe + 1];

                    console.log(`🎯 Checking for animations in keyframe ${currentKeyframe}...`);

                    // Check for SCREEN PANEL animations
                    if (currentKF.screenPanel?.enabled && nextKF.screenPanel?.enabled && isFullscreen) {
                        console.log(`🎬 Starting screen animation: ${currentKF.screenPanel.rate}Hz → ${nextKF.screenPanel.rate}Hz over ${currentKF.length}s`);
                        animateScreenPanel(currentKF.screenPanel, nextKF.screenPanel, currentKF.length);
                    }

                    Object.keys(currentKF.panels).forEach(panelId => {
                        const currentPanel = currentKF.panels[panelId];
                        const nextPanel = nextKF.panels[panelId];

                        console.log(`${panelId}: current.animate=${currentPanel.animate}, next.animate=${nextPanel?.animate}, hasNext=${!!nextPanel}`);

                        // 🔍 INVESTIGATE: Check data types before passing to animation
                        console.log(`🔎 Data types before animation:`);
                        console.log(`  currentPanel.frequency: ${currentPanel.frequency} (${typeof currentPanel.frequency})`);
                        console.log(`  currentPanel.volume: ${currentPanel.volume} (${typeof currentPanel.volume})`);
                        console.log(`  currentPanel.pan: ${currentPanel.pan} (${typeof currentPanel.pan})`);
                        console.log(`  nextPanel.frequency: ${nextPanel?.frequency} (${typeof nextPanel?.frequency})`);
                        console.log(`  nextPanel.volume: ${nextPanel?.volume} (${typeof nextPanel?.volume})`);
                        console.log(`  nextPanel.pan: ${nextPanel?.pan} (${typeof nextPanel?.pan})`);

                        // CORRECTED LOGIC: Check if NEXT keyframe has animate enabled
                        if (nextPanel && nextPanel.animate) {
                            console.log(`🚀 Starting animation for ${panelId}: ${currentPanel.frequency}Hz→${nextPanel.frequency}Hz over ${currentKF.length}s`);
                            // Start animation towards next keyframe's values
                            startKeyframeAnimation(panelId, currentPanel, nextPanel, currentKF.length);
                        } else if (nextPanel) {
                            console.log(`⏸️  No animation for ${panelId} (next.animate=${nextPanel.animate})`);
                        }
                    });
                } else {
                    console.log(`📍 Final keyframe ${currentKeyframe}, no animations to start`);
                }
            }
        }

        function transitionToKeyframe(targetIndex) {
            if (targetIndex <= 0 || targetIndex >= keyframes.length) return;

            const fromKeyframe = keyframes[targetIndex - 1];
            const toKeyframe = keyframes[targetIndex];
            const transitionDuration = fromKeyframe.length;

            // Handle screen panel transitions smoothly
            if (isFullscreen) {
                if (toKeyframe.screenPanel?.enabled) {
                    // Animate screen panel transition if both have screen enabled
                    if (fromKeyframe.screenPanel?.enabled) {
                        animateScreenPanel(fromKeyframe.screenPanel, toKeyframe.screenPanel, transitionDuration);
                    } else {
                        // Start fresh if previous didn't have screen enabled
                        stopScreenFlashing();
                        startScreenFlashing({
                            enabled: toKeyframe.screenPanel.enabled,
                            rate: toKeyframe.screenPanel.rate,
                            color: toKeyframe.screenPanel.color,
                            dutyCycle: toKeyframe.screenPanel.dutyCycle || 50,
                            mode: toKeyframe.screenPanel.mode || 'auto'
                        });
                    }
                } else {
                    exitFullscreen();
                }
            }

            // Process each panel
            Object.keys(toKeyframe.panels).forEach(panelId => {
                if (!generators[panelId]) return;

                const fromPanel = fromKeyframe.panels[panelId];
                const toPanel = toKeyframe.panels[panelId];

                if (!fromPanel) {
                    // Panel didn't exist in previous keyframe, fade in if enabled
                    if (toPanel.fade) {
                        fadeInPanel(panelId, toPanel);
                    } else {
                        applyPanelSettings(panelId, toPanel);
                        if (!generators[panelId].isPlaying) {
                            togglePlay(panelId);
                        }
                    }
                    return;
                }

                if (toPanel.animate) {
                    // Animate all parameter changes
                    animateFrequencyChange(panelId, fromPanel.frequency, toPanel.frequency, transitionDuration);
                    animateVolumeChange(panelId, fromPanel.volume, toPanel.volume, transitionDuration);
                    animatePanChange(panelId, fromPanel.pan, toPanel.pan, transitionDuration);

                    // Update other non-animated settings immediately
                    generator.waveType = toPanel.waveType;
                    generator.isIsochronic = toPanel.isIsochronic;
                    generator.isochronicRate = toPanel.isochronicRate;
                    document.getElementById(`${panelId}-wave`).value = toPanel.waveType;
                } else {
                    // Check if frequency is different
                    if (Math.abs(fromPanel.frequency - toPanel.frequency) > 0.01) {
                        // Frequency changed, apply new settings
                        if (toPanel.fade) {
                            fadeOutAndIn(panelId, fromPanel, toPanel);
                        } else {
                            applyPanelSettings(panelId, toPanel);
                        }
                    } else {
                        // Same frequency, just update other settings without stopping
                        updatePanelSettingsWithoutFrequency(panelId, toPanel);
                    }
                }
            });

            // Handle panels that exist in fromKeyframe but not in toKeyframe (fade out)
            Object.keys(fromKeyframe.panels).forEach(panelId => {
                if (!toKeyframe.panels[panelId] && generators[panelId]?.isPlaying) {
                    fadeOutPanel(panelId);
                }
            });
        }

        // Clean animation system that doesn't corrupt keyframe data
        function animateFrequencyChange(panelId, fromFreq, toFreq, duration) {
            const generator = generators[panelId];
            if (!generator) return;

            // 🔧 FIX: Convert to numbers IMMEDIATELY
            fromFreq = parseFloat(fromFreq);
            toFreq = parseFloat(toFreq);
            duration = parseFloat(duration);

            // Validate after conversion
            if (!isFinite(fromFreq)) fromFreq = 440;
            if (!isFinite(toFreq)) toFreq = 440;
            if (!isFinite(duration) || duration <= 0) duration = 1;

            const startTime = Date.now();
            const freqDiff = toFreq - fromFreq;

            const animationId = `${panelId}-freq-animation`;
            if (animationIntervals[animationId]) {
                clearInterval(animationIntervals[animationId]);
            }

            // Store original keyframe value to restore later
            if (!window.originalKeyframeValues) window.originalKeyframeValues = {};
            if (!window.originalKeyframeValues[panelId]) {
                window.originalKeyframeValues[panelId] = {
                    frequency: generator.frequency,
                    volume: generator.volume,
                    pan: generator.pan
                };
            }

            console.log(`🎬 Animating ${panelId} frequency: ${fromFreq}Hz → ${toFreq}Hz over ${duration}s`);

            animationIntervals[animationId] = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                const progress = Math.min(elapsed / duration, 1);

                const currentFreq = fromFreq + (freqDiff * progress);

                // Update audio and UI without affecting keyframe data
                generator.updateFrequency(currentFreq);
                updateFrequencyDisplay(panelId, currentFreq);
                document.getElementById(`${panelId}-slider`).value = currentFreq;

                // Log only every 1 second to reduce spam
                if (Math.floor(elapsed) > Math.floor((elapsed - 0.05))) {
                    console.log(`🎵 ${panelId} @ ${elapsed.toFixed(1)}s: ${currentFreq.toFixed(1)}Hz (${(progress*100).toFixed(0)}%)`);
                }

                if (progress >= 1) {
                    clearInterval(animationIntervals[animationId]);
                    delete animationIntervals[animationId];
                    console.log(`✅ Animation complete: ${panelId} reached ${currentFreq.toFixed(1)}Hz`);
                }
            }, 50); // Update every 50ms for smooth animation
        }

        function animateVolumeChange(panelId, fromVol, toVol, duration) {
            const generator = generators[panelId];
            if (!generator) return;

            // 🔧 FIX: Convert to numbers IMMEDIATELY
            fromVol = parseFloat(fromVol);
            toVol = parseFloat(toVol);
            duration = parseFloat(duration);

            // Validate after conversion
            if (!isFinite(fromVol)) fromVol = 0.5;
            if (!isFinite(toVol)) toVol = 0.5;
            if (!isFinite(duration) || duration <= 0) duration = 1;

            const startTime = Date.now();
            const volDiff = toVol - fromVol;

            const animationId = `${panelId}-vol-animation`;
            if (animationIntervals[animationId]) {
                clearInterval(animationIntervals[animationId]);
            }

            // Store original value
            if (!window.originalKeyframeValues) window.originalKeyframeValues = {};
            if (!window.originalKeyframeValues[panelId]) {
                window.originalKeyframeValues[panelId] = {
                    frequency: generator.frequency,
                    volume: generator.volume,
                    pan: generator.pan
                };
            }

            console.log(`🔊 Animating ${panelId} volume: ${(fromVol*100).toFixed(0)}% → ${(toVol*100).toFixed(0)}% over ${duration}s`);

            animationIntervals[animationId] = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                const progress = Math.min(elapsed / duration, 1);

                const currentVol = fromVol + (volDiff * progress);

                // Quick validation without excessive logging
                if (!isFinite(currentVol)) {
                    console.error(`❌ Volume animation error: ${currentVol} from ${fromVol} + (${volDiff} * ${progress})`);
                    clearInterval(animationIntervals[animationId]);
                    delete animationIntervals[animationId];
                    return;
                }

                generator.updateVolume(currentVol);
                document.getElementById(`${panelId}-volume`).value = currentVol;
                document.getElementById(`${panelId}-volume-display`).textContent = Math.round(currentVol * 100) + '%';

                if (progress >= 1) {
                    clearInterval(animationIntervals[animationId]);
                    delete animationIntervals[animationId];
                    console.log(`✅ Volume animation complete: ${panelId} reached ${(currentVol*100).toFixed(0)}%`);
                }
            }, 50);
        }

        function animatePanChange(panelId, fromPan, toPan, duration) {
            const generator = generators[panelId];
            if (!generator) return;

            // 🔧 FIX: Convert to numbers IMMEDIATELY before any usage
            fromPan = parseFloat(fromPan);
            toPan = parseFloat(toPan);
            duration = parseFloat(duration);

            // Validate after conversion
            if (!isFinite(fromPan)) fromPan = 0;
            if (!isFinite(toPan)) toPan = 0;
            if (!isFinite(duration) || duration <= 0) duration = 1;

            const startTime = Date.now();
            const panDiff = toPan - fromPan;

            const animationId = `${panelId}-pan-animation`;
            if (animationIntervals[animationId]) {
                clearInterval(animationIntervals[animationId]);
            }

            console.log(`⬅️➡️ Animating ${panelId} pan: ${fromPan.toFixed(2)} → ${toPan.toFixed(2)} over ${duration}s`);

            animationIntervals[animationId] = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                const progress = Math.min(elapsed / duration, 1);

                const currentPan = fromPan + (panDiff * progress);
                generator.updatePan(currentPan);
                document.getElementById(`${panelId}-pan`).value = currentPan;

                // Update pan display text
                let panDisplayText;
                if (currentPan < -0.1) {
                    panDisplayText = `L${Math.abs(Math.round(currentPan * 100))}%`;
                } else if (currentPan > 0.1) {
                    panDisplayText = `R${Math.round(currentPan * 100)}%`;
                } else {
                    panDisplayText = 'Center';
                }
                document.getElementById(`${panelId}-pan-display`).textContent = panDisplayText;

                if (progress >= 1) {
                    clearInterval(animationIntervals[animationId]);
                    delete animationIntervals[animationId];
                    console.log(`✅ Pan animation complete: ${panelId} reached ${currentPan.toFixed(2)}`);
                }
            }, 50);
        }

        function startKeyframeAnimation(panelId, fromPanel, toPanel, duration) {
            const generator = generators[panelId];
            if (!generator) {
                console.log(`❌ No generator found for ${panelId}`);
                return;
            }

            console.log(`🔍 ROOT CAUSE INVESTIGATION - startKeyframeAnimation(${panelId}):`);
            console.log(`  fromPanel:`, fromPanel);
            console.log(`  toPanel:`, toPanel);
            console.log(`  generator state:`, {
                frequency: generator.frequency,
                volume: generator.volume,
                pan: generator.pan
            });

            // Check for invalid data BEFORE calling animations
            const issues = [];
            if (!isFinite(fromPanel.frequency) || fromPanel.frequency === null || fromPanel.frequency === undefined) {
                issues.push(`fromPanel.frequency = ${fromPanel.frequency} (${typeof fromPanel.frequency})`);
            }
            if (!isFinite(fromPanel.volume) || fromPanel.volume === null || fromPanel.volume === undefined) {
                issues.push(`fromPanel.volume = ${fromPanel.volume} (${typeof fromPanel.volume})`);
            }
            if (!isFinite(fromPanel.pan) || fromPanel.pan === null || fromPanel.pan === undefined) {
                issues.push(`fromPanel.pan = ${fromPanel.pan} (${typeof fromPanel.pan})`);
            }
            if (!isFinite(toPanel.frequency) || toPanel.frequency === null || toPanel.frequency === undefined) {
                issues.push(`toPanel.frequency = ${toPanel.frequency} (${typeof toPanel.frequency})`);
            }
            if (!isFinite(toPanel.volume) || toPanel.volume === null || toPanel.volume === undefined) {
                issues.push(`toPanel.volume = ${toPanel.volume} (${typeof toPanel.volume})`);
            }
            if (!isFinite(toPanel.pan) || toPanel.pan === null || toPanel.pan === undefined) {
                issues.push(`toPanel.pan = ${toPanel.pan} (${typeof toPanel.pan})`);
            }

            if (issues.length > 0) {
                console.error(`💥 INVALID DATA DETECTED - ROOT CAUSE ANALYSIS NEEDED:`);
                issues.forEach(issue => console.error(`   - ${issue}`));
                console.error(`📍 This data came from keyframes. Need to investigate keyframe creation/loading!`);

                // Show the actual keyframe objects
                console.error(`🔎 Current keyframe index: ${currentKeyframeIndex}`);
                console.error(`🔎 All keyframes:`, keyframes);

                return; // Don't start animations with bad data
            }

            console.log(`✅ Data validation passed - starting animations`);
            console.log(`  Freq: ${fromPanel.frequency} → ${toPanel.frequency}`);
            console.log(`  Vol:  ${fromPanel.volume} → ${toPanel.volume}`);
            console.log(`  Pan:  ${fromPanel.pan} → ${toPanel.pan}`);
            console.log(`  Duration: ${duration}s`);

            // Start animations for all parameters
            animateFrequencyChange(panelId, fromPanel.frequency, toPanel.frequency, duration);
            animateVolumeChange(panelId, fromPanel.volume, toPanel.volume, duration);
            animatePanChange(panelId, fromPanel.pan, toPanel.pan, duration);

            // Update other settings immediately
            generator.waveType = fromPanel.waveType; // Use current keyframe's wave type during animation
            generator.isIsochronic = fromPanel.isIsochronic;
            generator.isochronicRate = fromPanel.isochronicRate;
            document.getElementById(`${panelId}-wave`).value = fromPanel.waveType;
        }

        function applyPanelSettings(panelId, panelData) {
            const generator = generators[panelId];
            if (!generator) return;

            generator.frequency = panelData.frequency;
            generator.waveType = panelData.waveType;
            generator.volume = panelData.volume;
            generator.pan = panelData.pan;
            generator.isIsochronic = panelData.isIsochronic;
            generator.isochronicRate = panelData.isochronicRate;

            // Update audio if playing
            if (generator.isPlaying) {
                generator.stop();
                generator.start();
            }

            // Update UI
            updateFrequencyDisplay(panelId, panelData.frequency);
            document.getElementById(`${panelId}-slider`).value = panelData.frequency;
            document.getElementById(`${panelId}-wave`).value = panelData.waveType;
        }

        function updatePanelSettingsWithoutFrequency(panelId, panelData) {
            const generator = generators[panelId];
            if (!generator) return;

            // Update everything except frequency
            if (generator.waveType !== panelData.waveType) {
                generator.updateWaveType(panelData.waveType);
                document.getElementById(`${panelId}-wave`).value = panelData.waveType;
            }

            if (Math.abs(generator.volume - panelData.volume) > 0.01) {
                generator.updateVolume(panelData.volume);
            }

            if (Math.abs(generator.pan - panelData.pan) > 0.01) {
                generator.updatePan(panelData.pan);
            }

            if (generator.isIsochronic !== panelData.isIsochronic ||
                Math.abs(generator.isochronicRate - panelData.isochronicRate) > 0.01) {
                generator.isIsochronic = panelData.isIsochronic;
                generator.isochronicRate = panelData.isochronicRate;
                generator.stop();
                generator.start();
            }
        }

        function fadeInPanel(panelId, panelData) {
            const generator = generators[panelId];
            if (!generator) return;

            applyPanelSettings(panelId, panelData);
            generator.volume = 0; // Start at zero volume

            if (!generator.isPlaying) {
                togglePlay(panelId);
            }

            const targetVolume = panelData.volume;
            const fadeDuration = panelData.fadeDuration || 2;
            const steps = fadeDuration * 20; // 20 steps per second
            const volumeIncrement = targetVolume / steps;

            let step = 0;
            const fadeInterval = setInterval(() => {
                step++;
                const newVolume = Math.min(volumeIncrement * step, targetVolume);
                generator.updateVolume(newVolume);

                if (step >= steps) {
                    clearInterval(fadeInterval);
                }
            }, 50);
        }

        function fadeOutPanel(panelId) {
            const generator = generators[panelId];
            if (!generator || !generator.isPlaying) return;

            const startVolume = generator.volume;
            const fadeDuration = generator.fadeDuration || 2;
            const steps = fadeDuration * 20;
            const volumeDecrement = startVolume / steps;

            let step = 0;
            const fadeInterval = setInterval(() => {
                step++;
                const newVolume = Math.max(startVolume - (volumeDecrement * step), 0);
                generator.updateVolume(newVolume);

                if (step >= steps) {
                    togglePlay(panelId); // Stop playing
                    clearInterval(fadeInterval);
                }
            }, 50);
        }

        function fadeOutAndIn(panelId, fromPanel, toPanel) {
            const generator = generators[panelId];
            if (!generator) return;

            const fadeDuration = toPanel.fadeDuration || 2;

            // Fade out
            fadeOutPanel(panelId);

            // Fade in with new settings after fade out completes
            setTimeout(() => {
                fadeInPanel(panelId, toPanel);
            }, fadeDuration * 1000);
        }

        // Cleanup flashlight on page unload
        window.addEventListener('beforeunload', function() {
            if (flashlightState.hasPermission) {
                setFlashlightState(false);
                releaseFlashlight();
            }
        });

        // Initialize keyframe system after both files are loaded
        window.addEventListener('DOMContentLoaded', function() {
            // Initialize keyframe system
            initializeKeyframes();
        });
