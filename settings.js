// Settings and Configuration Management
// Handles UI panels, frequency generators, keyframe editing, and configuration management

let audioContext;
        let panelCounter = 0;
        let favorites = JSON.parse(localStorage.getItem('frequencies') || '[]');
        let currentFavoriteFreq = 440;

        // Initialize audio context on first user interaction
        function initAudioContext() {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
        }

        class FrequencyGenerator {
            constructor(containerId) {
                this.containerId = containerId;
                this.frequency = 440;
                this.waveType = 'sine';
                this.volume = 0.5;
                this.pan = 0; // -1 = left, 0 = center, 1 = right
                this.lockTarget = null; // ID of panel this is locked to
                this.frequencyOffset = 0; // offset from locked target
                this.isIsochronic = false; // whether isochronic tones are enabled
                this.isochronicRate = 10; // Hz - rate of on/off pulsing (0.1-100Hz)
                this.isDelayedTone = false; // whether delayed tone is enabled
                this.delayTime = 100; // delay in milliseconds (1-5000ms)

                // Advanced Binaural Beat Modulation (only active when locked)
                this.verticalModulation = false; // amplitude modulation at beat frequency
                this.horizontalModulation = false; // left-right oscillation at beat frequency
                this.modulationDepth = 0.5; // modulation intensity (0-1)

                // Harmonic MultiLayering
                this.harmonicLayering = 'none'; // 'none', 'octave', 'fifth', 'triad', 'harmonic', 'golden', 'fibonacci'
                this.harmonicLayers = 5; // number of harmonic frequencies (2-50)
                this.harmonicVolume = 0.3; // volume scaling for harmonic layers

                this.animate = false; // whether to animate frequency changes between keyframes
                this.fade = true; // whether to fade in/out
                this.fadeDuration = 2; // fade duration in seconds
                this.isPlaying = false;
                this.oscillator = null;
                this.gainNode = null;
                this.panNode = null;
                this.lfoOscillator = null; // Low Frequency Oscillator for isochronic pulsing
                this.lfoGainNode = null; // Controls LFO amplitude

                // Harmonic MultiLayering components
                this.harmonicOscillators = []; // Array of harmonic oscillators
                this.harmonicGainNodes = []; // Individual gain nodes for each harmonic
                this.harmonicMixerNode = null; // Mixer for all harmonic layers

                // Advanced Binaural Modulation components
                this.verticalLFO = null; // LFO for vertical modulation
                this.verticalGainNode = null; // Gain modulation for vertical effect
                this.horizontalLFO = null; // LFO for horizontal modulation
                this.leftGainNode = null; // Left channel gain for horizontal modulation
                this.rightGainNode = null; // Right channel gain for horizontal modulation

                // Delayed tone components
                this.delayNode = null; // Delay line for right channel
                this.leftChannelNode = null; // Left channel splitter
                this.rightChannelNode = null; // Right channel splitter
                this.channelSplitter = null; // ChannelSplitter for stereo separation
                this.channelMerger = null; // ChannelMerger to combine channels
            }

            get isLocked() {
                return this.lockTarget !== null;
            }

            start() {
                if (this.isPlaying) return;

                initAudioContext();

                this.gainNode = audioContext.createGain();

                // Set up harmonic layering or single oscillator
                if (this.harmonicLayering !== 'none') {
                    this.setupHarmonicLayers();
                } else {
                    // Single oscillator mode (traditional)
                    this.oscillator = audioContext.createOscillator();
                    this.oscillator.frequency.value = this.frequency;
                    this.oscillator.type = this.waveType;
                    this.oscillator.connect(this.gainNode);
                }

                if (this.isDelayedTone) {
                    // Delayed tone setup: Left = direct, Right = delayed
                    this.channelSplitter = audioContext.createChannelSplitter(2);
                    this.channelMerger = audioContext.createChannelMerger(2);
                    this.delayNode = audioContext.createDelay(5.0); // Max 5 second delay
                    this.leftChannelNode = audioContext.createGain();
                    this.rightChannelNode = audioContext.createGain();

                    // Set delay time
                    this.delayNode.delayTime.value = this.delayTime / 1000; // Convert ms to seconds

                    // Set up audio chain for delayed tone
                    this.oscillator.connect(this.gainNode);
                    this.gainNode.connect(this.channelSplitter);

                    // Left channel: direct signal
                    this.channelSplitter.connect(this.leftChannelNode, 0);
                    this.leftChannelNode.connect(this.channelMerger, 0, 0);

                    // Right channel: delayed signal
                    this.channelSplitter.connect(this.delayNode, 0);
                    this.delayNode.connect(this.rightChannelNode);
                    this.rightChannelNode.connect(this.channelMerger, 0, 1);

                    this.channelMerger.connect(audioContext.destination);
                } else {
                    // Normal panning setup
                    this.panNode = audioContext.createStereoPanner();
                    this.oscillator.connect(this.gainNode);
                    this.gainNode.connect(this.panNode);
                    this.panNode.connect(audioContext.destination);
                    this.panNode.pan.value = this.pan;
                }

                // Set up advanced binaural modulation if locked and enabled
                if (this.isLocked && (this.verticalModulation || this.horizontalModulation)) {
                    this.setupBinauralModulation();
                } else if (this.isIsochronic) {
                    // Set up isochronic pulsing with LFO
                    this.lfoOscillator = audioContext.createOscillator();
                    this.lfoGainNode = audioContext.createGain();

                    // Configure LFO for square wave pulsing
                    this.lfoOscillator.frequency.value = this.isochronicRate;
                    this.lfoOscillator.type = 'square';

                    // Set up LFO to modulate gain (0 to volume)
                    this.lfoGainNode.gain.value = this.volume / 2; // Amplitude of modulation
                    this.gainNode.gain.value = this.volume / 2; // DC offset to center around volume/2

                    // Connect LFO to gain modulation
                    this.lfoOscillator.connect(this.lfoGainNode);
                    this.lfoGainNode.connect(this.gainNode.gain);

                    this.lfoOscillator.start();
                } else {
                    // Normal continuous tone
                    this.gainNode.gain.value = this.volume;
                }

                // Start oscillator(s)
                if (this.harmonicLayering !== 'none') {
                    this.harmonicOscillators.forEach(osc => osc.start());
                } else {
                    this.oscillator.start();
                }
                this.isPlaying = true;
            }

            stop() {
                if (!this.isPlaying) return;

                // Stop harmonic oscillators or single oscillator
                if (this.harmonicOscillators.length > 0) {
                    this.harmonicOscillators.forEach(osc => {
                        try { osc.stop(); } catch (e) {} // Ignore if already stopped
                    });
                    this.harmonicOscillators = [];
                    this.harmonicGainNodes = [];
                    this.harmonicMixerNode = null;
                } else if (this.oscillator) {
                    this.oscillator.stop();
                }

                // Clean up isochronic LFO
                if (this.lfoOscillator) {
                    this.lfoOscillator.stop();
                    this.lfoOscillator = null;
                    this.lfoGainNode = null;
                }

                // Clean up binaural modulation components
                if (this.verticalLFO) {
                    this.verticalLFO.stop();
                    this.verticalLFO = null;
                    this.verticalGainNode = null;
                }
                if (this.horizontalLFO) {
                    this.horizontalLFO.stop();
                    this.horizontalLFO = null;
                    this.leftGainNode = null;
                    this.rightGainNode = null;
                }

                this.oscillator = null;
                this.gainNode = null;
                this.panNode = null;

                // Clean up delayed tone components
                this.delayNode = null;
                this.leftChannelNode = null;
                this.rightChannelNode = null;
                this.channelSplitter = null;
                this.channelMerger = null;

                this.isPlaying = false;
            }

            updateFrequency(freq) {
                // Validate frequency value to prevent Web Audio API errors
                if (!isFinite(freq) || freq < 20) {
                    console.warn(`⚠️ Invalid frequency value: ${freq}, using 440`);
                    freq = 440;
                }
                if (freq > 20000) {
                    console.warn(`⚠️ Frequency value too high: ${freq}, clamping to 20000`);
                    freq = 20000;
                }

                this.frequency = freq;

                if (this.isPlaying) {
                    if (this.harmonicOscillators.length > 0) {
                        // Update harmonic frequencies
                        const frequencies = this.calculateHarmonicFrequencies(
                            freq, this.harmonicLayering, this.harmonicLayers
                        );
                        this.harmonicOscillators.forEach((osc, index) => {
                            if (frequencies[index]) {
                                osc.frequency.value = frequencies[index];
                            }
                        });
                    } else if (this.oscillator) {
                        this.oscillator.frequency.value = freq;
                    }
                }
            }

            updateWaveType(type) {
                this.waveType = type;
                if (this.isPlaying) {
                    if (this.harmonicOscillators.length > 0) {
                        this.harmonicOscillators.forEach(osc => {
                            osc.type = type;
                        });
                    } else if (this.oscillator) {
                        this.oscillator.type = type;
                    }
                }
            }

            updateVolume(vol) {
                // Validate volume value to prevent Web Audio API errors
                if (!isFinite(vol) || vol < 0) {
                    console.warn(`⚠️ Invalid volume value: ${vol}, using 0`);
                    vol = 0;
                }
                if (vol > 1) {
                    console.warn(`⚠️ Volume value too high: ${vol}, clamping to 1`);
                    vol = 1;
                }

                this.volume = vol;
                if (this.isPlaying && this.gainNode) {
                    if (this.isIsochronic && this.lfoGainNode) {
                        // For isochronic tones, update both DC offset and modulation amplitude
                        this.gainNode.gain.value = vol / 2;
                        this.lfoGainNode.gain.value = vol / 2;
                    } else {
                        this.gainNode.gain.value = vol;
                    }
                }
            }

            updatePan(panValue) {
                // Delayed tone disables panning (uses specific left/right channels)
                if (this.isDelayedTone) {
                    console.log('⚠️ Panning disabled when delayed tone is active');
                    return;
                }

                // Validate pan value to prevent Web Audio API errors
                if (!isFinite(panValue)) {
                    console.warn(`⚠️ Invalid pan value: ${panValue}, using 0`);
                    panValue = 0;
                }
                if (panValue < -1) {
                    console.warn(`⚠️ Pan value too low: ${panValue}, clamping to -1`);
                    panValue = -1;
                }
                if (panValue > 1) {
                    console.warn(`⚠️ Pan value too high: ${panValue}, clamping to 1`);
                    panValue = 1;
                }

                this.pan = panValue;
                if (this.isPlaying && this.panNode) {
                    this.panNode.pan.value = panValue;
                }
            }

            updateIsochronic(enabled) {
                // Isochronic tones conflict with delayed tone
                if (enabled && this.isDelayedTone) {
                    console.log('⚠️ Cannot enable isochronic tones when delayed tone is active');
                    return;
                }

                this.isIsochronic = enabled;
                // If currently playing, stop and restart to apply changes
                if (this.isPlaying) {
                    this.stop();
                    this.start();
                }
            }

            updateIsochronicRate(rate) {
                this.isochronicRate = rate;
                if (this.isPlaying && this.lfoOscillator) {
                    this.lfoOscillator.frequency.value = rate;
                }
            }

            updateDelayedTone(enabled) {
                // Delayed tone conflicts with isochronic tones
                if (enabled && this.isIsochronic) {
                    console.log('⚠️ Cannot enable delayed tone when isochronic tones are active');
                    return;
                }

                this.isDelayedTone = enabled;

                // Reset pan to center when enabling delayed tone
                if (enabled) {
                    this.pan = 0;
                }

                // If currently playing, stop and restart to apply changes
                if (this.isPlaying) {
                    this.stop();
                    this.start();
                }
            }

            updateDelayTime(delayMs) {
                // Validate delay time
                if (!isFinite(delayMs)) {
                    console.warn(`⚠️ Invalid delay time: ${delayMs}, using 100ms`);
                    delayMs = 100;
                }
                if (delayMs < 1) {
                    console.warn(`⚠️ Delay time too low: ${delayMs}, clamping to 1ms`);
                    delayMs = 1;
                }
                if (delayMs > 5000) {
                    console.warn(`⚠️ Delay time too high: ${delayMs}, clamping to 5000ms`);
                    delayMs = 5000;
                }

                this.delayTime = delayMs;

                // Update delay time if currently playing with delayed tone
                if (this.isPlaying && this.delayNode) {
                    this.delayNode.delayTime.value = delayMs / 1000; // Convert ms to seconds
                }
            }

            calculateHarmonicFrequencies(fundamentalFreq, layering, layers) {
                const frequencies = [fundamentalFreq]; // Always include fundamental

                switch (layering) {
                    case 'octave': // Perfect octaves: f, 2f, 4f, 8f...
                        for (let i = 1; i < layers; i++) {
                            frequencies.push(fundamentalFreq * Math.pow(2, i));
                        }
                        break;

                    case 'fifth': // Perfect fifths: f, f*1.5, f*2.25, f*3.375...
                        for (let i = 1; i < layers; i++) {
                            frequencies.push(fundamentalFreq * Math.pow(1.5, i));
                        }
                        break;

                    case 'triad': // Major triad cycle: 1, 1.25, 1.5, 2, 2.5, 3...
                        const triadRatios = [1, 1.25, 1.5]; // Root, Major Third, Perfect Fifth
                        for (let i = 1; i < layers; i++) {
                            const octave = Math.floor((i - 1) / 3);
                            const triadIndex = (i - 1) % 3;
                            frequencies.push(fundamentalFreq * triadRatios[triadIndex] * Math.pow(2, octave));
                        }
                        break;

                    case 'harmonic': // Natural harmonic series: f, 2f, 3f, 4f, 5f...
                        for (let i = 2; i <= layers; i++) {
                            frequencies.push(fundamentalFreq * i);
                        }
                        break;

                    case 'golden': // Golden ratio: f, f*φ, f*φ², f*φ³...
                        const phi = 1.6180339887; // Golden ratio
                        for (let i = 1; i < layers; i++) {
                            frequencies.push(fundamentalFreq * Math.pow(phi, i));
                        }
                        break;

                    case 'fibonacci': // Fibonacci ratios: 1, 2, 3, 5, 8, 13, 21...
                        const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
                        for (let i = 1; i < layers && i < fib.length; i++) {
                            frequencies.push(fundamentalFreq * fib[i]);
                        }
                        break;

                    default: // 'none' - only fundamental
                        break;
                }

                // Filter out frequencies above 20kHz (human hearing limit)
                return frequencies.filter(freq => freq <= 20000);
            }

            setupHarmonicLayers() {
                if (this.harmonicLayering === 'none') {
                    return; // Single oscillator mode
                }

                console.log(`🎵 Setting up ${this.harmonicLayering} harmonic layering with ${this.harmonicLayers} layers`);

                const frequencies = this.calculateHarmonicFrequencies(
                    this.frequency,
                    this.harmonicLayering,
                    this.harmonicLayers
                );

                console.log(`🎼 Harmonic frequencies:`, frequencies.map(f => f.toFixed(1) + 'Hz'));

                // Create mixer for harmonic layers
                this.harmonicMixerNode = audioContext.createGain();

                // Create oscillators for each harmonic frequency
                frequencies.forEach((freq, index) => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();

                    oscillator.frequency.value = freq;
                    oscillator.type = this.waveType;

                    // Volume scaling: fundamental at full volume, harmonics at reduced volume
                    const volume = index === 0 ? this.volume : this.volume * this.harmonicVolume;
                    gainNode.gain.value = volume / frequencies.length; // Normalize total volume

                    // Connect harmonic layer
                    oscillator.connect(gainNode);
                    gainNode.connect(this.harmonicMixerNode);

                    this.harmonicOscillators.push(oscillator);
                    this.harmonicGainNodes.push(gainNode);
                });

                // Connect mixer to main gain node (replace direct oscillator connection)
                this.harmonicMixerNode.connect(this.gainNode);
            }

            setupBinauralModulation() {
                // Calculate beat frequency from locked target
                const targetGenerator = generators[this.lockTarget];
                if (!targetGenerator) return;

                const beatFrequency = Math.abs(this.frequency - targetGenerator.frequency);
                console.log(`🧠 Setting up binaural modulation: Beat frequency ${beatFrequency}Hz`);

                if (this.verticalModulation) {
                    // Vertical modulation: amplitude modulation at beat frequency
                    this.verticalLFO = audioContext.createOscillator();
                    this.verticalGainNode = audioContext.createGain();

                    this.verticalLFO.frequency.value = beatFrequency;
                    this.verticalLFO.type = 'sine'; // Smooth modulation

                    // Set up gain modulation with configurable depth
                    const modulationAmount = this.volume * this.modulationDepth * 0.5;
                    this.verticalGainNode.gain.value = modulationAmount;
                    this.gainNode.gain.value = this.volume - modulationAmount; // DC offset

                    // Connect vertical modulation
                    this.verticalLFO.connect(this.verticalGainNode);
                    this.verticalGainNode.connect(this.gainNode.gain);
                    this.verticalLFO.start();

                    console.log(`📊 Vertical modulation enabled at ${beatFrequency}Hz`);
                }

                if (this.horizontalModulation) {
                    // Horizontal modulation: left-right oscillation
                    this.horizontalLFO = audioContext.createOscillator();

                    // Create separate gain nodes for left/right channels
                    this.leftGainNode = audioContext.createGain();
                    this.rightGainNode = audioContext.createGain();

                    this.horizontalLFO.frequency.value = beatFrequency;
                    this.horizontalLFO.type = 'sine';

                    // Set up stereo separation
                    this.channelSplitter = audioContext.createChannelSplitter(2);
                    this.channelMerger = audioContext.createChannelMerger(2);

                    // Reconnect audio chain for horizontal modulation
                    this.gainNode.disconnect();
                    this.gainNode.connect(this.channelSplitter);

                    // Left channel (inverted LFO)
                    const leftInverter = audioContext.createGain();
                    leftInverter.gain.value = -this.modulationDepth;
                    this.horizontalLFO.connect(leftInverter);
                    leftInverter.connect(this.leftGainNode.gain);
                    this.leftGainNode.gain.value = 0.5 + (this.modulationDepth * 0.5);

                    // Right channel (normal LFO)
                    const rightModGain = audioContext.createGain();
                    rightModGain.gain.value = this.modulationDepth;
                    this.horizontalLFO.connect(rightModGain);
                    rightModGain.connect(this.rightGainNode.gain);
                    this.rightGainNode.gain.value = 0.5 + (this.modulationDepth * 0.5);

                    // Connect channels
                    this.channelSplitter.connect(this.leftGainNode, 0);
                    this.channelSplitter.connect(this.rightGainNode, 1);
                    this.leftGainNode.connect(this.channelMerger, 0, 0);
                    this.rightGainNode.connect(this.channelMerger, 0, 1);

                    // Connect to final output (skip panNode for horizontal modulation)
                    this.channelMerger.connect(audioContext.destination);

                    this.horizontalLFO.start();

                    console.log(`◀️▶️ Horizontal modulation enabled at ${beatFrequency}Hz`);
                } else if (!this.verticalModulation) {
                    // Normal gain setting if no modulation
                    this.gainNode.gain.value = this.volume;
                }
            }
        }

        class NoiseGenerator {
            constructor(containerId) {
                this.containerId = containerId;
                this.noiseType = 'white'; // 'white', 'pink', 'brown'
                this.volume = 0.3;
                this.pan = 0; // -1 = left, 0 = center, 1 = right
                this.pulsatingFrequency = 0; // Hz - 0 means no pulsing

                // Advanced modulation (similar to binaural beats)
                this.verticalModulation = false; // amplitude modulation at pulsating frequency
                this.horizontalModulation = false; // left-right oscillation at pulsating frequency
                this.modulationDepth = 0.5; // modulation intensity (0-1)

                this.animate = false; // whether to animate changes between keyframes
                this.fade = true; // whether to fade in/out
                this.fadeDuration = 2; // fade duration in seconds
                this.isPlaying = false;

                // Audio nodes
                this.noiseBuffer = null;
                this.audioBufferSource = null;
                this.gainNode = null;
                this.panNode = null;
                this.lfoOscillator = null; // Low Frequency Oscillator for pulsing
                this.lfoGainNode = null; // Controls LFO amplitude

                // Advanced Modulation components
                this.verticalLFO = null; // LFO for vertical modulation
                this.verticalGainNode = null; // Gain modulation for vertical effect
                this.horizontalLFO = null; // LFO for horizontal modulation
                this.leftGainNode = null; // Left channel gain for horizontal modulation
                this.rightGainNode = null; // Right channel gain for horizontal modulation
                this.channelSplitter = null;
                this.channelMerger = null;

                // Generate noise buffer on creation
                this.generateNoiseBuffer();
            }

            generateNoiseBuffer() {
                const bufferSize = audioContext.sampleRate * 2; // 2 seconds of noise
                this.noiseBuffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate);

                for (let channel = 0; channel < this.noiseBuffer.numberOfChannels; channel++) {
                    const channelData = this.noiseBuffer.getChannelData(channel);

                    switch (this.noiseType) {
                        case 'white':
                            this.generateWhiteNoise(channelData);
                            break;
                        case 'pink':
                            this.generatePinkNoise(channelData);
                            break;
                        case 'brown':
                            this.generateBrownNoise(channelData);
                            break;
                    }
                }
            }

            generateWhiteNoise(channelData) {
                for (let i = 0; i < channelData.length; i++) {
                    channelData[i] = Math.random() * 2 - 1; // Random values between -1 and 1
                }
            }

            generatePinkNoise(channelData) {
                let b0, b1, b2, b3, b4, b5, b6;
                b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;

                for (let i = 0; i < channelData.length; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    b3 = 0.86650 * b3 + white * 0.3104856;
                    b4 = 0.55000 * b4 + white * 0.5329522;
                    b5 = -0.7616 * b5 - white * 0.0168980;
                    channelData[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                    channelData[i] *= 0.11; // Reduce amplitude
                    b6 = white * 0.115926;
                }
            }

            generateBrownNoise(channelData) {
                let lastOut = 0.0;
                for (let i = 0; i < channelData.length; i++) {
                    const white = Math.random() * 2 - 1;
                    channelData[i] = (lastOut + (0.02 * white)) / 1.02;
                    lastOut = channelData[i];
                    channelData[i] *= 3.5; // Brown noise is quieter, so amplify
                    if (channelData[i] > 1) channelData[i] = 1;
                    if (channelData[i] < -1) channelData[i] = -1;
                }
            }

            start() {
                if (this.isPlaying) return;

                initAudioContext();

                // Create audio buffer source
                this.audioBufferSource = audioContext.createBufferSource();
                this.audioBufferSource.buffer = this.noiseBuffer;
                this.audioBufferSource.loop = true;

                this.gainNode = audioContext.createGain();
                this.audioBufferSource.connect(this.gainNode);

                // Set up pulsating or modulation effects
                if (this.pulsatingFrequency > 0 && (this.verticalModulation || this.horizontalModulation)) {
                    this.setupAdvancedModulation();
                } else if (this.pulsatingFrequency > 0) {
                    // Simple pulsating effect
                    this.lfoOscillator = audioContext.createOscillator();
                    this.lfoGainNode = audioContext.createGain();

                    this.lfoOscillator.frequency.value = this.pulsatingFrequency;
                    this.lfoOscillator.type = 'square';

                    // Set up LFO to modulate gain (0 to volume)
                    this.lfoGainNode.gain.value = this.volume / 2;
                    this.gainNode.gain.value = this.volume / 2;

                    this.lfoOscillator.connect(this.lfoGainNode);
                    this.lfoGainNode.connect(this.gainNode.gain);

                    this.lfoOscillator.start();
                } else {
                    // Normal continuous noise
                    this.gainNode.gain.value = this.volume;
                }

                // Set up panning
                this.panNode = audioContext.createStereoPanner();
                this.gainNode.connect(this.panNode);
                this.panNode.connect(audioContext.destination);
                this.panNode.pan.value = this.pan;

                this.audioBufferSource.start();
                this.isPlaying = true;
            }

            stop() {
                if (!this.isPlaying) return;

                if (this.audioBufferSource) {
                    this.audioBufferSource.stop();
                    this.audioBufferSource = null;
                }

                if (this.lfoOscillator) {
                    this.lfoOscillator.stop();
                    this.lfoOscillator = null;
                    this.lfoGainNode = null;
                }

                // Clean up modulation components
                if (this.verticalLFO) {
                    this.verticalLFO.stop();
                    this.verticalLFO = null;
                    this.verticalGainNode = null;
                }
                if (this.horizontalLFO) {
                    this.horizontalLFO.stop();
                    this.horizontalLFO = null;
                    this.leftGainNode = null;
                    this.rightGainNode = null;
                    this.channelSplitter = null;
                    this.channelMerger = null;
                }

                this.gainNode = null;
                this.panNode = null;
                this.isPlaying = false;
            }

            updateNoiseType(type) {
                this.noiseType = type;
                this.generateNoiseBuffer(); // Regenerate buffer with new noise type

                // Restart if currently playing
                if (this.isPlaying) {
                    this.stop();
                    this.start();
                }
            }

            updateVolume(vol) {
                if (!isFinite(vol) || vol < 0) vol = 0;
                if (vol > 1) vol = 1;

                this.volume = vol;
                if (this.isPlaying && this.gainNode) {
                    if (this.pulsatingFrequency > 0 && this.lfoGainNode && !this.verticalModulation) {
                        // For pulsating noise, update both DC offset and modulation amplitude
                        this.gainNode.gain.value = vol / 2;
                        this.lfoGainNode.gain.value = vol / 2;
                    } else if (!this.verticalModulation) {
                        this.gainNode.gain.value = vol;
                    }
                }
            }

            updatePan(panValue) {
                if (!isFinite(panValue)) panValue = 0;
                if (panValue < -1) panValue = -1;
                if (panValue > 1) panValue = 1;

                this.pan = panValue;
                if (this.isPlaying && this.panNode) {
                    this.panNode.pan.value = panValue;
                }
            }

            updatePulsatingFrequency(freq) {
                this.pulsatingFrequency = Math.max(0, freq);

                // Restart if currently playing to apply changes
                if (this.isPlaying) {
                    this.stop();
                    this.start();
                }
            }

            updateModulation(type, enabled) {
                if (type === 'vertical') {
                    this.verticalModulation = enabled;
                } else if (type === 'horizontal') {
                    this.horizontalModulation = enabled;
                }

                // Restart if currently playing to apply changes
                if (this.isPlaying) {
                    this.stop();
                    this.start();
                }
            }

            updateModulationDepth(depth) {
                this.modulationDepth = Math.max(0.1, Math.min(1, depth));

                // Update LFO gains if currently playing
                if (this.isPlaying) {
                    if (this.verticalLFO && this.verticalGainNode) {
                        const modulationAmount = this.volume * this.modulationDepth * 0.5;
                        this.verticalGainNode.gain.value = modulationAmount;
                        this.gainNode.gain.value = this.volume - modulationAmount;
                    }
                    if (this.horizontalLFO && this.leftGainNode && this.rightGainNode) {
                        this.leftGainNode.gain.value = 0.5 + (this.modulationDepth * 0.5);
                        this.rightGainNode.gain.value = 0.5 + (this.modulationDepth * 0.5);
                    }
                }
            }

            setupAdvancedModulation() {
                if (this.pulsatingFrequency <= 0) return;

                console.log(`🔊 Setting up noise modulation at ${this.pulsatingFrequency}Hz`);

                if (this.verticalModulation) {
                    // Vertical modulation: amplitude modulation
                    this.verticalLFO = audioContext.createOscillator();
                    this.verticalGainNode = audioContext.createGain();

                    this.verticalLFO.frequency.value = this.pulsatingFrequency;
                    this.verticalLFO.type = 'sine';

                    const modulationAmount = this.volume * this.modulationDepth * 0.5;
                    this.verticalGainNode.gain.value = modulationAmount;
                    this.gainNode.gain.value = this.volume - modulationAmount;

                    this.verticalLFO.connect(this.verticalGainNode);
                    this.verticalGainNode.connect(this.gainNode.gain);
                    this.verticalLFO.start();

                    console.log(`📊 Vertical noise modulation enabled at ${this.pulsatingFrequency}Hz`);
                }

                if (this.horizontalModulation) {
                    // Horizontal modulation: left-right oscillation
                    this.horizontalLFO = audioContext.createOscillator();
                    this.leftGainNode = audioContext.createGain();
                    this.rightGainNode = audioContext.createGain();

                    this.horizontalLFO.frequency.value = this.pulsatingFrequency;
                    this.horizontalLFO.type = 'sine';

                    // Set up stereo separation
                    this.channelSplitter = audioContext.createChannelSplitter(2);
                    this.channelMerger = audioContext.createChannelMerger(2);

                    // Reconnect audio chain for horizontal modulation
                    this.gainNode.disconnect();
                    this.gainNode.connect(this.channelSplitter);

                    // Left channel (inverted LFO)
                    const leftInverter = audioContext.createGain();
                    leftInverter.gain.value = -this.modulationDepth;
                    this.horizontalLFO.connect(leftInverter);
                    leftInverter.connect(this.leftGainNode.gain);
                    this.leftGainNode.gain.value = 0.5 + (this.modulationDepth * 0.5);

                    // Right channel (normal LFO)
                    const rightModGain = audioContext.createGain();
                    rightModGain.gain.value = this.modulationDepth;
                    this.horizontalLFO.connect(rightModGain);
                    rightModGain.connect(this.rightGainNode.gain);
                    this.rightGainNode.gain.value = 0.5 + (this.modulationDepth * 0.5);

                    // Connect channels
                    this.channelSplitter.connect(this.leftGainNode, 0);
                    this.channelSplitter.connect(this.rightGainNode, 1);
                    this.leftGainNode.connect(this.channelMerger, 0, 0);
                    this.rightGainNode.connect(this.channelMerger, 0, 1);

                    // Connect to final output (skip panNode for horizontal modulation)
                    this.channelMerger.connect(audioContext.destination);

                    this.horizontalLFO.start();

                    console.log(`◀️▶️ Horizontal noise modulation enabled at ${this.pulsatingFrequency}Hz`);
                } else if (!this.verticalModulation) {
                    // Normal gain setting if no modulation
                    this.gainNode.gain.value = this.volume;
                }
            }
        }

        let generators = {};
        let noiseGenerators = {};
        let activePanelId = null;
        let savedConfigurations = JSON.parse(localStorage.getItem('frequencyConfigurations') || '[]');

        // Pre-built meditation configurations
        const prebuiltConfigurations = [
            {
                name: "🎼 Complex Multi-Frequency: Sacred + Ultra-High Progression",
                description: "432/9999/965/3320Hz + binaural pairs + ultra-high 12-15kHz progression through 10→2Hz",
                isPredefined: true,
                keyframes: [
                    {
                        title: "Frame0 - Initialization (10Hz)",
                        description: "Base frequencies with 10Hz binaural pattern",
                        length: 60,
                        guideText: "Initial frequency matrix activation. Four sacred frequencies create 10Hz binaural foundation.",
                        screenPanel: { enabled: true, color: "#FFD700", rate: 10 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 442, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 10 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10009, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 10 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 975, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 10 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3330, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 10 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 10, animate: false, fade: true, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame1 - Copy + Ultra-High Prep (10Hz)",
                        description: "Same as Frame0 + introduce 12kHz at 0% volume",
                        length: 30,
                        guideText: "Frequency matrix stabilizes. Ultra-high frequency preparation begins silently.",
                        screenPanel: { enabled: true, color: "#FFD700", rate: 10 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 442, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 10 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10009, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 10 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 975, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 10 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3330, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 10 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 10, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 12000, waveType: "triangle", volume: 0, pan: 0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame2 - Alpha-Theta Bridge (8Hz + Animate)",
                        description: "8Hz binaural shift + 13kHz at 50% + animate enabled",
                        length: 120,
                        guideText: "Consciousness shifts to 8Hz alpha-theta border. Ultra-high frequency emerges. Animation begins.",
                        screenPanel: { enabled: true, color: "#32CD32", rate: 8 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 440, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 8 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10007, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 8 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 973, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 8 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3328, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 8 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 8, animate: true, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 13000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame3 - Stabilization (8Hz)",
                        description: "Same as Frame2 but animate disabled",
                        length: 30,
                        guideText: "Frequencies stabilize in 8Hz alpha-theta state. System holds steady.",
                        screenPanel: { enabled: true, color: "#32CD32", rate: 8 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 440, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 8 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10007, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 8 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 973, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 8 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3328, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 8 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 8, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 13000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame4 - Theta Entry (6Hz + Animate)",
                        description: "6Hz theta + 14kHz + animate enabled",
                        length: 120,
                        guideText: "Deep theta 6Hz activation. Ultra-high reaches 14kHz. Animated transitions guide consciousness deeper.",
                        screenPanel: { enabled: true, color: "#9932CC", rate: 6 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 438, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 6 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10005, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 6 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 971, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 6 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3326, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 6 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 6, animate: true, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 14000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame5 - Theta Stabilization (6Hz)",
                        description: "Same as Frame4 but animate disabled",
                        length: 60,
                        guideText: "Deep theta consciousness stabilizes at 6Hz. All frequencies hold steady in meditation space.",
                        screenPanel: { enabled: true, color: "#9932CC", rate: 6 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 438, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 6 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10005, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 6 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 971, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 6 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3326, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 6 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 6, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 14000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame6 - Deep Theta (4Hz + Animate)",
                        description: "4Hz profound theta + 15kHz + animate enabled",
                        length: 120,
                        guideText: "Consciousness descends to 4Hz profound theta. Ultra-high peaks at 15kHz. Deep meditation unfolds.",
                        screenPanel: { enabled: true, color: "#4B0082", rate: 4 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 436, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 4 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10003, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 4 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 969, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 4 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3324, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 4 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 4, animate: true, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 15000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame7 - Deep Theta Hold (4Hz)",
                        description: "Same as Frame6 but animate disabled",
                        length: 60,
                        guideText: "Rest in profound 4Hz theta consciousness. Complete frequency matrix stabilized in deep meditation.",
                        screenPanel: { enabled: true, color: "#4B0082", rate: 4 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 436, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 4 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10003, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 4 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 969, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 4 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3324, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 4 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 4, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 15000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame8 - Delta Entry (3Hz + Animate)",
                        description: "3Hz delta + animate enabled",
                        length: 120,
                        guideText: "Consciousness enters 3Hz delta realm. Animated transitions guide into deepest meditation states.",
                        screenPanel: { enabled: true, color: "#2F1B69", rate: 3 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 435, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 3 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10002, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 3 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 968, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 3 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3323, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 3 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 3, animate: true, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 15000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame9 - Delta Stabilization (3Hz)",
                        description: "Same as Frame8 but animate disabled",
                        length: 60,
                        guideText: "Deep delta 3Hz consciousness stabilizes. System holds in profound meditation space.",
                        screenPanel: { enabled: true, color: "#2F1B69", rate: 3 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 435, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 3 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10002, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 3 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 968, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 3 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3323, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 3 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 3, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 15000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame10 - Deep Delta (2Hz + Animate)",
                        description: "2Hz profound delta + animate enabled",
                        length: 120,
                        guideText: "Consciousness reaches 2Hz profound delta depths. Animated transitions guide to deepest possible states.",
                        screenPanel: { enabled: true, color: "#1A0033", rate: 2 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 434, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10001, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 2 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 967, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 2 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3322, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 2 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 2, animate: true, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 15000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Frame11 - Deep Delta Hold (2Hz)",
                        description: "Same as Frame10 but animate disabled",
                        length: 60,
                        guideText: "Rest in ultimate 2Hz delta consciousness. Complete frequency matrix stabilized in deepest possible meditation.",
                        screenPanel: { enabled: true, color: "#1A0033", rate: 2 },
                        panels: {
                            "panel-1": { frequency: 432, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 434, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2 },
                            "panel-3": { frequency: 9999, waveType: "sine", volume: 0.2, pan: -0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 9567 },
                            "panel-4": { frequency: 10001, waveType: "sine", volume: 0.2, pan: 0.7, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-3", frequencyOffset: 2 },
                            "panel-5": { frequency: 965, waveType: "sine", volume: 0.3, pan: -0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 533 },
                            "panel-6": { frequency: 967, waveType: "sine", volume: 0.3, pan: 0.4, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-5", frequencyOffset: 2 },
                            "panel-7": { frequency: 3320, waveType: "sine", volume: 0.25, pan: -0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-1", frequencyOffset: 2888 },
                            "panel-8": { frequency: 3322, waveType: "sine", volume: 0.25, pan: 0.1, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: "panel-7", frequencyOffset: 2 },
                            "panel-9": { frequency: 100, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 2, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-10": { frequency: 15000, waveType: "triangle", volume: 0.5, pan: 0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 2, lockTarget: null, frequencyOffset: 0 }
                        }
                    }
                ]
            },
            {
                name: "🔥 Gamma Focus: 40Hz Binaural Concentration",
                description: "40Hz gamma binaural for peak focus + harmonic resonance",
                isPredefined: true,
                keyframes: [
                    {
                        title: "Key0 - Neural Activation",
                        description: "Igniting 40Hz gamma consciousness",
                        length: 120,
                        guideText: "Feel your neurons synchronizing at 40Hz. Peak focus is emerging.",
                        screenPanel: { enabled: true, color: "#FF4500", rate: 40 },
                        panels: {
                            "panel-1": { frequency: 440, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 480, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 220, waveType: "triangle", volume: 0.2, pan: 0, isIsochronic: true, isochronicRate: 40, animate: false, fade: true, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Key1 - Peak Gamma Flow",
                        description: "Full 40Hz gamma immersion",
                        length: 600,
                        guideText: "Your mind is operating at peak efficiency. Consciousness is crystal clear.",
                        screenPanel: { enabled: true, color: "#FF6600", rate: 40 },
                        panels: {
                            "panel-1": { frequency: 440, waveType: "sine", volume: 0.5, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 480, waveType: "sine", volume: 0.5, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 880, waveType: "sine", volume: 0.2, pan: -0.5, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 5, lockTarget: "panel-1", frequencyOffset: 440 },
                            "panel-4": { frequency: 960, waveType: "sine", volume: 0.2, pan: 0.5, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 5, lockTarget: "panel-2", frequencyOffset: 480 },
                            "panel-5": { frequency: 110, waveType: "square", volume: 0.15, pan: 0, isIsochronic: true, isochronicRate: 40, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Key2 - Transcendent Clarity",
                        description: "Beyond gamma - pure awareness",
                        length: 300,
                        guideText: "Transcend even gamma waves. You are pure awareness itself.",
                        screenPanel: { enabled: true, color: "#FFFFFF", rate: 20 },
                        panels: {
                            "panel-1": { frequency: 528, waveType: "sine", volume: 0.6, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 548, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 3, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 1056, waveType: "sine", volume: 0.15, pan: -0.3, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 5, lockTarget: "panel-1", frequencyOffset: 528 },
                            "panel-4": { frequency: 1096, waveType: "sine", volume: 0.15, pan: 0.3, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 5, lockTarget: "panel-2", frequencyOffset: 548 },
                            "panel-5": { frequency: 264, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 20, animate: true, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 }
                        }
                    }
                ]
            },
            {
                name: "💚 528Hz Love DNA + 6Hz Theta Healing",
                description: "528Hz miracle tone with 6Hz theta binaural for cellular repair",
                isPredefined: true,
                keyframes: [
                    {
                        title: "Key0 - Heart Opening (6Hz)",
                        description: "Theta brainwaves + love frequency",
                        length: 180,
                        guideText: "Open your heart. Feel 528Hz love frequency resonating in every cell.",
                        screenPanel: { enabled: true, color: "#00FF7F", rate: 6 },
                        panels: {
                            "panel-1": { frequency: 528, waveType: "sine", volume: 0.5, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 534, waveType: "sine", volume: 0.5, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Key1 - DNA Harmonics",
                        description: "Adding harmonic overtones with volume animation",
                        length: 420,
                        guideText: "Feel the harmonic cascade. Your DNA responds to love's frequency.",
                        screenPanel: { enabled: true, color: "#FF69B4", rate: 6 },
                        panels: {
                            "panel-1": { frequency: 528, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 534, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 1056, waveType: "sine", volume: 0.1, pan: -0.5, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 8, lockTarget: "panel-1", frequencyOffset: 528 },
                            "panel-4": { frequency: 1068, waveType: "sine", volume: 0.3, pan: 0.5, isIsochronic: false, isochronicRate: 10, animate: true, fade: true, fadeDuration: 8, lockTarget: "panel-2", frequencyOffset: 534 }
                        }
                    },
                    {
                        title: "Key2 - Deep Cellular Love",
                        description: "Full harmonic saturation with volume crescendo",
                        length: 600,
                        guideText: "Every cell vibrates with love. You are being healed at the deepest level.",
                        screenPanel: { enabled: true, color: "#FFB6C1", rate: 6 },
                        panels: {
                            "panel-1": { frequency: 528, waveType: "sine", volume: 0.6, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 534, waveType: "sine", volume: 0.2, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 5, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 1056, waveType: "sine", volume: 0.4, pan: -0.3, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 8, lockTarget: "panel-1", frequencyOffset: 528 },
                            "panel-4": { frequency: 1068, waveType: "sine", volume: 0.1, pan: 0.3, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 8, lockTarget: "panel-2", frequencyOffset: 534 },
                            "panel-5": { frequency: 264, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 6, animate: true, fade: false, fadeDuration: 6, lockTarget: null, frequencyOffset: 0 }
                        }
                    }
                ]
            },
            {
                name: "💤 Delta Sleep: 2Hz Deep Rest Binaural",
                description: "Progressive delta wave induction for deep restorative sleep",
                isPredefined: true,
                keyframes: [
                    {
                        title: "Key0 - Alpha Relaxation (8Hz)",
                        description: "Initial relaxation with 8Hz alpha",
                        length: 300,
                        guideText: "Close your eyes and relax. Feel the day's tensions melting away.",
                        screenPanel: { enabled: true, color: "#FFA500", rate: 8 },
                        panels: {
                            "panel-1": { frequency: 150, waveType: "sine", volume: 0.6, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 8, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 158, waveType: "sine", volume: 0.6, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 8, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Key1 - Theta Dreams (4Hz)",
                        description: "Deeper into theta with volume fade",
                        length: 600,
                        guideText: "Drift into the twilight state between waking and sleeping. Dreams begin to form.",
                        screenPanel: { enabled: true, color: "#8A2BE2", rate: 4 },
                        panels: {
                            "panel-1": { frequency: 100, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 8, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 104, waveType: "sine", volume: 0.6, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 8, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 50, waveType: "triangle", volume: 0.2, pan: 0, isIsochronic: true, isochronicRate: 4, animate: false, fade: true, fadeDuration: 12, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Key2 - Deep Delta Sleep (2Hz)",
                        description: "Profound delta sleep state",
                        length: 3600,
                        guideText: "Rest deeply in delta waves. Your body heals and restores itself completely.",
                        screenPanel: { enabled: true, color: "#191970", rate: 2 },
                        panels: {
                            "panel-1": { frequency: 80, waveType: "sine", volume: 0.2, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 8, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 82, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 8, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 40, waveType: "triangle", volume: 0.3, pan: 0, isIsochronic: true, isochronicRate: 2, animate: true, fade: false, fadeDuration: 12, lockTarget: null, frequencyOffset: 0 }
                        }
                    }
                ]
            },
            {
                name: "🌟 Solfeggio 852Hz: Third Eye + 12Hz Alpha",
                description: "852Hz awakening frequency with 12Hz alpha binaural",
                isPredefined: true,
                keyframes: [
                    {
                        title: "Key0 - Third Eye Preparation",
                        description: "Gentle 12Hz alpha activation",
                        length: 200,
                        guideText: "Focus gently on your third eye. Feel the space between your eyebrows awakening.",
                        screenPanel: { enabled: true, color: "#4B0082", rate: 12 },
                        panels: {
                            "panel-1": { frequency: 852, waveType: "sine", volume: 0.4, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 6, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 864, waveType: "sine", volume: 0.4, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 6, lockTarget: null, frequencyOffset: 0 }
                        }
                    },
                    {
                        title: "Key1 - Intuition Opening",
                        description: "Full 852Hz with harmonic support",
                        length: 480,
                        guideText: "Your inner vision opens. Trust the insights and images that arise.",
                        screenPanel: { enabled: true, color: "#8A2BE2", rate: 12 },
                        panels: {
                            "panel-1": { frequency: 852, waveType: "sine", volume: 0.5, pan: -1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 6, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 864, waveType: "sine", volume: 0.5, pan: 1.0, isIsochronic: false, isochronicRate: 10, animate: false, fade: false, fadeDuration: 6, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 426, waveType: "sine", volume: 0.2, pan: -0.5, isIsochronic: false, isochronicRate: 10, animate: false, fade: true, fadeDuration: 8, lockTarget: "panel-1", frequencyOffset: -426 },
                            "panel-4": { frequency: 432, waveType: "sine", volume: 0.3, pan: 0.5, isIsochronic: false, isochronicRate: 10, animate: true, fade: true, fadeDuration: 8, lockTarget: "panel-2", frequencyOffset: -432 }
                        }
                    },
                    {
                        title: "Key2 - Expanded Awareness",
                        description: "Peak third eye activation with pan movement",
                        length: 720,
                        guideText: "Your consciousness expands beyond ordinary perception. See with your inner eye.",
                        screenPanel: { enabled: true, color: "#E6E6FA", rate: 12 },
                        panels: {
                            "panel-1": { frequency: 852, waveType: "sine", volume: 0.6, pan: -0.8, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 6, lockTarget: null, frequencyOffset: 0 },
                            "panel-2": { frequency: 864, waveType: "sine", volume: 0.3, pan: 0.8, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 6, lockTarget: null, frequencyOffset: 0 },
                            "panel-3": { frequency: 426, waveType: "sine", volume: 0.3, pan: -0.2, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 8, lockTarget: "panel-1", frequencyOffset: -426 },
                            "panel-4": { frequency: 432, waveType: "sine", volume: 0.1, pan: 0.2, isIsochronic: false, isochronicRate: 10, animate: true, fade: false, fadeDuration: 8, lockTarget: "panel-2", frequencyOffset: -432 },
                            "panel-5": { frequency: 1704, waveType: "triangle", volume: 0.15, pan: 0, isIsochronic: true, isochronicRate: 12, animate: true, fade: false, fadeDuration: 10, lockTarget: "panel-1", frequencyOffset: 852 }
                        }
                    }
                ]
            }
        ];

        function addFrequencyPanel() {
            panelCounter++;
            const panelId = `panel-${panelCounter}`;

            const panel = document.createElement('div');
            panel.className = 'frequency-panel';
            panel.id = panelId;
            panel.innerHTML = createPanelHTML(panelId);

            document.getElementById('frequency-panels').appendChild(panel);

            generators[panelId] = new FrequencyGenerator(panelId);

            // Initialize the panel
            updateFrequencyDisplay(panelId);
            updateFavoritesDropdown(panelId);

            // Update all lock dropdowns to include the new panel
            updateLockDropdowns();

            // Add click handler to make panel active
            panel.addEventListener('click', () => setActivePanel(panelId));

            // Set as active if it's the first panel
            if (Object.keys(generators).length === 1) {
                setActivePanel(panelId);
            }
        }

        let noisePanelCounter = 0;

        function addNoisePanel() {
            noisePanelCounter++;
            const panelId = `noise-${noisePanelCounter}`;

            const panel = document.createElement('div');
            panel.className = 'noise-panel';
            panel.id = panelId;
            panel.innerHTML = createNoisePanelHTML(panelId);

            document.getElementById('frequency-panels').appendChild(panel);

            noiseGenerators[panelId] = new NoiseGenerator(panelId);

            // Initialize the panel
            updateNoiseVolumeDisplay(panelId);

            // Add click handler to make panel active
            panel.addEventListener('click', () => setActivePanel(panelId));
        }

        function createNoisePanelHTML(panelId) {
            return `
                <button class="remove-panel" onclick="removeNoisePanel('${panelId}')" title="Remove Noise Panel">×</button>

                <div class="noise-controls">
                    <div class="frequency-input">
                        <div class="noise-header">
                            <label>🔊 Noise Generator</label>
                        </div>

                        <div class="frequency-input">
                            <label>Noise Type</label>
                            <select class="wave-select" id="${panelId}-noise-type" onchange="updateNoiseType('${panelId}', this.value)">
                                <option value="white">⚪ White Noise (Equal Energy)</option>
                                <option value="pink">🌸 Pink Noise (1/f Falloff)</option>
                                <option value="brown">🟤 Brown Noise (1/f² Falloff)</option>
                            </select>
                        </div>

                        <div class="frequency-input">
                            <label>Volume</label>
                            <div class="volume-control">
                                <input type="range" class="volume-slider"
                                       id="${panelId}-volume"
                                       min="0" max="1" step="0.1" value="0.3"
                                       oninput="updateNoiseVolume('${panelId}', this.value)">
                                <span id="${panelId}-volume-display">30%</span>
                            </div>
                        </div>

                        <div class="frequency-input">
                            <label>Pan</label>
                            <div class="pan-control">
                                <input type="range" class="pan-slider"
                                       id="${panelId}-pan"
                                       min="-1" max="1" step="0.1" value="0"
                                       oninput="updateNoisePan('${panelId}', this.value)">
                                <span id="${panelId}-pan-display">Center</span>
                            </div>
                            <div class="pan-labels">
                                <span>L</span>
                                <span>C</span>
                                <span>R</span>
                            </div>
                        </div>

                        <div class="frequency-input">
                            <label>Pulsating Frequency (Hz)</label>
                            <div class="pulsating-control">
                                <input type="range" class="pulsating-slider"
                                       id="${panelId}-pulsating"
                                       min="0" max="20" step="0.1" value="0"
                                       oninput="updateNoisePulsating('${panelId}', this.value)">
                                <span id="${panelId}-pulsating-display">0 Hz (Off)</span>
                            </div>
                            <div class="pulsating-info">
                                <small>0 Hz = Continuous noise. Higher values create rhythmic pulsing.</small>
                            </div>
                        </div>

                        <div class="frequency-input noise-modulation-controls" id="${panelId}-modulation-controls" style="display: none;">
                            <label>Advanced Modulation</label>
                            <div class="noise-modulation-section">
                                <div class="modulation-toggles">
                                    <div class="modulation-toggle">
                                        <input type="checkbox" id="${panelId}-vertical-mod"
                                               onchange="updateNoiseModulation('${panelId}', 'vertical', this.checked)">
                                        <label for="${panelId}-vertical-mod">📊 Vertical Modulation</label>
                                    </div>
                                    <div class="modulation-toggle">
                                        <input type="checkbox" id="${panelId}-horizontal-mod"
                                               onchange="updateNoiseModulation('${panelId}', 'horizontal', this.checked)">
                                        <label for="${panelId}-horizontal-mod">◀️▶️ Horizontal Modulation</label>
                                    </div>
                                </div>
                                <div class="modulation-depth-control">
                                    <label>Depth:</label>
                                    <input type="range" class="modulation-depth-slider"
                                           id="${panelId}-mod-depth"
                                           min="0.1" max="1" step="0.1" value="0.5"
                                           oninput="updateNoiseModulationDepth('${panelId}', this.value)">
                                    <span class="modulation-depth-display" id="${panelId}-mod-depth-display">50%</span>
                                </div>
                                <div class="noise-modulation-info">
                                    <small>🔊 Advanced noise effects using pulsating frequency modulation<br>
                                    Vertical: Amplitude pulses | Horizontal: Left-right oscillation</small>
                                </div>
                            </div>
                        </div>

                        <div class="frequency-input">
                            <button class="play-btn" id="${panelId}-play" onclick="toggleNoisePlay('${panelId}')">Play</button>
                        </div>
                    </div>
                </div>

                <div class="animate-controls" id="${panelId}-animate-controls">
                    <div class="animate-toggle">
                        <input type="checkbox" class="animate-checkbox"
                               id="${panelId}-animate"
                               onchange="updateNoiseAnimate('${panelId}', this.checked)">
                        <label for="${panelId}-animate">Animate</label>
                    </div>

                    <div class="fade-toggle">
                        <input type="checkbox" class="fade-checkbox"
                               id="${panelId}-fade" checked
                               onchange="updateNoiseFade('${panelId}', this.checked)">
                        <label for="${panelId}-fade">Fade</label>
                    </div>

                    <div class="fade-duration-control">
                        <label for="${panelId}-fade-duration">Fade Duration:</label>
                        <input type="range" class="fade-duration-slider"
                               id="${panelId}-fade-duration"
                               min="1" max="10" step="1" value="2"
                               oninput="updateNoiseFadeDuration('${panelId}', this.value)">
                        <span class="fade-duration-display" id="${panelId}-fade-duration-display">2s</span>
                    </div>
                </div>
            `;
        }

        function createPanelHTML(panelId) {
            return `
                <button class="remove-panel" onclick="removePanel('${panelId}')" title="Remove Panel">×</button>

                <div class="frequency-controls">
                    <div class="frequency-input">
                        <div class="frequency-controls-header">
                            <label>Frequency (Hz)</label>
                            <div class="lock-controls">
                                <select class="lock-dropdown" id="${panelId}-lock-dropdown" onchange="updateLockTarget('${panelId}', this.value)">
                                    <option value="">No lock</option>
                                </select>
                                <span class="lock-indicator" id="${panelId}-lock-indicator"></span>
                            </div>
                        </div>
                        <input type="number" class="frequency-input-field"
                               id="${panelId}-input"
                               min="20" max="20000" step="0.01" value="440"
                               onchange="updateFrequencyFromInput('${panelId}', this.value)"
                               onkeydown="handleFrequencyInputKeydown(event, '${panelId}')">
                        <div class="frequency-slider-container">
                            <input type="range" class="frequency-slider"
                                   id="${panelId}-slider"
                                   min="20" max="20000" value="440"
                                   oninput="updateFrequency('${panelId}', this.value)">
                        </div>
                        <div class="freq-buttons">
                            <button class="freq-btn" onclick="adjustFrequency('${panelId}', -10)">-10</button>
                            <button class="freq-btn" onclick="adjustFrequency('${panelId}', -1)">-1</button>
                            <button class="freq-btn" onclick="adjustFrequency('${panelId}', -0.1)">-0.1</button>
                            <button class="freq-btn" onclick="adjustFrequency('${panelId}', -0.01)">-0.01</button>
                            <button class="freq-btn" onclick="adjustFrequency('${panelId}', 0.01)">+0.01</button>
                            <button class="freq-btn" onclick="adjustFrequency('${panelId}', 0.1)">+0.1</button>
                            <button class="freq-btn" onclick="adjustFrequency('${panelId}', 1)">+1</button>
                            <button class="freq-btn" onclick="adjustFrequency('${panelId}', 10)">+10</button>
                            <button class="freq-btn" onclick="multiplyFrequency('${panelId}', 0.5)">/2</button>
                            <button class="freq-btn" onclick="multiplyFrequency('${panelId}', 2)">×2</button>
                        </div>
                    </div>

                    <div class="frequency-input">
                        <label>Wave Type</label>
                        <select class="wave-select" id="${panelId}-wave" onchange="updateWaveType('${panelId}', this.value)">
                            <option value="sine">Sine</option>
                            <option value="square">Square</option>
                            <option value="triangle">Triangle</option>
                            <option value="sawtooth">Sawtooth</option>
                        </select>
                    </div>

                    <div class="frequency-input">
                        <label>Harmonic MultiLayering</label>
                        <div class="harmonic-controls">
                            <div class="harmonic-type-control">
                                <select class="wave-select" id="${panelId}-harmonic-type" onchange="updateHarmonicLayering('${panelId}', this.value)">
                                    <option value="none">🎵 PureTone (Single Frequency)</option>
                                    <option value="octave">🎼 Perfect Octave (2x, 4x, 8x...)</option>
                                    <option value="fifth">🎶 Perfect Fifth (3:2 ratio)</option>
                                    <option value="triad">🎹 Major Triad (1:1.25:1.5)</option>
                                    <option value="harmonic">🌊 Harmonic Series (1, 2, 3, 4...)</option>
                                    <option value="golden">✨ Golden Ratio (φ progression)</option>
                                    <option value="fibonacci">🌀 Fibonacci (1, 2, 3, 5, 8...)</option>
                                </select>
                            </div>
                            <div class="harmonic-layers-control">
                                <label>Layers:</label>
                                <input type="number" id="${panelId}-harmonic-layers"
                                       min="2" max="50" value="5"
                                       onchange="updateHarmonicLayers('${panelId}', this.value)">
                            </div>
                        </div>
                        <div class="harmonic-info">
                            <small>🎼 MultiLayering creates rich harmonic textures by adding mathematically related frequencies</small>
                        </div>
                    </div>

                    <div class="frequency-input">
                        <label>Volume</label>
                        <div class="volume-control">
                            <input type="range" class="volume-slider"
                                   id="${panelId}-volume"
                                   min="0" max="1" step="0.1" value="0.5"
                                   oninput="updateVolume('${panelId}', this.value)">
                            <span id="${panelId}-volume-display">50%</span>
                        </div>
                    </div>

                    <div class="frequency-input">
                        <label>Pan</label>
                        <div class="pan-control">
                            <input type="range" class="pan-slider"
                                   id="${panelId}-pan"
                                   min="-1" max="1" step="0.1" value="0"
                                   oninput="updatePan('${panelId}', this.value)">
                            <span id="${panelId}-pan-display">Center</span>
                        </div>
                        <div class="pan-labels">
                            <span>L</span>
                            <span>C</span>
                            <span>R</span>
                        </div>
                    </div>

                    <div class="frequency-input">
                        <label>Favorites</label>
                        <div class="favorites-section">
                            <select class="favorites-dropdown" id="${panelId}-favorites" onchange="loadFavorite('${panelId}', this.value)">
                                <option value="">Select favorite...</option>
                            </select>
                            <button class="add-favorite-btn" onclick="openFavoriteModal('${panelId}')">Add to Favorites</button>
                        </div>
                    </div>

                    <div class="frequency-input">
                        <label>Isochronic Tones</label>
                        <div class="isochronic-controls">
                            <div class="isochronic-toggle">
                                <input type="checkbox" class="isochronic-checkbox"
                                       id="${panelId}-isochronic"
                                       onchange="updateIsochronic('${panelId}', this.checked)">
                                <label for="${panelId}-isochronic">Enable</label>
                            </div>
                            <div class="isochronic-rate-control">
                                <input type="range" class="isochronic-rate-slider"
                                       id="${panelId}-iso-rate"
                                       min="0.1" max="100" step="0.1" value="10"
                                       oninput="updateIsochronicRate('${panelId}', this.value)">
                                <span class="isochronic-rate-display" id="${panelId}-iso-rate-display">10 Hz</span>
                            </div>
                        </div>
                    </div>

                    <div class="frequency-input">
                        <label>Delayed Tone</label>
                        <div class="delayed-tone-controls">
                            <div class="delayed-tone-toggle">
                                <input type="checkbox" class="delayed-tone-checkbox"
                                       id="${panelId}-delayed-tone"
                                       onchange="updateDelayedTone('${panelId}', this.checked)">
                                <label for="${panelId}-delayed-tone">Enable</label>
                            </div>
                            <div class="delayed-tone-time-control">
                                <input type="range" class="delay-time-slider"
                                       id="${panelId}-delay-time"
                                       min="1" max="5000" step="1" value="100"
                                       oninput="updateDelayTime('${panelId}', this.value)">
                                <span class="delay-time-display" id="${panelId}-delay-time-display">100ms</span>
                            </div>
                            <div class="delayed-tone-info">
                                <small>Left: Direct | Right: Delayed<br>
                                Disables panning and isochronic tones</small>
                            </div>
                        </div>
                    </div>

                    <div class="frequency-input binaural-modulation-controls" id="${panelId}-binaural-controls" style="display: none;">
                        <label>Advanced Binaural Beats</label>
                        <div class="binaural-modulation-section">
                            <div class="modulation-toggles">
                                <div class="modulation-toggle">
                                    <input type="checkbox" id="${panelId}-vertical-mod"
                                           onchange="updateBinauralModulation('${panelId}', 'vertical', this.checked)">
                                    <label for="${panelId}-vertical-mod">📊 Vertical Modulation</label>
                                </div>
                                <div class="modulation-toggle">
                                    <input type="checkbox" id="${panelId}-horizontal-mod"
                                           onchange="updateBinauralModulation('${panelId}', 'horizontal', this.checked)">
                                    <label for="${panelId}-horizontal-mod">◀️▶️ Horizontal Modulation</label>
                                </div>
                            </div>
                            <div class="modulation-depth-control">
                                <label>Depth:</label>
                                <input type="range" class="modulation-depth-slider"
                                       id="${panelId}-mod-depth"
                                       min="0.1" max="1" step="0.1" value="0.5"
                                       oninput="updateModulationDepth('${panelId}', this.value)">
                                <span class="modulation-depth-display" id="${panelId}-mod-depth-display">50%</span>
                            </div>
                            <div class="binaural-info">
                                <small>🧠 Advanced binaural effects using beat frequency modulation<br>
                                Vertical: Amplitude pulses | Horizontal: Left-right oscillation</small>
                            </div>
                        </div>
                    </div>

                    <div class="frequency-input">
                        <button class="play-btn" id="${panelId}-play" onclick="togglePlay('${panelId}')">Play</button>
                    </div>
                </div>

                <div class="animate-controls" id="${panelId}-animate-controls">
                    <div class="animate-toggle">
                        <input type="checkbox" class="animate-checkbox"
                               id="${panelId}-animate"
                               onchange="updateAnimate('${panelId}', this.checked)">
                        <label for="${panelId}-animate">Animate</label>
                    </div>

                    <div class="fade-toggle">
                        <input type="checkbox" class="fade-checkbox"
                               id="${panelId}-fade" checked
                               onchange="updateFade('${panelId}', this.checked)">
                        <label for="${panelId}-fade">Fade</label>
                    </div>

                    <div class="fade-settings">
                        <input type="range" class="fade-duration-slider"
                               id="${panelId}-fade-duration"
                               min="0.1" max="10" step="0.1" value="2"
                               oninput="updateFadeDuration('${panelId}', this.value)">
                        <span class="fade-duration-display" id="${panelId}-fade-duration-display">2.0s</span>
                    </div>
                </div>

                </div>
            `;
        }

        // Noise Panel Update Functions
        function updateNoiseType(panelId, type) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            generator.updateNoiseType(type);

            const typeNames = {
                'white': 'White Noise',
                'pink': 'Pink Noise',
                'brown': 'Brown Noise'
            };

            console.log(`🔊 ${typeNames[type]} selected for ${panelId}`);
        }

        function updateNoiseVolume(panelId, vol) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            vol = Math.max(0, Math.min(1, parseFloat(vol)));
            generator.updateVolume(vol);
            updateNoiseVolumeDisplay(panelId, vol);
        }

        function updateNoiseVolumeDisplay(panelId, vol = null) {
            if (vol === null) {
                vol = noiseGenerators[panelId]?.volume || 0.3;
            }
            document.getElementById(`${panelId}-volume-display`).textContent = Math.round(vol * 100) + '%';
        }

        function updateNoisePan(panelId, panValue) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            panValue = Math.max(-1, Math.min(1, parseFloat(panValue)));
            generator.updatePan(panValue);

            let panDisplayText;
            if (panValue < -0.1) {
                panDisplayText = `Left ${Math.round(-panValue * 100)}%`;
            } else if (panValue > 0.1) {
                panDisplayText = `Right ${Math.round(panValue * 100)}%`;
            } else {
                panDisplayText = 'Center';
            }
            document.getElementById(`${panelId}-pan-display`).textContent = panDisplayText;
        }

        function updateNoisePulsating(panelId, freq) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            freq = Math.max(0, parseFloat(freq));
            generator.updatePulsatingFrequency(freq);

            const displayText = freq === 0 ? '0 Hz (Off)' : `${freq.toFixed(1)} Hz`;
            document.getElementById(`${panelId}-pulsating-display`).textContent = displayText;

            // Show/hide modulation controls based on pulsating frequency
            const modulationControls = document.getElementById(`${panelId}-modulation-controls`);
            if (freq > 0) {
                modulationControls.style.display = 'block';
            } else {
                modulationControls.style.display = 'none';
                // Reset modulation checkboxes when hiding
                document.getElementById(`${panelId}-vertical-mod`).checked = false;
                document.getElementById(`${panelId}-horizontal-mod`).checked = false;
                generator.verticalModulation = false;
                generator.horizontalModulation = false;
            }

            console.log(`🔊 Pulsating frequency set to ${freq}Hz for ${panelId}`);
        }

        function updateNoiseModulation(panelId, type, enabled) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            generator.updateModulation(type, enabled);

            const modType = type === 'vertical' ? 'Vertical' : 'Horizontal';
            const symbol = type === 'vertical' ? '📊' : '◀️▶️';
            console.log(`${symbol} ${modType} modulation ${enabled ? 'enabled' : 'disabled'} for ${panelId}`);
        }

        function updateNoiseModulationDepth(panelId, depth) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            depth = Math.max(0.1, Math.min(1, parseFloat(depth)));
            generator.updateModulationDepth(depth);
            document.getElementById(`${panelId}-mod-depth-display`).textContent = Math.round(depth * 100) + '%';

            console.log(`🎛️ Noise modulation depth set to ${Math.round(depth * 100)}% for ${panelId}`);
        }

        function updateNoiseAnimate(panelId, enabled) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            generator.animate = enabled;

            if (enabled) {
                // Disable fade when animate is enabled
                generator.fade = false;
                document.getElementById(`${panelId}-fade`).checked = false;
            }
        }

        function updateNoiseFade(panelId, enabled) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            generator.fade = enabled;

            if (enabled) {
                // Disable animate when fade is enabled
                generator.animate = false;
                document.getElementById(`${panelId}-animate`).checked = false;
            }
        }

        function updateNoiseFadeDuration(panelId, duration) {
            const generator = noiseGenerators[panelId];
            if (!generator) return;

            duration = parseFloat(duration);
            generator.fadeDuration = duration;
            document.getElementById(`${panelId}-fade-duration-display`).textContent = duration.toFixed(1) + 's';
        }

        function toggleNoisePlay(panelId) {
            const generator = noiseGenerators[panelId];
            const playButton = document.getElementById(`${panelId}-play`);

            if (!generator.isPlaying) {
                generator.start();
                playButton.textContent = 'Stop';
                playButton.classList.add('playing');
            } else {
                generator.stop();
                playButton.textContent = 'Play';
                playButton.classList.remove('playing');
            }
        }

        function removeNoisePanel(panelId) {
            // Stop the generator if playing
            if (noiseGenerators[panelId]) {
                noiseGenerators[panelId].stop();
                delete noiseGenerators[panelId];
            }

            // Remove the DOM element
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.remove();
            }

            // Clear active panel if this was it
            if (activePanelId === panelId) {
                activePanelId = null;
            }
        }

        function updateFrequency(panelId, freq, skipOffsetRecalc = false) {
            freq = parseFloat(freq);
            generators[panelId].updateFrequency(freq);
            updateFrequencyDisplay(panelId, freq);
            document.getElementById(`${panelId}-slider`).value = freq;

            // Update offset if this panel is locked to another (skip during keyframe loading)
            if (!skipOffsetRecalc && generators[panelId].lockTarget) {
                const targetFreq = generators[generators[panelId].lockTarget].frequency;
                generators[panelId].frequencyOffset = Math.round((freq - targetFreq) * 100) / 100;
            }

            // Propagate changes to dependent panels
            propagateFrequencyChanges(panelId, freq);
        }

        function updateFrequencyDisplay(panelId, freq = null) {
            if (freq === null) {
                freq = generators[panelId].frequency;
            }
            // Format frequency to show decimals only when needed
            const formattedFreq = freq % 1 === 0 ? freq.toString() : freq.toFixed(2);
            document.getElementById(`${panelId}-input`).value = formattedFreq;
        }

        function adjustFrequency(panelId, delta) {
            const currentFreq = generators[panelId].frequency;
            const newFreq = Math.max(20, Math.min(20000, currentFreq + delta));
            // Round to 2 decimal places to avoid floating point precision issues
            const roundedFreq = Math.round(newFreq * 100) / 100;
            updateFrequency(panelId, roundedFreq);
        }

        function multiplyFrequency(panelId, multiplier) {
            const newFreq = Math.max(20, Math.min(20000, Math.round(generators[panelId].frequency * multiplier)));
            updateFrequency(panelId, newFreq);
        }

        function updateWaveType(panelId, waveType) {
            generators[panelId].updateWaveType(waveType);
        }

        function updateVolume(panelId, volume) {
            generators[panelId].updateVolume(volume);
            document.getElementById(`${panelId}-volume-display`).textContent = Math.round(volume * 100) + '%';
        }

        function updatePan(panelId, panValue) {
            generators[panelId].updatePan(panValue);
            let displayText;
            if (panValue < -0.1) {
                displayText = `Left ${Math.round(-panValue * 100)}%`;
            } else if (panValue > 0.1) {
                displayText = `Right ${Math.round(panValue * 100)}%`;
            } else {
                displayText = 'Center';
            }
            document.getElementById(`${panelId}-pan-display`).textContent = displayText;
        }

        function updateIsochronic(panelId, enabled) {
            // Handle conflict with delayed tone
            if (enabled) {
                const delayedToneCheckbox = document.getElementById(`${panelId}-delayed-tone`);
                if (delayedToneCheckbox.checked) {
                    delayedToneCheckbox.checked = false;
                    updateDelayedTone(panelId, false);
                }
            }

            generators[panelId].updateIsochronic(enabled);
        }

        function updateIsochronicRate(panelId, rate) {
            rate = parseFloat(rate);
            generators[panelId].updateIsochronicRate(rate);
            document.getElementById(`${panelId}-iso-rate-display`).textContent = rate.toFixed(1) + ' Hz';
        }

        function updateDelayedTone(panelId, enabled) {
            generators[panelId].updateDelayedTone(enabled);

            // Update UI state based on enabled/disabled
            const panElement = document.getElementById(`${panelId}-pan`);
            const panDisplay = document.getElementById(`${panelId}-pan-display`);
            const isochronicCheckbox = document.getElementById(`${panelId}-isochronic`);
            const delayTimeSlider = document.getElementById(`${panelId}-delay-time`);

            if (enabled) {
                // Disable panning controls
                panElement.disabled = true;
                panElement.value = 0;
                panDisplay.textContent = 'Center';
                panDisplay.style.opacity = '0.5';

                // Disable isochronic if enabled
                if (isochronicCheckbox.checked) {
                    isochronicCheckbox.checked = false;
                    updateIsochronic(panelId, false);
                }
                isochronicCheckbox.disabled = true;

                // Enable delay time control
                delayTimeSlider.disabled = false;
            } else {
                // Re-enable panning controls
                panElement.disabled = false;
                panDisplay.style.opacity = '1';

                // Re-enable isochronic control
                isochronicCheckbox.disabled = false;

                // Disable delay time control
                delayTimeSlider.disabled = true;
            }
        }

        function updateDelayTime(panelId, delayMs) {
            delayMs = parseInt(delayMs);
            generators[panelId].updateDelayTime(delayMs);
            document.getElementById(`${panelId}-delay-time-display`).textContent = delayMs + 'ms';
        }

        function updateBinauralModulation(panelId, type, enabled) {
            const generator = generators[panelId];
            if (!generator) return;

            if (type === 'vertical') {
                generator.verticalModulation = enabled;
            } else if (type === 'horizontal') {
                generator.horizontalModulation = enabled;
            }

            // Restart audio if currently playing to apply changes
            if (generator.isPlaying) {
                generator.stop();
                generator.start();
            }

            console.log(`🧠 ${type} modulation ${enabled ? 'enabled' : 'disabled'} for ${panelId}`);
        }

        function updateModulationDepth(panelId, depth) {
            const generator = generators[panelId];
            if (!generator) return;

            generator.modulationDepth = parseFloat(depth);
            document.getElementById(`${panelId}-mod-depth-display`).textContent = Math.round(depth * 100) + '%';

            // Restart audio if currently playing to apply changes
            if (generator.isPlaying) {
                generator.stop();
                generator.start();
            }

            console.log(`🎛️ Modulation depth set to ${Math.round(depth * 100)}% for ${panelId}`);
        }

        function updateHarmonicLayering(panelId, layering) {
            const generator = generators[panelId];
            if (!generator) return;

            generator.harmonicLayering = layering;

            // Enable/disable layers input based on layering type
            const layersInput = document.getElementById(`${panelId}-harmonic-layers`);
            layersInput.disabled = (layering === 'none');

            // Restart audio if currently playing to apply changes
            if (generator.isPlaying) {
                generator.stop();
                generator.start();
            }

            const layeringNames = {
                'none': 'PureTone',
                'octave': 'Perfect Octave',
                'fifth': 'Perfect Fifth',
                'triad': 'Major Triad',
                'harmonic': 'Harmonic Series',
                'golden': 'Golden Ratio',
                'fibonacci': 'Fibonacci'
            };

            console.log(`🎼 ${layeringNames[layering]} layering ${layering === 'none' ? 'disabled' : 'enabled'} for ${panelId}`);
        }

        function updateHarmonicLayers(panelId, layers) {
            const generator = generators[panelId];
            if (!generator) return;

            layers = Math.max(2, Math.min(50, parseInt(layers)));
            generator.harmonicLayers = layers;

            // Update input value in case it was clamped
            document.getElementById(`${panelId}-harmonic-layers`).value = layers;

            // Restart audio if currently playing to apply changes
            if (generator.isPlaying) {
                generator.stop();
                generator.start();
            }

            console.log(`🎵 Harmonic layers set to ${layers} for ${panelId}`);
        }

        function updateAnimate(panelId, enabled) {
            generators[panelId].animate = enabled;

            if (enabled) {
                // Disable fade when animate is enabled
                generators[panelId].fade = false;
                document.getElementById(`${panelId}-fade`).checked = false;
            }

            saveCurrentKeyframe();
        }

        function updateFade(panelId, enabled) {
            generators[panelId].fade = enabled;

            if (enabled) {
                // Disable animate when fade is enabled
                generators[panelId].animate = false;
                document.getElementById(`${panelId}-animate`).checked = false;
            }

            saveCurrentKeyframe();
        }

        function updateFadeDuration(panelId, duration) {
            duration = parseFloat(duration);
            generators[panelId].fadeDuration = duration;
            document.getElementById(`${panelId}-fade-duration-display`).textContent = duration.toFixed(1) + 's';
            saveCurrentKeyframe();
        }

        function updateFrequencyFromInput(panelId, inputValue) {
            let freq = parseFloat(inputValue);
            if (isNaN(freq)) freq = 440;
            freq = Math.max(20, Math.min(20000, freq));

            // Round to 2 decimal places
            freq = Math.round(freq * 100) / 100;

            generators[panelId].updateFrequency(freq);
            document.getElementById(`${panelId}-slider`).value = freq;

            // Update offset if this panel is locked to another
            if (generators[panelId].lockTarget) {
                const targetFreq = generators[generators[panelId].lockTarget].frequency;
                generators[panelId].frequencyOffset = Math.round((freq - targetFreq) * 100) / 100;
            }

            // Propagate changes to dependent panels
            propagateFrequencyChanges(panelId, freq);
        }

        function handleFrequencyInputKeydown(event, panelId) {
            if (event.key === 'Enter') {
                updateFrequencyFromInput(panelId, event.target.value);
            }
        }

        function updateLockTarget(panelId, targetId) {
            const generator = generators[panelId];

            // Check for circular dependency
            if (targetId && wouldCreateCircularDependency(panelId, targetId)) {
                alert('Cannot create circular dependency!');
                document.getElementById(`${panelId}-lock-dropdown`).value = generator.lockTarget || '';
                return;
            }

            // Update lock target
            generator.lockTarget = targetId || null;

            if (generator.lockTarget) {
                // Calculate offset from target
                const targetFreq = generators[generator.lockTarget].frequency;
                generator.frequencyOffset = generator.frequency - targetFreq;

                // Update indicator
                const indicator = document.getElementById(`${panelId}-lock-indicator`);
                const targetLabel = getPanelLabel(generator.lockTarget);
                indicator.textContent = `→ ${targetLabel}`;
                indicator.classList.add('active');

                // Show binaural modulation controls
                showBinauralModulationControls(panelId, true);
            } else {
                generator.frequencyOffset = 0;

                // Hide indicator
                const indicator = document.getElementById(`${panelId}-lock-indicator`);
                indicator.classList.remove('active');

                // Hide binaural modulation controls
                showBinauralModulationControls(panelId, false);
            }
        }

        function showBinauralModulationControls(panelId, show) {
            const binauralControls = document.getElementById(`${panelId}-binaural-controls`);
            if (binauralControls) {
                binauralControls.style.display = show ? 'block' : 'none';
                if (show) {
                    console.log(`🧠 Binaural modulation controls shown for ${panelId} (locked panel)`);
                }
            }
        }

        function wouldCreateCircularDependency(panelId, targetId) {
            const visited = new Set();
            let current = targetId;

            while (current && !visited.has(current)) {
                if (current === panelId) {
                    return true;
                }
                visited.add(current);
                current = generators[current]?.lockTarget;
            }
            return false;
        }

        function propagateFrequencyChanges(changedPanelId, newFreq) {
            const updated = new Set([changedPanelId]);
            const toUpdate = [];

            // Find all panels that depend on the changed panel
            Object.keys(generators).forEach(panelId => {
                const generator = generators[panelId];
                if (generator.lockTarget === changedPanelId && !updated.has(panelId)) {
                    toUpdate.push(panelId);
                }
            });

            // Update dependent panels and propagate changes
            toUpdate.forEach(panelId => {
                const generator = generators[panelId];
                const newDependentFreq = Math.max(20, Math.min(20000, newFreq + generator.frequencyOffset));
                const roundedFreq = Math.round(newDependentFreq * 100) / 100;

                // Update the frequency without triggering another propagation
                generator.updateFrequency(roundedFreq);
                updateFrequencyDisplay(panelId, roundedFreq);
                document.getElementById(`${panelId}-slider`).value = roundedFreq;

                updated.add(panelId);

                // Recursively propagate to panels that depend on this one
                propagateFrequencyChanges(panelId, roundedFreq);
            });
        }

        function updateLockDropdowns() {
            Object.keys(generators).forEach(panelId => {
                const dropdown = document.getElementById(`${panelId}-lock-dropdown`);
                const currentValue = dropdown.value;

                // Clear existing options except "No lock"
                dropdown.innerHTML = '<option value="">No lock</option>';

                // Add other panels as options
                Object.keys(generators).forEach(otherPanelId => {
                    if (otherPanelId !== panelId) {
                        const option = document.createElement('option');
                        option.value = otherPanelId;
                        option.textContent = getPanelLabel(otherPanelId);
                        dropdown.appendChild(option);
                    }
                });

                // Restore previous value if still valid
                if (currentValue && generators[currentValue]) {
                    dropdown.value = currentValue;
                }
            });
        }

        function getPanelLabel(panelId) {
            const panelNumber = parseInt(panelId.split('-')[1]);
            return `F${panelNumber}`;
        }

        function getDependentPanels(panelId) {
            return Object.keys(generators).filter(id => generators[id].lockTarget === panelId);
        }

        // Screen Panel Functions (now per-keyframe)
        function openSaveModal() {
            document.getElementById('configName').value = '';
            document.getElementById('saveModal').style.display = 'block';
        }

        function closeSaveModal() {
            document.getElementById('saveModal').style.display = 'none';
        }

        function openLoadModal() {
            displaySavedConfigurations();
            document.getElementById('loadModal').style.display = 'block';
        }

        function closeLoadModal() {
            document.getElementById('loadModal').style.display = 'none';
        }

        function saveConfiguration() {
            const name = document.getElementById('configName').value.trim();
            if (!name) {
                alert('Please enter a configuration name');
                return;
            }

            // Capture current state
            saveCurrentKeyframe(); // Make sure current keyframe is saved

            const config = {
                name: name,
                timestamp: new Date().toISOString(),
                panelCounter: panelCounter,
                noisePanelCounter: noisePanelCounter,
                keyframes: [...keyframes],
                currentKeyframeIndex: currentKeyframeIndex,
                panels: {},
                noisePanels: {}
            };

            Object.keys(generators).forEach(panelId => {
                const generator = generators[panelId];
                config.panels[panelId] = {
                    frequency: generator.frequency,
                    waveType: generator.waveType,
                    volume: generator.volume,
                    pan: generator.pan,
                    lockTarget: generator.lockTarget,
                    frequencyOffset: Math.round(generator.frequencyOffset * 100) / 100,
                    isIsochronic: generator.isIsochronic,
                    isochronicRate: generator.isochronicRate,
                    isDelayedTone: generator.isDelayedTone,
                    delayTime: generator.delayTime,
                    verticalModulation: generator.verticalModulation,
                    horizontalModulation: generator.horizontalModulation,
                    modulationDepth: generator.modulationDepth,
                    harmonicLayering: generator.harmonicLayering,
                    harmonicLayers: generator.harmonicLayers,
                    harmonicVolume: generator.harmonicVolume
                };
            });

            // Save noise panels
            Object.keys(noiseGenerators).forEach(panelId => {
                const generator = noiseGenerators[panelId];
                config.noisePanels[panelId] = {
                    noiseType: generator.noiseType,
                    volume: generator.volume,
                    pan: generator.pan,
                    pulsatingFrequency: generator.pulsatingFrequency,
                    verticalModulation: generator.verticalModulation,
                    horizontalModulation: generator.horizontalModulation,
                    modulationDepth: generator.modulationDepth
                };
            });

            // Check if configuration name already exists
            const existingIndex = savedConfigurations.findIndex(c => c.name === name);
            if (existingIndex >= 0) {
                if (!confirm('Configuration with this name already exists. Overwrite?')) {
                    return;
                }
                savedConfigurations[existingIndex] = config;
            } else {
                savedConfigurations.push(config);
            }

            // Save to localStorage
            localStorage.setItem('frequencyConfigurations', JSON.stringify(savedConfigurations));

            closeSaveModal();
            alert('Configuration saved successfully!');
        }

        function loadPrebuiltConfiguration(configName) {
            const config = prebuiltConfigurations.find(c => c.name === configName);
            if (!config) {
                alert('Pre-built configuration not found');
                return;
            }

            loadConfigurationData(config);
            closeLoadModal();
            alert('Pre-built configuration loaded successfully!');
        }

        function loadConfiguration(configName) {
            const config = savedConfigurations.find(c => c.name === configName);
            if (!config) {
                alert('Configuration not found');
                return;
            }

            loadConfigurationData(config);
            closeLoadModal();
            alert('Configuration loaded successfully!');
        }

        function loadConfigurationData(config) {
            // Stop all current generators
            stopAll();

            // Clear existing panels
            Object.keys(generators).forEach(panelId => {
                if (generators[panelId]) {
                    generators[panelId].stop();
                    delete generators[panelId];
                }
                const panelElement = document.getElementById(panelId);
                if (panelElement) {
                    panelElement.remove();
                }
            });

            // Clear existing noise panels
            Object.keys(noiseGenerators).forEach(panelId => {
                if (noiseGenerators[panelId]) {
                    noiseGenerators[panelId].stop();
                    delete noiseGenerators[panelId];
                }
                const panelElement = document.getElementById(panelId);
                if (panelElement) {
                    panelElement.remove();
                }
            });

            // Reset counters
            panelCounter = 0;
            noisePanelCounter = 0;
            activePanelId = null;

            // Restore keyframes
            if (config.keyframes && config.keyframes.length > 0) {
                keyframes = [...config.keyframes];
                currentKeyframeIndex = config.currentKeyframeIndex || 0;

                // Determine which panels we need from all keyframes
                const allPanelIds = new Set();
                config.keyframes.forEach(kf => {
                    Object.keys(kf.panels || {}).forEach(panelId => allPanelIds.add(panelId));
                });

                // Recreate panels
                Array.from(allPanelIds).forEach(panelId => {
                // Extract panel number and update counter
                const panelNumber = parseInt(panelId.split('-')[1]);
                if (panelNumber > panelCounter) {
                    panelCounter = panelNumber;
                }

                // Create panel
                const panel = document.createElement('div');
                panel.className = 'frequency-panel';
                panel.id = panelId;
                panel.innerHTML = createPanelHTML(panelId);

                document.getElementById('frequency-panels').appendChild(panel);

                // Create generator
                generators[panelId] = new FrequencyGenerator(panelId);

                // Add click handler
                panel.addEventListener('click', () => setActivePanel(panelId));
                });

                // Load the current keyframe state
                loadKeyframeState(keyframes[currentKeyframeIndex]);

                // Update keyframe system UI
                updateKeyframeTabs();
                updateKeyframeDetails();
                updateTimelineInfo();
                updateAnimateControlsVisibility();

            } else {
                // Handle legacy config without keyframes
                Object.keys(config.panels).forEach(panelId => {
                    // Extract panel number and update counter
                    const panelNumber = parseInt(panelId.split('-')[1]);
                    if (panelNumber > panelCounter) {
                        panelCounter = panelNumber;
                    }

                    // Create panel
                    const panel = document.createElement('div');
                    panel.className = 'frequency-panel';
                    panel.id = panelId;
                    panel.innerHTML = createPanelHTML(panelId);

                    document.getElementById('frequency-panels').appendChild(panel);

                    // Create generator
                    generators[panelId] = new FrequencyGenerator(panelId);

                    // Apply saved settings
                    const savedPanel = config.panels[panelId];
                generators[panelId].frequency = savedPanel.frequency;
                generators[panelId].waveType = savedPanel.waveType;
                generators[panelId].volume = savedPanel.volume;
                generators[panelId].pan = savedPanel.pan;
                generators[panelId].lockTarget = savedPanel.lockTarget;
                generators[panelId].frequencyOffset = savedPanel.frequencyOffset;
                generators[panelId].isIsochronic = savedPanel.isIsochronic || false;
                generators[panelId].isochronicRate = savedPanel.isochronicRate || 10;
                generators[panelId].isDelayedTone = savedPanel.isDelayedTone || false;
                generators[panelId].delayTime = savedPanel.delayTime || 100;
                generators[panelId].verticalModulation = savedPanel.verticalModulation || false;
                generators[panelId].horizontalModulation = savedPanel.horizontalModulation || false;
                generators[panelId].modulationDepth = savedPanel.modulationDepth || 0.5;
                generators[panelId].harmonicLayering = savedPanel.harmonicLayering || 'none';
                generators[panelId].harmonicLayers = savedPanel.harmonicLayers || 5;
                generators[panelId].harmonicVolume = savedPanel.harmonicVolume || 0.3;

                // Update UI elements
                updateFrequencyDisplay(panelId, savedPanel.frequency);
                document.getElementById(`${panelId}-slider`).value = savedPanel.frequency;
                document.getElementById(`${panelId}-wave`).value = savedPanel.waveType;
                document.getElementById(`${panelId}-volume`).value = savedPanel.volume;
                document.getElementById(`${panelId}-volume-display`).textContent = Math.round(savedPanel.volume * 100) + '%';
                document.getElementById(`${panelId}-pan`).value = savedPanel.pan;

                let panDisplayText;
                if (savedPanel.pan < -0.1) {
                    panDisplayText = `Left ${Math.round(-savedPanel.pan * 100)}%`;
                } else if (savedPanel.pan > 0.1) {
                    panDisplayText = `Right ${Math.round(savedPanel.pan * 100)}%`;
                } else {
                    panDisplayText = 'Center';
                }
                document.getElementById(`${panelId}-pan-display`).textContent = panDisplayText;

                // Update isochronic controls
                document.getElementById(`${panelId}-isochronic`).checked = savedPanel.isIsochronic || false;
                document.getElementById(`${panelId}-iso-rate`).value = savedPanel.isochronicRate || 10;
                document.getElementById(`${panelId}-iso-rate-display`).textContent = (savedPanel.isochronicRate || 10).toFixed(1) + ' Hz';

                // Update delayed tone controls
                const isDelayed = savedPanel.isDelayedTone || false;
                document.getElementById(`${panelId}-delayed-tone`).checked = isDelayed;
                document.getElementById(`${panelId}-delay-time`).value = savedPanel.delayTime || 100;
                document.getElementById(`${panelId}-delay-time-display`).textContent = (savedPanel.delayTime || 100) + 'ms';

                // Update delayed tone UI state
                document.getElementById(`${panelId}-pan`).disabled = isDelayed;
                document.getElementById(`${panelId}-pan-display`).style.opacity = isDelayed ? '0.5' : '1';
                document.getElementById(`${panelId}-isochronic`).disabled = isDelayed;
                document.getElementById(`${panelId}-delay-time`).disabled = !isDelayed;

                // Update binaural modulation UI state
                document.getElementById(`${panelId}-vertical-mod`).checked = savedPanel.verticalModulation || false;
                document.getElementById(`${panelId}-horizontal-mod`).checked = savedPanel.horizontalModulation || false;
                document.getElementById(`${panelId}-mod-depth`).value = savedPanel.modulationDepth || 0.5;
                document.getElementById(`${panelId}-mod-depth-display`).textContent = Math.round((savedPanel.modulationDepth || 0.5) * 100) + '%';

                // Show/hide binaural controls based on lock status
                showBinauralModulationControls(panelId, !!savedPanel.lockTarget);

                // Update harmonic layering UI
                document.getElementById(`${panelId}-harmonic-type`).value = savedPanel.harmonicLayering || 'none';
                document.getElementById(`${panelId}-harmonic-layers`).value = savedPanel.harmonicLayers || 5;
                document.getElementById(`${panelId}-harmonic-layers`).disabled = (savedPanel.harmonicLayering === 'none');

                    // Add click handler
                    panel.addEventListener('click', () => setActivePanel(panelId));
                });

                // Update favorites and lock dropdowns
                Object.keys(generators).forEach(panelId => {
                    updateFavoritesDropdown(panelId);
                });
                updateLockDropdowns();

                // Apply legacy lock settings and update UI
                Object.keys(config.panels).forEach(panelId => {
                    const savedPanel = config.panels[panelId];
                    if (savedPanel.lockTarget) {
                        const dropdown = document.getElementById(`${panelId}-lock-dropdown`);
                        const indicator = document.getElementById(`${panelId}-lock-indicator`);
                        dropdown.value = savedPanel.lockTarget;
                        const targetLabel = getPanelLabel(savedPanel.lockTarget);
                        indicator.textContent = `→ ${targetLabel}`;
                        indicator.classList.add('active');
                    }
                });

                // Recreate noise panels if they exist
                const allNoisePanelIds = new Set();
                config.keyframes.forEach(kf => {
                    Object.keys(kf.noisePanels || {}).forEach(panelId => allNoisePanelIds.add(panelId));
                });

                Array.from(allNoisePanelIds).forEach(panelId => {
                    // Extract panel number and update counter
                    const panelNumber = parseInt(panelId.split('-')[1]);
                    if (panelNumber > noisePanelCounter) {
                        noisePanelCounter = panelNumber;
                    }

                    // Create panel
                    const panel = document.createElement('div');
                    panel.className = 'noise-panel';
                    panel.id = panelId;
                    panel.innerHTML = createNoisePanelHTML(panelId);

                    document.getElementById('frequency-panels').appendChild(panel);

                    // Create generator
                    noiseGenerators[panelId] = new NoiseGenerator(panelId);

                    // Add click handler
                    panel.addEventListener('click', () => setActivePanel(panelId));
                });

                // Restore noise panel counters from config
                if (config.noisePanelCounter !== undefined) {
                    noisePanelCounter = config.noisePanelCounter;
                }

                // Initial keyframe will be created by timeline.js
                // initializeKeyframes(); // Moved to timeline.js
            }

            // Set first panel as active
            const firstPanelId = Object.keys(generators).sort((a, b) => {
                const aNum = parseInt(a.split('-')[1]);
                const bNum = parseInt(b.split('-')[1]);
                return aNum - bNum;
            })[0];

            if (firstPanelId) {
                setActivePanel(firstPanelId);
            }
        }

        function deleteConfiguration(configName) {
            if (!confirm(`Are you sure you want to delete "${configName}"?`)) {
                return;
            }

            savedConfigurations = savedConfigurations.filter(c => c.name !== configName);
            localStorage.setItem('frequencyConfigurations', JSON.stringify(savedConfigurations));
            displaySavedConfigurations();
        }

        function displaySavedConfigurations() {
            const configList = document.getElementById('configList');

            let html = '';

            // Pre-built configurations section
            html += '<div class="config-section-header">📚 Pre-built Meditation Sequences</div>';
            html += prebuiltConfigurations.map(config => {
                const panelCount = Math.max(...config.keyframes.map(kf => Object.keys(kf.panels || {}).length));
                const keyframeCount = config.keyframes.length;
                const totalDuration = config.keyframes.reduce((sum, kf) => sum + kf.length, 0);
                const hasVisual = config.keyframes.some(kf => kf.screenPanel?.enabled) ? '• Visual enabled' : '';

                return `
                    <div class="config-item predefined-config">
                        <div class="config-info">
                            <div class="config-name">
                                <span class="predefined-label">BUILT-IN</span>
                                ${config.name}
                            </div>
                            <div class="config-details">
                                ${config.description}<br>
                                ${panelCount} panels • ${keyframeCount} keyframes (${totalDuration}s) ${hasVisual}
                            </div>
                        </div>
                        <div class="config-actions">
                            <button class="load-config-btn" onclick="loadPrebuiltConfiguration('${config.name}')">Load</button>
                        </div>
                    </div>
                `;
            }).join('');

            // User-saved configurations section
            if (savedConfigurations.length > 0) {
                html += '<div class="config-section-header">💾 Your Saved Configurations</div>';
                html += savedConfigurations.map(config => {
                    const panelCount = Object.keys(config.panels).length;
                    const date = new Date(config.timestamp).toLocaleDateString();
                    const lockedCount = Object.values(config.panels).filter(p => p.lockTarget).length;
                    const keyframeCount = config.keyframes ? config.keyframes.length : 1;
                    const totalDuration = config.keyframes ? config.keyframes.reduce((sum, kf) => sum + kf.length, 0) : 10;
                    const hasVisual = config.keyframes?.some(kf => kf.screenPanel?.enabled) ? '• Visual enabled' : '';

                    return `
                        <div class="config-item">
                            <div class="config-info">
                                <div class="config-name">${config.name}</div>
                                <div class="config-details">
                                    ${panelCount} panels • ${lockedCount} locked • ${keyframeCount} keyframes (${totalDuration}s) ${hasVisual} • Saved ${date}
                                </div>
                            </div>
                            <div class="config-actions">
                                <button class="load-config-btn" onclick="loadConfiguration('${config.name}')">Load</button>
                                <button class="delete-config-btn" onclick="deleteConfiguration('${config.name}')">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                html += '<div class="config-section-header">💾 Your Saved Configurations</div>';
                html += '<p style="text-align: center; color: #666; padding: 20px;">No saved configurations yet</p>';
            }

            configList.innerHTML = html;
        }

        function togglePlay(panelId) {
            const generator = generators[panelId];
            const playBtn = document.getElementById(`${panelId}-play`);

            if (generator.isPlaying) {
                generator.stop();
                playBtn.textContent = 'Play';
                playBtn.classList.remove('playing');
            } else {
                generator.start();
                playBtn.textContent = 'Stop';
                playBtn.classList.add('playing');
            }
        }

        function removePanel(panelId) {
            if (generators[panelId]) {
                generators[panelId].stop();
                delete generators[panelId];
            }
            document.getElementById(panelId).remove();

            // Unlock all panels that were locked to the removed panel
            Object.keys(generators).forEach(remainingPanelId => {
                const generator = generators[remainingPanelId];
                if (generator.lockTarget === panelId) {
                    generator.lockTarget = null;
                    generator.frequencyOffset = 0;

                    // Update UI
                    const dropdown = document.getElementById(`${remainingPanelId}-lock-dropdown`);
                    const indicator = document.getElementById(`${remainingPanelId}-lock-indicator`);
                    if (dropdown) dropdown.value = '';
                    if (indicator) indicator.classList.remove('active');
                }
            });

            // Update all lock dropdowns to remove the deleted panel option
            updateLockDropdowns();

            // If this was the active panel, clear active panel or set to another one
            if (activePanelId === panelId) {
                activePanelId = null;
                const remainingPanels = Object.keys(generators);
                if (remainingPanels.length > 0) {
                    setActivePanel(remainingPanels[0]);
                }
            }
        }

        function stopAll() {
            Object.keys(generators).forEach(panelId => {
                if (generators[panelId].isPlaying) {
                    togglePlay(panelId);
                }
            });

            Object.keys(noiseGenerators).forEach(panelId => {
                if (noiseGenerators[panelId].isPlaying) {
                    toggleNoisePlay(panelId);
                }
            });

            // Exit fullscreen if active
            if (isFullscreen) {
                exitFullscreen();
            }
        }

        function playAll() {
            Object.keys(generators).forEach(panelId => {
                if (!generators[panelId].isPlaying) {
                    togglePlay(panelId);
                }
            });

            Object.keys(noiseGenerators).forEach(panelId => {
                if (!noiseGenerators[panelId].isPlaying) {
                    toggleNoisePlay(panelId);
                }
            });

            // Enter fullscreen if current keyframe has screen enabled
            const currentScreenSettings = keyframes[currentKeyframeIndex]?.screenPanel;
            if (currentScreenSettings?.enabled) {
                enterFullscreen();
            }
        }

        function openFavoriteModal(panelId) {
            currentFavoriteFreq = generators[panelId].frequency;
            document.getElementById('favoriteName').value = '';
            document.getElementById('favoriteModal').style.display = 'block';
        }

        function closeFavoriteModal() {
            document.getElementById('favoriteModal').style.display = 'none';
        }

        function saveFavorite() {
            const name = document.getElementById('favoriteName').value.trim();
            const displayName = name || `${currentFavoriteFreq} Hz`;

            const favorite = {
                name: displayName,
                frequency: currentFavoriteFreq
            };

            // Check if frequency already exists
            const existingIndex = favorites.findIndex(f => f.frequency === currentFavoriteFreq);
            if (existingIndex >= 0) {
                favorites[existingIndex] = favorite;
            } else {
                favorites.push(favorite);
            }

            favorites.sort((a, b) => a.frequency - b.frequency);
            localStorage.setItem('frequencies', JSON.stringify(favorites));

            // Update all dropdowns
            Object.keys(generators).forEach(panelId => {
                updateFavoritesDropdown(panelId);
            });

            closeFavoriteModal();
        }

        function updateFavoritesDropdown(panelId) {
            const dropdown = document.getElementById(`${panelId}-favorites`);
            dropdown.innerHTML = '<option value="">Select favorite...</option>';

            favorites.forEach(fav => {
                const option = document.createElement('option');
                option.value = fav.frequency;
                option.textContent = fav.name;
                dropdown.appendChild(option);
            });
        }

        function loadFavorite(panelId, frequency) {
            if (frequency) {
                updateFrequency(panelId, parseFloat(frequency));
                // Reset dropdown selection
                document.getElementById(`${panelId}-favorites`).value = '';
            }
        }

        function setActivePanel(panelId) {
            // Remove active class from all panels
            document.querySelectorAll('.frequency-panel').forEach(panel => {
                panel.classList.remove('active');
            });

            // Add active class to selected panel
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.add('active');
                activePanelId = panelId;
            }
        }

        // Handle clicking outside modal
        window.onclick = function(event) {
            const favoriteModal = document.getElementById('favoriteModal');
            const saveModal = document.getElementById('saveModal');
            const loadModal = document.getElementById('loadModal');

            if (event.target === favoriteModal) {
                closeFavoriteModal();
            } else if (event.target === saveModal) {
                closeSaveModal();
            } else if (event.target === loadModal) {
                closeLoadModal();
            }
        };

        // Handle keyboard input for frequency adjustment
        document.addEventListener('keydown', function(event) {
            if (!activePanelId || !generators[activePanelId]) return;

            // Prevent default behavior for arrow keys to avoid page scrolling
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();

                const delta = event.key === 'ArrowUp' ? 1 : -1;
                adjustFrequency(activePanelId, delta);
            }
        });

        // Testing functions for debugging animations
        function createAnimationTest() {
            console.log("🧪 Creating animation test setup...");

            // Clear existing setup
            stopTimeline();
            keyframes = [];

            // Create test panels if they don't exist
            if (!generators['panel-1']) {
                addFrequencyPanel();
            }

            // Create simple test keyframes
            const testKey0 = {
                title: "TestKey0",
                description: "Start: 440Hz, Vol 0.1",
                length: 3, // 3 seconds
                guideText: "Test keyframe 0",
                screenPanel: { enabled: false, color: "#ffffff", rate: 10 },
                panels: {
                    "panel-1": {
                        frequency: 440,
                        waveType: "sine",
                        volume: 0.1,
                        pan: -0.5,
                        isIsochronic: false,
                        isochronicRate: 10,
                        animate: false,  // Key0 can't have animate (no previous frame)
                        fade: false,
                        fadeDuration: 3,
                        lockTarget: null,
                        frequencyOffset: 0
                    }
                }
            };

            const testKey1 = {
                title: "TestKey1",
                description: "End: 880Hz, Vol 0.9",
                length: 2, // 2 seconds
                guideText: "Test keyframe 1",
                screenPanel: { enabled: false, color: "#ffffff", rate: 10 },
                panels: {
                    "panel-1": {
                        frequency: 880,
                        waveType: "sine",
                        volume: 0.9,
                        pan: 0.5,
                        isIsochronic: false,
                        isochronicRate: 10,
                        animate: true,  // CORRECT: Key1 has animate enabled
                        fade: false,
                        fadeDuration: 3,
                        lockTarget: null,
                        frequencyOffset: 0
                    }
                }
            };

            keyframes = [testKey0, testKey1];
            currentKeyframeIndex = 0;

            // Update UI
            updateKeyframeTabs();
            updateKeyframeDetails();
            updateTimelineInfo();

            console.log("✅ Test setup complete:");
            console.log("- Key0: 440Hz → 880Hz (animate ON, 3s)");
            console.log("- Key1: 880Hz (animate OFF, 2s)");
            console.log("- Expected: During 3s of Key0, freq should go 440→880, vol 0.1→0.9, pan -0.5→0.5");
        }

        function startAnimationTest() {
            console.log("🚀 Starting animation test...");

            // Show initial keyframe values
            console.log("📊 Initial keyframe values:");
            console.log(`Key0: ${JSON.stringify(keyframes[0].panels['panel-1'])}`);
            console.log(`Key1: ${JSON.stringify(keyframes[1].panels['panel-1'])}`);

            // Load initial state and show generator values
            loadKeyframeState(keyframes[0]);
            const gen = generators['panel-1'];
            console.log(`🎛️  Generator initial: Freq=${gen.frequency}Hz, Vol=${(gen.volume*100).toFixed(0)}%, Pan=${gen.pan.toFixed(2)}`);

            // Start timeline
            playTimeline();

            // Start monitoring
            let testStartTime = Date.now();
            let lastLogTime = -1;

            window.testMonitorInterval = setInterval(() => {
                const elapsed = (Date.now() - testStartTime) / 1000;

                // Log every 0.5 seconds
                if (elapsed - lastLogTime >= 0.5) {
                    lastLogTime = Math.floor(elapsed * 2) / 2; // Round to nearest 0.5s

                    const gen = generators['panel-1'];
                    if (gen) {
                        console.log(`⏱️  ${elapsed.toFixed(1)}s - Freq: ${gen.frequency.toFixed(1)}Hz, Vol: ${(gen.volume * 100).toFixed(0)}%, Pan: ${gen.pan.toFixed(2)}`);

                        // Check if values are changing during animation period
                        if (elapsed > 0.5 && elapsed < 2.5) {
                            if (Math.abs(gen.frequency - 440) < 20) {
                                console.log("⚠️  Frequency not animating! Still near 440Hz");
                            }
                            if (Math.abs(gen.volume - 0.1) < 0.1) {
                                console.log("⚠️  Volume not animating! Still near 10%");
                            }
                            if (Math.abs(gen.pan - (-0.5)) < 0.1) {
                                console.log("⚠️  Pan not animating! Still near -0.5");
                            }
                        }
                    }
                }

                // Stop test after 6 seconds and check for corruption
                if (elapsed > 6) {
                    clearInterval(window.testMonitorInterval);
                    stopTimeline();

                    // Check if keyframe data got corrupted
                    setTimeout(() => {
                        console.log("🔍 Checking for state corruption after timeline stop...");
                        console.log(`Key0 after: ${JSON.stringify(keyframes[0].panels['panel-1'])}`);
                        console.log(`Key1 after: ${JSON.stringify(keyframes[1].panels['panel-1'])}`);

                        const key0Panel = keyframes[0].panels['panel-1'];
                        if (Math.abs(key0Panel.frequency - 440) > 1) {
                            console.log(`💥 CORRUPTION DETECTED! Key0 frequency changed from 440 to ${key0Panel.frequency}`);
                        }
                        if (Math.abs(key0Panel.volume - 0.1) > 0.01) {
                            console.log(`💥 CORRUPTION DETECTED! Key0 volume changed from 0.1 to ${key0Panel.volume}`);
                        }
                    }, 500);

                    console.log("🏁 Animation test complete");
                }
            }, 100);
        }

        function testAnimationSystem() {
            console.log("🔧 Testing animation system...");

            // Test individual animation function
            if (generators['panel-1']) {
                console.log("Testing individual animateFrequencyChange...");
                animateFrequencyChange('panel-1', 440, 880, 2);

                setTimeout(() => {
                    const freq = generators['panel-1'].frequency;
                    console.log(`After 1s: ${freq.toFixed(1)}Hz (should be ~660Hz)`);
                }, 1000);

                setTimeout(() => {
                    const freq = generators['panel-1'].frequency;
                    console.log(`After 2s: ${freq.toFixed(1)}Hz (should be ~880Hz)`);
                }, 2000);
            }
        }

        // Initialize with one panel (keyframe system initialized in timeline.js)
        addFrequencyPanel();

        // Add test functions to window for console access
        window.createAnimationTest = createAnimationTest;
        window.startAnimationTest = startAnimationTest;
        window.testAnimationSystem = testAnimationSystem;

        console.log("🧪 Animation test functions available:");
        console.log("- createAnimationTest() - Sets up simple test keyframes");
        console.log("- startAnimationTest() - Runs the test and logs progress");
        console.log("- testAnimationSystem() - Tests individual animation functions");

        // Handle page reload/close
        window.addEventListener('beforeunload', () => {
            stopAll();
        });