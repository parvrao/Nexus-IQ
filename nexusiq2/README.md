# NexusIQ — Supply Chain Intelligence Platform

Real-time supply chain disruption early warning system with live vessel tracking (AIS), cargo aircraft tracking (ADS-B/OpenSky), and HGV ground routing (OpenRouteService).

---

## Quick Start (Local)

```bash
# 1. Backend
cd backend
cp .env.example .env        # fill in your API keys
npm install
npm run dev                 # runs on http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # runs on http://localhost:5173
```

---

## API Keys — Where to Get Them

| Service | Purpose | Get Key | Cost |
|---|---|---|---|
| **AISstream.io** | Live vessel positions | [aisstream.io](https://aisstream.io) → Sign Up → Dashboard → API Keys | Free |
| **OpenSky Network** | Cargo aircraft (ADS-B) | [opensky-network.org](https://opensky-network.org) → Register (username/password = credentials) | Free |
| **OpenRouteService** | HGV truck routing | [openrouteservice.org](https://openrouteservice.org) → Get started free → Dashboard → API Keys | Free (2000 req/day) |

Add keys to `backend/.env`:
```env
AIS_API_KEY=your_key
OPENSKY_USER=your_username
OPENSKY_PASS=your_password
ORS_API_KEY=your_key
```

**Without keys:** all three layers fall back to realistic simulation automatically. The app is fully functional either way.

---

## Deploy to Render

### Option A — Blueprint (one click)
1. Push repo to GitHub
2. Render Dashboard → New → Blueprint → connect repo
3. `render.yaml` deploys both services automatically
4. Add your API keys in each service's Environment settings

### Option B — Manual
**Backend** → New Web Service → Root: `backend` → Build: `npm install` → Start: `node server.js`

**Frontend** → New Static Site → Root: `frontend` → Build: `npm install && npm run build` → Publish: `dist`

Set env vars:
- Backend: `NODE_ENV=production`, `FRONTEND_URL=https://your-frontend.onrender.com`, all API keys
- Frontend: `VITE_API_URL=https://your-backend.onrender.com`

---

## Live Transport Layers

| Layer | Source | Update Rate | Fallback |
|---|---|---|---|
| Ships | AISstream.io WebSocket | ~5 seconds | 20 simulated vessels on real routes |
| Aircraft | OpenSky Network REST | 30 seconds | 10 simulated cargo aircraft |
| Trucks | OpenRouteService HGV routing | 10 seconds (animated) | Straight-line routes |

---

## File Structure

```
nexusiq/
├── render.yaml
├── README.md
├── .gitignore
├── backend/
│   ├── server.js         # Express + Socket.io + REST API
│   ├── tracking.js       # AIS + OpenSky + ORS integration
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── vite.config.js
    ├── package.json
    ├── index.html
    └── src/
        ├── App.jsx
        ├── api.js
        ├── useSocket.js
        ├── useLiveTracking.js
        ├── index.css
        └── components/
            ├── TopBar.jsx
            ├── Ticker.jsx
            ├── LeftPanel.jsx
            ├── MapArea.jsx        # D3 world map + live layers
            ├── BottomPanels.jsx   # Exposure + Scenario Modeler
            └── RightPanel.jsx     # Feed + Timeline + Sources
```

---

## Socket.io Events

| Event | Direction | Data |
|---|---|---|
| `vessel:update` | Server→Client | Single vessel position |
| `vessel:new` | Server→Client | New vessel appeared |
| `vessel:remove` | Server→Client | `{ mmsi }` |
| `aircraft:batch` | Server→Client | Array of all tracked aircraft |
| `ground:routes` | Server→Client | Initial route geometries from ORS |
| `ground:positions` | Server→Client | Current truck positions |
| `signal:count` | Server→Client | `{ count }` |
| `risk:update` | Server→Client | Risk score drifts |
| `feed:new` | Server→Client | New intelligence signal |
| `alert:acknowledged` | Server→Client | `{ id }` syncs all sessions |
