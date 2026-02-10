import { db } from './firebase-config.js';
import { collection, getDocs, setDoc, doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Initialize Firestore Database Structure
 * Creates collections and sets up the database schema
 */
export async function initializeFirestoreDatabase() {
    try {
        console.log('Starting Firestore database initialization...');

        // Check and create 'landlords' collection
        await initializeLandlordsCollection();

        // Check and create 'tenants' collection
        await initializeTenantsCollection();

        // Check and create 'keycardRequests' collection
        await initializeKeycardRequestsCollection();

        // Check and create 'approvalRequests' collection
        await initializeApprovalRequestsCollection();

        console.log('✓ Firestore database initialized successfully!');
        return { success: true, message: 'Database initialized' };
    } catch (error) {
        console.error('✗ Error initializing Firestore:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Initialize Landlords Collection
 */
async function initializeLandlordsCollection() {
    const collectionRef = collection(db, 'landlords');
    
    try {
        const snapshot = await getDocs(collectionRef);
        
        // If collection doesn't exist or is empty, create it with a template
        if (snapshot.empty) {
            console.log('Creating landlords collection...');
            
            const templateDoc = {
                name: 'Admin Template',
                email: 'admin@example.com',
                role: 'admin',
                phone: '',
                company: '',
                address: '',
                propertyCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true,
                permissions: {
                    viewReports: true,
                    manageTenants: true,
                    manageKeycards: true,
                    approveRequests: true
                }
            };
            
            await setDoc(doc(collectionRef), templateDoc);
            console.log('✓ Landlords collection created');
        } else {
            console.log('✓ Landlords collection already exists');
        }
    } catch (error) {
        console.error('Error initializing landlords collection:', error);
        throw error;
    }
}

/**
 * Initialize Tenants Collection
 */
async function initializeTenantsCollection() {
    const collectionRef = collection(db, 'tenants');
    
    try {
        const snapshot = await getDocs(collectionRef);
        
        if (snapshot.empty) {
            console.log('Creating tenants collection...');
            
            const templateDoc = {
                userId: '',
                name: 'Tenant Template',
                email: 'tenant@example.com',
                phone: '',
                unit: '101',
                address: '',
                residents: 1,
                keycardsUsing: 1,
                keycardsNeeded: 1,
                keycardStatus: 'active',
                keycardValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true,
                pendingChanges: null,
                cameraPermissions: {
                    ownFootage: true,
                    additionalFootage: false
                },
                documentationStatus: {
                    idVerified: false,
                    addressVerified: false,
                    backgroundCheckDone: false
                }
            };
            
            await setDoc(doc(collectionRef), templateDoc);
            console.log('✓ Tenants collection created');
        } else {
            console.log('✓ Tenants collection already exists');
        }
    } catch (error) {
        console.error('Error initializing tenants collection:', error);
        throw error;
    }
}

/**
 * Initialize Keycard Requests Collection
 */
async function initializeKeycardRequestsCollection() {
    const collectionRef = collection(db, 'keycardRequests');
    
    try {
        const snapshot = await getDocs(collectionRef);
        
        if (snapshot.empty) {
            console.log('Creating keycardRequests collection...');
            
            const templateDoc = {
                tenantId: '',
                tenantName: '',
                requestType: 'new', // 'new', 'replacement', 'additional'
                quantity: 1,
                reason: '',
                status: 'pending', // 'pending', 'approved', 'rejected', 'issued'
                requestedAt: new Date(),
                respondedAt: null,
                respondedBy: '',
                approvalNotes: '',
                issuedDate: null,
                expiryDate: null,
                keycardNumbers: [],
                priority: 'normal' // 'low', 'normal', 'high'
            };
            
            await setDoc(doc(collectionRef), templateDoc);
            console.log('✓ KeycardRequests collection created');
        } else {
            console.log('✓ KeycardRequests collection already exists');
        }
    } catch (error) {
        console.error('Error initializing keycardRequests collection:', error);
        throw error;
    }
}

/**
 * Initialize Approval Requests Collection
 */
async function initializeApprovalRequestsCollection() {
    const collectionRef = collection(db, 'approvalRequests');
    
    try {
        const snapshot = await getDocs(collectionRef);
        
        if (snapshot.empty) {
            console.log('Creating approvalRequests collection...');
            
            const templateDoc = {
                requestId: '',
                requestType: 'keycard', // 'keycard', 'tenant', 'modification'
                tenantId: '',
                tenantName: '',
                requestDetails: {
                    currentValue: '',
                    requestedValue: '',
                    reason: ''
                },
                status: 'pending', // 'pending', 'approved', 'rejected'
                createdAt: new Date(),
                createdBy: '', // tenant ID or landlord ID
                reviewedAt: null,
                reviewedBy: '', // landlord ID
                reviewNotes: '',
                priority: 'normal',
                deadline: null,
                isUrgent: false
            };
            
            await setDoc(doc(collectionRef), templateDoc);
            console.log('✓ ApprovalRequests collection created');
        } else {
            console.log('✓ ApprovalRequests collection already exists');
        }
    } catch (error) {
        console.error('Error initializing approvalRequests collection:', error);
        throw error;
    }
}

/**
 * Reset entire database (WARNING: Deletes all data!)
 * Only use this for development/testing
 */
export async function resetFirestoreDatabase() {
    if (!confirm('⚠️ WARNING: This will delete ALL data in your Firestore database! Are you sure?')) {
        return { success: false, message: 'Cancelled' };
    }
    
    if (!confirm('Are you REALLY sure? This cannot be undone!')) {
        return { success: false, message: 'Cancelled' };
    }

    try {
        const collectionsToReset = ['landlords', 'tenants', 'keycardRequests', 'approvalRequests'];
        
        for (const collectionName of collectionsToReset) {
            const collectionRef = collection(db, collectionName);
            const snapshot = await getDocs(collectionRef);
            
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            console.log(`✓ Cleared ${collectionName} collection`);
        }
        
        // Re-initialize with templates
        await initializeFirestoreDatabase();
        
        return { success: true, message: 'Database reset and reinitialized' };
    } catch (error) {
        console.error('Error resetting database:', error);
        return { success: false, error: error.message };
    }
}
