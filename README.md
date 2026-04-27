# 🛡️ VenueShield AI Crisis Response

**Elevating the Stadium Experience with Real-Time Intelligence.**

![VenueShield AI Crisis Response Banner](public/assets/docs/banner.png)

## 🌟 Overview

**VenueShield AI Crisis Response (VSAI)** is a premium, mobile-first companion application designed to transform the live event experience. By integrating real-time data from Firebase and Google Cloud services, VSAI empowers fans to navigate complex stadiums with ease, avoid long queues, and stay safe through instant emergency coordination.

For venue operators, VenueShield provides a powerful **Admin Dashboard** to monitor crowd density, manage events, and respond to assistance requests in real-time, ensuring a seamless and secure environment for thousands of attendees.

---

## 🚀 Key Features

### 🧠 Gemini Crowd Crush Predictor [NEW]

**The heart of VenueShield safety.** This feature uses **Google Gemini 1.5 Flash** to analyze real-time venue telemetry (zone density, entry rates, weather, and event type) to predict potential stampedes or crowd crushes **15 minutes before they happen**. 

- **Preventive Analysis**: Moves security from "Reactive" to "Proactive".
- **Actionable Commands**: Provides stewards with specific diversion tactics (e.g., "Close Gate C, Divert to North").
- **Auto-Emergency Broadcast**: Instantly triggers a venue-wide notification if a critical risk threshold is reached.

### 🗺️ Real-Time Crowd Heatmaps

Visualize stadium congestion levels instantly. Our integration with Google Maps API (Visualization Library) provides live heatmaps, allowing users to identify crowded zones and find quieter routes or facilities.
![Heatmap Feature](public/assets/docs/heatmap.png)

### ⏳ Smart Queue Management

Stop guessing wait times. VenueShield tracks and predicts queue lengths for restrooms, concessions, and entry points, helping fans spend more time enjoying the event and less time standing in line.

### 📍 Indoor Navigation & Location Sharing

Lost in a sea of sections? Our indoor locator helps you find your way. Plus, users can share their real-time location with stadium staff or friends in case of emergencies, ensuring help is always just a tap away.

### 🎫 Integrated Event & Ticket Management

Browse upcoming events, request digital tickets, and sync them to your calendar. The system handles multi-ticket permissions and automated fee notifications seamlessly.

### 🛠️ Professional Admin Dashboard

A centralized hub for venue managers to:

- **Deploy Alerts**: Send emergency FCM notifications to all users.
- **Manage Heatmaps**: Update congestion data dynamically.
- **Coordinate Assistance**: Real-time tracking of staff response to user help requests.
- **Event Orchestration**: Create, edit, and monitor live events.

---

## 🛠️ Technology Stack

| Layer              | Technology                                                         |
| :----------------- | :----------------------------------------------------------------- |
| **Frontend**       | Vanilla JavaScript (ES6+), HTML5, CSS3 (Modern Token-based System) |
| **Backend**        | Node.js, Express.js                                                |
| **Database**       | Firebase Firestore (Real-time NoSQL)                               |
| **Authentication** | Firebase Auth                                                      |
| **Cloud Services** | Google Maps Platform, Firebase Cloud Messaging (FCM), Google Gemini AI (1.5 Flash) |
| **Deployment**     | Dockerized for seamless scaling                                    |

---

## 🏗️ Process Flow: AI Risk Prediction
This diagram illustrates how **Gemini AI** proactively protects the venue.

```mermaid
sequenceDiagram
    participant S as Venue Sensors
    participant DB as Firestore
    participant A as Admin Dashboard
    participant G as Gemini AI (1.5 Flash)
    participant U as Attendee App
    
    S->>DB: Update Zone Density
    DB->>A: Stream Real-time Heatmap
    A->>G: POST /api/ai-risk (Current Telemetry)
    Note right of G: Predicts Risk 15min ahead
    G-->>A: JSON (Risk: 9.2, Action: Divert)
    
    alt If Risk Score >= 9
        A->>DB: Write Emergency Notification
        DB->>U: Real-time Listener Triggers Alert
    end
```

> [!TIP]
> For a deeper dive into the **Structural System Architecture** and **Use-Case Diagrams**, see the [architecture_diagrams.md](file:///C:/Users/ok/.gemini/antigravity/brain/6c392b5d-eb52-4e7b-a3d7-26cd00fdea6d/architecture_diagrams.md) artifact.

---

## ⚙️ Setup & Installation

### Prerequisites

- Node.js (v16+)
- Firebase Project with Firestore and Auth enabled
- Google Cloud API Key (with Maps & Visualization libraries)

### 1. Clone & Install

```bash
git clone https://github.com/gayatridot/VenueShield-AI-Crisis-Response.git
cd VenueShield-AI-Crisis-Response
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
PORT=3000
FIREBASE_API_KEY=your_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### 3. Run Locally

```bash
npm run dev
```

Open `http://localhost:3000` to view the app. Access the admin panel at `http://localhost:3000/admin.html`.

---

## 🛡️ Safety & Privacy

User location sharing is **strictly opt-in** and only active during live assistance requests. Data is handled according to modern security standards using Firebase Security Rules.

---

## 🔮 Future Roadmap

VenueShield is built to scale. Our vision includes:
- **AI Vision**: Automated CCTV density analysis using Google Cloud Vision.
- **PWA**: Offline map support for signal-congested environments.
- **AR Wayfinding**: Augmented Reality navigation to specific stadium seats.
- **Dynamic Logistics**: Integration with city transit for post-event crowd dispersion.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ for the Hackathon.
