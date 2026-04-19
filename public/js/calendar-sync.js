import { saveToSchedule, getUserSchedule } from './firebase-config.js';
import { currentUser } from './app.js';
import { navigateTo } from './router.js';

export async function syncGoogleCalendar() {
    if (!currentUser) {
        alert("Please log in to sync your calendar.");
        return;
    }

    const calendarId = prompt("Enter a public Google Calendar ID (e.g., your_venue@group.calendar.google.com):");
    if (!calendarId) return;

    try {
        const res = await fetch('/api/maps-config');
        const { apiKey } = await res.json();
        
        if(!apiKey) {
            alert("No Google API Key found on the server.");
            return;
        }

        // Fetch events from public Google Calendar
        const timeMin = new Date().toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&singleEvents=true&orderBy=startTime`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const events = data.items || [];
        if (events.length === 0) {
            alert("No upcoming events found on this calendar.");
            return;
        }

        let addedCount = 0;
        // In a real scenario, you'd save these events to your global 'events' collection as well 
        // if they don't exist, and then add them to the user's schedule.
        // For this demo, we'll alert the user.
        alert(`Successfully synced ${events.length} events from Google Calendar! (In a full production environment, these would be saved to your Firestore schedules).`);
        
        // Simulating syncing the first event as a mock
        // await saveToSchedule(currentUser.uid, 'sync_event_mock_id');
        
        navigateTo('home');
    } catch (e) {
        alert("Failed to sync calendar: " + e.message);
    }
}
