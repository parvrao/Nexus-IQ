import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';

const URL = import.meta.env.VITE_API_URL || '';

export function useLiveTracking() {
  const [vessels,  setVessels]  = useState(new Map());
  const [aircraft, setAircraft] = useState(new Map());
  const [ground,   setGround]   = useState([]);
  const [summary,  setSummary]  = useState({ vessels:0, aircraft:0, groundRoutes:0, aisLive:false, openskyLive:false, orsLive:false });

  useEffect(()=>{
    // Load snapshots
    Promise.all([api.liveVessels(), api.liveAircraft(), api.liveGround(), api.liveSummary()])
      .then(([v,a,g,s])=>{
        if (v?.vessels)  { const m=new Map(); v.vessels.forEach(x=>m.set(x.mmsi,x));   setVessels(m); }
        if (a?.aircraft) { const m=new Map(); a.aircraft.forEach(x=>m.set(x.icao24,x));setAircraft(m); }
        if (g?.routes)   setGround(g.routes);
        if (s)           setSummary(s);
      }).catch(()=>{});

    const s = io(URL, { transports:['websocket','polling'], reconnectionAttempts:10 });

    s.on('vessel:update', v  => setVessels(p=>{ const n=new Map(p); n.set(v.mmsi,v); return n; }));
    s.on('vessel:new',    v  => setVessels(p=>new Map(p).set(v.mmsi,v)));
    s.on('vessel:remove', ({mmsi}) => setVessels(p=>{ const n=new Map(p); n.delete(mmsi); return n; }));

    s.on('aircraft:batch', batch => {
      const m=new Map(); batch.forEach(a=>m.set(a.icao24,a)); setAircraft(m);
    });

    s.on('ground:routes',    routes    => setGround(routes));
    s.on('ground:positions', positions => {
      setGround(prev=>{
        const m=new Map(prev.map(r=>[r.id,r]));
        positions.forEach(p=>{ if(m.has(p.id)) m.set(p.id,{...m.get(p.id),...p}); });
        return Array.from(m.values());
      });
    });

    const si = setInterval(()=>api.liveSummary().then(setSummary).catch(()=>{}), 30000);
    return ()=>{ s.disconnect(); clearInterval(si); };
  },[]);

  return {
    vessels:  Array.from(vessels.values()),
    aircraft: Array.from(aircraft.values()),
    ground,
    summary,
  };
}
