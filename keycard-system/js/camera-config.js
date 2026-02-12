/**
 * Camera Configuration
 * Update this with your ESP32-CAM IP address
 */

// IMPORTANT: Replace with your ESP32-CAM IP address found in Serial Monitor
// Example: "192.168.1.100" or "192.168.1.100:81"
const CAMERA_CONFIG = {
    // Using mDNS hostname for automatic IP resolution
    // No need to find IP address - works on any network!
    // This hostname is set in esp32-camera.ino (mdnsName = "esp32cam")
    camera_hostname: "esp32cam.local",
    
    // Stream endpoint (MJPEG continuous stream)
    stream_endpoint: "/stream",
    
    // Capture endpoint (single JPEG snapshot)
    capture_endpoint: "/capture",
    
    // Status endpoint (camera info as JSON)
    status_endpoint: "/status",
    
    // Control port (default 80 for ESP32-CAM)
    port: 80,
    
    // Get the full camera stream URL
    getStreamUrl() {
        return `http://${this.camera_hostname}:${this.port}${this.stream_endpoint}`;
    },
    
    // Get single capture URL
    getCaptureUrl() {
        return `http://${this.camera_hostname}:${this.port}${this.capture_endpoint}`;
    },
    
    // Get camera status JSON URL
    getStatusUrl() {
        return `http://${this.camera_hostname}:${this.port}${this.status_endpoint}`;
    }
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CAMERA_CONFIG;
}
