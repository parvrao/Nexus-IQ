/**
 * NexusIQ — Live Transport Tracking
 * ───────────────────────────────────
 * 1. AISstream.io    — Real vessel positions (WebSocket)
 * 2. OpenSky Network — Cargo aircraft (REST poll every 30s)
 * 3. OpenRouteService — Real HGV truck routes
 */

// CHANGE 1: Use 'import' instead of 'require' for frontend compatibility
import WebSocket from 'ws';

const CARGO_AIRLINES = new Set([
  'FDX','UPS','BCS','DHK','CLX','GTI','ABX','PAC','CKS',
  'CCA','CSN','CES','KAL','AAR','JAL','ANA','EIN','UAE',
  'QTR','CPA','LRC','BAW','AFR','SIA','THA','MPH','HVN',
]);

const AIRLINE_NAMES = {
  FDX:'FedEx Express', UPS:'UPS Airlines', BCS:'DHL Air', DHK:'DHL Aviation',
  CLX:'Cargolux', GTI:'Atlas Air', ABX:'ABX Air', PAC:'Polar Air Cargo',
  CKS:'Kalitta Air', CCA:'Air China Cargo', CSN:'China Southern Cargo',
  KAL:'Korean Air Cargo', AAR:'Asiana Cargo', JAL:'Japan Airlines Cargo',
  ANA:'ANA Cargo', EIN:'Etihad Cargo', UAE:'Emirates SkyCargo',
  QTR:'Qatar Airways Cargo', CPA:'Cathay Pacific Cargo', LRC:'Lufthansa Cargo',
  BAW:'British Airways Cargo', AFR:'Air France Cargo', SIA:'Singapore Air Cargo',
};

const GROUND_CORRIDORS = [
  { id:'G01', name:'LA Port → Chicago DC',  from:[-118.27,33.74], to:[-87.65,41.85] },
  { id:'G02', name:'Memphis Hub → Atlanta', from:[-89.97,35.05],  to:[-84.42,33.64] },
  { id:'G03', name:'Rotterdam → Frankfurt', from:[4.47,51.90],    to:[8.68,50.11]   },
  { id:'G04', name:'Shenzhen → Shanghai',   from:[114.06,22.54],  to:[121.47,31.23] },
  { id:'G05', name:'Hamburg → Warsaw',      from:[10.00,53.55],   to:[21.01,52.23]  },
  { id:'G06', name:'Dallas → Houston Port', from:[-96.80,32.78],  to:[-95.37,29.75] },
  { id:'G07', name:'Detroit → Toronto',     from:[-83.05,42.33],  to:[-79.38,43.65] },
  { id:'G08', name:'Monterrey → Laredo XB', from:[-100.31,25.67], to:[-99.51,27.51] },
];

let vesselState   = new Map();
let aircraftState = new Map();
let groundRoutes  = new Map();
let aisSocket     = null;
let aisConnected  = false;
let openskyLive   = false;
let orsLive       = false;
let io            = null;

// CHANGE 2: Added 'export' keyword here as Claude suggested
export function initTracking(socketIoServer) {
  io = socketIoServer;
  console.log('[Tracking] Initialising live transport layer...');
  connectAIS();
  startOpenSkyPolling();
  loadGroundRoutes();
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. AIS — AISstream.io WebSocket
// ══════════════════════════════════════════════════════════════════════════════
function connectAIS() {
  const apiKey = process.env.AIS_API_KEY;
  if (!apiKey || apiKey === 'your_aisstream_key_here') {
    console.warn('[AIS] No key — running vessel simulation');
    startVesselSimulation();
    return;
  }

  console.log('[AIS] Connecting to AISstream.io...');
  try {
    aisSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');

    aisSocket.on('open', () => {
      aisConnected = true;
      console.log('[AIS] Connected ✓ — sending subscription...');
      aisSocket.send(JSON.stringify({
        APIkey: apiKey,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
      }));
      console.log('[AIS] Subscription sent — waiting for vessel data...');
    });

    aisSocket.on('message', data => {
      try { handleAISMessage(JSON.parse(data.toString())); } catch {}
    });

    aisSocket.on('close', (code) => {
      aisConnected = false;
      console.log(`[AIS] Disconnected (code: ${code}) — reconnecting in 15s`);
      setTimeout(connectAIS, 15000);
    });

    aisSocket.on('error', err => {
      console.error('[AIS] WebSocket error:', err.message);
      aisConnected = false;
    });

  } catch (err) {
    console.error('[AIS] Failed to connect:', err.message);
    startVesselSimulation();
  }
}

let aisMessageCount = 0;

function handleAISMessage(msg) {
  aisMessageCount++;
  if (aisMessageCount <= 5 || aisMessageCount % 100 === 0) {
    console.log(`[AIS] Message #${aisMessageCount} type: ${msg.MessageType}`);
  }

  let lat, lng, heading, speed, mmsi, name, destination, shipType;
  const meta = msg.MetaData || {};

  if (meta.latitude !== undefined && meta.longitude !== undefined) {
    lat = meta.latitude;
    lng = meta.longitude;
  }

  mmsi     = (meta.MMSI || '').toString();
  name     = (meta.ShipName || '').trim();
  shipType = meta.ShipType || 0;

  if (msg.Message?.PositionReport) {
    const pr = msg.Message.PositionReport;
    lat         = lat ?? pr.Latitude;
    lng         = lng ?? pr.Longitude;
    heading     = pr.TrueHeading ?? pr.Cog ?? 0;
    speed       = pr.Sog ?? 0;
    destination = (pr.Destination || '').trim();
    if (!mmsi) mmsi = (pr.UserID || '').toString();
  }

  if (msg.Message?.ClassBPositionReport) {
    const pr = msg.Message.ClassBPositionReport;
    lat     = lat ?? pr.Latitude;
    lng     = lng ?? pr.Longitude;
    heading = pr.TrueHeading ?? pr.Cog ?? 0;
    speed   = pr.Sog ?? 0;
    if (!mmsi) mmsi = (pr.UserID || '').toString();
  }

  if (!lat || !lng) return;
  if (!mmsi) return;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  if (lat === 0 && lng === 0) return;

  const vessel = {
    mmsi,
    source:      'ais-live',
    name:        name || `VESSEL-${mmsi.slice(-4)}`,
    lat, lng,
    speed:       speed ?? 0,
    heading:     heading ?? 0,
    typeLabel:   shipType >= 80 ? 'Tanker' : shipType >= 70 ? 'Cargo' : 'Vessel',
    destination: destination || meta.Destination || 'UNKNOWN',
    flag:        meta.flag || meta.Flag || '',
    shipType,
    ts:          Date.now(),
  };

  const isNew = !vesselState.has(mmsi);
  if (isNew && vesselState.size >= 500) return;

  vesselState.set(mmsi, vessel);

  if (isNew && vesselState.size % 10 === 0) {
    console.log(`[AIS] ${vesselState.size} vessels tracked`);
  }
}

setInterval(() => {
  const cutoff = Date.now() - 900000;
  for (const [mmsi, v] of vesselState) {
    if (v.ts < cutoff) vesselState.delete(mmsi);
  }
}, 60000);

setInterval(() => {
  if (io && vesselState.size > 0) {
    io.emit('vessel:batch', Array.from(vesselState.values()));
  }
}, 5000);

const SIM_VESSELS = [
  { name:'EVER GIVEN II',   from:[121.4,31.2], to:[-118.2,33.7], spd:14, type:'Container', flag:'PA' },
  { name:'MSC AURORA',      from:[114.1,22.5], to:[4.5,51.9],    spd:16, type:'Container', flag:'PA' },
  { name:'MAERSK ESSEX',    from:[103.8,1.3],  to:[-73.9,40.7],  spd:15, type:'Container', flag:'DK' },
  { name:'CMA CGM MARCO',   from:[127.0,37.2], to:[-118.2,33.7], spd:14, type:'Container', flag:'FR' },
  { name:'COSCO SHIPPING',  from:[121.4,31.2], to:[51.5,25.2],   spd:13, type:'Tanker',    flag:'CN' },
  { name:'YANG MING UNITY', from:[120.9,24.8], to:[-73.9,40.7],  spd:15, type:'Container', flag:'TW' },
  { name:'ONE OLYMPUS',     from:[80.2,13.0],  to:[4.5,51.9],    spd:14, type:'Container', flag:'JP' },
  { name:'HAPAG HAMBURG',   from:[4.5,51.9],   to:[-74.0,40.7],  spd:16, type:'Container', flag:'DE' },
  { name:'EVERGREEN EAGLE', from:[-118.2,33.7],to:[121.4,31.2],  spd:15, type:'Container', flag:'TW' },
  { name:'OOCL EUROPE',     from:[4.5,51.9],   to:[114.1,22.5],  spd:16, type:'Container', flag:'HK' },
  { name:'NYK LODESTAR',    from:[139.8,35.6], to:[-118.2,33.7], spd:14, type:'Container', flag:'JP' },
  { name:'ZIM INTEGRATED',  from:[-74.0,40.7], to:[32.0,31.2],   spd:15, type:'Container', flag:'IL' },
  { name:'NORDIC BOTHNIA',  from:[10.0,53.5],  to:[-74.0,40.7],  spd:17, type:'Tanker',    flag:'NO' },
  { name:'BAHRI YANBU',     from:[39.2,21.5],  to:[80.2,13.0],   spd:13, type:'Tanker',    flag:'SA' },
  { name:'PIL ENTERPRISE',  from:[103.8,1.3],  to:[114.1,22.5],  spd:13, type:'Container', flag:'SG' },
  { name:'SINOKOR BUSAN',   from:[129.0,35.1], to:[121.4,31.2],  spd:15, type:'Container', flag:'KR' },
  { name:'ATLANTIC PRIDE',  from:[-74.0,40.7], to:[4.5,51.9],    spd:16, type:'Container', flag:'US' },
  { name:'PACIFIC CROSS',   from:[-118.2,33.7],to:[103.8,1.3],   spd:14, type:'Container', flag:'SG' },
  { name:'GOLDEN OCEAN',    from:[10.0,53.5],  to:[32.0,31.2],   spd:14, type:'Tanker',    flag:'NO' },
  { name:'MOL COURAGE',     from:[103.8,1.3],  to:[139.8,35.6],  spd:13, type:'Container', flag:'JP' },
];

let simVessels = [];
function startVesselSimulation() {
  simVessels = SIM_VESSELS.map((r,i) => ({
    mmsi:`SIM${900000000+i}`, name:r.name, speed:r.spd, heading:0,
    typeLabel:r.type, destination:'', flag:r.flag,
    source:'simulated', progress:Math.random(), from:r.from, to:r.to, ts:Date.now(),
  }));
  setInterval(() => {
    simVessels.forEach(v => {
      const dist = gcDist(v.from, v.to);
      v.progress = (v.progress + (v.speed*1.852)/(dist*1000)*8) % 1;
      const pos  = gcLerp(v.from, v.to, v.progress);
      const next = gcLerp(v.from, v.to, Math.min(v.progress+.01,1));
      v.lat=pos[1]; v.lng=pos[0];
      v.heading=bearing(v.lng,v.lat,next[0],next[1]);
      v.ts=Date.now();
      if (io) io.emit('vessel:update', v);
    });
  }, 8000);
  setTimeout(() => {
    simVessels.forEach(v => {
      const pos=gcLerp(v.from,v.to,v.progress);
      v.lat=pos[1]; v.lng=pos[0];
      if (io) io.emit('vessel:update', v);
    });
  }, 2000);
}

let openskyFails = 0;

async function pollOpenSky() {
  const user = process.env.OPENSKY_USER;
  const pass = process.env.OPENSKY_PASS;
  try {
    const url = 'https://opensky-network.org/api/states/all?lamin=10&lamax=70&lomin=-130&lomax=160';
    const headers = { Accept:'application/json' };
    if (user && pass && user !== 'your_opensky_username')
      headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), 15000);
    const res = await fetch(url, { headers, signal:ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    openskyFails = 0; openskyLive = true;
    if (!data.states) return;
    const updates=[], seen=new Set();
    for (const s of data.states) {
      const [icao24,callsign,,,,lng,lat,,onGround,velocity,trueTrack]=s;
      if (!callsign||!lat||!lng||onGround) continue;
      const code=(callsign||'').trim().slice(0,3).toUpperCase();
      if (!CARGO_AIRLINES.has(code)) continue;
      const ac={
        icao24, source:user?'opensky-live':'opensky-anon',
        callsign:(callsign||'').trim(), airline:code,
        airlineName:AIRLINE_NAMES[code]||`${code} Cargo`,
        lat, lng,
        altitude:s[7]?Math.round(s[7]*3.281):0,
        speed:velocity?Math.round(velocity*1.944):0,
        heading:trueTrack||0, onGround:false, ts:Date.now(),
      };
      aircraftState.set(icao24,ac); updates.push(ac); seen.add(icao24);
    }
    for (const id of aircraftState.keys()) if (!seen.has(id)) aircraftState.delete(id);
    if (io && updates.length) {
      io.emit('aircraft:batch', updates);
      console.log(`[OpenSky] ${updates.length} cargo aircraft updated`);
    }
  } catch (err) {
    openskyFails++;
    if (openskyFails===1) console.warn('[OpenSky]', err.message);
    if (openskyFails===3) { openskyLive=false; console.warn('[OpenSky] Switching to simulation'); startAircraftSim(); }
  }
}

function startOpenSkyPolling() { pollOpenSky(); setInterval(pollOpenSky, 30000); }

const SIM_AIRCRAFT = [
  { cs:'FDX1234', al:'FDX', from:[-89.97,35.05], to:[103.8,1.36],   alt:37000, spd:480 },
  { cs:'UPS2847', al:'UPS', from:[-85.74,38.17], to:[8.57,50.03],   alt:35000, spd:470 },
  { cs:'DHK901',  al:'DHK', from:[12.22,51.42],  to:[55.36,25.25],  alt:38000, spd:485 },
  { cs:'CLX741',  al:'CLX', from:[6.20,49.63],   to:[113.91,22.31], alt:36000, spd:475 },
  { cs:'GTI3301', al:'GTI', from:[-118.41,33.94],to:[103.8,1.36],   alt:37000, spd:480 },
  { cs:'KAL7402', al:'KAL', from:[126.44,37.46], to:[-118.41,33.94],alt:35000, spd:470 },
  { cs:'UAE9771', al:'UAE', from:[55.36,25.25],  to:[-74.0,40.71],  alt:38000, spd:490 },
  { cs:'CPA7630', al:'CPA', from:[113.91,22.31], to:[8.57,50.03],   alt:37000, spd:475 },
  { cs:'FDX9002', al:'FDX', from:[-149.9,61.17], to:[-89.97,35.05], alt:36000, spd:480 },
  { cs:'LRC8842', al:'LRC', from:[8.57,50.03],   to:[121.8,31.15],  alt:37000, spd:475 },
];
let simAc=[];
function startAircraftSim() {
  if (simAc.length) return;
  simAc=SIM_AIRCRAFT.map((r,i)=>({
    icao24:`SIMAC${i}`, callsign:r.cs, airline:r.al,
    airlineName:AIRLINE_NAMES[r.al]||r.al, altitude:r.alt, speed:r.spd,
    heading:0, onGround:false, source:'simulated',
    progress:Math.random(), from:r.from, to:r.to, ts:Date.now(),
  }));
  setInterval(()=>{
    simAc.forEach(a=>{
      const dist=gcDist(a.from,a.to);
      a.progress=(a.progress+(a.speed*1.852)/(dist*1000)*15)%1;
      const pos=gcLerp(a.from,a.to,a.progress);
      const nxt=gcLerp(a.from,a.to,Math.min(a.progress+.005,1));
      a.lat=pos[1]; a.lng=pos[0];
      a.heading=bearing(a.lng,a.lat,nxt[0],nxt[1]);
      a.ts=Date.now();
    });
    if(io) io.emit('aircraft:batch',simAc);
  },15000);
}

async function loadGroundRoutes() {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey || apiKey === 'your_openrouteservice_key_here') {
    console.warn('[ORS] No key — using straight-line ground routes');
    useFallbackGroundRoutes();
    return;
  }

  console.log('[ORS] Loading HGV ground corridors...');

  for (const corridor of GROUND_CORRIDORS) {
    try {
      const [fLng,fLat] = corridor.from;
      const [tLng,tLat] = corridor.to;
      const url = `https://api.openrouteservice.org/v2/directions/driving-hgv?start=${fLng},${fLat}&end=${tLng},${tLat}`;
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 12000);
      const res = await fetch(url, {
        headers: { 'Authorization': apiKey, 'Accept': 'application/json, application/geo+json' },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        const errText = await res.text().catch(()=>'');
        throw new Error(`ORS ${res.status}: ${errText.slice(0,120)}`);
      }
      const data    = await res.json();
      const feature = data.features?.[0];
      if (!feature) throw new Error('No route in ORS response');
      const coords    = feature.geometry.coordinates;
      const summary   = feature.properties?.summary || {};
      const distKm    = Math.round((summary.distance||gcDist(corridor.from,corridor.to)*1000)/1000);
      const durationH = Math.round((summary.duration||distKm*45)/3600);
      groundRoutes.set(corridor.id, {
        ...corridor, waypoints:coords, distanceKm:distKm, durationHrs:durationH,
        truckCount:Math.floor(Math.random()*8)+2, progress:Math.random(), source:'ors-live', ts:Date.now(),
      });
      console.log(`[ORS] ✓ ${corridor.name} — ${distKm}km, ${durationH}h`);
      orsLive = true;
    } catch (err) {
      console.warn(`[ORS] ✗ ${corridor.name}: ${err.message}`);
      groundRoutes.set(corridor.id, {
        ...corridor,
        waypoints:[corridor.from, corridor.to],
        distanceKm:Math.round(gcDist(corridor.from,corridor.to)),
        durationHrs:Math.round(gcDist(corridor.from,corridor.to)/80),
        truckCount:Math.floor(Math.random()*5)+2, progress:Math.random(), source:'estimated', ts:Date.now(),
      });
    }
    await sleep(1600);
  }
  if (io) io.emit('ground:routes', Array.from(groundRoutes.values()));
  startGroundAnimation();
}

function useFallbackGroundRoutes() {
  GROUND_CORRIDORS.forEach(c => {
    groundRoutes.set(c.id, {
      ...c,
      waypoints:[c.from, c.to],
      distanceKm:Math.round(gcDist(c.from,c.to)),
      durationHrs:Math.round(gcDist(c.from,c.to)/80),
      truckCount:Math.floor(Math.random()*5)+2, progress:Math.random(), source:'estimated', ts:Date.now(),
    });
  });
  if (io) io.emit('ground:routes', Array.from(groundRoutes.values()));
  startGroundAnimation();
}

function startGroundAnimation() {
  setInterval(()=>{
    const positions=[];
    for (const [id,route] of groundRoutes) {
      const distKm=route.distanceKm||100;
      route.progress=(route.progress+(75/(distKm*360)))%1;
      const pos=interpolatePath(route.waypoints,route.progress);
      positions.push({ id, name:route.name, lat:pos[1], lng:pos[0], heading:pos[2]||0, speed:75, distanceKm:route.distanceKm, durationHrs:route.durationHrs, truckCount:route.truckCount, source:route.source });
    }
    if (io) io.emit('ground:positions',positions);
  },10000);
}

// CHANGE 3: Added 'export' keyword here too
export function registerTrackingRoutes(app) {
  app.get('/api/live/vessels',  (req,res) => res.json({ count:vesselState.size, source:aisConnected?'ais-live':'simulated', vessels:Array.from(vesselState.values()) }));
  app.get('/api/live/aircraft', (req,res) => res.json({ count:aircraftState.size, aircraft:Array.from(aircraftState.values()) }));
  app.get('/api/live/ground',   (req,res) => res.json({ routes:Array.from(groundRoutes.values()) }));
  app.get('/api/live/summary',  (req,res) => res.json({ vessels:vesselState.size, aircraft:aircraftState.size, groundRoutes:groundRoutes.size, aisLive:aisConnected, openskyLive, orsLive }));
}

function gcDist([lng1,lat1],[lng2,lat2]) {
  const R=6371,d2r=Math.PI/180,dLat=(lat2-lat1)*d2r,dLng=(lng2-lng1)*d2r;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function gcLerp([lng1,lat1],[lng2,lat2],t){ return [lng1+(lng2-lng1)*t,lat1+(lat2-lat1)*t]; }
function bearing(lng1,lat1,lng2,lat2){
  const d=Math.PI/180,dL=(lng2-lng1)*d,l1=lat1*d,l2=lat2*d;
  return((Math.atan2(Math.sin(dL)*Math.cos(l2),Math.cos(l1)*Math.sin(l2)-Math.sin(l1)*Math.cos(l2)*Math.cos(dL))*180/Math.PI)+360)%360;
}
function interpolatePath(pts,t){
  if(!pts||pts.length<2)return[0,0,0];
  const n=pts.length-1,s=t*n,i=Math.min(Math.floor(s),n-1),f=s-i;
  const[l1,a1]=pts[i],[l2,a2]=pts[Math.min(i+1,n)];
  return[l1+(l2-l1)*f,a1+(a2-a1)*f,bearing(l1,a1,l2,a2)];
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// FINAL CHANGE: Removed module.exports to avoid "mixed module" errors in frontend
