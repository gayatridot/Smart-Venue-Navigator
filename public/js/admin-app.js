import {
    initFirebase,
    loginWithEmail,
    listenForUserEvents,
    saveEvent,
    updateEvent,
    deleteEvent,
    sendNotification,
    monitorAuth,
    updateQueue,
    updateHeatmap,
    listenForUserLocations,
    generateTickets,
    issueTicketToUser,
    getEventTicketsSummary,
    listenForTicketRequests,
    updateTicketRequestStatus,
    listenForAssistanceRequests,
    deleteAllMyEvents,
    saveDevice,
    deleteDevice,
    listenForDevices,
    secureConfig,
    listenForHeatmap,
    listenForEventTickets,
    addMoreTickets,
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    await initFirebase();

    const authView = document.getElementById('admin-auth');
    const dashView = document.getElementById('admin-dashboard');
    let editingId = null;
    let loggedInUser = null;
    let adminReqSearchQuery = '';

    // Tab Logic
    document.querySelectorAll('.nav-tab').forEach((tab) => {
        tab.onclick = () => {
            document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
        };
    });

    monitorAuth((user) => {
        if (user) {
            loggedInUser = user;
            authView.classList.add('hidden');
            dashView.classList.remove('hidden');
            document.getElementById('admin-display-name').innerText = user.email.split('@')[0];
            loadEvents();
        } else {
            loggedInUser = null;
            authView.classList.remove('hidden');
            dashView.classList.add('hidden');
        }
    });

    document.getElementById('btn-admin-login').addEventListener('click', async () => {
        const e = document.getElementById('admin-email').value;
        const p = document.getElementById('admin-pass').value;
        try {
            await loginWithEmail(e, p);
        } catch (error) {
            document.getElementById('admin-err').innerText = error.message;
        }
    });

    document.getElementById('btn-emergency').addEventListener('click', async () => {
        if (!confirm('ARE YOU SURE? THIS WILL ALERT EVERYONE.')) return;
        const btn = document.getElementById('btn-emergency');
        btn.innerText = 'BROADCASTING...';
        try {
            await sendNotification(
                'Emergency Alert: Proceed to nearest exits immediately. Avoid gates with high congestion.',
                'emergency'
            );
            alert('EMERGENCY ALERT BROADCASTED!');
        } catch (e) {
            alert('Failed to broadcast alert.');
        }
        btn.innerText = 'ACTIVATE EMERGENCY OVERRIDE';
    });

    document.getElementById('btn-delete-all-events').addEventListener('click', async () => {
        if (
            !confirm(
                "SECURE DELETE: This will delete ALL events created by YOU. Other admins' data will remain safe. Proceed?"
            )
        )
            return;
        const btn = document.getElementById('btn-delete-all-events');
        btn.innerText = 'Deleting Your Events...';
        try {
            await deleteAllMyEvents(loggedInUser.uid);
            alert('Your managed events have been removed.');
            window.location.reload();
        } catch (e) {
            alert('Delete failed: ' + e.message);
        }
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete All My Events';
    });

    document.getElementById('ev-charge-fees').addEventListener('change', (e) => {
        document.getElementById('fee-config').classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('btn-save-event').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-event');
        btn.innerText = 'Updating Cloud...';

        const data = {
            title: document.getElementById('ev-name').value,
            date: document.getElementById('ev-date').value,
            time: `${document.getElementById('ev-time-start').value} to ${document.getElementById('ev-time-end').value}`,
            location: document.getElementById('ev-loc').value,
            description: document.getElementById('ev-desc').value,
            totalAttendees: parseInt(document.getElementById('ev-total').value) || 0,
            numBatches: parseInt(document.getElementById('ev-batches').value) || 5,
            allowMulti: document.getElementById('ev-allow-multi').checked,
            chargeFees: document.getElementById('ev-charge-fees').checked,
            feeNote: document.getElementById('ev-fee-note').value || '',
        };

        try {
            if (editingId) {
                await updateEvent(editingId, data);
                editingId = null;
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Push Event Update';
            } else {
                await saveEvent(data, loggedInUser.uid);
            }
            // Reset fields
            [
                'ev-name',
                'ev-loc',
                'ev-desc',
                'ev-total',
                'ev-batches',
                'ev-fee-note',
                'ev-time-start',
                'ev-time-end',
            ].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            document.getElementById('ev-charge-fees').checked = false;
            document.getElementById('fee-config').classList.add('hidden');
            alert('Sync Successful!');
        } catch (e) {
            alert('Error: ' + e.message);
        }
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Push Event Update';
    });

    document.getElementById('btn-save-q').onclick = async () => {
        const id = document.getElementById('q-id').value;
        const evContext = document.getElementById('stats-ev-context');
        const evName = evContext.options[evContext.selectedIndex]?.text || 'Venue';

        const data = {
            type: document.getElementById('q-type').value,
            section: document.getElementById('q-sec').value,
            waitTimeMins: parseInt(document.getElementById('q-wait').value) || 0,
            status: document.getElementById('q-status').value,
        };
        try {
            await updateQueue(id, data);
            alert(`Queue Synced for ${evName}`);
        } catch (e) {
            alert(e.message);
        }
    };

    document.getElementById('btn-save-h').onclick = async () => {
        const id = document.getElementById('h-id').value;
        const evContext = document.getElementById('stats-ev-context');
        const evName = evContext.options[evContext.selectedIndex]?.text || 'Venue';

        const data = {
            name: document.getElementById('h-name').value,
            status: document.getElementById('h-status').value,
            lat: 51.556,
            lng: -0.279,
            congestion: 50, // Defaults
        };
        try {
            await updateHeatmap(id, data);
            alert(`Heatmap Synced for ${evName}`);
        } catch (e) {
            alert(e.message);
        }
    };

    document.getElementById('btn-issue-tkt').onclick = async () => {
        const evId = document.getElementById('issue-ev-id').value;
        const email = document.getElementById('issue-email').value;
        const status = document.getElementById('issue-status');
        if (!evId) {
            status.innerText = 'Please select an event first.';
            status.style.color = 'var(--color-danger)';
            return;
        }
        try {
            await issueTicketToUser(evId, email);
            status.innerText = '✅ Issued to ' + email;
            status.style.color = 'var(--color-success)';
            document.getElementById('issue-email').value = '';
        } catch (e) {
            status.innerText = e.message;
            status.style.color = 'var(--color-danger)';
        }
    };

    // ---- Ticket Analytics Wiring ----
    let analyticsUnsubscribe = null;
    let allSeatsCache = [];

    function renderTicketAnalytics(data, eventLabel) {
        const panel = document.getElementById('ticket-analytics-panel');
        panel.style.display = 'block';
        document.getElementById('analytics-event-label').innerText = eventLabel;

        // --- Ticket Analytics Section ---

        // 1. Update general numerical stats for the dashboard display
        document.getElementById('stat-total').innerText = data.total;
        document.getElementById('stat-issued').innerText = data.issued;
        document.getElementById('stat-available').innerText = data.available;

        // 2. Calculate issuance percentage safely (avoid division by zero)
        const pct = data.total > 0 ? Math.round((data.issued / data.total) * 100) : 0;
        document.getElementById('stat-pct').innerText = pct + '%';

        // 3. Update the visual progress bar and apply dynamic color thresholds
        // Red for near-full (>=90%), Yellow for filling (>=60%), Blue for normal
        document.getElementById('stat-bar').style.width = pct + '%';
        document.getElementById('stat-bar').style.background =
            pct >= 90
                ? 'linear-gradient(90deg,#EF4444,#B91C1C)'
                : pct >= 60
                  ? 'linear-gradient(90deg,#F59E0B,#D97706)'
                  : 'linear-gradient(90deg,#3B82F6,#8B5CF6)';

        // 4. Reveal the 'Add Tickets' section only if the event is completely sold out
        document.getElementById('add-tickets-section').style.display =
            data.available === 0 ? 'block' : 'none';

        // --- Seat Map Rendering ---
        // Cache seats globally so the ticket table can filter them later
        allSeatsCache = data.seats;
        const grid = document.getElementById('seat-grid');

        // Generate accessible button elements for each seat to build the visual occupancy grid
        grid.innerHTML = data.seats
            .map((s) => {
                const occupied = s.isAssigned || !!s.assignedEmail;
                const color = occupied ? '#EF4444' : '#22C55E'; // Red if occupied, Green if available
                const tip = occupied ? s.assignedEmail || 'Issued' : 'Available';
                return `<button aria-label="Seat ${s.seat}, ${tip}" title="${s.seat}\n${tip}" style="width:20px;height:20px;border-radius:4px;background:${color};cursor:pointer;flex-shrink:0;border:none;"></button>`;
            })
            .join('');

        // --- Issued Tickets Table Rendering ---
        // Refresh the table with the newly acquired seat data
        renderTicketTable('');
    }

    function renderTicketTable(search) {
        const tbody = document.getElementById('ticket-table-body');
        const empty = document.getElementById('ticket-table-empty');

        // Filter down to only issued/assigned tickets from the cached seat array
        const issued = allSeatsCache.filter((s) => s.isAssigned || s.assignedEmail);

        // If a search query exists, filter the issued tickets by the assigned email string
        const filtered = search
            ? issued.filter((s) => (s.assignedEmail || '').toLowerCase().includes(search))
            : issued;

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';
        tbody.innerHTML = filtered
            .map(
                (s) => `
        <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 12px; color:var(--text-primary); font-weight:600;">${s.assignedEmail || '—'}</td>
            <td style="padding:10px 12px; color:var(--text-secondary);">${s.seat || '—'}</td>
            <td style="padding:10px 12px;">
                <span style="background:#EFF6FF;color:var(--color-primary);padding:2px 8px;border-radius:20px;font-size:0.65rem;font-weight:800;">Batch ${s.batch || '—'}</span>
            </td>
            <td style="padding:10px 12px; font-family:monospace; font-size:0.7rem; color:var(--text-muted);">${s.ticketId || s.id || '—'}</td>
        </tr>
    `
            )
            .join('');
    }

    document
        .getElementById('ticket-table-search')
        .setAttribute('aria-label', 'Search issued tickets');
    document.getElementById('ticket-table-search').oninput = (e) => {
        renderTicketTable(e.target.value.toLowerCase());
    };

    // Subscribe analytics when event is chosen
    document.getElementById('issue-ev-id').onchange = (e) => {
        const evId = e.target.value;
        if (analyticsUnsubscribe) {
            analyticsUnsubscribe();
            analyticsUnsubscribe = null;
        }
        if (!evId) {
            document.getElementById('ticket-analytics-panel').style.display = 'none';
            return;
        }
        const label = e.target.options[e.target.selectedIndex]?.text || evId;
        analyticsUnsubscribe = listenForEventTickets(evId, (data) =>
            renderTicketAnalytics(data, label)
        );
    };

    // Add More Tickets button
    document.getElementById('btn-add-tickets').onclick = async () => {
        const evId = document.getElementById('issue-ev-id').value;
        const count = parseInt(document.getElementById('add-tickets-count').value) || 10;
        const statusEl = document.getElementById('add-tickets-status');
        const btn = document.getElementById('btn-add-tickets');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
        statusEl.innerText = '';
        try {
            await addMoreTickets(evId, count);
            statusEl.innerText = `✅ ${count} tickets added successfully!`;
            statusEl.style.color = 'var(--color-success)';
        } catch (e) {
            statusEl.innerText = e.message;
            statusEl.style.color = 'var(--color-danger)';
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Tickets';
    };

    function loadEvents() {
        if (!loggedInUser) return;
        listenForUserEvents(loggedInUser.uid, (events) => {
            const list = document.getElementById('admin-events-list');
            list.innerHTML = events
                .map(
                    (ev) => `
            <div class="event-list-item">
                <div>
                    <strong style="display:block;">${ev.title || ev.name}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${ev.date} | ${ev.location}</span>
                    <span style="display:block; font-size: 0.65rem; color: var(--color-primary); margin-top: 4px;">ID: ${ev.id}</span>
                </div>
                <div style="display:flex; gap: 8px;">
                    <button class="btn btn-secondary edit-btn" aria-label="Edit Event ${ev.title || ev.name}" data-id="${ev.id}" style="padding: 6px 10px;"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
                    <button class="btn btn-alert delete-btn" aria-label="Delete Event ${ev.title || ev.name}" data-id="${ev.id}" style="padding: 6px 10px;"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
                </div>
            </div>
        `
                )
                .join('');

            document.querySelectorAll('.delete-btn').forEach((btn) => {
                btn.onclick = async () => {
                    if (!confirm('Delete this event and all associated data?')) return;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    btn.disabled = true;
                    try {
                        await deleteEvent(btn.dataset.id);
                        alert('Event deleted successfully.');
                    } catch (e) {
                        alert('Delete failed: ' + e.message);
                        btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                        btn.disabled = false;
                    }
                };
            });

            document.querySelectorAll('.edit-btn').forEach((btn) => {
                btn.onclick = () => {
                    const ev = events.find((x) => x.id === btn.dataset.id);
                    if (ev) {
                        document.getElementById('ev-name').value = ev.title || '';
                        document.getElementById('ev-date').value = ev.date || '';
                        if (ev.time && ev.time.includes(' to ')) {
                            const [start, end] = ev.time.split(' to ');
                            document.getElementById('ev-time-start').value = start;
                            document.getElementById('ev-time-end').value = end;
                        }
                        document.getElementById('ev-loc').value = ev.location || '';
                        document.getElementById('ev-desc').value = ev.description || '';
                        document.getElementById('ev-total').value = ev.totalAttendees || '';
                        document.getElementById('ev-batches').value = ev.numBatches || '';
                        document.getElementById('ev-charge-fees').checked = ev.chargeFees || false;
                        document
                            .getElementById('fee-config')
                            .classList.toggle('hidden', !ev.chargeFees);
                        editingId = ev.id;
                        document.getElementById('btn-save-event').innerText = 'Update Event Data';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                };
            });

            const optionsHTML =
                '<option value="">Choose Event...</option>' +
                events.map((e) => `<option value="${e.id}">${e.title}</option>`).join('');
            document.getElementById('issue-ev-id').innerHTML = optionsHTML;
            document.getElementById('stats-ev-context').innerHTML = optionsHTML;
            document.getElementById('dev-ev-id').innerHTML = optionsHTML;
        });

        // Global Dashboard Listeners (Decoupled from User Events)
        let lastRequests = [];
        listenForTicketRequests(loggedInUser.uid, (requests) => {
            lastRequests = requests;
            renderTicketRequests(requests);
        });

        listenForAssistanceRequests(loggedInUser.uid, (requests) => {
            renderAssistanceRequests(requests);
        });

        listenForUserLocations(loggedInUser.uid, (locations) => {
            renderUserLocations(locations);
        });

        listenForHeatmap((zones) => {
            renderAdminHeatmap(zones);
        });

        function renderAdminHeatmap(zones) {
            const list = document.getElementById('admin-heatmap-list');
            list.innerHTML = zones.length
                ? zones
                      .map(
                          (z) => `
            <div class="flex-row" style="padding: 10px; background: var(--bg-surface-elevated); border-radius: 8px; margin-bottom: 8px;">
                <div>
                    <span style="font-weight: 700; font-size: 0.85rem;">${z.name}</span>
                    <span style="display:block; font-size: 0.7rem; color: var(--text-muted);">Zone: ${z.id}</span>
                </div>
                <span class="status-badge ${z.status}" style="font-size: 0.65rem;">${z.status.toUpperCase()}</span>
            </div>
        `
                      )
                      .join('')
                : '<p class="subtext">No zones tracked.</p>';
        }

        function renderTicketRequests(requests) {
            const list = document.getElementById('ticket-requests-list');
            // Requests are already pre-filtered by Firestore listener
            let filtered = requests;

            if (adminReqSearchQuery) {
                filtered = filtered.filter(
                    (r) =>
                        (r.userName || '').toLowerCase().includes(adminReqSearchQuery) ||
                        (r.userEmail || '').toLowerCase().includes(adminReqSearchQuery)
                );
            }
            list.innerHTML = filtered.length
                ? filtered
                      .map(
                          (req) => `
            <div class="card" style="margin-bottom: 12px; border-left: 4px solid ${req.status === 'conditional' ? 'orange' : 'var(--color-primary-light)'};">
                <div class="flex-row">
                    <div>
                        <strong style="display:block;">${req.userName}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${req.userEmail}</span>
                        <p style="margin-top: 4px; font-size: 0.8rem; font-weight: 700; color: var(--color-primary);">${req.eventTitle}</p>
                    </div>
                    <div style="display:flex; gap: 8px;">
                        <button class="btn btn-primary btn-issue-req" data-id="${req.id}" data-email="${req.userEmail}" data-evid="${req.eventId}" style="padding: 6px 12px; font-size: 0.7rem;">Issue</button>
                        <button class="btn btn-secondary btn-condition-req" data-id="${req.id}" style="padding: 6px 12px; font-size: 0.7rem;">Note</button>
                    </div>
                </div>
            </div>
        `
                      )
                      .join('')
                : '<p class="subtext">No pending signals.</p>';

            document.querySelectorAll('.btn-issue-req').forEach((btn) => {
                btn.onclick = async () => {
                    if (confirm('Issue ticket?')) {
                        try {
                            await issueTicketToUser(btn.dataset.evid, btn.dataset.email);
                            await updateTicketRequestStatus(btn.dataset.id, 'fulfilled');
                        } catch (e) {
                            alert(e.message);
                        }
                    }
                };
            });
            document.querySelectorAll('.btn-condition-req').forEach((btn) => {
                btn.onclick = async () => {
                    const note = prompt('Condition/Note for user:');
                    if (note) await updateTicketRequestStatus(btn.dataset.id, 'conditional', note);
                };
            });
        }

        document.getElementById('admin-req-search').oninput = (e) => {
            adminReqSearchQuery = e.target.value.toLowerCase();
            renderTicketRequests(lastRequests);
        };

        function renderAssistanceRequests(requests) {
            const list = document.getElementById('assistance-requests-list');
            // Requests are already pre-filtered by Firestore listener
            const filtered = requests;

            list.innerHTML = filtered.length
                ? filtered
                      .map(
                          (req) => `
            <div class="card" style="margin-bottom: 12px; border-left: 4px solid var(--color-danger);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
                    <div>
                        <strong style="display:block; font-size: 1rem;">${req.userName}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${req.userEmail}</span>
                    </div>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">${req.timestamp?.toDate().toLocaleTimeString() || 'Just now'}</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-primary); background: var(--bg-surface-elevated); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <i class="fa-solid fa-quote-left" style="opacity: 0.2; margin-right: 8px;"></i>${req.message}
                </p>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.75rem;">
                    <div><i class="fa-solid fa-calendar-day"></i> ${req.eventName}</div>
                    <div><i class="fa-solid fa-clock"></i> ${req.eventTime}</div>
                    ${req.location ? `<div style="grid-column: span 2; color: var(--color-primary); font-weight: 700;"><i class="fa-solid fa-location-crosshairs"></i> ${req.location.lat.toFixed(4)}, ${req.location.lng.toFixed(4)}</div>` : ''}
                </div>
            </div>
        `
                      )
                      .join('')
                : '<p class="subtext">No active calls for support.</p>';
        }

        function renderUserLocations(locations) {
            const list = document.getElementById('admin-user-locations');
            // Locations are already pre-filtered by Firestore listener
            const filtered = locations;

            list.innerHTML = filtered.length
                ? filtered
                      .map(
                          (loc) => `
            <div class="flex-row" style="padding: 12px; border-bottom: 1px solid var(--bg-surface-elevated);">
                <span style="font-size: 0.8rem; font-weight: 700;">${loc.userName || 'Unknown User'}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}</span>
            </div>
        `
                      )
                      .join('')
                : '<p class="subtext">Awaiting GPS signals...</p>';
        }

        // Device Integration Logic
        document.getElementById('dev-type').onchange = (e) => {
            const label = document.getElementById('dev-config-label');
            const input = document.getElementById('dev-config');
            if (e.target.value === 'CCTV') {
                label.innerText = 'RTSP/HTTP Stream URL';
                input.placeholder = 'rtsp://...';
            } else if (e.target.value === 'WiFi') {
                label.innerText = 'Router API Key';
                input.placeholder = 'sk_live_...';
            } else {
                label.innerText = 'MQTT Topic / REST Endpoint';
                input.placeholder = 'venue/entrance';
            }
        };

        document.getElementById('btn-save-device').onclick = async () => {
            const evId = document.getElementById('dev-ev-id').value;
            if (!evId) return alert('Select an event first!');

            const data = {
                type: document.getElementById('dev-type').value,
                zone: document.getElementById('dev-zone').value,
                name: document.getElementById('dev-name').value,
                config: document.getElementById('dev-config').value,
            };

            try {
                await saveDevice(evId, data, loggedInUser.uid);
                alert('Device Registered!');
                ['dev-zone', 'dev-name', 'dev-config'].forEach(
                    (id) => (document.getElementById(id).value = '')
                );
            } catch (e) {
                alert(e.message);
            }
        };

        document.getElementById('dev-ev-id').onchange = (e) => {
            const evId = e.target.value;
            if (evId) {
                listenForDevices(evId, (devices) => {
                    const list = document.getElementById('admin-devices-list');
                    list.innerHTML = devices.length
                        ? devices
                              .map(
                                  (dev) => `
                    <div class="card" style="margin-bottom: 12px; border-left: 4px solid var(--color-primary);">
                        <div class="flex-row">
                            <div>
                                <strong style="display:block;">${dev.name}</strong>
                                <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">${dev.type} | Zone: ${dev.zone}</span>
                            </div>
                            <button class="btn btn-alert btn-del-dev" data-id="${dev.id}" data-evid="${evId}" style="padding: 4px 8px;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <p style="font-size: 0.75rem; background: var(--bg-surface-elevated); padding: 8px; border-radius: 6px; margin-top: 10px; word-break: break-all;">
                            <i class="fa-solid fa-link"></i> ${secureConfig(dev.config, false)}
                        </p>
                    </div>
                `
                              )
                              .join('')
                        : '<p class="subtext">No devices registered for this event.</p>';

                    document.querySelectorAll('.btn-del-dev').forEach((btn) => {
                        btn.onclick = async () => {
                            if (confirm('Remove device?')) {
                                await deleteDevice(
                                    btn.dataset.evid,
                                    btn.dataset.id,
                                    loggedInUser.uid
                                );
                            }
                        };
                    });
                });
            }
        };
    }
});
