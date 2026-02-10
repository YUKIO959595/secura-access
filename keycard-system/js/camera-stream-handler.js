/**
 * ESP32-CAM Live Stream Handler
 * Manages camera connections, stream display, and error handling
 */

class CameraStreamHandler {
    constructor() {
        this.cameraStream = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.isConnected = false;
    }

    /**
     * Initialize camera feed with direct MJPEG stream
     * @param {string} cameraUrl - Full URL to camera stream
     * @param {string} imageElementId - ID of img element to display stream
     * @param {function} onConnected - Callback when connected
     * @param {function} onError - Callback on error
     */
    initializeStream(cameraUrl, imageElementId, onConnected = null, onError = null) {
        const imageElement = document.getElementById(imageElementId);
        
        if (!imageElement) {
            console.error(`[CAMERA] Image element with ID "${imageElementId}" not found`);
            if (onError) onError('Image element not found');
            return;
        }

        console.log(`[CAMERA] Initializing stream: ${cameraUrl}`);

        // Set the image source to the MJPEG stream
        imageElement.src = cameraUrl;
        imageElement.onerror = () => this.handleStreamError(cameraUrl, imageElementId, onError);
        imageElement.onload = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateStatus('Connected', 'connected', onConnected);
            console.log('[CAMERA] Stream connected successfully');
        };

        // Set timeout to check if stream is loading
        setTimeout(() => {
            if (!this.isConnected) {
                this.updateStatus('Loading...', 'connecting');
            }
        }, 1000);
    }

    /**
     * Handle stream errors and attempt reconnection
     */
    handleStreamError(cameraUrl, imageElementId, onError = null) {
        this.isConnected = false;
        console.warn(`[CAMERA] Stream error - Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.updateStatus(`Reconnecting... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`, 'error');
            this.reconnectAttempts++;
            
            setTimeout(() => {
                const imageElement = document.getElementById(imageElementId);
                if (imageElement) {
                    // Force reload by adding timestamp
                    imageElement.src = cameraUrl + '?t=' + Date.now();
                }
            }, this.reconnectDelay);
        } else {
            this.updateStatus('Connection Failed - Camera Offline', 'error', onError);
            if (onError) onError('Failed to connect to camera after multiple attempts');
        }
    }

    /**
     * Update camera status display
     */
    updateStatus(message, status = 'disconnected', callback = null) {
        const statusElement = document.getElementById('cameraStatus');
        const connectionElement = document.getElementById('connectionStatus');
        const lastUpdateElement = document.getElementById('lastUpdate');

        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-${status}`;
        }

        if (connectionElement) {
            connectionElement.textContent = message;
            connectionElement.className = `status-indicator status-${status}`;
        }

        if (lastUpdateElement) {
            lastUpdateElement.textContent = new Date().toLocaleTimeString();
        }

        if (callback) callback();
    }

    /**
     * Stop the stream
     */
    stopStream(imageElementId) {
        const imageElement = document.getElementById(imageElementId);
        if (imageElement) {
            imageElement.src = '';
        }
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.updateStatus('Disconnected', 'disconnected');
        console.log('[CAMERA] Stream stopped');
    }

    /**
     * Capture a single frame (snapshot)
     */
    async captureFrame(cameraUrl) {
        try {
            const response = await fetch(cameraUrl.replace('/stream', '/capture'));
            if (!response.ok) throw new Error('Failed to capture');
            
            const blob = await response.blob();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `camera-capture-${timestamp}.jpg`;
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log('[CAMERA] Frame captured:', filename);
            return true;
        } catch (error) {
            console.error('[CAMERA] Capture failed:', error);
            return false;
        }
    }

    /**
     * Get camera health status
     */
    async checkCameraHealth(cameraUrl) {
        try {
            const response = await fetch(cameraUrl.replace('/stream', '/capture'), { 
                method: 'HEAD',
                timeout: 5000 
            });
            return response.ok;
        } catch (error) {
            console.error('[CAMERA] Health check failed:', error);
            return false;
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraStreamHandler;
}

// Create global instance for convenience
const cameraStreamHandler = new CameraStreamHandler();
