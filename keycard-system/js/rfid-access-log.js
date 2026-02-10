/**
 * RFID Access Log Management
 * Real-time logging and display of RFID card scans for access control
 * 
 * Features:
 * - Real-time RFID scan logging to Firebase
 * - Access history filtering and search
 * - Live access log display on dashboard
 * - Statistical analysis of access patterns
 */

import { db, realtimeDb } from './firebase-config.js';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  onSnapshot,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { 
  ref, 
  onValue, 
  orderByChild, 
  limitToLast 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

/**
 * RFID Scan Log Structure
 * Stored in Firestore: /rfid_scans collection
 */
class RFIDAccessLog {
  constructor(data) {
    this.rfidCode = data.rfidCode;           // Unique RFID card identifier
    this.timestamp = data.timestamp;          // Unix timestamp (ms)
    this.deviceId = data.deviceId;            // ESP32 device identifier
    this.direction = data.direction;          // "in" or "out"
    this.tenantId = data.tenantId || null;   // Tenant reference
    this.tenantName = data.tenantName || "Unknown"; // Display name
    this.verified = data.verified || false;  // Authorization status
    this.signalStrength = data.signalStrength; // Wi-Fi RSSI
    this.notes = data.notes || "";            // Additional notes
  }

  getFormattedTime() {
    const date = new Date(this.timestamp);
    return date.toLocaleString();
  }

  getFormattedDate() {
    const date = new Date(this.timestamp);
    return date.toLocaleDateString();
  }

  getDayOfWeek() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = new Date(this.timestamp);
    return days[date.getDay()];
  }
}

/**
 * Log RFID Scan to Firestore
 * Called when ESP32 sends RFID data via Firebase Realtime Database
 * 
 * @param {string} rfidCode - The RFID card code
 * @param {Object} options - Additional options
 */
async function logRFIDAccessToFirestore(rfidCode, options = {}) {
  try {
    const accessLog = {
      rfidCode: rfidCode.toUpperCase(),
      timestamp: Timestamp.now(),
      timestampMs: Date.now(),
      deviceId: options.deviceId || 'ESP32_UNIT_001',
      direction: options.direction || 'in',
      tenantId: options.tenantId || null,
      tenantName: options.tenantName || 'Unidentified',
      verified: false,
      signalStrength: options.signalStrength || 0,
      status: 'pending', // pending, approved, denied
      notes: options.notes || '',
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'rfid_scans'), accessLog);
    console.log(`[RFID LOG] Access logged with ID: ${docRef.id}`);
    console.log(`[RFID LOG] Timestamp set to: ${accessLog.timestamp} (ms: ${accessLog.timestampMs})`);
    return docRef.id;
  } catch (error) {
    console.error('[RFID LOG ERROR]', error);
    throw error;
  }
}

/**
 * Listen for Real-time RFID Scans from Firebase Realtime DB
 * ESP32 publishes RFID data to /rfid_scans/ path
 */
function listenForRealtimeRFIDScans(callback) {
  const rfidScansRef = ref(realtimeDb, 'rfid_scans');
  
  onValue(rfidScansRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      // Convert to array and sort by timestamp (newest first)
      const scans = Object.entries(data)
        .map(([key, value]) => ({
          id: key,
          ...value
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50); // Keep last 50 scans

      console.log(`[RFID REALTIME] Received ${scans.length} scans`);
      if (callback) callback(scans);
    }
  }, (error) => {
    console.error('[RFID REALTIME ERROR]', error);
  });
}

/**
 * Get Recent RFID Access Records
 * Query Firestore for recent access logs
 * 
 * @param {number} days - Number of days to look back
 * @param {number} maxResults - Maximum results to return
 */
async function getRecentRFIDAccess(days = 7, maxResults = 100) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'rfid_scans'),
      where('timestamp', '>=', Timestamp.fromDate(cutoffDate)),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => new RFIDAccessLog(doc.data()));

    console.log(`[RFID ACCESS] Retrieved ${logs.length} records from ${days} days`);
    return logs;
  } catch (error) {
    console.error('[RFID ACCESS ERROR]', error);
    return [];
  }
}

/**
 * Get Access Records for Specific Tenant
 * 
 * @param {string} tenantId - Tenant document ID
 * @param {number} maxResults - Maximum records to return
 */
async function getTenantAccessHistory(tenantId, maxResults = 50) {
  try {
    const q = query(
      collection(db, 'rfid_scans'),
      where('tenantId', '==', tenantId),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => new RFIDAccessLog(doc.data()));

    console.log(`[TENANT ACCESS] Retrieved ${logs.length} records for tenant ${tenantId}`);
    return logs;
  } catch (error) {
    console.error('[TENANT ACCESS ERROR]', error);
    return [];
  }
}

/**
 * Get Today's Access Log
 * Returns all access records for current day
 */
async function getTodaysAccessLog() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      collection(db, 'rfid_scans'),
      where('timestamp', '>=', Timestamp.fromDate(today)),
      where('timestamp', '<', Timestamp.fromDate(tomorrow)),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => new RFIDAccessLog(doc.data()));

    console.log(`[TODAY ACCESS] Retrieved ${logs.length} records for today`);
    return logs;
  } catch (error) {
    console.error('[TODAY ACCESS ERROR]', error);
    return [];
  }
}

/**
 * Listen for Real-time RFID Access Log Updates
 * Subscribes to Firestore changes for live dashboard updates
 * 
 * @param {string} tenantId - Optional: filter by tenant ID
 * @param {Function} callback - Callback with updated logs
 */
function subscribeToRFIDAccessLog(callback, tenantId = null) {
  let q;
  
  if (tenantId) {
    q = query(
      collection(db, 'rfid_scans'),
      where('tenantId', '==', tenantId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
  } else {
    q = query(
      collection(db, 'rfid_scans'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
  }

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => new RFIDAccessLog(doc.data()));
    console.log(`[RFID SUBSCRIPTION] Updated with ${logs.length} records`);
    if (callback) callback(logs);
  }, (error) => {
    console.error('[RFID SUBSCRIPTION ERROR]', error);
  });

  return unsubscribe;
}

/**
 * Display RFID Access Log Table
 * Renders access logs to HTML table
 * 
 * @param {Array<RFIDAccessLog>} logs - Array of access log objects
 * @param {string} containerId - HTML element ID for table container
 */
function displayAccessLogTable(logs, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[DISPLAY] Container ${containerId} not found`);
    return;
  }

  if (logs.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No access records found</p>';
    return;
  }

  let html = `
    <div class="access-log-table">
      <table class="table table-striped table-hover">
        <thead class="table-dark">
          <tr>
            <th>Timestamp</th>
            <th>Tenant Name</th>
            <th>RFID Code</th>
            <th>Direction</th>
            <th>Device</th>
            <th>Status</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
  `;

  logs.forEach(log => {
    const statusBadge = log.verified 
      ? '<span class="badge badge-success">Verified</span>'
      : '<span class="badge badge-warning">Pending</span>';
    
    const directionBadge = log.direction === 'in'
      ? '<span class="badge badge-info">Enter</span>'
      : '<span class="badge badge-secondary">Exit</span>';

    const signalClass = log.signalStrength > -70 
      ? 'text-success' 
      : log.signalStrength > -80 
      ? 'text-warning' 
      : 'text-danger';

    html += `
      <tr>
        <td><small>${log.getFormattedTime()}</small></td>
        <td><strong>${log.tenantName}</strong></td>
        <td><code>${log.rfidCode.substring(0, 8)}</code></td>
        <td>${directionBadge}</td>
        <td><small>${log.deviceId}</small></td>
        <td>${statusBadge}</td>
        <td><span class="${signalClass}">${log.signalStrength} dBm</span></td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  console.log(`[DISPLAY] Rendered ${logs.length} access records`);
}

/**
 * Get Access Statistics for Time Period
 * Analyzes access patterns
 * 
 * @param {Array<RFIDAccessLog>} logs - Array of access logs
 */
function getAccessStatistics(logs) {
  if (logs.length === 0) return null;

  const stats = {
    totalAccess: logs.length,
    uniqueTenants: new Set(logs.map(l => l.tenantId)).size,
    uniqueCards: new Set(logs.map(l => l.rfidCode)).size,
    byDirection: {
      in: logs.filter(l => l.direction === 'in').length,
      out: logs.filter(l => l.direction === 'out').length
    },
    byTenant: {},
    byHour: {},
    byDay: {},
    verifiedCount: logs.filter(l => l.verified).length,
    deniedCount: logs.filter(l => l.status === 'denied').length
  };

  // Count by tenant
  logs.forEach(log => {
    stats.byTenant[log.tenantName] = (stats.byTenant[log.tenantName] || 0) + 1;
  });

  // Count by hour
  logs.forEach(log => {
    const date = new Date(log.timestamp);
    const hour = `${date.getHours()}:00`;
    stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
  });

  // Count by day of week
  logs.forEach(log => {
    const log_obj = new RFIDAccessLog(log);
    const day = log_obj.getDayOfWeek();
    stats.byDay[day] = (stats.byDay[day] || 0) + 1;
  });

  return stats;
}

/**
 * Display Access Statistics
 * 
 * @param {Object} stats - Statistics object from getAccessStatistics()
 * @param {string} containerId - HTML element ID
 */
function displayAccessStatistics(stats, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !stats) return;

  let html = `
    <div class="access-stats">
      <div class="row">
        <div class="col-md-3">
          <div class="stat-card">
            <h5>Total Access</h5>
            <h2>${stats.totalAccess}</h2>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <h5>Unique Tenants</h5>
            <h2>${stats.uniqueTenants}</h2>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <h5>Unique Cards</h5>
            <h2>${stats.uniqueCards}</h2>
          </div>
        </div>
        <div class="col-md-3">
          <div class="stat-card">
            <h5>Verified</h5>
            <h2 class="text-success">${stats.verifiedCount}</h2>
          </div>
        </div>
      </div>
      <div class="row" style="margin-top: 20px;">
        <div class="col-md-6">
          <h6>Direction Distribution</h6>
          <p>Enter: <strong>${stats.byDirection.in}</strong></p>
          <p>Exit: <strong>${stats.byDirection.out}</strong></p>
        </div>
        <div class="col-md-6">
          <h6>Top Tenants</h6>
  `;

  // Top 5 tenants
  const topTenants = Object.entries(stats.byTenant)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  topTenants.forEach(([tenant, count]) => {
    html += `<p>${tenant}: <strong>${count}</strong></p>`;
  });

  html += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Export Access Log to CSV
 * Downloads access records as CSV file
 * 
 * @param {Array<RFIDAccessLog>} logs - Array of access logs
 * @param {string} filename - Output filename
 */
function exportAccessLogToCSV(logs, filename = 'access-log.csv') {
  if (logs.length === 0) {
    alert('No records to export');
    return;
  }

  let csv = 'Timestamp,Tenant,RFID Code,Direction,Device,Status,Signal (dBm)\n';

  logs.forEach(log => {
    csv += `"${log.getFormattedTime()}","${log.tenantName}","${log.rfidCode}","${log.direction}","${log.deviceId}","${log.verified ? 'Verified' : 'Pending'}","${log.signalStrength}"\n`;
  });

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  console.log(`[EXPORT] Exported ${logs.length} records to ${filename}`);
}

/**
 * Search Access Logs
 * Filter logs by various criteria
 * 
 * @param {Array<RFIDAccessLog>} logs - Array of logs to search
 * @param {Object} criteria - Search criteria
 */
function searchAccessLogs(logs, criteria = {}) {
  return logs.filter(log => {
    if (criteria.rfidCode && !log.rfidCode.includes(criteria.rfidCode.toUpperCase())) {
      return false;
    }
    if (criteria.tenantId && log.tenantId !== criteria.tenantId) {
      return false;
    }
    if (criteria.tenantName && !log.tenantName.toLowerCase().includes(criteria.tenantName.toLowerCase())) {
      return false;
    }
    if (criteria.direction && log.direction !== criteria.direction) {
      return false;
    }
    if (criteria.status && log.status !== criteria.status) {
      return false;
    }
    if (criteria.startDate && log.timestamp < criteria.startDate) {
      return false;
    }
    if (criteria.endDate && log.timestamp > criteria.endDate) {
      return false;
    }
    return true;
  });
}

// ============= EXPORT FUNCTIONS =============
export {
  RFIDAccessLog,
  logRFIDAccessToFirestore,
  listenForRealtimeRFIDScans,
  getRecentRFIDAccess,
  getTenantAccessHistory,
  getTodaysAccessLog,
  subscribeToRFIDAccessLog,
  displayAccessLogTable,
  getAccessStatistics,
  displayAccessStatistics,
  exportAccessLogToCSV,
  searchAccessLogs
};
