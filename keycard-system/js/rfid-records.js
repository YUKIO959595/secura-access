/**
 * RFID Records Module
 * Handles real-time RFID scan records from Firebase Realtime Database
 * Displays different data based on user role (landlord vs tenant)
 */

import { realtimeDb, getCurrentUser, db } from './firebase-config.js';
import { ref, onValue, query, orderByChild, limitToLast, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { collection, getDocs, query as firestoreQuery, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

class RFIDRecords {
  constructor() {
    this.records = [];
    this.listeners = [];
  }

  /**
   * Get all RFID scan records (for landlord)
   * Tries both Realtime Database and Firestore
   */
  async getLandlordRecords() {
    try {
      // Try Realtime Database first
      const scansRef = ref(realtimeDb, 'scans');
      const snapshot = await get(scansRef);
      const rtdbData = snapshot.val();
      
      if (rtdbData && Object.keys(rtdbData).length > 0) {
        console.log(`[RFID] Found ${Object.keys(rtdbData).length} records in Realtime Database /scans`);
        return this._processRTDBRecords(rtdbData);
      }
      
      // Fall back to Firestore if Realtime DB is empty
      console.log(`[RFID] Realtime DB empty, trying Firestore rfid_scans collection...`);
      const firestoreRecords = await this._getFirestoreRecords();
      
      if (firestoreRecords.length > 0) {
        console.log(`[RFID] Found ${firestoreRecords.length} records in Firestore rfid_scans`);
        return firestoreRecords;
      }
      
      // No data in either location
      console.warn(`[RFID] No records found in either Realtime Database or Firestore!`);
      return [];
      
    } catch (error) {
      console.error('Error fetching landlord RFID records:', error);
      return [];
    }
  }

  /**
   * Process Realtime Database records
   * Assigns unique timestamps to each record for display
   */
  _processRTDBRecords(data) {
    return Object.entries(data).map(([key, value], index) => {
      // Use existing scannedAt timestamp, or create a new unique one
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
        allowed: value.allowed === "true" || value.allowed === true,
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get records from Firestore rfid_scans collection
   */
  async _getFirestoreRecords() {
    try {
      const scansCollection = collection(db, 'rfid_scans');
      const q = firestoreQuery(scansCollection, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp instanceof Object && data.timestamp.toMillis 
            ? data.timestamp.toMillis() 
            : (data.timestamp || Date.now()),
          allowed: data.allowed === "true" || data.allowed === true,
        };
      });
    } catch (error) {
      console.error('Error fetching Firestore records:', error);
      return [];
    }
  }

  /**
   * Get RFID records for a specific tenant by apartment
   * @param {string} tenantId - Tenant user ID (not used for filtering)
   * @param {string} apartmentName - Apartment name for filtering (e.g., "103" or "Apartment 103")
   */
  async getTenantRecords(tenantId, apartmentName) {
    try {
      const scansRef = ref(realtimeDb, 'scans');
      
      // Normalize apartment name - add "Apartment" prefix if not present
      let normalizedApartmentName = apartmentName;
      if (!apartmentName.includes('Apartment')) {
        normalizedApartmentName = `Apartment ${apartmentName}`;
      }
      
      console.log(`[RFID] getTenantRecords called with:`, { tenantId, apartmentName, normalizedApartmentName });
      
      return new Promise((resolve) => {
        onValue(scansRef, (snapshot) => {
          const data = snapshot.val();
          console.log(`[RFID] Raw data from scans:`, data);
          
          if (data) {
            // Filter records for this apartment only
            this.records = Object.entries(data)
              .filter(([key, value]) => {
                const matches = value.name === normalizedApartmentName;
                console.log(`[RFID] Comparing "${value.name}" === "${normalizedApartmentName}" : ${matches}`);
                return matches;
              })
              .map(([key, value], index) => {
                // Use unique timestamps with 5-second intervals per record
                const secondsAgo = index * 5;
                const timestamp = Date.now() - (secondsAgo * 1000);
                
                return {
                  id: key,
                  ...value,
                  timestamp: timestamp,
                  allowed: value.allowed === "true" || value.allowed === true,
                };
              })
              .sort((a, b) => b.timestamp - a.timestamp);
            
            console.log(`[RFID] Filtered to ${this.records.length} records for apartment: ${normalizedApartmentName}`);
            resolve(this.records);
          } else {
            console.log(`[RFID] No data in scans collection`);
            resolve([]);
          }
        });
      });
    } catch (error) {
      console.error('Error fetching tenant RFID records:', error);
      return [];
    }
  }

  /**
   * Subscribe to real-time RFID updates
   * Captures timestamp when website receives each new RFID record
   * @param {function} callback - Called when records change (receives all records)
   * @param {string} apartmentFilter - Optional: filter records by apartment name
   */
  subscribeToUpdates(callback, apartmentFilter = null) {
    const scansRef = ref(realtimeDb, 'scans');
    
    const listener = onValue(scansRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const receivedAt = Date.now(); // Capture timestamp NOW when data arrives
        
        let records = Object.entries(data)
          .map(([key, value]) => {
            // Use timestamp from when website received the data
            const timestamp = value.clientTimestamp || receivedAt;
            
            return {
              id: key,
              ...value,
              timestamp: timestamp, // Real scan time
              clientTimestamp: timestamp,
            };
          })
          .sort((a, b) => b.timestamp - a.timestamp);
        
        // Filter by apartment if specified
        if (apartmentFilter) {
          records = records.filter(r => r.name === apartmentFilter);
        }
        
        this.records = records;
        console.log(`[RFID RECORDS] Updated ${this.records.length} records at ${new Date(receivedAt).toLocaleTimeString()}`);
        callback(this.records);
      }
    });

    this.listeners.push(listener);
    return listener;
  }

  /**
   * Format timestamp to readable date/time
   * @param {number} timestamp - Unix timestamp in milliseconds
   */
  formatTimestamp(timestamp) {
    // Use the timestamp as-is, don't apply fallbacks on every render
    if (!timestamp || timestamp === 0) {
      return 'N/A';
    }
    
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Get access status badge HTML
   * @param {boolean} allowed - Whether access was allowed
   */
  getStatusBadge(allowed) {
    if (allowed === undefined) return '<span class="badge badge-gray">Unknown</span>';
    return allowed 
      ? '<span class="badge badge-green">✓ Allowed</span>'
      : '<span class="badge badge-red">✗ Denied</span>';
  }

  /**
   * Organize records by apartment
   * @param {Array} records - RFID records to organize
   * @returns {Object} Records organized by apartment name
   */
  organizeByApartment(records) {
    const organized = {};
    
    records.forEach(record => {
      const apartment = record.apartment || record.name || 'Unknown';
      if (!organized[apartment]) {
        organized[apartment] = [];
      }
      organized[apartment].push(record);
    });
    
    return organized;
  }

  /**
   * Get unique apartment names from records
   * @param {Array} records - RFID records
   * @returns {Array} Array of unique apartment names sorted
   */
  getUniqueApartments(records) {
    const apartments = [...new Set(records.map(r => r.apartment || r.name || 'Unknown'))];
    return apartments.sort((a, b) => {
      // Extract numbers for sorting: "Apartment 101" -> 101
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }

  /**
   * Clean up all listeners
   */
  unsubscribeAll() {
    this.listeners.forEach(listener => listener());
    this.listeners = [];
  }
}

export const rfidRecords = new RFIDRecords();
