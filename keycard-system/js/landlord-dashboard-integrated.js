import { auth, db, realtimeDb } from './firebase-config.js';
import { rfidRecords } from './rfid-records.js';
import { cameraAccess } from './camera-access.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, getDocs, getDoc, doc, updateDoc, query, orderBy, where, serverTimestamp, limit, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, onValue, off, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ==================== INITIALIZATION ====================

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        console.log('No user logged in, redirecting to home');
        window.location.href = 'index.html';
        return;
    }
    
    const userType = localStorage.getItem('userType');
    if (userType !== 'landlord') {
        console.log('User is not a landlord, redirecting to home');
        window.location.href = 'index.html';
        return;
    }
    
    try {
        console.log('Loading landlord dashboard for user:', user.uid);
        
        // Note: authContainer and dashboardContainer are only used in merged HTML files
        // Individual HTML files don't have these containers
        
        setupEventListeners();
        await loadAllData();
        setupRealtimeListeners();
    } catch (error) {
        console.error('Error loading landlord dashboard:', error);
        console.error('Error stack:', error.stack);
        // Show error on dashboard but don't redirect
    }
});

// Load all data
async function loadAllData() {
    await loadPendingApprovals();
    await loadKeycardRequests();
    await loadAllTenants();
    await loadCameraPermissions();
    await loadTenantsForCameraSelect();
    await loadRFIDAccessLogIntegrated();
    setupRFIDEventListeners();
}

// ==================== EVENT LISTENERS ====================

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            switchSection(section);
        });
    });
    
    // Logout
    document.getElementById('landlordLogout').addEventListener('click', handleLogout);
    
    // Camera controls
    const tenantSelect = document.getElementById('tenantSelect');
    const connectBtn = document.getElementById('connectCameraBtn');
    const disconnectBtn = document.getElementById('disconnectCameraBtn');
    
    if (tenantSelect) {
        tenantSelect.addEventListener('change', () => {
            connectBtn.disabled = !tenantSelect.value;
        });
    }
    
    if (connectBtn) {
        connectBtn.addEventListener('click', connectToCameraIntegrated);
    }
    
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectCamera);
    }
}

// Setup RFID event listeners
function setupRFIDEventListeners() {
    // Setup apartment filter buttons
    setTimeout(() => {
        const apartmentButtons = document.querySelectorAll('.apartment-filter-btn');
        console.log(`[SETUP] Found ${apartmentButtons.length} apartment filter buttons`);
        
        if (apartmentButtons.length > 0) {
            // Set the first button (All Apartments) as active by default
            apartmentButtons.forEach((btn) => {
                if (btn.dataset.apartment === '') {
                    btn.classList.add('active');
                }
            });
            
            // Attach click handlers
            apartmentButtons.forEach((btn) => {
                btn.addEventListener('click', function() {
                    apartmentButtons.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    loadRFIDAccessLogIntegrated();
                });
            });
            console.log('[SETUP] Apartment filter buttons ready');
        }
    }, 100);
    
    // Apply Filters button
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            loadRFIDAccessLogIntegrated();
        });
    }
    
    // Export button
    const exportLogBtn = document.getElementById('exportLogBtn');
    if (exportLogBtn) {
        exportLogBtn.addEventListener('click', exportRFIDAccessLog);
    }
    
    // Clear All Records button
    const clearRFIDBtn = document.getElementById('clearRFIDBtn');
    if (clearRFIDBtn) {
        clearRFIDBtn.addEventListener('click', clearAllRFIDRecords);
    }
}

// Switch section
function switchSection(section) {
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === section) {
            link.classList.add('active');
        }
    });
    
    // Update sections
    document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    const sectionMap = {
        'approvals': 'approvals-section',
        'keycard-requests': 'keycard-requests-section',
        'tenants': 'tenants-section',
        'live-camera': 'live-camera-section',
        'camera-permissions': 'camera-permissions-section',
        'rfid-access-log': 'rfid-access-log-section'
    };
    
    const titleMap = {
        'approvals': 'Pending Approvals',
        'keycard-requests': 'Keycard Requests',
        'tenants': 'All Tenants',
        'live-camera': 'Live Camera Feed',
        'camera-permissions': 'Camera Permissions',
        'rfid-access-log': 'RFID Access Log'
    };
    
    document.getElementById(sectionMap[section]).classList.add('active');
    document.getElementById('dashboardTitle').textContent = titleMap[section];
}

// ==================== PENDING APPROVALS ====================

async function loadPendingApprovals() {
    try {
        const approvalsRef = collection(db, 'profile_change_requests');
        const q = query(approvalsRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        const approvalsList = document.getElementById('pendingApprovalsList');
        if (snapshot.empty) {
            approvalsList.innerHTML = '<p>No pending approvals.</p>';
            return;
        }
        
        approvalsList.innerHTML = '';
        
        for (const approvalDoc of snapshot.docs) {
            const approval = approvalDoc.data();
            const tenantRef = doc(db, 'tenants', approval.tenantId);
            const tenantDoc = await getDoc(tenantRef);
            const tenantData = tenantDoc.data();
            
            const approvalItem = document.createElement('div');
            approvalItem.className = 'approval-item card';
            approvalItem.innerHTML = `
                <h3>${tenantData?.name || 'Unknown Tenant'}</h3>
                <p><strong>Unit:</strong> ${tenantData?.unit || 'N/A'}</p>
                <p><strong>Change Type:</strong> ${approval.changeType}</p>
                <p><strong>Details:</strong> ${JSON.stringify(approval.changes)}</p>
                <p><strong>Requested:</strong> ${new Date(approval.createdAt.toDate()).toLocaleDateString()}</p>
                <div class="approval-actions">
                    <button class="btn btn-success" onclick="approveProfileChange('${approvalDoc.id}', '${approval.tenantId}')">Approve</button>
                    <button class="btn btn-danger" onclick="rejectProfileChange('${approvalDoc.id}')">Reject</button>
                </div>
            `;
            approvalsList.appendChild(approvalItem);
        }
    } catch (error) {
        console.error('Error loading pending approvals:', error);
    }
}

window.approveProfileChange = async function(approvalId, tenantId) {
    try {
        const approvalRef = doc(db, 'profile_change_requests', approvalId);
        const approvalDoc = await getDoc(approvalRef);
        const approval = approvalDoc.data();
        
        const tenantRef = doc(db, 'tenants', tenantId);
        await updateDoc(tenantRef, approval.changes);
        
        await updateDoc(approvalRef, {
            status: 'approved',
            approvedAt: serverTimestamp()
        });
        
        alert('Profile change approved!');
        await loadPendingApprovals();
    } catch (error) {
        alert('Error approving profile change: ' + error.message);
    }
};

window.rejectProfileChange = async function(approvalId) {
    try {
        const approvalRef = doc(db, 'profile_change_requests', approvalId);
        await updateDoc(approvalRef, {
            status: 'rejected',
            rejectedAt: serverTimestamp()
        });
        
        alert('Profile change rejected!');
        await loadPendingApprovals();
    } catch (error) {
        alert('Error rejecting profile change: ' + error.message);
    }
};

// ==================== KEYCARD REQUESTS ====================

async function loadKeycardRequests() {
    try {
        const requestsRef = collection(db, 'keycard_requests');
        const q = query(requestsRef, where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        const requestsList = document.getElementById('keycardRequestsList');
        if (snapshot.empty) {
            requestsList.innerHTML = '<p>No pending keycard requests.</p>';
            return;
        }
        
        requestsList.innerHTML = '';
        
        for (const requestDoc of snapshot.docs) {
            const request = requestDoc.data();
            const tenantRef = doc(db, 'tenants', request.tenantId);
            const tenantDoc = await getDoc(tenantRef);
            const tenantData = tenantDoc.data();
            
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item card';
            requestItem.innerHTML = `
                <h3>${tenantData?.name || 'Unknown Tenant'}</h3>
                <p><strong>Unit:</strong> ${tenantData?.unit || 'N/A'}</p>
                <p><strong>Type:</strong> ${request.type}</p>
                <p><strong>Requested:</strong> ${new Date(request.createdAt.toDate()).toLocaleDateString()}</p>
                <div class="request-actions">
                    <button class="btn btn-success" onclick="approveKeycardRequest('${requestDoc.id}', '${request.tenantId}')">Approve</button>
                    <button class="btn btn-danger" onclick="rejectKeycardRequest('${requestDoc.id}')">Reject</button>
                </div>
            `;
            requestsList.appendChild(requestItem);
        }
    } catch (error) {
        console.error('Error loading keycard requests:', error);
    }
}

window.approveKeycardRequest = async function(requestId, tenantId) {
    try {
        const requestRef = doc(db, 'keycard_requests', requestId);
        
        await updateDoc(requestRef, {
            status: 'approved',
            approvedAt: serverTimestamp()
        });
        
        alert('Keycard request approved!');
        await loadKeycardRequests();
    } catch (error) {
        alert('Error approving keycard request: ' + error.message);
    }
};

window.rejectKeycardRequest = async function(requestId) {
    try {
        const requestRef = doc(db, 'keycard_requests', requestId);
        await updateDoc(requestRef, {
            status: 'rejected',
            rejectedAt: serverTimestamp()
        });
        
        alert('Keycard request rejected!');
        await loadKeycardRequests();
    } catch (error) {
        alert('Error rejecting keycard request: ' + error.message);
    }
};

// ==================== ALL TENANTS ====================

async function loadAllTenants() {
    try {
        const tenantsRef = collection(db, 'tenants');
        const querySnapshot = await getDocs(tenantsRef);
        
        const tenantsList = document.getElementById('tenantsList');
        if (querySnapshot.empty) {
            tenantsList.innerHTML = '<p>No tenants found.</p>';
            return;
        }
        
        tenantsList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const tenant = doc.data();
            const tenantItem = document.createElement('div');
            tenantItem.className = 'tenant-item card';
            tenantItem.innerHTML = `
                <h3>${tenant.name || 'Unknown'}</h3>
                <p><strong>Unit:</strong> ${tenant.unit || 'N/A'}</p>
                <p><strong>Email:</strong> ${tenant.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${tenant.phone || 'N/A'}</p>
                <p><strong>Move-in Date:</strong> ${tenant.moveInDate || 'N/A'}</p>
            `;
            tenantsList.appendChild(tenantItem);
        });
    } catch (error) {
        console.error('Error loading tenants:', error);
    }
}

// ==================== CAMERA PERMISSIONS ====================

async function loadCameraPermissions() {
    try {
        const tenantsRef = collection(db, 'tenants');
        const querySnapshot = await getDocs(tenantsRef);
        
        const permissionsList = document.getElementById('cameraPermissionsList');
        if (querySnapshot.empty) {
            permissionsList.innerHTML = '<p>No tenants found.</p>';
            return;
        }
        
        permissionsList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const tenant = doc.data();
            const permissions = tenant.cameraPermissions || { ownFootage: true, additionalFootage: false };
            
            const permissionItem = document.createElement('div');
            permissionItem.className = 'permission-item card';
            permissionItem.innerHTML = `
                <h3>${tenant.name || 'Unknown Tenant'}</h3>
                <p><strong>Unit:</strong> ${tenant.unit || 'N/A'}</p>
                <div class="permission-toggle">
                    <label>
                        <input type="checkbox" ${permissions.ownFootage ? 'checked' : ''} 
                               onchange="updateCameraPermission('${doc.id}', 'ownFootage', this.checked)">
                        Own Footage Access
                    </label>
                </div>
                <div class="permission-toggle">
                    <label>
                        <input type="checkbox" ${permissions.additionalFootage ? 'checked' : ''} 
                               onchange="updateCameraPermission('${doc.id}', 'additionalFootage', this.checked)">
                        Additional Footage Access
                    </label>
                </div>
            `;
            
            permissionsList.appendChild(permissionItem);
        });
    } catch (error) {
        console.error('Error loading camera permissions:', error);
    }
}

window.updateCameraPermission = async function(tenantId, permissionType, enabled) {
    try {
        const tenantRef = doc(db, 'tenants', tenantId);
        const tenantDoc = await getDoc(tenantRef);
        
        if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            const currentPermissions = tenantData.cameraPermissions || { ownFootage: true, additionalFootage: false };
            
            await updateDoc(tenantRef, {
                cameraPermissions: {
                    ...currentPermissions,
                    [permissionType]: enabled
                }
            });
            
            alert('Camera permission updated successfully!');
        }
    } catch (error) {
        alert('Error updating permission: ' + error.message);
    }
};

// ==================== CAMERA STREAMING ====================

async function loadTenantsForCameraSelect() {
    try {
        const tenantsRef = collection(db, 'tenants');
        const querySnapshot = await getDocs(tenantsRef);
        
        const tenantSelect = document.getElementById('tenantSelect');
        if (!tenantSelect) return;
        
        tenantSelect.innerHTML = '<option value="">-- Select a Tenant --</option>';
        
        querySnapshot.forEach((doc) => {
            const tenant = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${tenant.name || 'Unknown'} (Unit: ${tenant.unit || 'N/A'})`;
            option.dataset.tenantName = tenant.name || 'Unknown';
            option.dataset.tenantUnit = tenant.unit || 'N/A';
            option.dataset.tenantId = doc.id;
            option.dataset.tenantEmail = tenant.email || '';
            option.dataset.cameraUrl = tenant.cameraUrl || `http://192.168.x.x/stream`; // Update with actual camera URL
            tenantSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading tenants for camera select:', error);
    }
}

// Connect to camera feed with PIN protection
window.connectToCameraIntegrated = async function() {
    try {
        const tenantSelect = document.getElementById('tenantSelect');
        const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
        
        if (!selectedOption.value) {
            alert('Please select a tenant first.');
            return;
        }
        
        const tenantId = selectedOption.value;
        const tenantName = selectedOption.dataset.tenantName;
        const tenantUnit = selectedOption.dataset.tenantUnit;
        const tenantEmail = selectedOption.dataset.tenantEmail;
        const cameraUrl = selectedOption.dataset.cameraUrl;
        
        // Show PIN modal
        cameraAccess.showPINModal('landlord', async (success) => {
            if (success) {
                // Log camera access to Firebase
                await cameraAccess.logCameraAccess(
                    tenantUnit,
                    localStorage.getItem('userEmail') || 'Admin',
                    'landlord'
                );
                
                // Notify tenant that camera is being accessed (with email)
                const userEmail = localStorage.getItem('userEmail') || 'Admin';
                await cameraAccess.notifyTenantOfCameraAccess(
                    tenantId,
                    tenantName,
                    tenantEmail,
                    tenantUnit,
                    userEmail
                );
                
                // Show camera feed without blur
                const cameraFeedContainer = document.getElementById('cameraFeedContainer');
                const cameraStream = document.getElementById('cameraStream');
                const selectedTenantName = document.getElementById('selectedTenantName');
                const selectedTenantUnit = document.getElementById('selectedTenantUnit');
                const noCameraMessage = document.getElementById('noCameraMessage');
                
                cameraStream.src = cameraUrl;
                selectedTenantName.textContent = tenantName;
                selectedTenantUnit.textContent = tenantUnit;
                cameraFeedContainer.style.display = 'block';
                noCameraMessage.style.display = 'none';
                
                // Update connection status
                document.getElementById('connectionStatus').textContent = 'Connected';
                document.getElementById('connectionStatus').className = 'status-indicator online';
                document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
                
                showNotification(`Camera access granted for Unit ${tenantUnit}`, 'success');
            } else {
                showNotification('Invalid PIN code', 'error');
            }
        });
    } catch (error) {
        console.error('Error connecting to camera:', error);
        showNotification('Error connecting to camera: ' + error.message, 'error');
    }
};

// Disconnect camera feed
window.disconnectCamera = function() {
    try {
        const cameraFeedContainer = document.getElementById('cameraFeedContainer');
        const cameraStream = document.getElementById('cameraStream');
        const tenantSelect = document.getElementById('tenantSelect');
        
        cameraStream.src = '';
        cameraFeedContainer.style.display = 'none';
        document.getElementById('noCameraMessage').style.display = 'block';
        tenantSelect.value = '';
        document.getElementById('connectCameraBtn').disabled = true;
        
        document.getElementById('connectionStatus').textContent = 'Disconnected';
        document.getElementById('connectionStatus').className = 'status-indicator offline';
        
        showNotification('Camera disconnected', 'info');
    } catch (error) {
        console.error('Error disconnecting camera:', error);
    }
};

// ==================== RFID ACCESS LOG (INTEGRATED) ====================

// Store all RFID records in memory for fast filtering
let allRFIDRecords = [];

async function loadRFIDAccessLogIntegrated() {
    try {
        console.log(`[RFID] Loading RFID records from Firebase...`);
        
        // Load all records once
        if (allRFIDRecords.length === 0) {
            allRFIDRecords = await rfidRecords.getLandlordRecords();
            console.log(`[RFID] Loaded ${allRFIDRecords.length} total records`);
        }
        
        // If no records, show message
        if (allRFIDRecords.length === 0) {
            displayRFIDStatistics({ totalAccess: 0, approved: 0, denied: 0, uniqueTenants: 0, byDirection: { in: 0, out: 0 }, uniqueCards: 0 });
            document.getElementById('rfidAccessLogTable').innerHTML = `
                <div style="padding: 20px; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
                    <p style="color: #856404;"><strong>⚠️ No RFID Records</strong></p>
                </div>
            `;
            return;
        }
        
        // Start with all records
        let filteredRecords = [...allRFIDRecords];
        console.log(`[RFID] Starting with ${filteredRecords.length} records`);
        
        // Filter by apartment only
        const activeApartmentBtn = document.querySelector('.apartment-filter-btn.active');
        const apartmentFilter = activeApartmentBtn ? activeApartmentBtn.dataset.apartment : '';
        
        if (apartmentFilter) {
            const normalizedApartmentName = `Apartment ${apartmentFilter}`;
            filteredRecords = filteredRecords.filter(record => record.name === normalizedApartmentName);
            console.log(`[RFID] Filtered to apartment ${apartmentFilter}: ${filteredRecords.length} records`);
        } else {
            console.log(`[RFID] Showing all apartments: ${filteredRecords.length} records`);
        }
        
        // Display results
        const stats = calculateRFIDStatistics(filteredRecords);
        displayRFIDStatistics(stats);
        displayAccessLogTableIntegrated(filteredRecords);
        
        console.log(`[RFID] Displaying ${filteredRecords.length} records`);
        
    } catch (error) {
        console.error('[RFID ERROR]', error);
        document.getElementById('rfidAccessLogTable').innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

// Setup realtime listeners for RFID data
function setupRealtimeListeners() {
    try {
        // Setup door status listener
        setupDoorStatusListener();
        
        // Subscribe to real-time RFID updates from Realtime Database
        console.log('[RFID] Setting up real-time listeners for RFID data...');
        const scansRef = ref(realtimeDb, 'scans');
        
        onValue(scansRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                console.log(`[RFID REALTIME] Received ${Object.keys(data).length} RFID records`);
                
                // Update records with latest data
                allRFIDRecords = Object.entries(data).map(([key, value], index) => {
                    // Use existing scannedAt timestamp, or create a new one
                    // This ensures each record has a UNIQUE timestamp
                    let timestamp;
                    
                    if (value.scannedAt && typeof value.scannedAt === 'number') {
                        // Use stored scan time
                        timestamp = value.scannedAt;
                    } else {
                        // Assign a unique timestamp: each record gets progressively older
                        // This simulates scanning them at different times
                        // Newest scans first (index 0 = now, index 1 = 5 seconds ago, etc)
                        const secondsAgo = index * 5; // 5 second intervals
                        timestamp = Date.now() - (secondsAgo * 1000);
                    }
                    
                    return {
                        id: key,
                        ...value,
                        timestamp: timestamp, // Unique timestamp for each record
                        scannedAt: timestamp, // Store for next reload
                        allowed: value.allowed === 'true' || value.allowed === true,
                    };
                }).sort((a, b) => b.timestamp - a.timestamp);
                
                console.log(`[RFID REALTIME] Updated to ${allRFIDRecords.length} total records with unique timestamps`);
                // Reload display with new data
                loadRFIDAccessLogIntegrated();
            }
        }, (error) => {
            console.error('[RFID REALTIME ERROR]', error);
        });
        
        // Subscribe to camera access notifications
        const currentUser = localStorage.getItem('userId');
        if (currentUser) {
            cameraAccess.subscribeToNotifications(currentUser, (notification) => {
                console.log('[CAMERA] Notification:', notification);
                showNotification(notification.message, 'info');
            });
        }
    } catch (error) {
        console.error('Error setting up realtime listeners:', error);
    }
}

function calculateRFIDStatistics(logs) {
    const stats = {
        totalAccess: logs.length,
        uniqueTenants: new Set(logs.map(l => l.tenantId || l.tenantName)).size,
        uniqueCards: new Set(logs.map(l => l.uid)).size,
        approved: logs.filter(l => {
            // Handle both boolean true and string "true"
            return l.allowed === true || l.allowed === "true";
        }).length,
        denied: logs.filter(l => {
            // Handle both boolean false and string "false"
            return l.allowed === false || l.allowed === "false";
        }).length,
        byDirection: {
            in: logs.filter(l => l.direction === 'in').length,
            out: logs.filter(l => l.direction === 'out').length
        }
    };
    return stats;
}

function displayRFIDStatistics(stats) {
    const statsDiv = document.getElementById('rfidStatistics');
    if (!statsDiv) return;

    statsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-box">
                <h5>Total Access</h5>
                <p class="stat-value">${stats.totalAccess}</p>
            </div>
            <div class="stat-box">
                <h5>Approved</h5>
                <p class="stat-value" style="color: green;">${stats.approved}</p>
            </div>
            <div class="stat-box">
                <h5>Denied</h5>
                <p class="stat-value" style="color: red;">${stats.denied}</p>
            </div>
            <div class="stat-box">
                <h5>Unique Tenants</h5>
                <p class="stat-value">${stats.uniqueTenants}</p>
            </div>
            <div class="stat-box">
                <h5>Entry / Exit</h5>
                <p class="stat-value">${stats.byDirection.in} / ${stats.byDirection.out}</p>
            </div>
            <div class="stat-box">
                <h5>Unique Cards</h5>
                <p class="stat-value">${stats.uniqueCards}</p>
            </div>
        </div>
    `;
}

function displayAccessLogTableIntegrated(records) {
    const tableContainer = document.getElementById('rfidAccessLogTable');
    
    if (records.length === 0) {
        tableContainer.innerHTML = '<p class="rfid-records-empty">No access records found.</p>';
        return;
    }
    
    let html = `
        <table class="rfid-records-table">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Apartment</th>
                    <th>UID</th>
                    <th>Status</th>
                    <th>Event Type</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    records.forEach(record => {
        const timestamp = rfidRecords.formatTimestamp(record.timestamp);
        // Get apartment number from name or apartment field
        const apartment = record.name || record.apartment || 'Unknown';
        const statusText = (record.allowed === true || record.allowed === 'true') ? 'Access Granted' : 'Access Denied';
        
        // Determine event type - scan opens door, auto-close after
        let eventType = '🔓 OPENED';
        let eventColor = '#2ecc71';
        let eventBg = '#e8f8f5';
        
        if (record.eventType === 'closed') {
            eventType = '🔒 CLOSED';
            eventColor = '#e74c3c';
            eventBg = '#fadbd8';
        }
        
        html += `
            <tr>
                <td>${timestamp}</td>
                <td>${apartment}</td>
                <td>${record.uid || 'N/A'}</td>
                <td>${statusText}</td>
                <td style="color: ${eventColor}; font-weight: bold; background-color: ${eventBg}; padding: 4px 8px; border-radius: 4px;">${eventType}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    tableContainer.innerHTML = html;
}

// ==================== DOOR STATUS & SERVO CONTROL ====================

function setupDoorStatusListener() {
    try {
        console.log('[DOOR] Setting up door status listener...');
        
        // Read from /servo path where your actual servo data is stored
        const servoRef = ref(realtimeDb, 'servo');
        
        onValue(servoRef, (snapshot) => {
            const data = snapshot.val();
            console.log('[DOOR] Raw Firebase servo data:', data);
            
            if (data === null) {
                console.warn('[DOOR] No data at /servo, defaulting to LOCKED');
                updateDoorStatusIcon('LOCKED');
                return;
            }
            
            // Check if there's a status field manually added
            let status = 'LOCKED';
            
            if (data.status !== undefined) {
                // If you manually add a 'status' field, use it
                status = (data.status === true || data.status === 'unlocked' || data.status === 1) ? 'UNLOCKED' : 'LOCKED';
                console.log('[DOOR] Using status field:', status);
            } else if (data.last_triggered !== undefined) {
                // Alternative: Check if servo was recently triggered (within 10 seconds)
                const now = Date.now();
                const lastTriggered = data.last_triggered;
                const timeSinceTriggered = now - lastTriggered;
                
                // If triggered less than 10 seconds ago, door is open
                if (timeSinceTriggered < 10000) {
                    status = 'UNLOCKED';
                    console.log('[DOOR] Door was triggered', timeSinceTriggered, 'ms ago - UNLOCKED');
                } else {
                    status = 'LOCKED';
                    console.log('[DOOR] Door trigger was', timeSinceTriggered, 'ms ago - LOCKED');
                }
            }
            
            updateDoorStatusIcon(status);
            console.log('[DOOR] Door status updated:', status);
        }, (error) => {
            console.warn('[DOOR] Error reading servo data:', error.message);
            updateDoorStatusIcon('LOCKED');
        });
    } catch (error) {
        console.error('[DOOR] Error setting up door status listener:', error);
        updateDoorStatusIcon('LOCKED');
    }
}

function updateDoorStatusIcon(status) {
    const iconEl = document.getElementById('doorStatusIcon');
    const textEl = document.getElementById('doorStatusText');
    
    if (iconEl && textEl) {
        if (status === 'UNLOCKED') {
            iconEl.textContent = '🔓';
            iconEl.style.color = '#2ecc71';
            textEl.textContent = 'UNLOCKED';
            textEl.style.color = '#2ecc71';
        } else {
            iconEl.textContent = '🔒';
            iconEl.style.color = '#e74c3c';
            textEl.textContent = 'LOCKED';
            textEl.style.color = '#e74c3c';
        }
    }
}

async function populateAccessLogTenantFilter(records) {
    const tenantFilter = document.getElementById('accessLogTenant');
    if (!tenantFilter) return;
    
    const uniqueTenants = [...new Set(records
        .map(r => r.tenantName || 'Unknown')
        .filter(name => name !== 'Unknown')
    )];
    
    const currentValue = tenantFilter.value;
    tenantFilter.innerHTML = '<option value="">All Tenants</option>';
    
    uniqueTenants.forEach(tenantName => {
        const option = document.createElement('option');
        option.value = tenantName;
        option.textContent = tenantName;
        tenantFilter.appendChild(option);
    });
    
    tenantFilter.value = currentValue;
}

function exportRFIDAccessLog() {
    try {
        const days = parseInt(document.getElementById('accessLogDays')?.value || 7);
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        // Get data from table
        const table = document.querySelector('.rfid-records-table');
        if (!table) {
            alert('No data to export');
            return;
        }
        
        let csv = 'Timestamp,Tenant,Unit,UID,Status,Direction\n';
        
        table.querySelectorAll('tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            csv += `"${cells[0].textContent}","${cells[1].textContent}","${cells[2].textContent}","${cells[3].textContent}","${cells[4].textContent}","${cells[5].textContent}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rfid-access-log-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showNotification('Access log exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting log:', error);
        showNotification('Error exporting log: ' + error.message, 'error');
    }
}

// ==================== NOTIFICATIONS ====================

function showNotification(message, type = 'info') {
    const container = document.querySelector('.notifications-container') || createNotificationsContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    container.appendChild(notification);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function createNotificationsContainer() {
    const container = document.createElement('div');
    container.className = 'notifications-container';
    document.body.appendChild(container);
    return container;
}

// ==================== LOGOUT ====================

async function handleLogout() {
    try {
        await signOut(auth);
        localStorage.removeItem('userType');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// ==================== CLEAR RFID RECORDS ====================

async function clearAllRFIDRecords() {
    // Confirm before clearing
    const confirmClear = confirm('⚠️ Are you sure you want to delete ALL RFID records?\n\nThis action cannot be undone!');
    
    if (!confirmClear) {
        console.log('[RFID CLEAR] User cancelled clear operation');
        return;
    }
    
    try {
        console.log('[RFID CLEAR] Clearing all RFID records from Firebase...');
        
        const scansRef = ref(realtimeDb, 'scans');
        await set(scansRef, null); // Delete all data at /scans
        
        console.log('[RFID CLEAR] All RFID records cleared successfully');
        
        // Clear from memory
        allRFIDRecords = [];
        
        // Reload the display
        loadRFIDAccessLogIntegrated();
        
        // Show success message
        alert('✅ All RFID records have been cleared!');
        
    } catch (error) {
        console.error('[RFID CLEAR ERROR]', error);
        alert('❌ Error clearing records: ' + error.message);
    }
}
