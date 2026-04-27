import { navigateTo, initRouter, handleUserAuth } from './router.js';
import {
    initFirebase,
    listenForNotifications,
    loginWithEmail,
    signUpWithEmail,
    loginWithGoogle,
    logoutUser,
    monitorAuth,
    saveToSchedule,
    getUserProfile,
    deleteUserAccount,
    submitAssistanceRequest,
    cleanupExpiredData,
    deleteTicket,
} from './firebase-config.js';

export let currentUser = null;
let isSignupMode = false;

const setupAuthUI = () => {
    const authOverlay = document.getElementById('auth-overlay');
    const errText = document.getElementById('auth-error');
    const toggleBtn = document.getElementById('btn-toggle-auth');
    const primaryBtn = document.getElementById('btn-auth-primary');
    const signupFields = document.getElementById('signup-fields');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');

    const updateAuthUI = () => {
        if (isSignupMode) {
            authTitle.innerText = 'Create Account';
            authSubtitle.innerText = 'Join the VenueShield AI Crisis Response today.';
            signupFields.style.display = 'block';
            primaryBtn.innerHTML =
                '<i class="fa-solid fa-user-plus" style="margin-right: 8px;"></i> Sign Up';
            toggleBtn.innerText = 'Already have an account? Sign In';
        } else {
            authTitle.innerText = 'Login required';
            authSubtitle.innerText = 'Please login to access the VenueShield AI Crisis Response.';
            signupFields.style.display = 'none';
            primaryBtn.innerHTML =
                '<i class="fa-solid fa-right-to-bracket" style="margin-right: 8px;"></i> Sign In';
            toggleBtn.innerText = 'Need an account? Sign Up';
        }
    };

    toggleBtn.addEventListener('click', () => {
        isSignupMode = !isSignupMode;
        updateAuthUI();
    });

    const handleAuth = async (actionFn) => {
        errText.innerText = '';
        try {
            await actionFn();
            authOverlay.classList.add('hidden');
            navigateTo('home');
        } catch (e) {
            errText.innerText = e.message;
        }
    };

    primaryBtn.addEventListener('click', () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;

        if (isSignupMode) {
            const name = document.getElementById('reg-name').value;
            const address = document.getElementById('reg-address').value;
            handleAuth(() => signUpWithEmail(email, pass, { name, address }));
        } else {
            handleAuth(() => loginWithEmail(email, pass));
        }
    });

    // Reset UI to login mode on start
    isSignupMode = false;
    updateAuthUI();

    document.getElementById('btn-google').addEventListener('click', () => {
        handleAuth(loginWithGoogle);
    });

    monitorAuth((user) => {
        currentUser = user;
        handleUserAuth(user);
        if (user) {
            authOverlay.classList.add('hidden');
            if (window.location.pathname === '/') window.location.hash = '#home';
            cleanupExpiredData(user.uid);
        } else {
            authOverlay.classList.remove('hidden');
        }
    });
};

const setupModals = () => {
    const modalContainer = document.getElementById('modal-container');
    const modalInner = document.getElementById('modal-inner');

    // Close Modal Flow
    document.getElementById('close-modal').addEventListener('click', () => {
        modalContainer.classList.add('hidden');
    });

    // Global Click Delegation
    document.body.addEventListener('click', async (e) => {
        if (e.target.closest('#user-profile-btn')) {
            const profile = await getUserProfile(currentUser?.uid);
            modalInner.innerHTML = `
                <div style="text-align: center;">
                    <i class="fa-solid fa-circle-user" style="font-size: 64px; color: var(--color-primary); margin-bottom: 15px;"></i>
                    <h3 style="color: var(--color-primary); margin-bottom: 5px;">${profile?.name || currentUser?.email || 'Guest User'}</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 5px; font-size: 14px;">${currentUser?.email}</p>
                    <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 12px;"><i class="fa-solid fa-location-dot"></i> ${profile?.address || 'Address not set'}</p>
                    
                    ${currentUser ? '<a href="/admin.html" class="btn btn-primary" style="display:block; text-decoration:none; margin-bottom: 10px;">Manage My Events</a>' : ''}
                    <button id="btn-logout" class="btn btn-alert" style="width: 100%; margin-bottom: 10px;">Sign Out</button>
                    <button id="btn-delete-account" style="width: 100%; background: transparent; border: none; color: #ff5252; font-size: 11px; cursor: pointer; text-decoration: underline;">Permanently Delete Account</button>
                </div>
            `;
            modalContainer.classList.remove('hidden');
        }

        if (e.target.closest('#btn-logout')) {
            logoutUser().then(() => {
                modalContainer.classList.add('hidden');

                // Clear UI state
                currentUser = null;
                isSignupMode = false;

                // Manually clear inputs in case of browser auto-fill/cache
                const emailField = document.getElementById('auth-email');
                const passField = document.getElementById('auth-pass');
                const nameField = document.getElementById('reg-name');
                const addrField = document.getElementById('reg-address');

                if (emailField) emailField.value = '';
                if (passField) passField.value = '';
                if (nameField) nameField.value = '';
                if (addrField) addrField.value = '';

                // Fully reload to clear all in-memory variables and listeners
                window.location.href = '/';
            });
        }

        if (e.target.closest('#btn-delete-account')) {
            if (
                confirm(
                    'WARNING: This will permanently delete your account and all profile data. This cannot be undone. Proceed?'
                )
            ) {
                deleteUserAccount()
                    .then(() => {
                        alert('Account deleted successfully.');
                        window.location.href = '/';
                    })
                    .catch((err) => {
                        alert(err.message);
                    });
            }
        }

        if (e.target.closest('.btn-delete-ticket')) {
            const btn = e.target.closest('.btn-delete-ticket');
            const evId = btn.getAttribute('data-event-id');
            const tktId = btn.getAttribute('data-ticket-id');
            if (confirm('Return this ticket? This will free up your spot for others.')) {
                deleteTicket(evId, tktId)
                    .then(() => {
                        navigateTo('home'); // Refresh
                    })
                    .catch((err) => alert('Error returning ticket: ' + err.message));
            }
        }
        if (e.target.closest('.btn-save-schedule')) {
            const btn = e.target.closest('.btn-save-schedule');
            const eventId = btn.getAttribute('data-event-id');
            if (currentUser) {
                saveToSchedule(currentUser.uid, eventId)
                    .then(() => {
                        btn.innerHTML = `<i class="fa-solid fa-check" style="margin-right:8px;"></i> Saved`;
                        btn.classList.add('saved');
                        btn.style.background = 'var(--color-success)';
                        btn.disabled = true;
                    })
                    .catch((err) => alert('Failed to save event.'));
            } else {
                document.getElementById('auth-overlay').classList.remove('hidden');
            }
        }

        if (e.target.closest('#btn-sync-calendar')) {
            import('./calendar-sync.js').then((module) => {
                module.syncGoogleCalendar();
            });
        }

        // Assistance Modal Handlers handled in router.js setupLocator
    });
};

const initApp = async () => {
    console.log('🚀 Starting VSAI UI Initialization...');
    // 1. Initialize Firebase (waits for server API keys)
    await initFirebase();
    console.log('✅ Firebase init sequence finished (isLive: ' + window.isLive + ')');

    // Initialize Router Listeners
    initRouter();

    // 2. Setup Modals & Auth Listeners
    setupModals();
    setupAuthUI();
    console.log('✅ Modals and Auth UI bound');

    // 3. Setup router hash listener
    window.addEventListener('hashchange', () => {
        const route = window.location.hash.replace('#', '') || 'home';
        navigateTo(route);
    });

    // Attach click listeners to bottom nav
    document.querySelectorAll('.nav-item').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const route = el.getAttribute('data-route');
            if (route) window.location.hash = '#' + route;
        });
    });

    // Push Notifications
    const banner = document.createElement('div');
    banner.className = 'notification-banner emergency hidden';
    banner.innerHTML = `
        <i class="fa-solid fa-bullhorn" style="font-size: 24px;"></i>
        <div style="flex:1;">
            <strong style="display:block; margin-bottom:2px;">Emergency Alert</strong>
            <span id="notif-text"></span>
        </div>
        <button id="close-notif" style="background:none; border:none; color:var(--text-inverse); cursor:pointer;"><i class="fa-solid fa-times"></i></button>
    `;
    document.body.appendChild(banner);
    document
        .getElementById('close-notif')
        .addEventListener('click', () => banner.classList.add('hidden'));

    listenForNotifications((data) => {
        document.getElementById('notif-text').innerText = data.message;
        if (data.type === 'emergency') {
            banner.className = 'notification-banner emergency';
            banner.querySelector('strong').innerText = 'Emergency Alert';
            banner.querySelector('i').className = 'fa-solid fa-bullhorn';
        } else {
            banner.className = 'notification-banner offer';
            banner.querySelector('strong').innerText = 'Event Update';
            banner.querySelector('i').className = 'fa-solid fa-circle-info';
        }
        banner.classList.remove('hidden');
    });

    // Trigger initial route
    navigateTo(window.location.hash.replace('#', '') || 'home');
    console.log('✅ App initialization complete!');
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
