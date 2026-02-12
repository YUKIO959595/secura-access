import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeFirestoreDatabase } from './firestore-init.js';

console.log('Landlord auth script loaded');

// Initialize landlord login form
function initializeLandlordLoginForm() {
    const landlordLoginForm = document.getElementById('landlordLoginForm');
    if (!landlordLoginForm) {
        console.log('landlordLoginForm not found, retrying...');
        setTimeout(initializeLandlordLoginForm, 500);
        return;
    }
    
    console.log('Setting up landlord login form listener');
    
    landlordLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Landlord login form submitted');
        
        const email = document.getElementById('landlordEmail').value.trim();
        const password = document.getElementById('landlordPassword').value.trim();
        const rememberMe = document.getElementById('landlordRememberMe').checked;
        const errorDiv = document.getElementById('landlordError');
        
        if (!email || !password) {
            errorDiv.textContent = 'Please enter both email and password.';
            errorDiv.style.display = 'block';
            return;
        }
        
        errorDiv.textContent = 'Logging in...';
        errorDiv.style.color = '#333';
        errorDiv.style.display = 'block';
        
        try {
            console.log('Attempting Firebase login for:', email);
            // Check if user is a landlord/admin
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('Firebase auth successful, checking landlord status');
            
            // Verify user is a landlord/admin
            const landlordsRef = collection(db, 'landlords');
            const q = query(landlordsRef, where('email', '==', email));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                console.log('User is not in landlords collection');
                await signOut(auth);
                throw new Error('Access denied. This account is not authorized as a landlord/admin.');
            }
            
            console.log('User verified as landlord');
            
            // Save credentials if remember me is checked
            if (rememberMe) {
                localStorage.setItem('landlordEmail', email);
                localStorage.setItem('landlordPassword', password);
                localStorage.setItem('landlordRememberMe', 'true');
            } else {
                localStorage.removeItem('landlordEmail');
                localStorage.removeItem('landlordPassword');
                localStorage.removeItem('landlordRememberMe');
            }
            
            // Save user type
            localStorage.setItem('userType', 'landlord');
            localStorage.setItem('userId', user.uid);
            
            // Auto-initialize Firestore database on first landlord login
            console.log('Initializing Firestore database...');
            await initializeFirestoreDatabase();
            
            // If already on landlord.html, reload; otherwise navigate to it
            errorDiv.textContent = 'Login successful!';
            errorDiv.style.color = '#4caf50';
            
            setTimeout(() => {
                window.location.href = 'landlord-dashboard.html';
            }, 1000);
            
        } catch (error) {
            console.error('Landlord login error:', error);
            errorDiv.textContent = error.message || 'Login failed. Please check your credentials.';
            errorDiv.style.color = '#d32f2f';
            errorDiv.style.display = 'block';
        }
    });
}

// Check for saved credentials on page load
function autoPopulateLandlordCredentials() {
    const savedEmail = localStorage.getItem('landlordEmail');
    const savedPassword = localStorage.getItem('landlordPassword');
    const rememberMe = localStorage.getItem('landlordRememberMe') === 'true';
    
    if (rememberMe && savedEmail && savedPassword) {
        const emailInput = document.getElementById('landlordEmail');
        const passwordInput = document.getElementById('landlordPassword');
        const rememberMeCheckbox = document.getElementById('landlordRememberMe');
        
        if (emailInput) emailInput.value = savedEmail;
        if (passwordInput) passwordInput.value = savedPassword;
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded - initializing landlord auth');
        autoPopulateLandlordCredentials();
        initializeLandlordLoginForm();
    });
} else {
    console.log('Document already loaded - initializing landlord auth');
    autoPopulateLandlordCredentials();
    initializeLandlordLoginForm();
}

// Initialize form when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeLandlordLoginForm();
});
