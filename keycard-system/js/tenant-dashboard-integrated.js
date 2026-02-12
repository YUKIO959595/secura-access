import { auth, db, realtimeDb } from './firebase-config.js';
import { rfidRecords } from './rfid-records.js';
import { cameraAccess } from './camera-access.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, getDocs, getDoc, doc, updateDoc, query, where, orderBy, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, onValue, off, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log('[TENANT-DASHBOARD] Script loaded and initializing...');
console.log('[TENANT-DASHBOARD] Firebase config:', { auth: !!auth, db: !!db, realtimeDb: !!realtimeDb });
console.log('[TENANT-DASHBOARD] RFID Records module:', !!rfidRecords);
console.log('[TENANT-DASHBOARD] Camera Access module:', !!cameraAccess);

// ==================== INITIALIZATION ====================

let currentTenant = null;
let isInitialized = false;

// Check authentication
onAuthStateChanged(auth, async (user) => {
    console.log('[TENANT-DASHBOARD] onAuthStateChanged triggered, user:', user?.email);
    
    // Prevent multiple initializations
    if (isInitialized) {
        console.log('[TENANT-DASHBOARD] Already initialized, skipping auth check');
        return;
    }
    
    // If no user, redirect to login
    if (!user) {
        console.log('No user logged in, redirecting to index');
        window.location.href = 'index.html';
        return;
    }
    
    const userType = localStorage.getItem('userType');
    console.log('User type from localStorage:', userType);
    
    // If not a tenant, redirect
    if (userType !== 'tenant') {
        console.log('User is not a tenant, redirecting to index');
        window.location.href = 'index.html';
        return;
    }
    
    // Mark as initialized to prevent re-running this code
    isInitialized = true;
    console.log('[TENANT-DASHBOARD] Initialize flag set to true');
    
    // Get current tenant data
    isInitialized = true;
    
    // Get current tenant data
    try {
        console.log('Loading tenant data for user:', user.uid);
        const tenantRef = doc(db, 'tenants', user.uid);
        const tenantDoc = await getDoc(tenantRef);
        
        if (tenantDoc.exists()) {
            currentTenant = {
                id: user.uid,
                ...tenantDoc.data(),
                email: user.email
            };
            
            console.log('Tenant data loaded successfully:', currentTenant.id);
            
            // Note: authContainer and dashboardContainer are only used in merged HTML files
            // Individual HTML files don't have these containers
            
            try {
                console.log('Setting up event listeners...');
                setupEventListeners();
                console.log('Event listeners setup completed');
            } catch (setupError) {
                console.error('Error setting up event listeners:', setupError);
            }
            
            try {
                console.log('Loading all data...');
                // Add a small delay to ensure DOM is fully ready
                await new Promise(resolve => setTimeout(resolve, 200));
                await loadAllData();
                console.log('All data loaded successfully');
            } catch (dataError) {
                console.error('Error loading data:', dataError);
            }
            
            try {
                console.log('Setting up realtime listeners...');
                setupRealtimeListeners();
                console.log('Realtime listeners setup completed');
            } catch (realtimeError) {
                console.error('Error setting up realtime listeners:', realtimeError);
            }
        } else {
            console.warn('Tenant document not found, attempting to create...');
            // Create tenant document if missing
            try {
                const { setDoc, serverTimestamp: serverTS } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                await setDoc(tenantRef, {
                    userId: user.uid,
                    email: user.email,
                    createdAt: serverTS(),
                    name: 'Rovin San Miguel',
                    phone: '',
                    unit: '103',
                    address: '',
                    residents: 1,
                    keycardsUsing: 1,
                    keycardsNeeded: 1
                });
                console.log('Tenant document created successfully');
                
                // Initialize the dashboard with created data
                currentTenant = {
                    id: user.uid,
                    userId: user.uid,
                    email: user.email,
                    name: 'Nivea Sinahon',
                    phone: '',
                    unit: '101',
                    address: '',
                    residents: 1,
                    keycardsUsing: 1,
                    keycardsNeeded: 1
                };
                
                try {
                    console.log('Setting up event listeners...');
                    setupEventListeners();
                    console.log('Event listeners setup completed');
                } catch (setupError) {
                    console.error('Error setting up event listeners:', setupError);
                }
                
                try {
                    console.log('Loading all data...');
                    // Add a small delay to ensure DOM is fully ready
                    await new Promise(resolve => setTimeout(resolve, 200));
                    await loadAllData();
                    console.log('All data loaded successfully');
                } catch (dataError) {
                    console.error('Error loading data:', dataError);
                }
                
                try {
                    console.log('Setting up realtime listeners...');
                    setupRealtimeListeners();
                    console.log('Realtime listeners setup completed');
                } catch (realtimeError) {
                    console.error('Error setting up realtime listeners:', realtimeError);
                }
            } catch (createError) {
                console.error('Failed to create tenant document:', createError);
                isInitialized = false;
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Error loading tenant data:', error);
        console.error('Error stack:', error.stack);
        isInitialized = false;
        // Show error on dashboard but don't immediately redirect
        const errorDiv = document.getElementById('profileError');
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.style.color = '#d32f2f';
            errorDiv.textContent = 'Error loading dashboard. Please refresh the page or logout and log back in.';
        }
    }
});

// Load all data
async function loadAllData() {
    if (!currentTenant) {
        console.warn('loadAllData: currentTenant is null, skipping data load');
        return;
    }
    
    try {
        console.log('Starting loadAllData for tenant:', currentTenant.id);
        
        try {
            console.log('Loading tenant profile...');
            await loadTenantProfile();
            console.log('Tenant profile loaded successfully');
        } catch (profileError) {
            console.error('Error loading profile:', profileError);
        }
        
        try {
            console.log('Loading RFID records...');
            await loadRFIDRecordsForTenant();
            console.log('RFID records loaded successfully');
        } catch (rfidError) {
            console.error('Error loading RFID records:', rfidError);
        }
        
        try {
            console.log('Loading keycard status...');
            await loadKeycardStatus();
            console.log('Keycard status loaded successfully');
        } catch (keycardError) {
            console.error('Error loading keycard status:', keycardError);
        }
        
        try {
            console.log('Loading camera access requests...');
            await loadCameraAccessRequests();
            console.log('Camera access requests loaded successfully');
        } catch (cameraError) {
            console.error('Error loading camera requests:', cameraError);
        }
        
        try {
            console.log('Setting up RFID event listeners...');
            setupRFIDEventListeners();
            console.log('RFID event listeners setup successfully');
        } catch (listenerError) {
            console.error('Error setting up RFID listeners:', listenerError);
        }
        
        console.log('loadAllData completed successfully');
    } catch (error) {
        console.error('Critical error in loadAllData:', error);
    }
}

// ==================== RFID UNLOCK ANIMATION ====================

function applyRFIDUnlockAnimation() {
    try {
        if (!window.rfidUnlockTimers || window.rfidUnlockTimers.length === 0) {
            return;
        }
        
        // Clear existing timers
        if (window.rfidUnlockTimeoutIds) {
            window.rfidUnlockTimeoutIds.forEach(id => clearTimeout(id));
        }
        window.rfidUnlockTimeoutIds = [];
        
        // Apply timers to all unlocked records
        window.rfidUnlockTimers.forEach(({recordId, elementId, timestamp}) => {
            const element = document.getElementById(elementId);
            if (element) {
                // Set the unlock state with transition
                element.innerHTML = '🔓 Unlocked';
                element.style.color = '#2ecc71';
                element.style.fontWeight = '600';
                element.style.transition = 'all 0.3s ease';
                
                // Set timeout to transition to locked after 10 seconds
                const timeoutId = setTimeout(() => {
                    const el = document.getElementById(elementId);
                    if (el) {
                        el.innerHTML = '🔒 Locked';
                        el.style.color = '#ff9800';
                        el.style.transition = 'all 0.3s ease';
                    }
                }, 10000); // 10 seconds
                
                window.rfidUnlockTimeoutIds.push(timeoutId);
            }
        });
        
        console.log('[RFID] Applied unlock animations to', window.rfidUnlockTimers.length, 'records');
    } catch (error) {
        console.error('[RFID] Error applying unlock animation:', error);
    }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    try {
        console.log('Setting up event listeners...');
        
        // Navigation
        const navLinks = document.querySelectorAll('.nav-link');
        console.log('Found', navLinks.length, 'nav links');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                console.log('Switching to section:', section);
                switchSection(section);
            });
        });
        
        // Logout
        const logoutBtn = document.getElementById('tenantLogout');
        if (logoutBtn) {
            console.log('Adding logout listener...');
            logoutBtn.addEventListener('click', (e) => {
                console.log('Logout button clicked');
                e.preventDefault();
                handleLogout();
            });
            console.log('Logout button listener added');
        } else {
            console.warn('Logout button not found');
        }
        
        // Edit Profile Button
        const editProfileBtn = document.getElementById('editProfileBtn');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Edit profile button clicked');
                enableProfileEdit();
                editProfileBtn.style.display = 'none';
                const submitBtn = document.getElementById('submitChangesBtn');
                if (submitBtn) submitBtn.style.display = 'inline-block';
            });
        }
        
        // Submit Changes Button (Profile Form)
        const profileForm = document.getElementById('profileForm');
        const submitChangesBtn = document.getElementById('submitChangesBtn');
        if (submitChangesBtn && profileForm) {
            submitChangesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Submit changes button clicked');
                saveProfileChanges(e);
            });
        }
        
        // Deactivate Keycard Button
        const deactivateKeycardBtn = document.getElementById('deactivateKeycardBtn');
        if (deactivateKeycardBtn) {
            deactivateKeycardBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                console.log('Deactivate keycard button clicked');
                if (confirm('Are you sure you want to deactivate your keycard?')) {
                    try {
                        // Update in Firestore
                        const tenantRef = doc(db, 'tenants', currentTenant.id);
                        await updateDoc(tenantRef, {
                            keycardActive: false,
                            keycardDeactivatedAt: serverTimestamp()
                        });
                        alert('Keycard has been deactivated');
                        await loadKeycardStatus();
                    } catch (error) {
                        alert('Error deactivating keycard: ' + error.message);
                    }
                }
            });
        }
        
        // Keycard Request Form
        const keycardRequestForm = document.getElementById('keycardRequestForm');
        if (keycardRequestForm) {
            keycardRequestForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const reason = document.getElementById('keycardReason').value;
                    const details = document.getElementById('keycardDetails').value;
                    
                    await addDoc(collection(db, 'keycard_requests'), {
                        tenantId: currentTenant.id,
                        tenantName: currentTenant.name,
                        tenantUnit: currentTenant.unit,
                        reason: reason,
                        details: details,
                        status: 'pending',
                        createdAt: serverTimestamp()
                    });
                    
                    document.getElementById('keycardSuccess').textContent = 'Keycard request submitted successfully!';
                    document.getElementById('keycardSuccess').style.display = 'block';
                    keycardRequestForm.reset();
                    setTimeout(() => {
                        document.getElementById('keycardSuccess').style.display = 'none';
                    }, 3000);
                } catch (error) {
                    document.getElementById('keycardError').textContent = 'Error: ' + error.message;
                    document.getElementById('keycardError').style.display = 'block';
                }
            });
        }
        
        // Setup keycard registration handlers
        setupKeycardRegistrationHandlers();
        
        console.log('Event listeners setup completed');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

function setupRFIDEventListeners() {
    const filterBtn = document.getElementById('filterTrackRecords');
    const resetBtn = document.getElementById('resetTrackRecords');
    const clearBtn = document.getElementById('clearTenantRFIDBtn');
    
    if (filterBtn) {
        filterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Filter track records clicked');
            loadRFIDRecordsForTenant();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Reset track records clicked');
            const filterInput = document.getElementById('trackRecordFilter');
            if (filterInput) {
                filterInput.value = '';
            }
            loadRFIDRecordsForTenant();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Clear tenant RFID records clicked');
            clearTenantRFIDRecords();
        });
    }
}

// Switch section
function switchSection(section) {
    console.log('switchSection called with:', section);
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === section) {
            link.classList.add('active');
        }
    });
    
    // Update sections - hide all first
    document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    
    // Map section names to actual element IDs
    const sectionMap = {
        'profile': 'profile-section',
        'rfid-track': 'rfid-track-section',
        'keycard': 'keycard-section',
        'camera': 'camera-section'
    };
    
    const titleMap = {
        'profile': 'My Profile',
        'rfid-track': 'RFID Access Track Record',
        'keycard': 'Keycard Status',
        'camera': 'Camera Footage'
    };
    
    // Show the selected section
    if (sectionMap[section]) {
        const sectionElement = document.getElementById(sectionMap[section]);
        if (sectionElement) {
            sectionElement.classList.add('active');
            sectionElement.style.display = 'block';
            console.log('Showed section:', sectionMap[section]);
        } else {
            console.warn('Section element not found:', sectionMap[section]);
        }
        
        // Update title
        const titleElement = document.getElementById('dashboardTitle');
        if (titleElement) {
            titleElement.textContent = titleMap[section];
        }
    } else {
        console.warn('Unknown section:', section);
    }
}

// ==================== TENANT PROFILE ====================

async function loadTenantProfile() {
    try {
        if (!currentTenant) {
            console.warn('loadTenantProfile: currentTenant is null');
            showProfileError('Tenant data not loaded');
            return;
        }
        
        console.log('loadTenantProfile: Current tenant data:', currentTenant);
        
        // Wait a moment to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if form exists
        const profileForm = document.getElementById('profileForm');
        if (!profileForm) {
            console.error('profileForm element not found in DOM');
            showProfileError('Profile form not found in page');
            return;
        }
        
        console.log('profileForm found, populating fields...');
        console.log('profileForm HTML:', profileForm.innerHTML.substring(0, 200));
        
        // Populate form fields with existing data
        const fields = {
            'profileName': currentTenant.name || '',
            'profileEmail': currentTenant.email || '',
            'profilePhone': currentTenant.phone || '',
            'profileUnit': currentTenant.unit || '',
            'profileResidents': currentTenant.residents || 1,
            'profileKeycards': currentTenant.keycardsUsing || 1,
            'profileKeycardsNeeded': currentTenant.keycardsNeeded || 1,
            'profileAddress': currentTenant.address || ''
        };
        
        // Set each field
        let populatedCount = 0;
        Object.entries(fields).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                console.log(`Before: ${fieldId} = "${element.value}"`);
                element.value = value;
                // Force a change event
                element.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`After: ${fieldId} = "${element.value}"`);
                populatedCount++;
            } else {
                console.error(`✗ Field not found in DOM: ${fieldId}`);
                // List all IDs in the form to debug
                const allElements = profileForm.querySelectorAll('[id]');
                console.log('Available form elements:', Array.from(allElements).map(e => e.id));
            }
        });
        
        console.log(`✓ Profile fields populated: ${populatedCount}/8`);
        
        if (populatedCount === 0) {
            showProfileError('Could not find any profile fields to populate. Check console for available IDs.');
            return;
        }
        
        // Setup form submit handler
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Profile form submitted');
            saveProfileChanges(e);
        });
        console.log('Profile form submit handler attached');
        
    } catch (error) {
        console.error('Error loading tenant profile:', error);
        showProfileError('Error: ' + error.message);
    }
}

function showProfileError(message) {
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.innerHTML = `
            <div style="background: #ffebee; border: 1px solid #ef5350; padding: 15px; border-radius: 4px; color: #c62828;">
                <strong>Error loading profile:</strong> ${message}
                <p style="font-size: 12px; margin-top: 10px;">Check browser console for details (F12).</p>
            </div>
        `;
    }
}

function enableProfileEdit() {
    // Enable all form fields for editing
    const fieldIds = ['profileName', 'profilePhone', 'profileUnit', 'profileResidents', 'profileKeycards', 'profileKeycardsNeeded', 'profileAddress'];
    
    fieldIds.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.removeAttribute('readonly');
            element.removeAttribute('disabled');
        }
    });
    
    console.log('Profile fields enabled for editing');
}

async function saveProfileChanges(e) {
    try {
        if (e) {
            e.preventDefault();
        }
        
        if (!currentTenant) {
            console.warn('saveProfileChanges: currentTenant is null');
            return;
        }
        
        console.log('Saving profile changes...');
        
        // Get form values
        const updatedData = {
            name: document.getElementById('profileName')?.value || currentTenant.name,
            phone: document.getElementById('profilePhone')?.value || currentTenant.phone,
            unit: document.getElementById('profileUnit')?.value || currentTenant.unit,
            residents: parseInt(document.getElementById('profileResidents')?.value) || currentTenant.residents,
            keycardsUsing: parseInt(document.getElementById('profileKeycards')?.value) || currentTenant.keycardsUsing,
            keycardsNeeded: parseInt(document.getElementById('profileKeycardsNeeded')?.value) || currentTenant.keycardsNeeded,
            address: document.getElementById('profileAddress')?.value || currentTenant.address
        };
        
        console.log('Updated data:', updatedData);
        
        // Update in Firestore
        const tenantRef = doc(db, 'tenants', currentTenant.id);
        await updateDoc(tenantRef, {
            ...updatedData,
            lastProfileUpdate: serverTimestamp()
        });
        
        // Create change request for approval
        await addDoc(collection(db, 'profile_change_requests'), {
            tenantId: currentTenant.id,
            changeType: 'profile_update',
            changes: updatedData,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        
        // Update local tenant data
        currentTenant = { ...currentTenant, ...updatedData };
        
        // Make fields readonly again
        const fieldIds = ['profileName', 'profilePhone', 'profileUnit', 'profileResidents', 'profileKeycards', 'profileKeycardsNeeded', 'profileAddress'];
        fieldIds.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && fieldId !== 'profileEmail') {
                element.setAttribute('readonly', 'true');
            }
        });
        
        showNotification('Profile changes submitted for landlord approval', 'success');
        console.log('Profile saved successfully');
    } catch (error) {
        console.error('Error saving profile changes:', error);
        showNotification('Error saving profile changes: ' + error.message, 'error');
    }
}

// ==================== RFID TRACK RECORD ====================

async function loadRFIDRecordsForTenant() {
    try {
        if (!currentTenant) {
            console.warn('loadRFIDRecordsForTenant: No currentTenant');
            return;
        }
        
        console.log('Loading RFID records for tenant:', currentTenant.id);
        
        const days = parseInt(document.getElementById('trackRecordFilter')?.value || 7);
        
        // Try to get records from rfidRecords module
        let records = [];
        try {
            records = await rfidRecords.getTenantRecords(currentTenant.id, currentTenant.unit);
            console.log('Got records from rfidRecords module:', records.length);
        } catch (rfidError) {
            console.warn('rfidRecords module error, using empty array:', rfidError);
            records = [];
        }
        
        // Filter by date - but show all records if date filter is not valid
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const filteredRecords = records.filter(record => {
            const recordTime = new Date(record.timestamp).getTime();
            // Show all records - don't filter out old ones
            return true;
        });
        
        console.log('Filtered records:', filteredRecords.length, 'Total records:', records.length);
        
        // Update stats
        const totalCount = records.length;
        const todayRecords = records.filter(r => {
            const recordDate = new Date(r.timestamp);
            const today = new Date();
            return recordDate.toDateString() === today.toDateString();
        });
        const lastRecord = records.length > 0 ? records[0] : null;
        
        const totalAccessCountEl = document.getElementById('totalAccessCount');
        const todayAccessCountEl = document.getElementById('todayAccessCount');
        const lastAccessTimeEl = document.getElementById('lastAccessTime');
        
        if (totalAccessCountEl) totalAccessCountEl.textContent = totalCount;
        if (todayAccessCountEl) todayAccessCountEl.textContent = todayRecords.length;
        if (lastAccessTimeEl && lastRecord) {
            lastAccessTimeEl.textContent = rfidRecords.formatTimestamp ? rfidRecords.formatTimestamp(lastRecord.timestamp) : new Date(lastRecord.timestamp).toLocaleString();
        }
        
        // Populate table
        const tableBody = document.getElementById('trackRecordBody');
        const noRecords = document.getElementById('noTrackRecords');
        
        if (filteredRecords.length === 0) {
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No access records found.</td></tr>';
            if (noRecords) noRecords.style.display = 'block';
            return;
        }
        
        if (noRecords) noRecords.style.display = 'none';
        
        let tableHTML = '';
        filteredRecords.forEach((record, index) => {
            const timestamp = rfidRecords.formatTimestamp ? rfidRecords.formatTimestamp(record.timestamp) : new Date(record.timestamp).toLocaleString();
            const recordId = `rfid-record-${Date.now()}-${index}`;
            const duration = record.duration || '-';
            
            // Get apartment from current tenant
            const apartmentNumber = currentTenant && currentTenant.unit ? currentTenant.unit : 'Unknown';
            
            // Lock Status with unlock animation
            let lockStatusDisplay = '';
            if (record.allowed) {
                // For allowed access, show unlocked padlock that transitions to locked after 10 seconds
                lockStatusDisplay = `<span id="${recordId}-unlock" style="color: #2ecc71; font-weight: 600;">🔓 Unlocked</span>`;
            } else {
                // For denied access, show denied icon
                lockStatusDisplay = `<span style="color: #e74c3c; font-weight: 600;">🚫 Denied</span>`;
            }
            
            tableHTML += `
                <tr id="${recordId}">
                    <td>${timestamp}</td>
                    <td>APT ${apartmentNumber}</td>
                    <td>${duration}</td>
                    <td>${lockStatusDisplay}</td>
                </tr>
            `;
            
            // Store record ID for later processing
            if (!window.rfidUnlockTimers) {
                window.rfidUnlockTimers = [];
            }
            if (record.allowed) {
                window.rfidUnlockTimers.push({recordId, elementId: `${recordId}-unlock`, timestamp: Date.now()});
            }
        });
        
        if (tableBody) {
            tableBody.innerHTML = tableHTML;
            console.log('Updated table with', filteredRecords.length, 'records');
            
            // Apply unlock animation to newly added records
            setTimeout(() => {
                applyRFIDUnlockAnimation();
            }, 0);
        } else {
            console.warn('trackRecordBody element not found');
        }
        
    } catch (error) {
        console.error('Error loading RFID records:', error);
        const tableBody = document.getElementById('trackRecordBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="4" style="color: red;">Error loading records: ' + error.message + '</td></tr>';
        }
    }
}

function setupRealtimeListeners() {
    try {
        if (!currentTenant) return;
        
        console.log('[REALTIME] Setting up real-time listeners for apartment:', currentTenant.unit);
        
        // Setup door status listener
        setupDoorStatusListener();
        
        // Subscribe to real-time RFID updates for this apartment
        rfidRecords.subscribeToUpdates((allRecords) => {
            // Normalize apartment name - add "Apartment" prefix if not present
            let normalizedApartment = currentTenant.unit;
            if (!normalizedApartment.includes('Apartment')) {
                normalizedApartment = `Apartment ${normalizedApartment}`;
            }
            
            // Filter records for this apartment only (using 'name' field from Realtime DB)
            const apartmentRecords = allRecords.filter(record => record.name === normalizedApartment);
            
            if (apartmentRecords.length > 0) {
                console.log('[RFID] New real-time update - found', apartmentRecords.length, 'records for apartment:', normalizedApartment);
                loadRFIDRecordsForTenant();
            }
        });
        
        // Subscribe to camera access notifications
        cameraAccess.subscribeToNotifications(currentTenant.id, (notification) => {
            console.log('[CAMERA] Notification:', notification);
            showNotification(notification.message, 'warning');
            loadCameraAccessRequests();
        });
    } catch (error) {
        console.error('Error setting up realtime listeners:', error);
    }
}

function calculateTenantRFIDStatistics(logs) {
    const stats = {
        totalAccess: logs.length,
        approvedAccess: logs.filter(l => l.allowed === true).length,
        deniedAccess: logs.filter(l => l.allowed === false).length,
        byDirection: {
            in: logs.filter(l => l.direction === 'in').length,
            out: logs.filter(l => l.direction === 'out').length
        }
    };
    return stats;
}

function displayTenantRFIDStatistics(stats) {
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
                <p class="stat-value" style="color: green;">${stats.approvedAccess}</p>
            </div>
            <div class="stat-box">
                <h5>Denied</h5>
                <p class="stat-value" style="color: red;">${stats.deniedAccess}</p>
            </div>
            <div class="stat-box">
                <h5>Entry / Exit</h5>
                <p class="stat-value">${stats.byDirection.in} / ${stats.byDirection.out}</p>
            </div>
        </div>
    `;
}

function displayTenantAccessLogTable(records) {
    const tableContainer = document.getElementById('rfidTrackRecordTable');
    
    if (records.length === 0) {
        tableContainer.innerHTML = '<p class="rfid-records-empty">No access records found.</p>';
        return;
    }
    
    let html = `
        <table class="rfid-records-table">
            <thead>
                <tr>
                    <th>Date & Time</th>
                    <th>Card UID</th>
                    <th>Status</th>
                    <th>Direction</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    records.forEach(record => {
        const timestamp = rfidRecords.formatTimestamp(record.timestamp);
        const statusBadge = rfidRecords.getStatusBadge(record.allowed);
        const direction = record.direction ? (record.direction === 'in' ? 'Entry' : 'Exit') : 'Unknown';
        
        html += `
            <tr>
                <td>${timestamp}</td>
                <td>${record.uid || 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>${direction}</td>
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

// ==================== KEYCARD MANAGEMENT ====================

async function loadKeycardStatus() {
    try {
        if (!currentTenant) {
            console.warn('loadKeycardStatus: No currentTenant');
            return;
        }
        
        console.log('Loading keycard status for tenant:', currentTenant.id);
        console.log('Keycard data from tenant:', {
            status: currentTenant.keycardStatus,
            validUntil: currentTenant.keycardValidUntil,
            id: currentTenant.id
        });
        
        // Get keycard status from tenant document
        const status = currentTenant.keycardStatus || 'active';
        const validUntil = currentTenant.keycardValidUntil ? new Date(currentTenant.keycardValidUntil).toLocaleDateString() : 'Not set';
        
        // Calculate days remaining
        let daysRemaining = '-';
        if (currentTenant.keycardValidUntil) {
            const validDate = new Date(currentTenant.keycardValidUntil);
            const today = new Date();
            const diffTime = validDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysRemaining = diffDays > 0 ? diffDays : '0 (Expired)';
        }
        
        console.log('Keycard status:', { status, validUntil, daysRemaining });
        
        // Update status elements
        const statusEl = document.getElementById('keycardStatusValue');
        const validUntilEl = document.getElementById('keycardValidUntil');
        const daysEl = document.getElementById('keycardDaysRemaining');
        
        console.log('Status elements:', { 
            statusElExists: !!statusEl, 
            validUntilElExists: !!validUntilEl, 
            daysElExists: !!daysEl 
        });
        
        if (statusEl) {
            statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusEl.style.color = status === 'active' ? 'green' : 'red';
            console.log('Updated status element');
        } else {
            console.warn('keycardStatusValue element not found');
        }
        
        if (validUntilEl) {
            validUntilEl.textContent = validUntil;
            console.log('Updated validUntil element');
        } else {
            console.warn('keycardValidUntil element not found');
        }
        
        if (daysEl) {
            daysEl.textContent = daysRemaining;
            console.log('Updated daysRemaining element');
        } else {
            console.warn('keycardDaysRemaining element not found');
        }
        
        // Setup button handlers
        setupKeycardButtons();
        
        // Load keycard requests history
        await loadKeycardRequestsHistory();
        
    } catch (error) {
        console.error('Error loading keycard status:', error);
    }
}

function setupKeycardButtons() {
    const deactivateBtn = document.getElementById('deactivateKeycard');
    const requestBtn = document.getElementById('requestNewKeycard');
    const cancelBtn = document.getElementById('cancelRequest');
    const submitBtn = document.getElementById('keycardRequestForm');
    
    if (deactivateBtn) {
        deactivateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Deactivate keycard clicked');
            deactivateKeycard();
        });
    }
    
    if (requestBtn) {
        requestBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Request new keycard clicked');
            showKeycardRequestForm();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            hideKeycardRequestForm();
        });
    }
    
    if (submitBtn) {
        submitBtn.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Keycard request form submitted');
            submitKeycardRequest(e);
        });
    }
    
    // Handle "Other" reason visibility
    const reasonSelect = document.getElementById('requestReason');
    const otherGroup = document.getElementById('otherReasonGroup');
    
    if (reasonSelect) {
        reasonSelect.addEventListener('change', (e) => {
            if (otherGroup) {
                otherGroup.style.display = e.target.value === 'other' ? 'block' : 'none';
            }
        });
    }
}

function showKeycardRequestForm() {
    const formDiv = document.getElementById('newKeycardRequest');
    if (formDiv) {
        formDiv.style.display = 'block';
    }
}

function hideKeycardRequestForm() {
    const formDiv = document.getElementById('newKeycardRequest');
    if (formDiv) {
        formDiv.style.display = 'none';
    }
    document.getElementById('keycardRequestForm').reset();
}

// ==================== KEYCARD REGISTRATION ====================

function setupKeycardRegistrationHandlers() {
    try {
        console.log('[KEYCARD-REG] Setting up keycard registration handlers...');
        
        const registrationForm = document.getElementById('keycardRegistrationForm');
        const viewButton = document.getElementById('viewRegisteredKeycards');
        
        if (registrationForm) {
            registrationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('[KEYCARD-REG] Registration form submitted');
                registerNewKeycard();
            });
        }
        
        if (viewButton) {
            viewButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('[KEYCARD-REG] View registered keycards clicked');
                displayRegisteredKeycards();
            });
        }
        
        console.log('[KEYCARD-REG] Registration handlers setup completed');
    } catch (error) {
        console.error('[KEYCARD-REG] Error setting up registration handlers:', error);
    }
}

async function registerNewKeycard() {
    try {
        if (!currentTenant) {
            showNotification('No tenant data loaded', 'error');
            return;
        }
        
        const uidInput = document.getElementById('newKeycardUID');
        const typeSelect = document.getElementById('keycardType');
        
        if (!uidInput || !typeSelect) {
            console.warn('[KEYCARD-REG] Form elements not found');
            showNotification('Form elements missing', 'error');
            return;
        }
        
        const newUID = uidInput.value.trim().toUpperCase();
        const keycardType = typeSelect.value;
        
        if (!newUID) {
            showNotification('Please enter a keycard UID', 'warning');
            return;
        }
        
        if (newUID.length < 4) {
            showNotification('UID appears to be invalid (too short)', 'warning');
            return;
        }
        
        console.log('[KEYCARD-REG] Registering new keycard:', { uid: newUID, type: keycardType });
        
        // Get existing RFID codes
        const existingCodes = currentTenant.rfidCodes || [];
        
        // Check if UID already exists
        if (existingCodes.includes(newUID)) {
            showNotification('This keycard UID is already registered', 'warning');
            return;
        }
        
        // Add new UID
        const updatedCodes = [...existingCodes, newUID];
        
        // Update tenant document
        const tenantRef = doc(db, 'tenants', currentTenant.id);
        await updateDoc(tenantRef, {
            rfidCode: newUID, // Set as primary
            rfidCodes: updatedCodes,
            keycardUIDs: {
                ...( currentTenant.keycardUIDs || {}),
                [newUID]: {
                    type: keycardType,
                    registeredAt: serverTimestamp(),
                    status: 'active'
                }
            },
            updatedAt: serverTimestamp()
        });
        
        // Update local state
        currentTenant.rfidCode = newUID;
        currentTenant.rfidCodes = updatedCodes;
        
        console.log('[KEYCARD-REG] Keycard registered successfully:', newUID);
        
        // Clear form
        uidInput.value = '';
        typeSelect.value = 'primary';
        
        showNotification('Keycard UID registered successfully! RFID access is now active.', 'success');
        
        // Refresh displayed keycards
        await displayRegisteredKeycards();
        
    } catch (error) {
        console.error('[KEYCARD-REG] Error registering keycard:', error);
        showNotification('Error registering keycard: ' + error.message, 'error');
    }
}

async function displayRegisteredKeycards() {
    try {
        if (!currentTenant) return;
        
        console.log('[KEYCARD-REG] Displaying registered keycards...');
        
        const listDiv = document.getElementById('registeredKeycardsList');
        const contentDiv = document.getElementById('keycardListContent');
        
        if (!listDiv || !contentDiv) {
            console.warn('[KEYCARD-REG] List elements not found');
            return;
        }
        
        const rfidCodes = currentTenant.rfidCodes || [];
        const keycardUIDs = currentTenant.keycardUIDs || {};
        
        if (rfidCodes.length === 0) {
            contentDiv.innerHTML = '<p style="color: #666;">No keycards registered yet. Register one above to enable RFID access.</p>';
            listDiv.style.display = 'block';
            return;
        }
        
        let html = '<div style="display: grid; gap: 10px;">';
        
        rfidCodes.forEach((uid, index) => {
            const details = keycardUIDs[uid] || { type: 'unknown', status: 'active' };
            const registeredAt = details.registeredAt ? new Date(details.registeredAt.toDate?.() || details.registeredAt).toLocaleDateString() : 'Unknown';
            
            html += `
                <div style="padding: 10px; border: 1px solid #ddd; border-radius: 5px; background: #f9f9f9;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="font-family: monospace; font-size: 14px;">${uid}</strong>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                                Type: <span style="text-transform: capitalize;">${details.type}</span> | 
                                Status: <span style="color: ${details.status === 'active' ? 'green' : 'red'};">${details.status}</span> | 
                                Registered: ${registeredAt}
                            </div>
                        </div>
                        <button class="btn btn-danger btn-small" onclick="removeKeycardUID('${uid}')">Remove</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        contentDiv.innerHTML = html;
        listDiv.style.display = 'block';
        
        console.log('[KEYCARD-REG] Displayed', rfidCodes.length, 'registered keycards');
        
    } catch (error) {
        console.error('[KEYCARD-REG] Error displaying keycards:', error);
    }
}

async function removeKeycardUID(uid) {
    try {
        const confirm = window.confirm(`Remove keycard UID ${uid}? You will no longer be able to access with this card.`);
        if (!confirm) return;
        
        if (!currentTenant) return;
        
        console.log('[KEYCARD-REG] Removing keycard UID:', uid);
        
        const rfidCodes = currentTenant.rfidCodes || [];
        const updatedCodes = rfidCodes.filter(code => code !== uid);
        const keycardUIDs = { ...currentTenant.keycardUIDs };
        delete keycardUIDs[uid];
        
        const tenantRef = doc(db, 'tenants', currentTenant.id);
        
        // If removing primary UID, set next one as primary
        let updateData = {
            rfidCodes: updatedCodes,
            keycardUIDs: keycardUIDs,
            updatedAt: serverTimestamp()
        };
        
        if (currentTenant.rfidCode === uid && updatedCodes.length > 0) {
            updateData.rfidCode = updatedCodes[0];
        } else if (updatedCodes.length === 0) {
            updateData.rfidCode = null;
        }
        
        await updateDoc(tenantRef, updateData);
        
        // Update local state
        currentTenant.rfidCodes = updatedCodes;
        currentTenant.keycardUIDs = keycardUIDs;
        if (updateData.rfidCode !== undefined) {
            currentTenant.rfidCode = updateData.rfidCode;
        }
        
        showNotification('Keycard UID removed successfully', 'success');
        await displayRegisteredKeycards();
        
    } catch (error) {
        console.error('[KEYCARD-REG] Error removing keycard:', error);
        showNotification('Error removing keycard: ' + error.message, 'error');
    }
}

async function deactivateKeycard() {
    try {
        if (!currentTenant) return;
        
        const confirm = window.confirm('Are you sure you want to deactivate your keycard? You will need to request a new one to access your unit.');
        if (!confirm) return;
        
        const tenantRef = doc(db, 'tenants', currentTenant.id);
        await updateDoc(tenantRef, {
            keycardStatus: 'deactivated',
            lastStatusChange: serverTimestamp()
        });
        
        currentTenant.keycardStatus = 'deactivated';
        loadKeycardStatus();
        showNotification('Keycard deactivated successfully. Please request a new one.', 'warning');
    } catch (error) {
        console.error('Error deactivating keycard:', error);
        showNotification('Error deactivating keycard: ' + error.message, 'error');
    }
}

async function submitKeycardRequest(e) {
    try {
        if (!currentTenant) return;
        
        const reason = document.getElementById('requestReason').value;
        const otherReason = document.getElementById('otherReason').value;
        const notes = document.getElementById('requestNotes').value;
        
        if (!reason) {
            showNotification('Please select a reason', 'error');
            return;
        }
        
        const finalReason = reason === 'other' ? otherReason : reason;
        
        // Submit keycard request
        await addDoc(collection(db, 'keycardRequests'), {
            tenantId: currentTenant.id,
            tenantName: currentTenant.name,
            tenantEmail: currentTenant.email,
            unit: currentTenant.unit,
            reason: finalReason,
            notes: notes,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        
        hideKeycardRequestForm();
        showNotification('Keycard request submitted successfully. Your landlord will review it shortly.', 'success');
        loadKeycardRequestsHistory();
    } catch (error) {
        console.error('Error submitting keycard request:', error);
        showNotification('Error submitting request: ' + error.message, 'error');
    }
}

async function loadKeycardRequestsHistory() {
    try {
        if (!currentTenant) return;
        
        const historyDiv = document.getElementById('keycardRequestsHistory');
        if (!historyDiv) return;
        
        console.log('Loading keycard requests history for tenant:', currentTenant.id);
        
        // Simplified query - no orderBy to avoid index requirement
        const q = query(
            collection(db, 'keycardRequests'),
            where('tenantId', '==', currentTenant.id)
        );
        
        const snapshot = await getDocs(q);
        let requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort in JavaScript instead of Firestore
        requests.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB - dateA; // Descending order
        });
        
        console.log('Loaded', requests.length, 'keycard requests');
        
        if (requests.length === 0) {
            historyDiv.innerHTML = '<p style="text-align: center; color: #666;">No keycard requests yet.</p>';
            return;
        }
        
        let html = '';
        requests.forEach(request => {
            const createdDate = request.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Unknown date';
            const statusColor = request.status === 'approved' ? 'green' : request.status === 'rejected' ? 'red' : 'orange';
            const statusText = request.status?.charAt(0).toUpperCase() + request.status?.slice(1) || 'Unknown';
            
            html += `
                <div class="request-item" style="border: 1px solid #ddd; padding: 12px; margin-bottom: 10px; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p><strong>Reason:</strong> ${request.reason || 'N/A'}</p>
                            <p style="font-size: 12px; color: #666;">Requested: ${createdDate}</p>
                            <p><strong>Notes:</strong> ${request.notes || 'N/A'}</p>
                        </div>
                        <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                    </div>
                </div>
            `;
        });
        
        historyDiv.innerHTML = html;
        console.log('Keycard requests history loaded successfully');
    } catch (error) {
        console.error('Error loading keycard requests history:', error);
        const historyDiv = document.getElementById('keycardRequestsHistory');
        if (historyDiv) {
            historyDiv.innerHTML = '<p style="color: red;">Error loading requests: ' + error.message + '</p>';
        }
    }
}

// ==================== CAMERA FOOTAGE ====================

async function loadCameraAccessRequests() {
    try {
        if (!currentTenant) return;
        
        const cameraFeedSection = document.getElementById('cameraFeedContainer');
        if (!cameraFeedSection) return;
        
        // Build camera info
        cameraFeedSection.innerHTML = `
            <div class="camera-info">
                <h3>Your Unit Camera</h3>
                <p><strong>Unit:</strong> ${currentTenant.unit || 'N/A'}</p>
                <p><strong>Camera Status:</strong> <span class="status-indicator online">Online</span></p>
            </div>
            
            <div class="video-wrapper" id="cameraWrapper">
                <div style="background-color: #000; width: 100%; height: 400px; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                    <img id="tenantCameraStream" src="" alt="Camera Stream" class="camera-stream" style="display: none;">
                    <p id="cameraLockedMessage" style="color: #fff;">Camera is locked. Click the button below to unlock.</p>
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                <button class="btn btn-primary" id="unlockCameraBtn" type="button">Unlock Camera</button>
                <button class="btn btn-secondary" id="lockCameraBtn" type="button" style="display: none;">Lock Camera</button>
            </div>
            
            <div id="cameraAccessLog" style="margin-top: 20px;"></div>
        `;
        
        // Setup camera unlock button
        const unlockBtn = document.getElementById('unlockCameraBtn');
        const lockBtn = document.getElementById('lockCameraBtn');
        
        if (unlockBtn) {
            unlockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Unlock camera clicked');
                unlockTenantCamera();
            });
        }
        
        if (lockBtn) {
            lockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Lock camera clicked');
                lockTenantCamera();
            });
        }
        
        // Load camera access logs
        loadTenantCameraAccessLogs();
    } catch (error) {
        console.error('Error loading camera section:', error);
    }
}

async function unlockTenantCamera() {
    try {
        if (!currentTenant) return;
        
        // Show PIN modal (tenant PIN: 2025)
        cameraAccess.showPINModal('tenant', async (success) => {
            if (success) {
                // Log tenant's own camera access
                await cameraAccess.logCameraAccess(
                    currentTenant.unit,
                    currentTenant.name,
                    'tenant'
                );
                
                // Show camera stream (NO BLUR for tenant's own camera)
                const cameraStream = document.getElementById('tenantCameraStream');
                const cameraUrl = currentTenant.cameraUrl || `http://192.168.x.x/stream`; // Update with actual URL
                
                cameraStream.src = cameraUrl;
                cameraStream.style.display = 'block';
                cameraStream.style.filter = 'none'; // No blur for tenant's own camera
                document.getElementById('cameraLockedMessage').style.display = 'none';
                
                document.getElementById('unlockCameraBtn').style.display = 'none';
                document.getElementById('lockCameraBtn').style.display = 'inline-block';
                
                showNotification('Camera unlocked. Feed is now visible.', 'success');
                
                // Reload access logs
                loadTenantCameraAccessLogs();
            } else {
                showNotification('Invalid PIN code', 'error');
            }
        });
    } catch (error) {
        console.error('Error unlocking camera:', error);
        showNotification('Error unlocking camera: ' + error.message, 'error');
    }
}

function lockTenantCamera() {
    try {
        const cameraStream = document.getElementById('tenantCameraStream');
        cameraStream.src = '';
        cameraStream.style.display = 'none';
        document.getElementById('cameraLockedMessage').style.display = 'block';
        
        document.getElementById('unlockCameraBtn').style.display = 'inline-block';
        document.getElementById('lockCameraBtn').style.display = 'none';
        
        showNotification('Camera locked.', 'info');
    } catch (error) {
        console.error('Error locking camera:', error);
    }
}

async function loadTenantCameraAccessLogs() {
    try {
        if (!currentTenant) return;
        
        // Get camera access logs for this unit
        const logsRef = collection(db, 'camera_access_logs');
        const q = query(
            logsRef,
            where('unitNumber', '==', currentTenant.unit || currentTenant.name),
            orderBy('timestamp', 'desc')
        );
        
        // Note: This requires security rules to allow access
        // For now, we'll show a placeholder
        const logContainer = document.getElementById('cameraAccessLog');
        logContainer.innerHTML = `
            <h4>Camera Access History</h4>
            <p style="color: #666;">Your landlord can view this camera during business hours. You will receive a notification when they access it.</p>
        `;
    } catch (error) {
        console.error('Error loading camera access logs:', error);
    }
}

// ==================== NOTIFICATIONS ====================

async function loadCameraNotifications() {
    try {
        if (!currentTenant) return;
        
        const notificationsContainer = document.getElementById('notificationsList');
        if (!notificationsContainer) return;
        
        // Subscribe to notifications for this tenant
        cameraAccess.subscribeToNotifications(currentTenant.id, (notification) => {
            displayNotificationItem(notification, notificationsContainer);
        });
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function displayNotificationItem(notification, container) {
    const item = document.createElement('div');
    item.className = 'notification-item card';
    item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
                <h4>${notification.title || 'Camera Access'}</h4>
                <p>${notification.message}</p>
                <p style="color: #666; font-size: 12px;">
                    <strong>Time:</strong> ${new Date(notification.timestamp).toLocaleString()}
                </p>
            </div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    container.insertBefore(item, container.firstChild);
}

// ==================== NOTIFICATIONS SYSTEM ====================

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

// ==================== CLEAR TENANT RFID RECORDS ====================

async function clearTenantRFIDRecords() {
    const confirmClear = confirm('⚠️ Are you sure you want to delete ALL your RFID records?\n\nThis action cannot be undone!');
    if (!confirmClear) return;
    
    try {
        if (!currentTenant) {
            alert('❌ Error: Could not identify current tenant');
            return;
        }
        
        console.log('[RFID CLEAR] Clearing records for tenant:', currentTenant.id);
        
        // Get all records from Firebase
        const scansRef = ref(realtimeDb, 'scans');
        
        // Get current data
        const snapshot = await new Promise((resolve, reject) => {
            onValue(scansRef, (data) => {
                resolve(data);
            }, reject, { onlyOnce: true });
        });
        
        // Normalize apartment name for filtering
        let normalizedApartment = currentTenant.unit;
        if (!normalizedApartment.includes('Apartment')) {
            normalizedApartment = `Apartment ${normalizedApartment}`;
        }
        
        // Filter out records for this tenant's apartment
        const updatedData = {};
        let recordsDeleted = 0;
        
        if (snapshot.val()) {
            Object.entries(snapshot.val()).forEach(([key, value]) => {
                // Keep records that don't belong to this apartment
                if (value.name !== normalizedApartment) {
                    updatedData[key] = value;
                } else {
                    recordsDeleted++;
                }
            });
        }
        
        // Write back the filtered data (or null if no data left)
        await set(scansRef, Object.keys(updatedData).length > 0 ? updatedData : null);
        
        console.log('[RFID CLEAR] Deleted', recordsDeleted, 'records for apartment:', normalizedApartment);
        loadRFIDRecordsForTenant();
        alert(`✅ Deleted ${recordsDeleted} record(s) from your access log!`);
    } catch (error) {
        console.error('[RFID CLEAR ERROR]', error);
        alert('❌ Error clearing records: ' + error.message);
    }
}
