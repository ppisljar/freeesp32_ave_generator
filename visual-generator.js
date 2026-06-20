/**
 * Visual Flicker Generator
 * Manages individual visual flicker channels (screen flash, flashlight, etc.)
 */

class VisualFlickerGenerator {
    constructor(panelId) {
        this.panelId = panelId;

        // Visual properties
        this.frequency = 10;        // Hz (0.01-100)
        this.dutyCycle = 50;        // Percentage (1-99)
        this.power = 100;          // Intensity/brightness (1-100)
        this.color = '#ffffff';     // RGB hex color
        this.mode = 'screen';       // 'screen', 'flashlight', 'auto'
        this.enabled = true;        // Panel on/off

        // Animation properties (similar to frequency panels)
        this.animate = false;
        this.fade = true;
        this.fadeDuration = 2;

        // Runtime state
        this.isActive = false;
        this.startTime = 0;
        this.lastTimestamp = 0;
        this.phase = 0;
        this.animationId = null;

        // Animation state for keyframe transitions
        this.isAnimating = false;
        this.animationStart = 0;
        this.animationDuration = 0;
        this.fromFrequency = this.frequency;
        this.toFrequency = this.frequency;
        this.fromDutyCycle = this.dutyCycle;
        this.toDutyCycle = this.dutyCycle;
        this.fromPower = this.power;
        this.toPower = this.power;
        this.fromColor = this.color;
        this.toColor = this.color;
        this.fromRGB = this.hexToRgb(this.color);
        this.toRGB = this.hexToRgb(this.color);

        // Flashlight state (per panel)
        this.flashlightState = {
            isSupported: false,
            hasPermission: false,
            stream: null,
            track: null,
            imageCapture: null,
            isOn: false,
            lastUpdateTime: 0
        };

        console.log(`🔷 Visual panel ${panelId} created with frequency: ${this.frequency}Hz`);
    }

    /**
     * Start visual flicking for this panel
     */
    async start() {
        if (!this.enabled) {
            console.log(`🔷 Visual panel ${this.panelId} is disabled, not starting`);
            return;
        }

        this.isActive = true;
        this.startTime = performance.now();
        this.lastTimestamp = performance.now();
        this.phase = 0;

        const effectiveMode = await this.determineEffectiveMode();
        console.log(`🔷 Starting visual panel ${this.panelId} (${effectiveMode}): ${this.frequency}Hz, duty: ${this.dutyCycle}%, power: ${this.power}%`);

        // Setup flashlight if needed
        if (effectiveMode === 'flashlight' && !this.flashlightState.hasPermission) {
            const success = await this.requestFlashlightAccess();
            if (!success) {
                console.warn(`⚠️ Flashlight failed for ${this.panelId}, falling back to screen`);
                this.mode = 'screen';
            }
        }

        // Start animation loop if not already running
        if (!this.animationId) {
            this.animationId = requestAnimationFrame(() => this.updateVisualLoop());
        }
    }

    /**
     * Stop visual flicking for this panel
     */
    stop() {
        this.isActive = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Turn off flashlight if it's on
        if (this.flashlightState.isOn) {
            this.setFlashlightState(false);
        }

        // Reset screen flash for this panel (remove any visual effects)
        this.resetScreenFlash();

        console.log(`🔷 Visual panel ${this.panelId} stopped`);
    }

    /**
     * Main visual update loop for this panel
     */
    updateVisualLoop() {
        if (!this.isActive) return;

        const now = performance.now();
        const deltaTime = now - this.lastTimestamp;
        this.lastTimestamp = now;

        // Update animation if active
        if (this.isAnimating) {
            this.updateAnimation(now);
        }

        // Calculate current phase based on frequency
        const cycleLength = 1000 / this.frequency; // ms per cycle
        const timeSinceStart = now - this.startTime;
        this.phase = (timeSinceStart % cycleLength) / cycleLength; // 0-1

        // Determine if we should be "on" or "off" based on duty cycle
        const dutyCycleNormalized = this.dutyCycle / 100; // 0-1
        const shouldBeOn = this.phase < dutyCycleNormalized;

        // Apply visual effect based on mode
        const effectiveMode = this.mode === 'auto' ? this.determineAutoMode() : this.mode;

        if (effectiveMode === 'flashlight') {
            this.updateFlashlight(shouldBeOn);
        } else {
            this.updateScreenFlash(shouldBeOn);
        }

        // Continue animation loop
        if (this.isActive) {
            this.animationId = requestAnimationFrame(() => this.updateVisualLoop());
        }
    }

    /**
     * Update screen flash for this panel
     */
    updateScreenFlash(shouldBeOn) {
        const panelElement = document.getElementById(this.panelId);
        if (!panelElement) return;

        if (shouldBeOn) {
            // Calculate intensity based on power setting
            const intensity = this.power / 100; // 0-1
            const color = this.adjustColorIntensity(this.color, intensity);

            // Apply visual effect (could be panel background, border, or screen overlay)
            panelElement.style.backgroundColor = color;
            panelElement.style.boxShadow = `0 0 20px ${color}`;

            // For screen flash mode, we could also create a full-screen overlay
            if (this.mode === 'screen') {
                this.createScreenOverlay(color, intensity);
            }
        } else {
            // Turn off visual effect
            panelElement.style.backgroundColor = '';
            panelElement.style.boxShadow = '';
            this.removeScreenOverlay();
        }
    }

    /**
     * Update flashlight for this panel
     */
    async updateFlashlight(shouldBeOn) {
        if (!this.flashlightState.hasPermission) return;

        // Throttle flashlight updates to prevent excessive API calls
        const now = performance.now();
        if (now - this.flashlightState.lastUpdateTime < 50) return; // Max 20Hz for flashlight
        this.flashlightState.lastUpdateTime = now;

        try {
            if (shouldBeOn && !this.flashlightState.isOn) {
                await this.setFlashlightState(true);
            } else if (!shouldBeOn && this.flashlightState.isOn) {
                await this.setFlashlightState(false);
            }
        } catch (error) {
            console.error(`🔷 Flashlight error for ${this.panelId}:`, error);
        }
    }

    /**
     * Create screen overlay effect
     */
    createScreenOverlay(color, intensity) {
        let overlay = document.getElementById(`screen-overlay-${this.panelId}`);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = `screen-overlay-${this.panelId}`;
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                pointer-events: none;
                z-index: 9999;
                mix-blend-mode: screen;
            `;
            document.body.appendChild(overlay);
        }

        overlay.style.backgroundColor = color;
        overlay.style.opacity = intensity * 0.3; // Limit max opacity for comfort
    }

    /**
     * Remove screen overlay effect
     */
    removeScreenOverlay() {
        const overlay = document.getElementById(`screen-overlay-${this.panelId}`);
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Reset screen flash effects
     */
    resetScreenFlash() {
        const panelElement = document.getElementById(this.panelId);
        if (panelElement) {
            panelElement.style.backgroundColor = '';
            panelElement.style.boxShadow = '';
        }
        this.removeScreenOverlay();
    }

    /**
     * Update parameter values
     */
    updateFrequency(frequency) {
        this.frequency = Math.max(0.01, Math.min(100, parseFloat(frequency)));
        console.log(`🔷 ${this.panelId} frequency updated to: ${this.frequency}Hz`);
    }

    updateDutyCycle(dutyCycle) {
        this.dutyCycle = Math.max(1, Math.min(99, parseFloat(dutyCycle)));
        console.log(`🔷 ${this.panelId} duty cycle updated to: ${this.dutyCycle}%`);
    }

    updatePower(power) {
        this.power = Math.max(1, Math.min(100, parseFloat(power)));
        console.log(`🔷 ${this.panelId} power updated to: ${this.power}%`);
    }

    updateColor(color) {
        this.color = color;
        console.log(`🔷 ${this.panelId} color updated to: ${this.color}`);
    }

    updateMode(mode) {
        this.mode = mode;
        console.log(`🔷 ${this.panelId} mode updated to: ${this.mode}`);
    }

    /**
     * Animation support for keyframe transitions
     */
    startAnimation(targetParams, duration) {
        this.isAnimating = true;
        this.animationStart = performance.now();
        this.animationDuration = duration * 1000; // Convert to ms

        // Set animation targets
        this.fromFrequency = this.frequency;
        this.toFrequency = targetParams.frequency || this.frequency;
        this.fromDutyCycle = this.dutyCycle;
        this.toDutyCycle = targetParams.dutyCycle || this.dutyCycle;
        this.fromPower = this.power;
        this.toPower = targetParams.power || this.power;
        this.fromColor = this.color;
        this.toColor = targetParams.color || this.color;
        this.fromRGB = this.hexToRgb(this.fromColor);
        this.toRGB = this.hexToRgb(this.toColor);

        console.log(`🔷 ${this.panelId} starting animation over ${duration}s`);
    }

    updateAnimation(now) {
        const elapsed = now - this.animationStart;
        const progress = Math.min(elapsed / this.animationDuration, 1);

        // Interpolate values
        this.frequency = this.lerp(this.fromFrequency, this.toFrequency, progress);
        this.dutyCycle = this.lerp(this.fromDutyCycle, this.toDutyCycle, progress);
        this.power = this.lerp(this.fromPower, this.toPower, progress);

        // Interpolate color
        const currentRGB = {
            r: Math.round(this.lerp(this.fromRGB.r, this.toRGB.r, progress)),
            g: Math.round(this.lerp(this.fromRGB.g, this.toRGB.g, progress)),
            b: Math.round(this.lerp(this.fromRGB.b, this.toRGB.b, progress))
        };
        this.color = this.rgbToHex(currentRGB.r, currentRGB.g, currentRGB.b);

        if (progress >= 1) {
            this.isAnimating = false;
            console.log(`🔷 ${this.panelId} animation completed`);
        }
    }

    /**
     * Utility functions
     */
    lerp(start, end, progress) {
        return start + (end - start) * progress;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    adjustColorIntensity(color, intensity) {
        const rgb = this.hexToRgb(color);
        return this.rgbToHex(
            Math.round(rgb.r * intensity),
            Math.round(rgb.g * intensity),
            Math.round(rgb.b * intensity)
        );
    }

    determineAutoMode() {
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        return (isMobile && this.flashlightState.isSupported) ? 'flashlight' : 'screen';
    }

    async determineEffectiveMode() {
        if (this.mode === 'auto') {
            return this.determineAutoMode();
        }
        return this.mode;
    }

    /**
     * Flashlight control methods
     */
    async requestFlashlightAccess() {
        try {
            if (!navigator.mediaDevices || !window.ImageCapture) {
                console.log(`🔷 Flashlight API not supported for ${this.panelId}`);
                return false;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            const track = stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(track);

            // Check if torch is supported
            const capabilities = track.getCapabilities();
            if (!capabilities.torch) {
                console.log(`🔷 Torch not supported for ${this.panelId}`);
                track.stop();
                return false;
            }

            this.flashlightState.stream = stream;
            this.flashlightState.track = track;
            this.flashlightState.imageCapture = imageCapture;
            this.flashlightState.isSupported = true;
            this.flashlightState.hasPermission = true;

            console.log(`🔷 Flashlight access granted for ${this.panelId}`);
            return true;

        } catch (error) {
            console.error(`🔷 Flashlight access failed for ${this.panelId}:`, error);
            return false;
        }
    }

    async setFlashlightState(isOn) {
        if (!this.flashlightState.hasPermission || !this.flashlightState.track) {
            return;
        }

        try {
            await this.flashlightState.track.applyConstraints({
                advanced: [{ torch: isOn }]
            });
            this.flashlightState.isOn = isOn;
        } catch (error) {
            console.error(`🔷 Failed to set flashlight state for ${this.panelId}:`, error);
        }
    }
}

// Make class globally available
if (typeof window !== 'undefined') {
    window.VisualFlickerGenerator = VisualFlickerGenerator;
}