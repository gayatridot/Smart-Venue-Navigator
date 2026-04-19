import { renderHome, renderHeatmap, renderQueues, renderLocator } from './components.js';
import { listenForEvents, getUserSchedule, listenForQueues, listenForHeatmap, listenForMyTicket, requestTicket, listenForMyRequests, submitAssistanceRequest, getUserProfile } from './firebase-config.js';
import { currentUser } from './app.js';

let liveEvents = [];
let savedScheduleIds = [];
let liveQueues = [];
let liveZones = [];
let currentRoute = 'home';
let heatmapMap = null;
let heatmapLayer = null;
let myTickets = [];
let myTicketRequests = [];
let searchQuery = '';

export async function navigateTo(routeId) {
    currentRoute = routeId;
    const mainContent = document.getElementById('main-content');
    
    // Update active nav state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const targetNav = document.querySelector(`.nav-item[data-route="${routeId}"]`);
    if(targetNav) targetNav.classList.add('active');

    if(routeId === 'home') {
        if (currentUser) {
            savedScheduleIds = await getUserSchedule(currentUser.uid);
        } else {
            savedScheduleIds = [];
        }

        const filteredEvents = liveEvents.filter(e => 
            (e.name || e.title || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        mainContent.innerHTML = renderHome(filteredEvents, savedScheduleIds, myTickets, myTicketRequests, searchQuery);
        setupHomeListeners();
    } else if (routeId === 'heatmap') {
        mainContent.innerHTML = renderHeatmap(liveZones);
        initHeatmapMap();
    } else if (routeId === 'queues') {
        mainContent.innerHTML = renderQueues(liveQueues);
    } else if (routeId === 'locator') {
        mainContent.innerHTML = renderLocator();
        setupLocator();
    }
}

// Map logic
async function initHeatmapMap() {
    const mapDiv = document.getElementById('heatmap-map');
    if (!mapDiv) return;
    
    try {
        const res = await fetch('/api/maps-config');
        const { apiKey } = await res.json();
        
        if (!window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`;
            script.async = true;
            document.head.appendChild(script);
            
            script.onload = () => setupGoogleMap(mapDiv);
        } else {
            setupGoogleMap(mapDiv);
        }
    } catch(e) {
        console.error("Map init failed", e);
    }
}

function setupGoogleMap(mapDiv) {
    heatmapMap = new google.maps.Map(mapDiv, {
        zoom: 17,
        center: { lat: 51.556, lng: -0.279 }, // Wembley Stadium
        mapTypeId: 'satellite',
        disableDefaultUI: true
    });
    
    heatmapLayer = new google.maps.visualization.HeatmapLayer({
        data: getHeatmapPoints(),
        map: heatmapMap,
        radius: 50,
        opacity: 0.8
    });
}

function getHeatmapPoints() {
    if (!window.google) return [];
    return liveZones.map(z => {
        return {
            location: new google.maps.LatLng(z.lat || 51.556, z.lng || -0.279),
            weight: z.congestion || 0
        };
    });
}

function updateHeatmapUI() {
    const listDiv = document.getElementById('heatmap-zones-list');
    if (listDiv) {
        listDiv.innerHTML = liveZones.length > 0 ? liveZones.map(z => {
            let color = "var(--color-success)";
            let width = "25%";
            let label = "Fast Moving";
            if (z.status === 'moderate') { color = "var(--color-warning)"; width = "60%"; label = "Moderate Traffic"; }
            if (z.status === 'busy') { color = "var(--color-danger)"; width = "95%"; label = "Congested Area"; }
            return `
                <div class="card" style="margin-bottom: 12px; padding: 18px; border-left: 4px solid ${color};">
                    <div class="flex-row" style="margin-bottom: 12px;">
                        <div>
                            <span style="font-weight: 800; font-size: 1rem; display: block;">${z.name}</span>
                            <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Zone ID: ${z.id}</span>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge" style="background: ${color}20; color: ${color}; font-size: 0.65rem;">${label}</span>
                        </div>
                    </div>
                    <div style="height: 8px; width: 100%; background: var(--bg-surface-elevated); border-radius: 10px; overflow: hidden; position: relative;">
                        <div style="height: 100%; width: ${width}; background: ${color}; border-radius: 10px; transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                    </div>
                </div>
            `;
        }).join('') : `
            <div style="text-align: center; padding: 40px 20px; background: white; border-radius: var(--border-radius-lg); border: 2px dashed var(--bg-surface-elevated);">
                <i class="fa-solid fa-map-location" style="font-size: 2.5rem; color: var(--bg-surface-elevated); margin-bottom: 15px;"></i>
                <h4 style="color: var(--text-secondary);">No Active Signals</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted);">Administrators haven't configured any density zones yet.</p>
            </div>
        `;
    }
    
    if (heatmapLayer && window.google) {
        heatmapLayer.setData(getHeatmapPoints());
    }
}

export function initRouter() {
    // Start listeners after Firebase is initialized
    listenForEvents((events) => {
        liveEvents = events;
        if (currentRoute === 'home') navigateTo('home');
    });

    listenForQueues((queues) => {
        liveQueues = queues;
        if (currentRoute === 'queues') navigateTo('queues');
    });

    listenForHeatmap((zones) => {
        liveZones = zones;
        if (currentRoute === 'heatmap') updateHeatmapUI();
    });
}

export function handleUserAuth(user) {
    if (user && user.email) {
        listenForMyTicket(user.email, (tickets) => {
            myTickets = tickets;
            if (currentRoute === 'home') navigateTo('home');
        });
        listenForMyRequests(user.email, (requests) => {
            myTicketRequests = requests;
            if (currentRoute === 'home') navigateTo('home');
        });
    } else {
        myTickets = [];
        myTicketRequests = [];
        if (currentRoute === 'home') navigateTo('home');
    }
}

function setupHomeListeners() {
    document.querySelectorAll('.btn-request-ticket').forEach(btn => {
        btn.onclick = async () => {
            if (!currentUser) return alert("Please log in first!");
            const eventId = btn.getAttribute('data-event-id');
            const eventTitle = btn.getAttribute('data-event-title');
            
            const event = liveEvents.find(e => e.id === eventId);
            
            // Check for existing ticket/request if multi-ticket is disabled
            const hasTicket = myTickets.some(t => t.eventId === eventId);
            const hasRequest = myTicketRequests.some(r => r.eventId === eventId && r.status !== 'fulfilled');
            
            if (event && !event.allowMulti && (hasTicket || hasRequest)) {
                return alert("This event only allows one ticket per user. You already have a ticket or a pending request.");
            }

            const feeInfo = (event && event.chargeFees) ? `\n\nNote: This event has an entry fee: ${event.feeNote || 'Amount TBA'}` : '';
            
            const name = prompt(`Enter your Full Name to request a ticket for ${eventTitle}:${feeInfo}`);
            if (!name) return;
            
            try {
                btn.disabled = true;
                btn.innerText = "Sending...";
                await requestTicket(eventId, eventTitle, name, currentUser.email, event.ownerId);
                alert("Ticket request sent! The admin will review it and may set payment conditions.");
                
                // 30s cooldown
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerText = "Request Ticket";
                }, 30000);
            } catch (e) {
                alert("Failed to send request.");
                btn.disabled = false;
                btn.innerText = "Request Ticket";
            }
        };
    });

    const searchInput = document.getElementById('event-search');
    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            navigateTo('home');
            const newSearch = document.getElementById('event-search');
            if (newSearch) {
                newSearch.focus();
                newSearch.setSelectionRange(searchQuery.length, searchQuery.length);
            }
        };
    }
}

function setupLocator() {
    const btnRequest = document.getElementById('btn-request-assistance');
    const modal = document.getElementById('assistance-modal');
    const btnClose = document.getElementById('btn-close-assistance');
    const btnSubmit = document.getElementById('btn-submit-assistance');
    const textMsg = document.getElementById('assistance-message');
    const statusText = document.getElementById('assistance-status');
    const btnShareLocation = document.getElementById('btn-share-location');
    const shareStatus = document.getElementById('share-location-status');

    if (btnShareLocation) {
        btnShareLocation.addEventListener('click', async () => {
            if (!currentUser) {
                document.getElementById('auth-overlay').classList.remove('hidden');
                return;
            }
            shareStatus.innerText = "Getting location...";
            shareStatus.style.color = 'var(--text-secondary)';
            
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    try {
                        const { updateUserLocation, getUserProfile } = await import('./firebase-config.js');
                        const profile = await getUserProfile(currentUser.uid);
                        const latestTicket = myTickets && myTickets.length > 0 ? myTickets[0] : null;
                        
                        await updateUserLocation(currentUser.uid, { 
                            lat, lng, 
                            userName: profile?.name || currentUser.displayName || 'Guest User',
                            eventOwnerId: latestTicket?.eventOwnerId || null 
                        });
                        shareStatus.innerText = "Location shared successfully!";
                        shareStatus.style.color = 'var(--color-success)';
                    } catch (e) {
                        shareStatus.innerText = "Failed to share location.";
                        shareStatus.style.color = 'var(--color-danger)';
                    }
                }, (err) => {
                    shareStatus.innerText = "Location access denied or unavailable.";
                    shareStatus.style.color = 'var(--color-danger)';
                });
            } else {
                shareStatus.innerText = "Geolocation not supported.";
                shareStatus.style.color = 'var(--color-danger)';
            }
        });
    }

    if (btnRequest && modal && btnClose && btnSubmit) {
        btnRequest.addEventListener('click', () => {
            const select = document.getElementById('assistance-event-context');
            if (select) {
                // Populate dropdown with user's active tickets
                if (window.myTickets && window.myTickets.length > 0) {
                    select.innerHTML = '<option value="">No specific event (General Help)</option>' + 
                        window.myTickets.map(t => `<option value="${t.eventId}" data-owner="${t.eventOwnerId}">${t.eventTitle}</option>`).join('');
                } else {
                    select.innerHTML = '<option value="">No specific event (General Help)</option>';
                }
            }
            modal.classList.remove('hidden');
            statusText.innerText = '';
            textMsg.value = '';
        });

        btnClose.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        btnSubmit.addEventListener('click', async () => {
            const message = textMsg.value.trim();
            if (!message) {
                statusText.innerText = 'Please enter a message.';
                statusText.style.color = 'var(--color-danger)';
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.innerText = 'Sending...';
            statusText.innerText = '';

            try {
                // 1. Get User Profile for full details
                const profile = await getUserProfile(currentUser.uid);
                const userName = profile?.name || currentUser.displayName || 'Anonymous User';
                
                // 2. Try to get current position if available, or use mock
                let location = { lat: 51.556, lng: -0.279 }; // Default Wembley
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                } catch (e) { console.warn("Using fallback location for assistance request"); }

                // 3. Save to Firestore for Real-time Dashboard
                const select = document.getElementById('assistance-event-context');
                const selectedOpt = select.options[select.selectedIndex];
                const selectedEventId = select.value;
                const selectedOwnerId = selectedOpt?.dataset.owner || null;
                const selectedEventTitle = selectedOpt?.text || "General Help";

                await submitAssistanceRequest({
                    userName,
                    userEmail: currentUser.email,
                    message,
                    location,
                    eventName: selectedEventTitle,
                    eventTime: new Date().toLocaleTimeString(),
                    eventOwnerId: selectedOwnerId,
                    eventId: selectedEventId
                });

                // 4. Send Email via API (Existing flow)
                const response = await fetch('/api/send-assistance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message, 
                        userLocation: `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
                        userName,
                        userEmail: currentUser.email
                    })
                });
                
                const data = await response.json();
                if (response.ok) {
                    statusText.innerText = 'Request sent successfully! Cooldown active.';
                    statusText.style.color = 'var(--color-success)';
                    
                    // 60s cooldown for emergency help to prevent spam
                    setTimeout(() => {
                        modal.classList.add('hidden');
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 8px;"></i> Send Request';
                    }, 60000);
                } else {
                    throw new Error(data.error || 'Failed to send request');
                }
            } catch (error) {
                statusText.innerText = error.message;
                statusText.style.color = 'var(--color-danger)';
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane" style="margin-right: 8px;"></i> Send Request';
            }
        });
    }
}
