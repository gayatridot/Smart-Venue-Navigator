import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, setDoc, query, where, collectionGroup, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging.js";

export let app, db, auth, messaging;
export let isLive = false;

// Simple Obfuscation for sensitive device configs
const SECRET_SALT = "SVN_SECURE_2026";
export const secureConfig = (text, encrypt = true) => {
    if (!text) return "";
    try {
        if (encrypt) {
            const encoded = btoa(text.split('').map((char, i) => 
                String.fromCharCode(char.charCodeAt(0) ^ SECRET_SALT.charCodeAt(i % SECRET_SALT.length))
            ).join(''));
            return `ENC:${encoded}`;
        } else {
            if (!text.startsWith("ENC:")) return text;
            const raw = atob(text.replace("ENC:", ""));
            return raw.split('').map((char, i) => 
                String.fromCharCode(char.charCodeAt(0) ^ SECRET_SALT.charCodeAt(i % SECRET_SALT.length))
            ).join('');
        }
    } catch (e) { return text; }
};

// Async init because we must fetch keys from backend securely
export const submitAssistanceRequest = async (requestData) => {
    if (!isLive) return true;
    try {
        await addDoc(collection(db, "assistanceRequests"), {
            ...requestData,
            userId: auth.currentUser?.uid || "anonymous",
            eventOwnerId: requestData.eventOwnerId || null,
            timestamp: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Assistance Request Error:", e);
        throw e;
    }
};

export const listenForAssistanceRequests = (callback) => {
    if (!isLive) return;
    const q = query(collection(db, "assistanceRequests"), orderBy("timestamp", "desc"));
    return onSnapshot(q, snapshot => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(requests);
    });
};

export const cleanupExpiredData = async (uid) => {
    if (!isLive || !uid) return;
    try {
        const now = new Date();
        
        // 1. Cleanup Ticket Requests
        const reqRef = collection(db, "ticketRequests");
        const qReq = query(reqRef, where("uid", "==", uid));
        const reqSnap = await getDocs(qReq);
        
        for (const docSnap of reqSnap.docs) {
            const data = docSnap.data();
            if (data.eventDate) {
                const eventDate = new Date(data.eventDate);
                eventDate.setHours(23, 59, 59, 999); // Allow until end of day
                if (eventDate < now) {
                    await deleteDoc(doc(db, "ticketRequests", docSnap.id));
                }
            }
        }
        
        // 2. Cleanup Saved Schedules
        const schedRef = collection(db, "users", uid, "schedule");
        const schedSnap = await getDocs(schedRef);
        for (const docSnap of schedSnap.docs) {
            const data = docSnap.data();
            if (data.date) {
                const eventDate = new Date(data.date);
                eventDate.setHours(23, 59, 59, 999);
                if (eventDate < now) {
                    await deleteDoc(doc(db, "users", uid, "schedule", docSnap.id));
                }
            }
        }
    } catch (e) {
        console.error("Cleanup Error:", e);
    }
};

export const initFirebase = async () => {
    try {
        console.log("Checking system status...");
        const res = await fetch('/api/firebase-config');
        const firebaseConfig = await res.json();
        console.log("Configuration status received. Key present:", !!firebaseConfig.apiKey);

        if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "MOCK_API_KEY" && firebaseConfig.apiKey !== "undefined" && firebaseConfig.apiKey !== "null") {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            isLive = true;
            console.log("🔥 System Online: Live mode active.");

            // Messaging is optional — don't let it break auth
            try {
                messaging = getMessaging(app);
            } catch (msgErr) {
                console.warn("⚠️ Firebase Messaging unavailable (service worker may not be registered):", msgErr.message);
                messaging = null;
            }

            return true;
        } else {
            console.warn("⚠️ System Warning: Missing or invalid credentials. Falling back to safe mode.");
            console.warn("Received config:", JSON.stringify({ ...firebaseConfig, apiKey: firebaseConfig.apiKey ? "[PRESENT]" : "[MISSING]" }));
            isLive = false;
            return false;
        }
    } catch (e) {
        console.error("System Error: Configuration fetch failed.", e);
        return false;
    }
};

// ======================
// Authentication API
// ======================
const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
    if (!isLive && window.location.hostname === 'localhost') return mockLogin();
    if (!isLive) throw new Error("Authentication System Offline. Please check server configuration.");
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Sync profile on every login
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                name: user.displayName || 'Google User',
                email: user.email,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
        } else {
            await updateDoc(userRef, { lastLogin: serverTimestamp() });
        }
        
        return user;
    } catch (error) {
        throw new Error(error.message);
    }
};

export const loginWithEmail = async (email, password) => {
    if (!isLive && window.location.hostname === 'localhost') return mockLogin();
    if (!isLive) throw new Error("Authentication System Offline. Please check server configuration.");
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        // Update last login
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { lastLogin: serverTimestamp() }).catch(() => {
            // If doc doesn't exist for some reason, create it
            setDoc(userRef, { email, lastLogin: serverTimestamp() });
        });
        
        return user;
    } catch (error) {
        throw new Error(error.message);
    }
};

export const signUpWithEmail = async (email, password, profileData = null) => {
    if (!isLive && window.location.hostname === 'localhost') return mockLogin();
    if (!isLive) throw new Error("Registration System Offline. Please check server configuration.");
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (profileData) {
            await setDoc(doc(db, "users", result.user.uid), {
                ...profileData,
                email,
                createdAt: serverTimestamp()
            });
        }
        return result.user;
    } catch (error) {
        throw new Error(error.message);
    }
};

export const getUserProfile = async (uid) => {
    if (!uid) return null;
    if (!isLive) return { name: "Mock User", email: "mock@example.com", address: "123 Stadium Way" };
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error fetching profile:", error);
        return null;
    }
};

export const logoutUser = async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (!isLive) return true;
    try {
        await signOut(auth);
        return true;
    } catch (e) {
        console.error("Sign out error:", e);
        return false;
    }
};

export const deleteUserAccount = async () => {
    if (!isLive) return true;
    const user = auth.currentUser;
    if (user) {
        try {
            // Remove profile from Firestore
            await deleteDoc(doc(db, "users", user.uid));
            // Remove account from Auth
            await user.delete();
            localStorage.clear();
            sessionStorage.clear();
            return true;
        } catch (e) {
            console.error("Delete account error:", e);
            throw new Error("For security reasons, please log out and log back in before deleting your account.");
        }
    }
    return false;
};

export const monitorAuth = (callback) => {
    if (isLive) {
        onAuthStateChanged(auth, user => {
            callback(user);
        });
    } else {
        // In mock mode, immediately signal that no real user is logged in
        callback(null);
    }
}

function mockLogin() {
    console.log("Mock Mode Login Success");
    return { uid: 'mock-user-404', displayName: 'Mock User', email: 'mock@example.com' };
}

// checkAdminRole removed for decentralized profile roles

// ======================
// Firestore / Events API
// ======================
export const listenForEvents = (callback) => {
    if (isLive) {
        const eventsRef = collection(db, "events");
        onSnapshot(eventsRef, (snapshot) => {
            const events = [];
            snapshot.forEach(doc => {
                events.push({ id: doc.id, ...doc.data() });
            });
            callback(events);
        });
    } else {
        // Mock fallback
        callback([
            { id: "e1", name: "Hackathon Finals", date: "2026-04-15", location: "Wembley Stadium", desc: "Join us for the final presentation!" },
            { id: "e2", name: "Closing Ceremony", date: "2026-04-16", location: "MetLife Stadium", desc: "Awards and celebrations." }
        ]);
    }
};

export const listenForUserEvents = (uid, callback) => {
    if (isLive) {
        const q = query(collection(db, "events"), where("ownerId", "==", uid));
        onSnapshot(q, (snapshot) => {
            const events = [];
            snapshot.forEach(doc => {
                events.push({ id: doc.id, ...doc.data() });
            });
            callback(events);
        });
    } else {
        callback([
            { id: "e1", name: "Hackathon Finals", date: "2026-04-15", location: "Wembley Stadium", desc: "Join us for the final presentation!" }
        ]);
    }
};

export const saveEvent = async (eventData, uid) => {
    const fullData = { 
        ...eventData, 
        ownerId: uid, 
        createdBy: uid, 
        createdAt: serverTimestamp() 
    };
    if (!isLive) { console.log("MOCK Saved:", fullData); return true; }
    try {
        await addDoc(collection(db, "events"), fullData);
        return true;
    } catch (error) { throw error; }
};

export const deleteEvent = async (id) => {
    if (!isLive) return true;
    try {
        // 0. Audit Log for Security
        const logRef = collection(db, "eventLogs");
        await addDoc(logRef, {
            action: "DELETE_EVENT",
            eventId: id,
            deletedBy: auth.currentUser?.uid || "system",
            timestamp: serverTimestamp()
        });

        // 1. Delete Ticket Requests for this event
        const requestsRef = collection(db, "ticketRequests");
        const qReq = query(requestsRef, where("eventId", "==", id));
        const reqSnap = await getDocs(qReq);
        for (const docSnap of reqSnap.docs) {
            try { await deleteDoc(doc(db, "ticketRequests", docSnap.id)); } catch(e) { console.warn("Skip ticket delete:", e); }
        }

        // 2. Delete Attendees (Tickets)
        const attendeesRef = collection(db, "events", id, "attendees");
        const attSnap = await getDocs(attendeesRef);
        for (const docSnap of attSnap.docs) {
            try { await deleteDoc(doc(db, "events", id, "attendees", docSnap.id)); } catch(e) { console.warn("Skip attendee delete:", e); }
        }

        // 3. Delete Assistance Requests for this event
        const assistRef = collection(db, "assistanceRequests");
        const qAssist = query(assistRef, where("eventId", "==", id));
        const assistSnap = await getDocs(qAssist);
        for (const docSnap of assistSnap.docs) {
            try { await deleteDoc(doc(db, "assistanceRequests", docSnap.id)); } catch(e) { console.warn("Skip assist delete:", e); }
        }

        // 4. Delete Devices for this event
        const devicesRef = collection(db, "events", id, "devices");
        const devSnap = await getDocs(devicesRef);
        for (const docSnap of devSnap.docs) {
            try { await deleteDoc(doc(db, "events", id, "devices", docSnap.id)); } catch(e) { console.warn("Skip device delete:", e); }
        }

        // 5. Delete the event itself
        await deleteDoc(doc(db, "events", id));
        return true;
    } catch (error) { throw error; }
};

export const deleteAllMyEvents = async (uid) => {
    if (!isLive) return true;
    try {
        const q = query(collection(db, "events"), where("ownerId", "==", uid));
        const eventsSnap = await getDocs(q);
        for (const evDoc of eventsSnap.docs) {
            await deleteEvent(evDoc.id);
        }
        return true;
    } catch (e) { throw e; }
};

export const deleteTicket = async (eventId, ticketId) => {
    if (!isLive) return true;
    try {
        await deleteDoc(doc(db, "events", eventId, "attendees", ticketId));
        return true;
    } catch (error) { throw error; }
};

export const updateEvent = async (id, eventData) => {
    if (!isLive) return true;
    try {
        await updateDoc(doc(db, "events", id), eventData);
        return true;
    } catch (error) { throw error; }
};

export const saveToSchedule = async (uid, eventId) => {
    if (!isLive) { 
        console.log(`Mock Save Event ${eventId} for User ${uid}`); 
        const sched = JSON.parse(localStorage.getItem('mockSchedule') || '[]');
        if (!sched.includes(eventId)) {
            sched.push(eventId);
            localStorage.setItem('mockSchedule', JSON.stringify(sched));
        }
        return true; 
    }
    try {
        const scheduleRef = doc(db, "users", uid, "schedule", eventId);
        await setDoc(scheduleRef, { savedAt: new Date() });
        return true;
    } catch (error) { throw error; }
};

export const getUserSchedule = async (uid) => {
    if (!isLive) {
        return JSON.parse(localStorage.getItem('mockSchedule') || '[]');
    }
    try {
        const scheduleRef = collection(db, "users", uid, "schedule");
        const snapshot = await getDocs(scheduleRef);
        return snapshot.docs.map(doc => doc.id);
    } catch (error) {
        console.error("Error fetching schedule", error);
        return [];
    }
};

export const listenForQueues = (callback) => {
    if (isLive) {
        const queuesRef = collection(db, "queues");
        onSnapshot(queuesRef, (snapshot) => {
            const queues = [];
            snapshot.forEach(doc => queues.push({ id: doc.id, ...doc.data() }));
            callback(queues);
        });
    } else {
        // Mock fallback
        callback([
            { id: 'q1', type: 'Restroom', section: '101', waitTimeMins: 3, status: 'Fast' },
            { id: 'q2', type: 'Concession', section: '104', waitTimeMins: 15, status: 'Busy' }
        ]);
    }
};

export const updateQueue = async (id, data) => {
    if (!isLive) return true;
    try {
        await updateDoc(doc(db, "queues", id), data);
        return true;
    } catch (e) {
        // Fallback to setDoc if it doesn't exist
        try {
            await setDoc(doc(db, "queues", id), data);
            return true;
        } catch (err) { throw err; }
    }
};

export const listenForHeatmap = (callback) => {
    if (isLive) {
        const heatmapRef = collection(db, "heatmap");
        onSnapshot(heatmapRef, (snapshot) => {
            const zones = [];
            snapshot.forEach(doc => zones.push({ id: doc.id, ...doc.data() }));
            callback(zones);
        });
    } else {
        // Mock fallback (using Wembley stadium coordinates for the center: 51.556, -0.279)
        callback([
            { id: "z1", name: "North Stand", congestion: 80, lat: 51.557, lng: -0.279, status: "busy" },
            { id: "z2", name: "South Stand", congestion: 40, lat: 51.555, lng: -0.279, status: "moderate" },
            { id: "z3", name: "East Wing", congestion: 15, lat: 51.556, lng: -0.277, status: "fast" },
            { id: "z4", name: "West Wing", congestion: 20, lat: 51.556, lng: -0.281, status: "fast" }
        ]);
    }
};

export const updateHeatmap = async (id, data) => {
    if (!isLive) return true;
    try {
        await updateDoc(doc(db, "heatmap", id), data);
        return true;
    } catch (e) {
        try {
            await setDoc(doc(db, "heatmap", id), data);
            return true;
        } catch (err) { throw err; }
    }
};

// ======================
// Messaging API
// ======================
export const listenForNotifications = (callback) => {
    if (isLive) {
        // Firestore-driven Notifications for Hackathon Demo UI without backend
        const notifRef = collection(db, "notifications");
        onSnapshot(notifRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    callback(change.doc.data());
                }
            });
        });

        // Backup FCM event listener if real FCM setup exists
        if (messaging) {
            onMessage(messaging, (payload) => {
                callback({ type: 'emergency', message: payload.notification.body });
            });
        }
    } else {
        // Fallback simulate a single push
        setTimeout(() => {
            callback({ type: "emergency", message: "Mock Alert: High congestion at Gate 4. Please use Gate 5." });
        }, 5000);
    }
};

export const sendNotification = async (message, type = "offer") => {
    if (!isLive) { alert(`MOCK NOTIF [${type}]: ${message}`); return true; }
    try {
        await addDoc(collection(db, "notifications"), {
            message,
            type,
            createdBy: auth.currentUser?.uid || "system",
            timestamp: serverTimestamp()
        });
        return true;
    } catch (error) { throw error; }
};

// ======================
// User Locations API
// ======================
export const updateUserLocation = async (uid, locationData) => {
    if (!isLive) return true;
    try {
        await setDoc(doc(db, "userLocations", uid), {
            ...locationData,
            userName: locationData.userName || "Anonymous User",
            eventOwnerId: locationData.eventOwnerId || null,
            timestamp: new Date()
        });
        return true;
    } catch (e) {
        throw e;
    }
};

export const listenForUserLocations = (callback) => {
    if (isLive) {
        const locationsRef = collection(db, "userLocations");
        onSnapshot(locationsRef, (snapshot) => {
            const locations = [];
            snapshot.forEach(doc => locations.push({ uid: doc.id, ...doc.data() }));
            callback(locations);
        });
    } else {
        // Mock fallback
        callback([
            { uid: "mock1", lat: 51.556, lng: -0.279, timestamp: new Date() }
        ]);
    }
};

// ======================
// Ticketing & Batch API
// ======================
export const generateTickets = async (eventId) => {
    if (!isLive) return alert(`Mock: Generated tickets for ${eventId}`);
    
    try {
        // Fetch event configuration
        const eventDocRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventDocRef);
        
        let config = {
            totalAttendees: 100,
            numBatches: 5,
            skipLunch: false,
            startTime: "17:00",
            lunchTime: "19:00",
            washroomTime: "19:15"
        };
        
        if (eventSnap.exists()) {
            const data = eventSnap.data();
            config.totalAttendees = data.totalAttendees || 100;
            config.numBatches = data.numBatches || 5;
            config.skipLunch = data.skipLunch || false;
            config.startTime = data.time || "17:00"; // Assuming event start time
            config.lunchTime = data.lunchTime || "19:00";
            config.washroomTime = data.washroomTime || "19:15";
            
            await setDoc(eventDocRef, { hasTickets: true }, { merge: true });
        } else {
            await setDoc(eventDocRef, { id: eventId, hasTickets: true }, { merge: true });
        }

        const batchRef = collection(db, "events", eventId, "attendees");
        // For demo purposes, we will only generate a max of 100 tickets at once to avoid abusing Firestore limits
        const count = Math.min(config.totalAttendees, 100); 
        
        const parseTime = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            return { h: h || 17, m: m || 0 };
        };
        
        const formatTime = (h, m) => {
            let outH = h + Math.floor(m / 60);
            let outM = m % 60;
            let ampm = outH >= 12 ? 'PM' : 'AM';
            outH = outH % 12 || 12;
            return `${outH}:${outM.toString().padStart(2, '0')} ${ampm}`;
        };

        const startT = parseTime(config.startTime);
        const lunchT = parseTime(config.lunchTime);
        const washroomT = parseTime(config.washroomTime);
        
        for (let i = 0; i < count; i++) {
            const batchNum = (i % config.numBatches) + 1;
            const gate = `Gate ${Math.floor(Math.random() * 4) + 1}`;
            
            // Staggered times based on batch (15 mins per batch)
            const addMin = (batchNum - 1) * 15;
            
            const entryTime = `${formatTime(startT.h, startT.m + addMin)} - ${formatTime(startT.h, startT.m + addMin + 15)}`;
            const lunchSlot = config.skipLunch ? "N/A" : formatTime(lunchT.h, lunchT.m + addMin);
            const washroomSlot = formatTime(washroomT.h, washroomT.m + addMin);

            const ticketData = {
                seat: `Block ${String.fromCharCode(65 + (i%5))}, Row ${Math.floor(i/10) + 1}, Seat ${i+1}`,
                batch: batchNum,
                gate: gate,
                entryTime: entryTime,
                lunchSlot: lunchSlot,
                washroomSlot: washroomSlot,
                isAssigned: false,
                assignedEmail: null,
                assignedUid: null,
                ticketId: `TKT-${eventId}-${i}`
            };
            
            await addDoc(batchRef, ticketData);
        }
        return true;
    } catch (error) {
        throw error;
    }
};

export const issueTicketToUser = async (eventId, userEmail) => {
    if (!isLive) return alert(`Mock: Issued ticket for ${eventId} to ${userEmail}`);
    
    try {
        const batchRef = collection(db, "events", eventId, "attendees");
        // Find an unassigned ticket
        const qUnassigned = query(batchRef, where("isAssigned", "==", false));
        const snapshot = await getDocs(qUnassigned);
        
        if (snapshot.empty) {
            throw new Error("No available tickets left for this event.");
        }
        
        // Take the first available ticket and assign it
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, {
            isAssigned: true,
            assignedEmail: userEmail,
            assignedAt: new Date()
        });
        
        return snapshot.docs[0].data().ticketId;
    } catch (error) {
        throw error;
    }
};

export const listenForMyTicket = async (userEmail, callback) => {
    if (!isLive) {
        callback([{
            eventId: "mock-event",
            eventTitle: "Mock Event Title",
            seat: "Block A, Row 1, Seat 1",
            batch: 1,
            gate: "Gate 1",
            entryTime: "5:00 PM - 5:15 PM",
            lunchSlot: "7:00 PM",
            washroomSlot: "7:15 PM"
        }]);
        return;
    }
    
    try {
        // Fetch all events to avoid needing a CollectionGroup index for 'attendees'
        const eventsSnapshot = await getDocs(collection(db, "events"));
        const ticketsMap = new Map();
        
        if (eventsSnapshot.empty) {
            callback([]);
            return;
        }

        eventsSnapshot.docs.forEach(eventDoc => {
            const eventId = eventDoc.id;
            const eventData = eventDoc.data();
            const eventTitle = eventData.title || eventData.name || eventId;
            const attendeesRef = collection(db, "events", eventId, "attendees");
            const q = query(attendeesRef, where("assignedEmail", "==", userEmail));
            
            onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const ticketDoc = snapshot.docs[0];
                    ticketsMap.set(eventId, { eventId, eventTitle, ...ticketDoc.data() });
                } else {
                    ticketsMap.delete(eventId);
                }
                // Send all tickets found so far as an array
                callback(Array.from(ticketsMap.values()));
            }, (error) => {
                console.error("Ticket listener error:", error);
            });
        });
    } catch (e) {
        console.error("Failed to set up ticket listener:", e);
        callback([]);
    }
};

export const requestTicket = async (eventId, eventTitle, userName, userEmail, eventOwnerId = null) => {
    if (!isLive) return alert("Mock: Request sent!");
    try {
        const requestsRef = collection(db, "ticketRequests");
        await addDoc(requestsRef, {
            eventId,
            eventTitle,
            eventOwnerId: eventOwnerId,
            userId: auth.currentUser?.uid || "anonymous",
            userName,
            userEmail,
            status: "pending",
            adminNote: "",
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Error requesting ticket:", e);
        throw e;
    }
};

export const listenForTicketRequests = (callback) => {
    if (isLive) {
        const q = query(collection(db, "ticketRequests"));
        onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            requests.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            callback(requests);
        });
    }
};

export const listenForMyRequests = (userEmail, callback) => {
    if (!isLive) return;
    const q = query(
        collection(db, "ticketRequests"), 
        where("userEmail", "==", userEmail)
    );
    return onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        requests.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        callback(requests);
    });
};

export const updateTicketRequestStatus = async (requestId, status, note = "") => {
    if (!isLive) return;
    try {
        const docRef = doc(db, "ticketRequests", requestId);
        await updateDoc(docRef, { 
            status, 
            adminNote: note,
            updatedAt: serverTimestamp() 
        });
    } catch (e) {
        console.error("Error updating request:", e);
        throw e;
    }
};

// ======================
// Device Integration API
// ======================
export const saveDevice = async (eventId, deviceData, uid) => {
    if (!isLive) return true;
    try {
        const deviceRef = collection(db, "events", eventId, "devices");
        const fullData = { 
            ...deviceData, 
            config: secureConfig(deviceData.config, true),
            createdBy: uid, 
            createdAt: serverTimestamp() 
        };
        await addDoc(deviceRef, fullData);

        // Audit Log
        const logRef = collection(db, "eventLogs");
        await addDoc(logRef, {
            action: "ADD_DEVICE",
            eventId: eventId,
            deviceName: deviceData.name,
            createdBy: uid,
            timestamp: serverTimestamp()
        });
        return true;
    } catch (error) { throw error; }
};

export const deleteDevice = async (eventId, deviceId, uid) => {
    if (!isLive) return true;
    try {
        await deleteDoc(doc(db, "events", eventId, "devices", deviceId));
        
        // Audit Log
        const logRef = collection(db, "eventLogs");
        await addDoc(logRef, {
            action: "DELETE_DEVICE",
            eventId: eventId,
            deviceId: deviceId,
            deletedBy: uid,
            timestamp: serverTimestamp()
        });
        return true;
    } catch (error) { throw error; }
};

export const listenForDevices = (eventId, callback) => {
    if (!isLive) return;
    const deviceRef = collection(db, "events", eventId, "devices");
    return onSnapshot(deviceRef, snapshot => {
        const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(devices);
    });
};

export const getEventTicketsSummary = async (eventId) => {
    if (!isLive) return { total: 0, unassigned: 0, batches: {} };
    try {
        const batchRef = collection(db, "events", eventId, "attendees");
        const snapshot = await getDocs(batchRef);
        const summary = { total: 0, unassigned: 0, batches: {} };
        
        snapshot.forEach(doc => {
            const data = doc.data();
            summary.total++;
            if (!data.isAssigned) summary.unassigned++;
            
            const batchNum = data.batch;
            if (!summary.batches[batchNum]) {
                summary.batches[batchNum] = { count: 0, entryTime: data.entryTime };
            }
            summary.batches[batchNum].count++;
        });
        
        return summary;
    } catch (e) {
        console.error(e);
        return { total: 0, unassigned: 0, batches: {} };
    }
};

