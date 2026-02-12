import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, addDoc, doc, setDoc, serverTimestamp, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

console.log('Tenant auth script loaded');

// Signup form handler
function initializeSignupForm() {
    const signupForm = document.getElementById('tenantSignupForm');
    if (!signupForm) {
        console.log('tenantSignupForm not found, retrying...');
        setTimeout(initializeSignupForm, 500);
        return;
    }
    
    console.log('Setting up tenant signup form listener');
    
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Signup form submitted');
        
        const name = document.getElementById('tenantName')?.value.trim();
        const email = document.getElementById('tenantEmail')?.value.trim();
        const password = document.getElementById('tenantPassword')?.value.trim();
        const phone = document.getElementById('tenantPhone')?.value.trim();
        const unit = document.getElementById('tenantUnit')?.value.trim();
        const residents = parseInt(document.getElementById('tenantResidents')?.value || '1');
        const keycards = parseInt(document.getElementById('tenantKeycards')?.value || '1');
        const address = document.getElementById('tenantAddress')?.value.trim();
        const rfidCodeElement = document.getElementById('tenantRFIDCode');
        const rfidCode = rfidCodeElement ? rfidCodeElement.value.trim().toUpperCase() : '';
        const rememberMe = document.getElementById('tenantRememberMe')?.checked || false;
        const agreeTerms = document.getElementById('agreeTerms')?.checked || false;
        const agreePrivacy = document.getElementById('agreePrivacy')?.checked || false;
        
        const errorDiv = document.getElementById('tenantSignupError');
        const successDiv = document.getElementById('tenantSignupSuccess');
        
        console.log('Form values:', {name, email, phone, unit, rfidCode});
        
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
        if (successDiv) {
            successDiv.textContent = '';
            successDiv.style.display = 'none';
        }
        
        // Validation
        if (!name || !email || !password || !phone || !unit || !address || !residents || !keycards) {
            const msg = 'Please fill in all required fields.';
            console.error(msg);
            if (errorDiv) {
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (password.length < 6) {
            const msg = 'Password must be at least 6 characters long.';
            console.error(msg);
            if (errorDiv) {
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (!agreeTerms || !agreePrivacy) {
            const msg = 'Please agree to the Terms and Conditions and Privacy Agreement.';
            console.error(msg);
            if (errorDiv) {
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        try {
            console.log('Creating user account for:', email);
            // Create user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('Firebase auth account created, setting up tenant profile');
            
            // Create tenant document
            const tenantData = {
                userId: user.uid,
                name: name,
                email: email,
                phone: phone,
                unit: unit,
                address: address,
                rfidCode: rfidCode || null,
                rfidCodes: rfidCode ? [rfidCode] : [],
                residents: residents,
                keycardsUsing: keycards,
                keycardsNeeded: keycards,
                keycardStatus: 'active',
                keycardValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: 'active',
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
            
            await setDoc(doc(db, 'tenants', user.uid), tenantData);
            console.log('Tenant profile created in Firestore');
            
            // Save credentials if remember me is checked
            if (rememberMe) {
                localStorage.setItem('tenantEmail', email);
                localStorage.setItem('tenantPassword', password);
                localStorage.setItem('tenantRememberMe', 'true');
            }
            
            // Save user type
            localStorage.setItem('userType', 'tenant');
            localStorage.setItem('userId', user.uid);
            
            if (successDiv) {
                successDiv.textContent = 'Account created successfully! Redirecting...';
                successDiv.style.display = 'block';
                successDiv.style.color = '#4caf50';
            }
            
            setTimeout(() => {
                // Navigate to tenant dashboard
                window.location.href = 'tenant-dashboard.html';
            }, 2000);
            
        } catch (error) {
            console.error('Signup error:', error);
            if (errorDiv) {
                errorDiv.textContent = error.message || 'Signup failed. Please try again.';
                errorDiv.style.display = 'block';
                errorDiv.style.color = '#d32f2f';
            }
        }
    });
}

// Login form handler
function initializeLoginForm() {
    const loginForm = document.getElementById('tenantLoginForm');
    if (!loginForm) {
        console.log('tenantLoginForm not found, retrying...');
        setTimeout(initializeLoginForm, 500);
        return;
    }
    
    console.log('Setting up tenant login form listener');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Login form submitted');
        
        const email = document.getElementById('tenantEmailLogin').value.trim();
        const password = document.getElementById('tenantPasswordLogin').value.trim();
        const rememberMe = document.getElementById('tenantRememberMe').checked;
        const errorDiv = document.getElementById('tenantError');
        
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
            // Sign in user
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log('Firebase auth successful, checking tenant status');
            
            // Verify user is a tenant
            const tenantsRef = collection(db, 'tenants');
            const q = query(tenantsRef, where('userId', '==', user.uid));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                console.log('User is not in tenants collection');
                await signOut(auth);
                throw new Error('Access denied. This account is not authorized as a tenant.');
            }
            
            console.log('User verified as tenant');
            
            // Save credentials if remember me is checked
            if (rememberMe) {
                localStorage.setItem('tenantEmail', email);
                localStorage.setItem('tenantPassword', password);
                localStorage.setItem('tenantRememberMe', 'true');
            } else {
                localStorage.removeItem('tenantEmail');
                localStorage.removeItem('tenantPassword');
                localStorage.removeItem('tenantRememberMe');
            }
            
            // Save user type
            localStorage.setItem('userType', 'tenant');
            localStorage.setItem('userId', user.uid);
            
            // If already on tenant.html, reload; otherwise navigate to it
            errorDiv.textContent = 'Login successful!';
            errorDiv.style.color = '#4caf50';
            
            setTimeout(() => {
                window.location.href = 'tenant-dashboard.html';
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = error.message || 'Login failed. Please check your credentials.';
            errorDiv.style.color = '#d32f2f';
            errorDiv.style.display = 'block';
        }
    });
}

// Auto-populate login credentials
function autoPopulateTenantCredentials() {
    const savedEmail = localStorage.getItem('tenantEmail');
    const savedPassword = localStorage.getItem('tenantPassword');
    const rememberMe = localStorage.getItem('tenantRememberMe') === 'true';
    
    if (rememberMe && savedEmail && savedPassword) {
        const emailInput = document.getElementById('tenantEmailLogin');
        const passwordInput = document.getElementById('tenantPasswordLogin');
        const rememberMeCheckbox = document.getElementById('tenantRememberMe');
        
        if (emailInput) emailInput.value = savedEmail;
        if (passwordInput) passwordInput.value = savedPassword;
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded - initializing tenant auth');
        autoPopulateTenantCredentials();
        initializeSignupForm();
        initializeLoginForm();
        initializeForgotPasswordHandler();
    });
} else {
    console.log('Document already loaded - initializing tenant auth');
    autoPopulateTenantCredentials();
    initializeSignupForm();
    initializeLoginForm();
    initializeForgotPasswordHandler();
}

// Forgot Password Handler
function initializeForgotPasswordHandler() {
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const closeModal = document.getElementById('closeModal');
    const cancelResetBtn = document.getElementById('cancelResetBtn');
    const sendResetBtn = document.getElementById('sendResetBtn');
    const resetEmail = document.getElementById('resetEmail');
    const resetMessage = document.getElementById('resetMessage');

    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', () => {
            forgotPasswordModal.style.display = 'flex';
            resetEmail.value = '';
            resetMessage.textContent = '';
            resetMessage.style.display = 'none';
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            forgotPasswordModal.style.display = 'none';
            resetMessage.textContent = '';
            resetMessage.style.display = 'none';
        });
    }

    if (cancelResetBtn) {
        cancelResetBtn.addEventListener('click', () => {
            forgotPasswordModal.style.display = 'none';
            resetMessage.textContent = '';
            resetMessage.style.display = 'none';
        });
    }

    if (sendResetBtn) {
        sendResetBtn.addEventListener('click', async () => {
            const email = resetEmail.value.trim();
            
            if (!email) {
                resetMessage.textContent = 'Please enter your email address.';
                resetMessage.style.display = 'block';
                resetMessage.style.color = '#d32f2f';
                return;
            }
            
            try {
                resetMessage.textContent = 'Sending password reset email...';
                resetMessage.style.display = 'block';
                resetMessage.style.color = '#333';
                sendResetBtn.disabled = true;
                
                await sendPasswordResetEmail(auth, email);
                
                resetMessage.textContent = 'Password reset link has been sent to your email. Check your inbox and spam folder.';
                resetMessage.style.display = 'block';
                resetMessage.style.color = '#4caf50';
                
                setTimeout(() => {
                    forgotPasswordModal.style.display = 'none';
                    resetMessage.textContent = '';
                    resetMessage.style.display = 'none';
                    sendResetBtn.disabled = false;
                }, 3000);
                
            } catch (error) {
                sendResetBtn.disabled = false;
                resetMessage.textContent = error.message || 'Error sending reset email. Please try again.';
                resetMessage.style.display = 'block';
                resetMessage.style.color = '#d32f2f';
            }
        });
    }

    // Close modal when clicking outside
    if (forgotPasswordModal) {
        window.addEventListener('click', (event) => {
            if (event.target === forgotPasswordModal) {
                forgotPasswordModal.style.display = 'none';
                resetMessage.textContent = '';
                resetMessage.style.display = 'none';
            }
        });
    }
}
