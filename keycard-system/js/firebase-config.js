// Firebase Configuration
// IMPORTANT: Replace these with your actual Firebase configuration values
const firebaseConfig = {
  apiKey: "AIzaSyB57BZuTGpgOnr61juuMr9hpzQlcu0iJB8",
  authDomain: "admin-96f1c.firebaseapp.com",
  databaseURL: "https://admin-96f1c-default-rtdb.firebaseio.com",
  projectId: "admin-96f1c",
  storageBucket: "admin-96f1c.firebasestorage.app",
  messagingSenderId: "1019964386782",
  appId: "1:1019964386782:web:714590229a9505bb31c14f",
};

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);

// Set persistence for auto-login
setPersistence(auth, browserLocalPersistence);

// Helper function to check if user is logged in
export function checkAuth() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged((user) => {
            resolve(user);
        });
    });
}

// Helper function to get current user
export function getCurrentUser() {
    return auth.currentUser;
}
