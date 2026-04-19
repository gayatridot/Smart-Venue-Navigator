const isEventPast = (dateStr, timeStr) => {
    if (!dateStr) return false;
    const today = new Date();
    const eventDate = new Date(dateStr);
    
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate < today) return true;
    if (eventDate > today) return false;

    if (timeStr && timeStr.includes(' to ')) {
        const endTimeStr = timeStr.split(' to ')[1];
        const [hours, minutes] = endTimeStr.split(':').map(Number);
        const eventEndTime = new Date();
        eventEndTime.setHours(hours, minutes, 0, 0);
        return new Date() > eventEndTime;
    }
    return false;
};

export const renderHome = (events = [], savedScheduleIds = [], myTickets = [], myTicketRequests = [], searchQuery = '') => {
    // Filter everything first
    const activeEvents = events.filter(e => !isEventPast(e.date, e.time));
    const activeTickets = myTickets.filter(t => !isEventPast(t.eventDate, t.eventTime)); // Assuming tickets have date/time
    const activeRequests = myTicketRequests.filter(r => !isEventPast(r.eventDate, r.eventTime));

    const savedEvents = activeEvents.filter(e => savedScheduleIds.includes(e.id));
    const upcomingEvents = activeEvents.filter(e => !savedScheduleIds.includes(e.id));

    const renderEventCard = (e, isSaved) => `
        <div class="card">
            <div class="flex-row" style="margin-bottom: 8px;">
                <h3 style="font-size: 1.1rem; color: var(--color-primary);">${e.name || e.title}</h3>
                <span class="badge badge-success" style="font-size: 0.6rem;">Live</span>
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 12px; font-size: 0.85rem; color: var(--text-secondary);">
                <span><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i> ${e.date}</span>
                <span><i class="fa-regular fa-clock" style="margin-right: 4px;"></i> ${e.time || 'All Day'}</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">
                <i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i> ${e.location}
            </p>
            <div class="flex-row" style="gap: 10px;">
                ${isSaved ? `
                    <button class="btn btn-secondary" disabled style="flex: 1; opacity: 0.7;">
                       <i class="fa-solid fa-check"></i> Saved
                    </button>
                ` : `
                    <button class="btn btn-secondary btn-save-schedule" data-event-id="${e.id}" style="flex: 1;">
                       <i class="fa-solid fa-bookmark"></i> Save
                    </button>
                `}
                <button class="btn btn-primary btn-request-ticket" data-event-id="${e.id}" data-event-title="${e.name || e.title}" style="flex: 1.5;">
                   <i class="fa-solid fa-paper-plane"></i> Get Ticket
                </button>
            </div>
        </div>
    `;

    const ticketsHTML = activeTickets.length > 0 ? activeTickets.map(tkt => `
        <div class="ticket">
            <div class="flex-row" style="margin-bottom: 16px;">
                <h2 style="color: white; font-size: 1.3rem; margin: 0;">${tkt.eventTitle}</h2>
                <i class="fa-solid fa-qrcode" style="font-size: 1.5rem; opacity: 0.8;"></i>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px; font-size: 0.75rem; opacity: 0.9;">
                <div><p>Seat</p><strong>${tkt.seat}</strong></div>
                <div><p>Gate</p><strong>${tkt.gate}</strong></div>
                <div><p>Batch</p><strong>#${tkt.batch}</strong></div>
            </div>
            <div style="border-top: 1px dashed rgba(255,255,255,0.3); padding-top: 16px; font-size: 0.8rem;">
                <div class="flex-row">
                    <span><i class="fa-solid fa-clock" style="margin-right: 6px;"></i> Entry: <strong>${tkt.entryTime}</strong></span>
                    <button class="btn-delete-ticket" data-event-id="${tkt.eventId}" data-ticket-id="${tkt.id}" style="background: rgba(255,255,255,0.1); border:none; color:white; padding: 4px 8px; border-radius: 6px; cursor:pointer;">
                        <i class="fa-solid fa-trash-can" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
                ${tkt.lunchSlot !== "N/A" ? `<div style="margin-top: 8px; font-size: 0.75rem;"><i class="fa-solid fa-utensils" style="margin-right: 6px;"></i> Lunch: <strong>${tkt.lunchSlot}</strong></div>` : ''}
            </div>
        </div>
    `).join('') : `
        <div class="card" style="text-align: center; border: 2px dashed var(--bg-surface-elevated); background: transparent;">
            <i class="fa-solid fa-ticket-simple" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 12px; display: block;"></i>
            <h4 style="color: var(--text-secondary);">No active tickets</h4>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Request a ticket below to get started.</p>
        </div>
    `;

    const requestsHTML = activeRequests.length > 0 ? `
        <div style="margin-bottom: 32px;">
            <div class="section-title"><span><i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px; color: var(--color-accent);"></i> Pending Signals</span></div>
            ${activeRequests.map(req => {
                let statusClass = "badge-warning";
                if (req.status === 'conditional') statusClass = "badge-warning";
                if (req.status === 'fulfilled') statusClass = "badge-success";
                return `
                    <div class="card" style="padding: 12px 16px; border-left: 4px solid var(--color-primary-light);">
                        <div class="flex-row">
                            <strong style="font-size: 0.9rem;">${req.eventTitle}</strong>
                            <span class="badge ${statusClass}">${req.status}</span>
                        </div>
                        ${req.adminNote ? `<p style="margin-top: 8px; font-size: 0.75rem; color: var(--color-warning); background: #FFFBEB; padding: 6px 10px; border-radius: 6px;"><i class="fa-solid fa-info-circle"></i> ${req.adminNote}</p>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    ` : '';

    return `
        <div class="page" id="page-home">
            <div class="flex-row" style="margin-bottom: 24px; align-items: flex-start;">
                <div>
                    <h1 style="font-size: 1.8rem; letter-spacing: -0.5px;">Hello!</h1>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Ready for the show?</p>
                </div>
                <button id="btn-sync-calendar" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.75rem; border-radius: var(--border-radius-pill);">
                    <i class="fa-brands fa-google"></i> Sync
                </button>
            </div>

            <div class="search-container">
                <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted);"></i>
                <input type="text" id="event-search" placeholder="Search events..." value="${searchQuery}">
            </div>

            <div class="section-title">Digital Wallet</div>
            ${ticketsHTML}
            ${requestsHTML}

            ${savedEvents.length > 0 ? `
                <div class="section-title">Your Schedule</div>
                ${savedEvents.map(e => renderEventCard(e, true)).join('')}
            ` : ''}

            <div class="section-title">Upcoming Events</div>
            ${upcomingEvents.map(e => renderEventCard(e, false)).join('')}
        </div>
    `;
};

export const renderHeatmap = (zones = []) => {
    return `
        <div class="page" id="page-heatmap" style="padding-bottom: 120px;">
            <div class="flex-row" style="margin-bottom: 24px; align-items: flex-start;">
                <div>
                    <h1 style="font-size: 1.8rem; letter-spacing: -0.5px;">Venue Map</h1>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">Live crowd density & navigation</p>
                </div>
                <div style="background: var(--bg-surface-elevated); padding: 8px 12px; border-radius: var(--border-radius-sm); text-align: right;">
                    <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">SYSTEM STATUS</div>
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--color-success);"><i class="fa-solid fa-circle-check"></i> LIVE</div>
                </div>
            </div>
            
            <div id="heatmap-map" style="width: 100%; height: 260px; border-radius: var(--border-radius-lg); margin-bottom: 24px; overflow: hidden; box-shadow: var(--shadow-lg); border: 2px solid white; position: relative; background: url('/stadium_satellite_heatmap_1776592030620.png') center/cover no-repeat;">
                <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, transparent, rgba(15, 23, 42, 0.4));"></div>
                <div id="google-map-overlay" style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;">
                    <!-- Google Map will be injected here -->
                </div>
                <div style="position: absolute; bottom: 15px; right: 15px; background: rgba(255,255,255,0.9); padding: 6px 12px; border-radius: var(--border-radius-pill); font-size: 0.65rem; font-weight: 700; color: var(--color-primary); display: flex; align-items: center; gap: 6px; box-shadow: var(--shadow-sm);">
                    <i class="fa-solid fa-satellite"></i> Satellite Active
                </div>
            </div>

            <div class="flex-row" style="margin-bottom: 20px;">
                <div class="section-title" style="margin:0;">Live Density Zones</div>
                <div style="display:flex; gap: 8px; font-size: 0.6rem; font-weight: 800;">
                    <span style="color: var(--color-success); opacity: 0.8;">LOW</span>
                    <span style="color: var(--color-warning); opacity: 0.8;">MED</span>
                    <span style="color: var(--color-danger); opacity: 0.8;">HIGH</span>
                </div>
            </div>

            <div id="heatmap-zones-list">
                ${zones.length > 0 ? zones.map(z => {
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
                `}
            </div>
        </div>
    `;
};

export const renderQueues = (queuesData) => {
    return `
        <div class="page" id="page-queues">
            <h1 style="margin-bottom: 8px;">Queue Times</h1>
            <p class="subtext" style="margin-bottom: 24px;">Wait times updated 1 min ago</p>
            
            <div class="queue-list" style="display: grid; gap: 16px;">
                ${queuesData.map(q => {
                    let icon = "fa-utensils";
                    if (q.type.includes("Restroom")) icon = "fa-restroom";
                    if (q.type.includes("Merch")) icon = "fa-bag-shopping";
                    
                    return `
                        <div class="card" style="display: flex; align-items: center; gap: 16px; margin: 0;">
                            <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--bg-surface-elevated); display: flex; align-items: center; justify-content: center; color: var(--color-primary);">
                                <i class="fa-solid ${icon}" style="font-size: 1.2rem;"></i>
                            </div>
                            <div style="flex: 1;">
                                <h4 style="font-size: 0.95rem;">${q.type}</h4>
                                <p style="font-size: 0.75rem; color: var(--text-muted);">Section ${q.section}</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">${q.waitTimeMins}m</div>
                                <span class="badge ${q.status === 'Fast' ? 'badge-success' : q.status === 'Busy' ? 'badge-danger' : 'badge-warning'}">${q.status}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
};

export const renderLocator = () => {
    return `
        <div class="page" id="page-locator">
            <h1 style="margin-bottom: 8px;">Facility Finder</h1>
            <p class="subtext" style="margin-bottom: 32px;">Real-time assistance & navigation</p>
            
            <div class="card" style="padding: 32px 24px; text-align: center; border: 1px solid var(--color-primary-light); background: linear-gradient(180deg, #ffffff 0%, #EFF6FF 100%);">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: #DBEAFE; color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <i class="fa-solid fa-location-arrow" style="font-size: 1.5rem;"></i>
                </div>
                <h3 style="margin-bottom: 8px;">Broadcast Location</h3>
                <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 24px; line-height: 1.5;">Share your coordinates to help us find you in the crowd.</p>
                <button id="btn-share-location" class="btn btn-primary" style="width: 100%; border-radius: var(--border-radius-pill);">
                    Start Broadcasting
                </button>
                <p id="share-location-status" style="margin-top: 12px; font-size: 0.75rem; font-weight: 600; color: var(--color-primary);"></p>
            </div>
            
            <div class="card" style="background: #FEF2F2; border: 1px solid #FECACA;">
                <h4 style="color: #991B1B; margin-bottom: 8px;"><i class="fa-solid fa-shield-heart" style="margin-right: 8px;"></i> Emergency?</h4>
                <p style="font-size: 0.8rem; color: #B91C1C; margin-bottom: 16px;">Request immediate staff assistance at your location.</p>
                <button id="btn-request-assistance" class="btn btn-alert" style="width: 100%; border-radius: var(--border-radius-pill);">
                    Call for Support
                </button>
            </div>

            </div>
        </div>
    `;
};
