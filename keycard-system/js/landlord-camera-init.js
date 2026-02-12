/**
 * Landlord Dashboard Camera Initialization
 * Displays live camera feed for monitoring
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('[LANDLORD-CAMERA] Initializing camera stream');
    
    const cameraSection = document.getElementById('live-camera-section');
    const tenantSelect = document.getElementById('tenantSelect');
    const connectCameraBtn = document.getElementById('connectCameraBtn');
    const disconnectCameraBtn = document.getElementById('disconnectCameraBtn');
    const cameraFeedContainer = document.getElementById('cameraFeedContainer');
    const noCameraMessage = document.getElementById('noCameraMessage');
    const cameraStream = document.getElementById('cameraStream');
    const selectedTenantName = document.getElementById('selectedTenantName');
    const selectedTenantUnit = document.getElementById('selectedTenantUnit');

    if (!connectCameraBtn || !cameraStream) {
        console.warn('[LANDLORD-CAMERA] Camera elements not found');
        return;
    }

    // Load tenants into dropdown (simulated - replace with actual tenant data)
    function loadTenants() {
        // This would be populated from your Firebase or tenant list
        const tenants = [
            { id: '1', name: 'John Doe', unit: 'Apartment 101' },
            { id: '2', name: 'Jane Smith', unit: 'Apartment 102' },
            { id: '3', name: 'Mike Johnson', unit: 'Apartment 103' }
        ];

        tenants.forEach(tenant => {
            const option = document.createElement('option');
            option.value = tenant.id;
            option.textContent = `${tenant.name} (${tenant.unit})`;
            option.dataset.name = tenant.name;
            option.dataset.unit = tenant.unit;
            tenantSelect.appendChild(option);
        });
    }

    // Enable connect button when tenant is selected
    tenantSelect.addEventListener('change', function() {
        connectCameraBtn.disabled = this.value === '';
        if (this.value !== '') {
            const selected = this.options[this.selectedIndex];
            selectedTenantName.textContent = selected.dataset.name;
            selectedTenantUnit.textContent = selected.dataset.unit;
        }
    });

    /**
     * Connect to camera stream
     */
    connectCameraBtn.addEventListener('click', function() {
        const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
        const cameraUrl = CAMERA_CONFIG.getStreamUrl();
        
        console.log('[LANDLORD-CAMERA] Connecting to camera:', cameraUrl);
        console.log('[LANDLORD-CAMERA] Selected tenant:', selectedOption.dataset.name);
        
        // Show camera feed
        cameraFeedContainer.style.display = 'block';
        noCameraMessage.style.display = 'none';
        connectCameraBtn.disabled = true;
        
        // Initialize stream
        cameraStreamHandler.initializeStream(
            cameraUrl,
            'cameraStream',
            () => {
                console.log('[LANDLORD-CAMERA] Connected successfully');
                connectCameraBtn.style.display = 'none';
                disconnectCameraBtn.style.display = 'inline-block';
            },
            (error) => {
                console.error('[LANDLORD-CAMERA] Connection error:', error);
                cameraFeedContainer.style.display = 'none';
                noCameraMessage.style.display = 'block';
                noCameraMessage.innerHTML = `
                    <p>❌ Camera Connection Failed</p>
                    <p style="font-size: 12px; margin-top: 10px;">
                        Error: ${error}<br>
                        Camera IP: ${CAMERA_CONFIG.camera_ip}<br>
                        Tenant: ${selectedOption.dataset.name}
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
        console.log('[LANDLORD-CAMERA] Disconnecting from camera');
        cameraStreamHandler.stopStream('cameraStream');
        cameraFeedContainer.style.display = 'none';
        noCameraMessage.style.display = 'block';
        connectCameraBtn.disabled = true;
        connectCameraBtn.style.display = 'inline-block';
        disconnectCameraBtn.style.display = 'none';
    });

    // Initial state
    disconnectCameraBtn.style.display = 'none';
    connectCameraBtn.disabled = true;
    noCameraMessage.style.display = 'block';
    cameraFeedContainer.style.display = 'none';

    // Load tenant list
    loadTenants();

    console.log('[LANDLORD-CAMERA] Camera initialized - Ready for connection');
});
