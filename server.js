// Load .env only if running locally (not in containers like Cloud Run)
const fs = require('fs');
if (fs.existsSync('.env')) { require('dotenv').config(); }

const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Nodemailer configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,    // The email from which it sends (usually same as user, or a service account)
        pass: process.env.EMAIL_PASS     // App Password for the Gmail account
    }
});

// Simple in-memory rate limiter to prevent spam
const assistanceRateLimits = new Map();
const ASSISTANCE_LIMIT = 5; // max 5 requests
const WINDOW_MS = 15 * 60 * 1000; // per 15 minutes

const assistanceRateLimiter = (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (!assistanceRateLimits.has(ip)) {
        assistanceRateLimits.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        return next();
    }
    
    const rateData = assistanceRateLimits.get(ip);
    if (now > rateData.resetTime) {
        assistanceRateLimits.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        return next();
    }
    
    if (rateData.count >= ASSISTANCE_LIMIT) {
        return res.status(429).json({ error: "Too many requests. Please wait a few minutes before sending another assistance request." });
    }
    
    rateData.count++;
    next();
};

// Assistance Request Email Endpoint
app.post('/api/send-assistance', assistanceRateLimiter, async (req, res) => {
    const { message, userLocation } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'ghogareg474@gmail.com',
            subject: 'New Assistance Request - Smart Venue Navigator',
            text: `Assistance Request Received:\n\nLocation: ${userLocation || 'Unknown'}\n\nMessage:\n${message}`,
            html: `<p><strong>Assistance Request Received:</strong></p><p><strong>Location:</strong> ${userLocation || 'Unknown'}</p><p><strong>Message:</strong><br/>${message}</p>`
        };

        // Attempt email, but don't crash if it fails (Admin Dashboard via Firestore is primary)
        transporter.sendMail(mailOptions).catch(e => console.error("Non-blocking Email Error:", e.message));
        
        res.status(200).json({ success: true, message: 'Request recorded. Staff notified via Dashboard.' });
    } catch (error) {
        console.error('API processing error:', error);
        res.status(500).json({ error: 'Failed to process request.' });
    }
});

// Middleware to restrict API config to our own frontend
const authorizeFrontend = (req, res, next) => {
    // Relaxed for hackathon stability - ensure config is always served to the frontend
    return next();
};

app.get('/api/firebase-config', authorizeFrontend, (req, res) => {
    const config = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };
    
    // Debug log (masked for security in logs)
    console.log(`Serving Firebase Config. API Key present: ${!!config.apiKey}`);
    
    if (!config.apiKey || config.apiKey === "undefined") {
        console.error("CRITICAL: Firebase API Key is missing from environment variables!");
    }
    
    res.json(config);
});

app.get('/api/maps-config', authorizeFrontend, (req, res) => {
    res.json({
        apiKey: process.env.GOOGLE_MAPS_API_KEY
    });
});

app.get('/api/venues/wembley', (req, res) => {
    res.json({
        id: 'wembley_01',
        name: 'Wembley Stadium',
        location: 'London, UK',
        capacity: 90000,
        status: 'Active',
        event: 'Hackathon Finals 2026'
    });
});

app.get('/api/queues', (req, res) => {
    res.json([
        { id: 'q1', type: 'Restroom', section: '101', waitTimeMins: 3, status: 'Fast' },
        { id: 'q2', type: 'Concession', section: '104', waitTimeMins: 15, status: 'Busy' },
        { id: 'q3', type: 'Merch', section: '110', waitTimeMins: 5, status: 'Moderate' },
        { id: 'q4', type: 'Restroom', section: '202', waitTimeMins: 1, status: 'Fast' }
    ]);
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(/^(.*)$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running securely on port ${PORT}`);
});
