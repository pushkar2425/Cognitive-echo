// Cognitive Echo Application
class CognitiveEcho {
    constructor() {
        this.currentScreen = 'welcome-screen';
        this.mediaStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.devices = { cameras: [], microphones: [] };
        this.selectedDevices = { camera: null, microphone: null };
        this.settings = {
            audioEnabled: true,
            videoEnabled: true,
            autoStart: false,
            sensitivity: 0.7,
            volume: 0.8
        };
        this.isListening = false;
        this.currentScenarioIndex = 0;
        this.processingTimeout = null;
        
        // Demo data
        this.demoScenarios = [
            {
                id: 1,
                fragmentedInput: "I... went... for a... you know... the green place...",
                predictions: ["park", "garden", "forest", "field"],
                visualAid: { emoji: "🌳", label: "Park" },
                completedSentence: "I went for a walk in the park",
                confidence: 0.85,
                processingTime: 1200
            },
            {
                id: 2,
                fragmentedInput: "with my... uh... furry... four legs...",
                predictions: ["dog", "cat", "pet", "animal"],
                visualAid: { emoji: "🐕", label: "Dog" },
                completedSentence: "with my dog",
                confidence: 0.92,
                processingTime: 800
            },
            {
                id: 3,
                fragmentedInput: "Need to... the white... for teeth...",
                predictions: ["toothbrush", "dentist", "toothpaste", "dental"],
                visualAid: { emoji: "🪥", label: "Toothbrush" },
                completedSentence: "Need to brush my teeth",
                confidence: 0.78,
                processingTime: 1500
            },
            {
                id: 4,
                fragmentedInput: "Want some... cold... from the...",
                predictions: ["water", "juice", "milk", "drink"],
                visualAid: { emoji: "🥛", label: "Glass of water" },
                completedSentence: "Want some cold water from the fridge",
                confidence: 0.88,
                processingTime: 900
            }
        ];

        this.tips = [
            "Speak clearly and at a natural pace",
            "Look at the camera for better gesture recognition", 
            "Use the visual aids to help complete your thoughts",
            "Don't worry about making mistakes - the AI learns from them"
        ];

        this.init();
    }

    init() {
        console.log('Initializing Cognitive Echo...');
        this.setupEventListeners();
        this.populateTips();
        this.showScreen('welcome-screen');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Welcome screen
        const startDemoBtn = document.getElementById('start-demo-btn');
        if (startDemoBtn) {
            startDemoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Start Demo button clicked');
                this.showScreen('permission-screen');
            });
        } else {
            console.error('start-demo-btn not found');
        }

        // Permission screen
        const requestPermissionsBtn = document.getElementById('request-permissions-btn');
        if (requestPermissionsBtn) {
            requestPermissionsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.requestPermissions();
            });
        }

        const demoModeBtn = document.getElementById('demo-mode-btn');
        if (demoModeBtn) {
            demoModeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.enterDemoMode();
            });
        }

        const retryPermissionsBtn = document.getElementById('retry-permissions-btn');
        if (retryPermissionsBtn) {
            retryPermissionsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.retryPermissions();
            });
        }

        // Device screen
        const cameraSelect = document.getElementById('camera-select');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => {
                this.selectedDevices.camera = e.target.value;
                this.updatePreview();
            });
        }

        const microphoneSelect = document.getElementById('microphone-select');
        if (microphoneSelect) {
            microphoneSelect.addEventListener('change', (e) => {
                this.selectedDevices.microphone = e.target.value;
                this.updatePreview();
            });
        }

        const confirmDevicesBtn = document.getElementById('confirm-devices-btn');
        if (confirmDevicesBtn) {
            confirmDevicesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.confirmDevices();
            });
        }

        const backToPermissionsBtn = document.getElementById('back-to-permissions-btn');
        if (backToPermissionsBtn) {
            backToPermissionsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showScreen('permission-screen');
            });
        }

        // Success screen
        const toggleVideoBtn = document.getElementById('toggle-video-btn');
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePreviewVideo(e.target);
            });
        }

        const toggleAudioBtn = document.getElementById('toggle-audio-btn');
        if (toggleAudioBtn) {
            toggleAudioBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePreviewAudio(e.target);
            });
        }

        const enterAppBtn = document.getElementById('enter-app-btn');
        if (enterAppBtn) {
            enterAppBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.enterMainApp();
            });
        }

        // Main app
        const listenBtn = document.getElementById('listen-btn');
        if (listenBtn) {
            listenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleListening();
            });
        }

        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.resetSession();
            });
        }

        const toggleMainVideo = document.getElementById('toggle-main-video');
        if (toggleMainVideo) {
            toggleMainVideo.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMainVideo(e.target);
            });
        }

        const toggleMainAudio = document.getElementById('toggle-main-audio');
        if (toggleMainAudio) {
            toggleMainAudio.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMainAudio(e.target);
            });
        }

        const nextScenario = document.getElementById('next-scenario');
        if (nextScenario) {
            nextScenario.addEventListener('click', (e) => {
                e.preventDefault();
                this.nextScenario();
            });
        }

        // Settings
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openSettings();
            });
        }

        const closeSettings = document.getElementById('close-settings');
        if (closeSettings) {
            closeSettings.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeSettings();
            });
        }

        const saveSettings = document.getElementById('save-settings');
        if (saveSettings) {
            saveSettings.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveSettings();
            });
        }

        // Exit
        const exitBtn = document.getElementById('exit-btn');
        if (exitBtn) {
            exitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exitDemo();
            });
        }

        // Modal click outside to close
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settings-modal') {
                    this.closeSettings();
                }
            });
        }

        console.log('Event listeners setup complete');
    }

    showScreen(screenId) {
        console.log(`Attempting to show screen: ${screenId}`);
        
        // Get all screens
        const screens = document.querySelectorAll('.screen');
        
        // Hide all screens
        screens.forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen after a small delay to ensure transition
        setTimeout(() => {
            const targetScreen = document.getElementById(screenId);
            if (targetScreen) {
                targetScreen.classList.add('active');
                this.currentScreen = screenId;
                console.log(`Successfully switched to screen: ${screenId}`);
            } else {
                console.error(`Screen not found: ${screenId}`);
            }
        }, 50);
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        if (overlay && text) {
            text.textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    async requestPermissions() {
        console.log('Requesting permissions...');
        this.showLoading('Requesting camera and microphone access...');
        
        try {
            // Update status
            this.updatePermissionStatus('camera', 'requesting');
            this.updatePermissionStatus('microphone', 'requesting');

            // Request permissions
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 },
                audio: { echoCancellation: true, noiseSuppression: true }
            });

            console.log('Permissions granted successfully');
            this.mediaStream = stream;
            
            // Update status
            this.updatePermissionStatus('camera', 'granted');
            this.updatePermissionStatus('microphone', 'granted');

            this.hideLoading();

            // Get available devices
            await this.enumerateDevices();

            // Check if device selection is needed
            if (this.devices.cameras.length > 1 || this.devices.microphones.length > 1) {
                this.showScreen('device-screen');
                this.populateDeviceSelectors();
                this.startPreview();
            } else {
                this.showScreen('success-screen');
                this.startSuccessPreview();
            }

        } catch (error) {
            console.error('Permission request failed:', error);
            this.hideLoading();
            this.handlePermissionError(error);
        }
    }

    handlePermissionError(error) {
        let errorMessage = '';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera/microphone access was denied. Please allow permissions and try again.';
            this.updatePermissionStatus('camera', 'denied');
            this.updatePermissionStatus('microphone', 'denied');
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera or microphone found. Please connect a device and refresh.';
            this.updatePermissionStatus('camera', 'not-found');
            this.updatePermissionStatus('microphone', 'not-found');
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Your browser doesn\'t support camera/microphone access. Please use Chrome, Firefox, or Edge.';
            this.updatePermissionStatus('camera', 'not-supported');
            this.updatePermissionStatus('microphone', 'not-supported');
        } else {
            errorMessage = 'An error occurred accessing your camera/microphone. Please refresh and try again.';
            this.updatePermissionStatus('camera', 'error');
            this.updatePermissionStatus('microphone', 'error');
        }

        this.showPermissionError(errorMessage);
    }

    updatePermissionStatus(device, status) {
        const statusEl = document.getElementById(`${device}-status`);
        if (!statusEl) return;
        
        statusEl.className = 'status';
        
        switch (status) {
            case 'waiting':
                statusEl.classList.add('status--info');
                statusEl.textContent = 'Waiting';
                break;
            case 'requesting':
                statusEl.classList.add('status--warning');
                statusEl.textContent = 'Requesting...';
                break;
            case 'granted':
                statusEl.classList.add('status--success');
                statusEl.textContent = 'Granted';
                break;
            case 'denied':
                statusEl.classList.add('status--error');
                statusEl.textContent = 'Denied';
                break;
            case 'not-found':
                statusEl.classList.add('status--error');
                statusEl.textContent = 'Not Found';
                break;
            case 'not-supported':
                statusEl.classList.add('status--error');
                statusEl.textContent = 'Not Supported';
                break;
            case 'error':
                statusEl.classList.add('status--error');
                statusEl.textContent = 'Error';
                break;
        }
    }

    showPermissionError(message) {
        const errorEl = document.getElementById('permission-error');
        const errorText = errorEl.querySelector('.error-text');
        if (errorEl && errorText) {
            errorText.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    retryPermissions() {
        const errorEl = document.getElementById('permission-error');
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
        this.updatePermissionStatus('camera', 'waiting');
        this.updatePermissionStatus('microphone', 'waiting');
        this.requestPermissions();
    }

    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices.cameras = devices.filter(device => device.kind === 'videoinput');
            this.devices.microphones = devices.filter(device => device.kind === 'audioinput');
            
            console.log('Found devices:', {
                cameras: this.devices.cameras.length,
                microphones: this.devices.microphones.length
            });
        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }

    populateDeviceSelectors() {
        const cameraSelect = document.getElementById('camera-select');
        const microphoneSelect = document.getElementById('microphone-select');

        if (!cameraSelect || !microphoneSelect) return;

        // Clear existing options
        cameraSelect.innerHTML = '<option value="">Select Camera</option>';
        microphoneSelect.innerHTML = '<option value="">Select Microphone</option>';

        // Populate cameras
        this.devices.cameras.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${index + 1}`;
            cameraSelect.appendChild(option);
        });

        // Populate microphones
        this.devices.microphones.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${index + 1}`;
            microphoneSelect.appendChild(option);
        });

        // Select first available devices
        if (this.devices.cameras.length > 0) {
            cameraSelect.value = this.devices.cameras[0].deviceId;
            this.selectedDevices.camera = this.devices.cameras[0].deviceId;
        }
        if (this.devices.microphones.length > 0) {
            microphoneSelect.value = this.devices.microphones[0].deviceId;
            this.selectedDevices.microphone = this.devices.microphones[0].deviceId;
        }
    }

    async startPreview() {
        const video = document.getElementById('preview-video');
        if (this.mediaStream && video) {
            video.srcObject = this.mediaStream;
            this.startAudioLevelIndicator();
        }
    }

    async updatePreview() {
        if (!this.selectedDevices.camera || !this.selectedDevices.microphone) return;

        try {
            // Stop current stream
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }

            // Get new stream with selected devices
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: this.selectedDevices.camera },
                audio: { deviceId: this.selectedDevices.microphone }
            });

            this.startPreview();
        } catch (error) {
            console.error('Error updating preview:', error);
        }
    }

    startAudioLevelIndicator() {
        if (!this.mediaStream) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);

            this.updateAudioBars();
        } catch (error) {
            console.error('Error setting up audio analysis:', error);
        }
    }

    updateAudioBars() {
        if (!this.analyser) return;

        const bars = document.querySelectorAll('.audio-bars .bar');
        if (bars.length === 0) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const animate = () => {
            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
            const level = Math.floor((average / 255) * bars.length);

            bars.forEach((bar, index) => {
                if (index < level) {
                    bar.classList.add('active');
                } else {
                    bar.classList.remove('active');
                }
            });

            if (this.analyser) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }

    confirmDevices() {
        this.showScreen('success-screen');
        this.startSuccessPreview();
    }

    startSuccessPreview() {
        const video = document.getElementById('success-video');
        if (this.mediaStream && video) {
            video.srcObject = this.mediaStream;
        }
    }

    togglePreviewVideo(button) {
        const video = document.getElementById('success-video');
        const videoTrack = this.mediaStream?.getVideoTracks()[0];
        
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            button.classList.toggle('active');
            
            if (video) {
                if (videoTrack.enabled) {
                    video.style.opacity = '1';
                } else {
                    video.style.opacity = '0.3';
                }
            }
        }
    }

    togglePreviewAudio(button) {
        const audioTrack = this.mediaStream?.getAudioTracks()[0];
        
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            button.classList.toggle('active');
        }
    }

    populateTips() {
        const tipsList = document.getElementById('tips-list');
        if (tipsList) {
            tipsList.innerHTML = '';
            this.tips.forEach(tip => {
                const li = document.createElement('li');
                li.textContent = tip;
                tipsList.appendChild(li);
            });
        }
    }

    enterMainApp() {
        this.showScreen('main-screen');
        this.startMainVideo();
        this.setupMainInterface();
    }

    startMainVideo() {
        const video = document.getElementById('main-video');
        if (this.mediaStream && video) {
            video.srcObject = this.mediaStream;
        }
    }

    setupMainInterface() {
        this.displayCurrentScenario();
        this.resetInterface();
    }

    displayCurrentScenario() {
        const scenario = this.demoScenarios[this.currentScenarioIndex];
        const inputEl = document.getElementById('speech-input');
        const predictionsEl = document.getElementById('predictions-container');
        const completedEl = document.getElementById('completed-sentence');

        if (inputEl) {
            inputEl.textContent = "Click 'Start Listening' to begin...";
            inputEl.className = 'speech-text fragmented';
        }
        
        if (predictionsEl) {
            predictionsEl.innerHTML = '';
        }
        
        if (completedEl) {
            completedEl.textContent = 'Your completed sentence will appear here...';
        }
    }

    toggleListening() {
        const button = document.getElementById('listen-btn');
        if (!button) return;
        
        if (!this.isListening) {
            this.startListening();
            button.textContent = 'Stop Listening';
            button.classList.add('btn--secondary');
            button.classList.remove('btn--primary');
        } else {
            this.stopListening();
            button.textContent = 'Start Listening';
            button.classList.add('btn--primary');
            button.classList.remove('btn--secondary');
        }
        
        this.isListening = !this.isListening;
    }

    startListening() {
        console.log('Starting listening simulation...');
        const scenario = this.demoScenarios[this.currentScenarioIndex];
        const inputEl = document.getElementById('speech-input');
        
        if (inputEl) {
            // Simulate fragmented input
            inputEl.textContent = scenario.fragmentedInput;
            inputEl.className = 'speech-text';
        }
        
        // Show processing
        this.showProgress(scenario.processingTime);
        
        // Display predictions after a delay
        setTimeout(() => {
            this.displayPredictions(scenario);
        }, scenario.processingTime * 0.6);
    }

    stopListening() {
        console.log('Stopping listening...');
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }
        this.resetProgress();
    }

    displayPredictions(scenario) {
        const predictionsEl = document.getElementById('predictions-container');
        if (!predictionsEl) return;
        
        predictionsEl.innerHTML = '';

        // Add visual aid prediction first
        const visualCard = document.createElement('div');
        visualCard.className = 'prediction-card';
        visualCard.innerHTML = `
            <span class="prediction-emoji">${scenario.visualAid.emoji}</span>
            <span class="prediction-label">${scenario.visualAid.label}</span>
        `;
        visualCard.addEventListener('click', () => this.selectPrediction(visualCard, scenario));
        predictionsEl.appendChild(visualCard);

        // Add other predictions
        scenario.predictions.slice(0, 3).forEach(prediction => {
            const card = document.createElement('div');
            card.className = 'prediction-card';
            card.innerHTML = `
                <span class="prediction-emoji">💭</span>
                <span class="prediction-label">${prediction}</span>
            `;
            card.addEventListener('click', () => this.selectPrediction(card, scenario));
            predictionsEl.appendChild(card);
        });
    }

    selectPrediction(card, scenario) {
        // Remove previous selections
        document.querySelectorAll('.prediction-card').forEach(c => {
            c.classList.remove('selected');
        });
        
        // Select current card
        card.classList.add('selected');
        
        // Show completed sentence
        setTimeout(() => {
            const completedEl = document.getElementById('completed-sentence');
            if (completedEl) {
                completedEl.textContent = scenario.completedSentence;
            }
            
            // Auto stop listening
            setTimeout(() => {
                if (this.isListening) {
                    this.toggleListening();
                }
            }, 1000);
        }, 500);
    }

    showProgress(duration) {
        const progressFill = document.getElementById('progress-fill');
        if (!progressFill) return;
        
        progressFill.style.width = '0%';
        
        let progress = 0;
        const interval = 50;
        const increment = (interval / duration) * 100;
        
        const updateProgress = () => {
            progress += increment;
            progressFill.style.width = Math.min(progress, 100) + '%';
            
            if (progress < 100 && this.isListening) {
                this.processingTimeout = setTimeout(updateProgress, interval);
            }
        };
        
        updateProgress();
    }

    resetProgress() {
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }
    }

    resetSession() {
        this.stopListening();
        this.resetInterface();
    }

    resetInterface() {
        const inputEl = document.getElementById('speech-input');
        const predictionsEl = document.getElementById('predictions-container');
        const completedEl = document.getElementById('completed-sentence');
        
        if (inputEl) {
            inputEl.textContent = "Click 'Start Listening' to begin...";
            inputEl.className = 'speech-text fragmented';
        }
        if (predictionsEl) {
            predictionsEl.innerHTML = '';
        }
        if (completedEl) {
            completedEl.textContent = 'Your completed sentence will appear here...';
        }
        this.resetProgress();
    }

    nextScenario() {
        this.currentScenarioIndex = (this.currentScenarioIndex + 1) % this.demoScenarios.length;
        this.resetSession();
        console.log(`Switched to scenario ${this.currentScenarioIndex + 1}`);
    }

    toggleMainVideo(button) {
        const video = document.getElementById('main-video');
        const videoTrack = this.mediaStream?.getVideoTracks()[0];
        
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            button.classList.toggle('active');
            
            if (video) {
                if (videoTrack.enabled) {
                    video.style.opacity = '1';
                } else {
                    video.style.opacity = '0.3';
                }
            }
        }
    }

    toggleMainAudio(button) {
        const audioTrack = this.mediaStream?.getAudioTracks()[0];
        
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            button.classList.toggle('active');
        }
    }

    openSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Load current settings
            const audioEnabled = document.getElementById('audio-enabled');
            const videoEnabled = document.getElementById('video-enabled');
            const sensitivitySlider = document.getElementById('sensitivity-slider');
            const volumeSlider = document.getElementById('volume-slider');
            
            if (audioEnabled) audioEnabled.checked = this.settings.audioEnabled;
            if (videoEnabled) videoEnabled.checked = this.settings.videoEnabled;
            if (sensitivitySlider) sensitivitySlider.value = this.settings.sensitivity * 100;
            if (volumeSlider) volumeSlider.value = this.settings.volume * 100;
        }
    }

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    saveSettings() {
        const audioEnabled = document.getElementById('audio-enabled');
        const videoEnabled = document.getElementById('video-enabled');
        const sensitivitySlider = document.getElementById('sensitivity-slider');
        const volumeSlider = document.getElementById('volume-slider');
        
        if (audioEnabled) this.settings.audioEnabled = audioEnabled.checked;
        if (videoEnabled) this.settings.videoEnabled = videoEnabled.checked;
        if (sensitivitySlider) this.settings.sensitivity = sensitivitySlider.value / 100;
        if (volumeSlider) this.settings.volume = volumeSlider.value / 100;
        
        console.log('Settings saved:', this.settings);
        this.closeSettings();
    }

    enterDemoMode() {
        console.log('Entering demo mode without real camera/microphone');
        this.showScreen('main-screen');
        this.setupDemoMode();
    }

    setupDemoMode() {
        // Hide video elements or show placeholder
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            video.style.background = 'var(--color-bg-8)';
            video.style.display = 'flex';
            video.style.alignItems = 'center';
            video.style.justifyContent = 'center';
            
            // Create placeholder content
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'color: var(--color-text-secondary); text-align: center; padding: 20px; font-size: var(--font-size-lg);';
            placeholder.innerHTML = 'Demo Mode<br>Camera Simulation';
            
            // Clear video and add placeholder
            video.innerHTML = '';
            video.appendChild(placeholder);
        });
        
        this.setupMainInterface();
    }

    exitDemo() {
        // Clean up media streams
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.analyser = null;
        }
        
        // Reset state
        this.isListening = false;
        this.currentScenarioIndex = 0;
        
        // Return to welcome screen
        this.showScreen('welcome-screen');
        console.log('Demo exited and resources cleaned up');
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Cognitive Echo...');
    try {
        window.cognitiveEcho = new CognitiveEcho();
    } catch (error) {
        console.error('Failed to initialize Cognitive Echo:', error);
    }
});

// Handle page unload to clean up resources
window.addEventListener('beforeunload', () => {
    if (window.cognitiveEcho) {
        window.cognitiveEcho.exitDemo();
    }
});