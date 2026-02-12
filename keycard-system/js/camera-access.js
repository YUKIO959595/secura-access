/**
 * Camera Access Module
 * Handles PIN code protection, blur effect, and notifications
 * for live camera feeds
 */

import { realtimeDb, getCurrentUser } from './firebase-config.js';
import { ref, set, push, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

class CameraAccess {
  constructor() {
    this.PIN_CODES = {
      landlord: '2026',
      tenant: '2025'
    };
    this.accessedUnits = new Set(); // Track which units have been accessed
    this.blurLevel = 30; // Blur intensity (0-100)
  }

  /**
   * Validate PIN code
   * @param {string} pin - User entered PIN
   * @param {string} userRole - 'landlord' or 'tenant'
   */
  validatePIN(pin, userRole) {
    const expectedPin = this.PIN_CODES[userRole];
    return pin === expectedPin;
  }

  /**
   * Create PIN code input modal
   * @param {string} userRole - 'landlord' or 'tenant'
   * @param {function} onSuccess - Callback when PIN is correct
   */
  showPINModal(userRole, onSuccess) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content pin-modal">
        <div class="modal-header">
          <h2>Camera Access Verification</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p>Enter your PIN code to access the live camera feed:</p>
          <input type="password" id="pinInput" class="pin-input" placeholder="Enter PIN" maxlength="4">
          <div id="pinError" class="error-message" style="display: none;">Invalid PIN code</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="pinCancel">Cancel</button>
          <button class="btn btn-primary" id="pinSubmit">Unlock</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const pinInput = modal.querySelector('#pinInput');
    const pinSubmit = modal.querySelector('#pinSubmit');
    const pinCancel = modal.querySelector('#pinCancel');
    const pinError = modal.querySelector('#pinError');
    const modalClose = modal.querySelector('.modal-close');

    const handleSubmit = () => {
      const enteredPin = pinInput.value;
      if (this.validatePIN(enteredPin, userRole)) {
        modal.remove();
        onSuccess();
      } else {
        pinError.style.display = 'block';
        pinInput.value = '';
        pinInput.focus();
      }
    };

    const handleCancel = () => {
      modal.remove();
    };

    pinSubmit.addEventListener('click', handleSubmit);
    pinCancel.addEventListener('click', handleCancel);
    modalClose.addEventListener('click', handleCancel);
    
    // Allow Enter key to submit
    pinInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });

    pinInput.focus();
  }

  /**
   * Apply blur effect to camera feed
   * @param {HTMLElement} element - Image or canvas element
   * @param {boolean} shouldBlur - True to blur, false to unblur
   */
  applyBlur(element, shouldBlur) {
    if (shouldBlur) {
      element.style.filter = `blur(${this.blurLevel}px)`;
      element.style.opacity = '0.9';
    } else {
      element.style.filter = 'none';
      element.style.opacity = '1';
    }
  }

  /**
   * Log camera access event to Firebase
   * @param {string} unitNumber - Unit being accessed
   * @param {string} accessedBy - User ID accessing camera
   * @param {string} userRole - 'landlord' or 'tenant'
   */
  async logCameraAccess(unitNumber, accessedBy, userRole) {
    try {
      const logsRef = ref(realtimeDb, 'camera_access_logs');
      const newLogRef = push(logsRef);
      
      await set(newLogRef, {
        unit: unitNumber,
        accessedBy: accessedBy,
        userRole: userRole,
        timestamp: Date.now(),
        type: 'view_access'
      });

      console.log(`Camera access logged for unit ${unitNumber}`);
    } catch (error) {
      console.error('Error logging camera access:', error);
    }
  }

  /**
   * Send notification to tenant that their camera is being viewed
   * Sends both in-app and email notifications
   * @param {string} tenantId - Tenant's user ID
   * @param {string} tenantName - Tenant's name
   * @param {string} tenantEmail - Tenant's email address
   * @param {string} unitNumber - Unit number
   * @param {string} accessedBy - Name of person accessing
   */
  async notifyTenantOfCameraAccess(tenantId, tenantName, tenantEmail, unitNumber, accessedBy) {
    try {
      // 1. Send in-app notification
      const notifRef = ref(realtimeDb, `notifications/${tenantId}`);
      const newNotifRef = push(notifRef);
      
      await set(newNotifRef, {
        type: 'camera_access',
        message: `Your Unit ${unitNumber} camera is being viewed by ${accessedBy}`,
        unit: unitNumber,
        timestamp: Date.now(),
        read: false,
        accessedBy: accessedBy
      });

      console.log(`[NOTIFICATION] In-app alert sent to ${tenantName}`);

      // 2. Send email notification (via Cloud Function)
      if (tenantEmail) {
        await this.sendEmailNotification(
          tenantEmail,
          tenantName,
          unitNumber,
          accessedBy
        );
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Send email notification to tenant
   * Calls Firebase Cloud Function to send email
   * @param {string} tenantEmail - Tenant's email
   * @param {string} tenantName - Tenant's name
   * @param {string} unitNumber - Unit number
   * @param {string} accessedBy - Name of person accessing
   */
  async sendEmailNotification(tenantEmail, tenantName, unitNumber, accessedBy) {
    try {
      // Call Cloud Function to send email
      const response = await fetch('https://us-central1-admin-96f1c.cloudfunctions.net/sendCameraAccessEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: tenantEmail,
          tenantName: tenantName,
          unit: unitNumber,
          accessedBy: accessedBy,
          timestamp: new Date().toLocaleString()
        })
      });

      if (response.ok) {
        console.log(`[EMAIL] Camera access email sent to ${tenantEmail}`);
      } else {
        console.warn(`[EMAIL] Failed to send email to ${tenantEmail}`);
      }
    } catch (error) {
      // Silently fail email - don't break in-app notification
      console.warn('[EMAIL] Could not send email notification:', error.message);
    }
  }

  /**
   * Subscribe to camera access notifications for current user
   * @param {string} userId - Current user's ID
   * @param {function} callback - Called when new notification arrives
   */
  subscribeToNotifications(userId, callback) {
    const notifRef = ref(realtimeDb, `notifications/${userId}`);
    
    onValue(notifRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const notifications = Object.entries(data)
          .map(([key, value]) => ({
            id: key,
            ...value
          }))
          .sort((a, b) => b.timestamp - a.timestamp);
        callback(notifications);
      }
    });
  }

  /**
   * Create notification popup
   * @param {string} message - Notification message
   * @param {string} type - 'info', 'warning', 'success', 'error'
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    `;

    // Add to page
    let container = document.querySelector('.notifications-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'notifications-container';
      document.body.appendChild(container);
    }
    container.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 5000);

    // Manual close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
  }

  /**
   * Create camera feed container with blur
   * @param {string} cameraStreamUrl - URL of camera feed
   * @param {boolean} isBlurred - Whether to start blurred
   */
  createCameraElement(cameraStreamUrl, isBlurred = true) {
    const container = document.createElement('div');
    container.className = 'camera-element-wrapper';
    
    const img = document.createElement('img');
    img.src = cameraStreamUrl;
    img.className = 'camera-stream';
    img.alt = 'Camera Feed';
    
    if (isBlurred) {
      this.applyBlur(img, true);
      img.dataset.blurred = 'true';
    }

    container.appendChild(img);
    return container;
  }
}

export const cameraAccess = new CameraAccess();
