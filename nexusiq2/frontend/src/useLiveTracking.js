import { useState, useEffect } from 'react';

// Keep all your constants outside the hook so they don't re-render
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

// Helper Functions
const gcDist = ([lng1,lat1],[lng2,lat2]) => {
  const R=6371, d2r=Math.PI/180, dLat=(lat2-lat1)*d2r, dLng=(lng2-lng1)*d2r;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};
const gcLerp = ([lng1,lat1],[lng2,lat2],t) => [lng1+(lng2-lng1)*t,lat1+(lat2-lat1)*t];
const bearing = (lng1,lat1,lng2,lat2) => {
  const d=Math.PI/180, dL=(lng2-lng1)*d, l1=lat1*d, l2=lat2*d;
  return((Math.atan2(Math.sin(dL)*Math.cos(l2),Math.cos(l1)*Math.sin(l2)-Math.sin(l1)*Math.cos(l2)*Math.cos(dL))*180/Math.PI)+360)%360;
};

// --- THIS IS THE CRITICAL CHANGE ---
export function useLiveTracking() {
  const [vessels, setVessels] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [groundPositions, setGroundPositions] = useState([]);

  useEffect(() => {
    // Initial vessel simulation state
    let simV = SIM_VESSELS.map((r,i) => ({
      mmsi:`SIM${900000000+i}`, name:r.name, speed:r.spd, heading:0,
      typeLabel:r.type, destination:'', flag:r.flag,
      source:'simulated', progress:Math.random(), from:r.from, to:r.to, ts:Date.now(),
    }));

    const timer = setInterval(() => {
      const updated = simV.map(v => {
        const dist = gcDist(v.from, v.to);
        v.progress = (v.progress + (v.speed*1.852)/(dist*1000)*8) % 1;
        const pos  = gcLerp(v.from, v.to, v.progress);
        const next = gcLerp(v.from, v.to, Math.min(v.progress+.01,1));
        return {
          ...v,
          lat: pos[1],
          lng: pos[0],
          heading: bearing(v.lng, v.lat, next[0], next[1]),
          ts: Date.now()
        };
      });
      setVessels(updated);
    }, 4000); // Update every 4 seconds

    return () => clearInterval(timer);
  }, []);

  return { vessels, aircraft, groundPositions };
}
