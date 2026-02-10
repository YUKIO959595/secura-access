/**
 * Tenant Dashboard Camera Initialization
 * Displays live camera feed for tenant's door entry
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('[TENANT-CAMERA] Initializing camera stream');
    
    const cameraSection = document.getElementById('camera-section');
    const connectCameraBtn = document.getElementById('connectCameraBtn');
    const disconnectCameraBtn = document.getElementById('disconnectCameraBtn');
    const cameraFeedContainer = document.getElementById('cameraFeedContainer');
    const noCameraMessage = document.getElementById('noCameraMessage');
    const cameraStream = document.getElementById('cameraStream');

    if (!connectCameraBtn || !cameraStream) {
        console.warn('[TENANT-CAMERA] Camera elements not found');
        return;
    }

    /**
     * Connect to camera stream
     */
    connectCameraBtn.addEventListener('click', function() {
        const cameraUrl = CAMERA_CONFIG.getStreamUrl();
        
        console.log('[TENANT-CAMERA] Connecting to camera:', cameraUrl);
        
        // Show camera feed
        cameraFeedContainer.style.display = 'block';
        noCameraMessage.style.display = 'none';
        connectCameraBtn.disabled = true;
        
        // Initialize stream
        cameraStreamHandler.initializeStream(
            cameraUrl,
            'cameraStream',
            () => {
                console.log('[TENANT-CAMERA] Connected successfully');
                connectCameraBtn.style.display = 'none';
                disconnectCameraBtn.style.display = 'inline-block';
            },
            (error) => {
                console.error('[TENANT-CAMERA] Connection error:', error);
                cameraFeedContainer.style.display = 'none';
                noCameraMessage.style.display = 'block';
                noCameraMessage.innerHTML = `
                    <p>❌ Camera Connection Failed</p>
                    <p style="font-size: 12px; margin-top: 10px;">
                        Error: ${error}<br>
                        Camera IP: ${CAMERA_CONFIG.camera_ip}
                    </p>
                `;
                connectCameraBtn.disabled = false;
                connectCameraBtn.style.display = 'inline-block';
            }
        );
    });

    /**
     * Disconnect from camera stream
     */
    disconnectCameraBtn.addEventListener('click', function() {
        console.log('[TENANT-CAMERA] Disconnecting from camera');
        cameraStreamHandler.stopStream('cameraStream');
        cameraFeedContainer.style.display = 'none';
        noCameraMessage.style.display = 'block';
        connectCameraBtn.disabled = false;
        connectCameraBtn.style.display = 'inline-block';
        disconnectCameraBtn.style.display = 'none';
    });

    // Initial state
    disconnectCameraBtn.style.display = 'none';
    connectCameraBtn.disabled = false;
    noCameraMessage.style.display = 'block';
    cameraFeedContainer.style.display = 'none';

    console.log('[TENANT-CAMERA] Camera initialized - Ready for connection');
});
