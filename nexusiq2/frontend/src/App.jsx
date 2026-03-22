import { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import { useSocket } from './useSocket.js';
import TopBar       from './components/TopBar.jsx';
import Ticker       from './components/Ticker.jsx';
import LeftPanel    from './components/LeftPanel.jsx';
import MapArea      from './components/MapArea.jsx';
import BottomPanels from './components/BottomPanels.jsx';
import RightPanel   from './components/RightPanel.jsx';

export default function App() {
  const [stats,     setStats]     = useState({ openAlerts:23, criticalAlerts:2, suppliersAtRisk:47, revenueExposed:'14.2', signalCount:1247 });
  const [suppliers, setSuppliers] = useState([]);
  const [alerts,    setAlerts]    = useState([]);
  const [feed,      setFeed]      = useState([]);
  const [sources,   setSources]   = useState([]);
  const [timeline,  setTimeline]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  const loadAll = useCallback(async ()=>{
    try {
      const [s,sup,al,f,src,tl] = await Promise.all([
        api.stats(), api.suppliers(), api.alerts(), api.feed(), api.sources(), api.timeline()
      ]);
      setStats(s); setSuppliers(sup); setAlerts(al);
      setFeed(f); setSources(src); setTimeline(tl);
    } catch(e){ console.error('Load error:',e.message); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ loadAll(); },[]);

  useSocket({
    'signal:count':      ({count})  => setStats(p=>({...p,signalCount:count})),
    'risk:update':       drifts     => setSuppliers(p=>p.map(s=>{ const d=drifts.find(d=>d.id===s.id); return d?{...s,risk:d.risk}:s; })),
    'feed:new':          item       => setFeed(p=>[item,...p].slice(0,20)),
    'alert:acknowledged':({id})     => { setAlerts(p=>p.filter(a=>a.id!==id)); setStats(p=>({...p,openAlerts:Math.max(0,p.openAlerts-1)})); },
  });

  const handleAck = async id => {
    try {
      await api.acknowledge(id);
      setAlerts(p=>p.filter(a=>a.id!==id));
      setStats(p=>({...p,openAlerts:Math.max(0,p.openAlerts-1)}));
    } catch(e){ console.error(e); }
  };

  if (loading) return (
    <div style={{height:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',fontFamily:'var(--mono)',color:'var(--blue-ll)',fontSize:13}}>
      <div><div style={{marginBottom:8,opacity:.4,fontSize:10,letterSpacing:2}}>NEXUSIQ</div><div>Initialising intelligence feeds...</div></div>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <TopBar stats={stats}/>
      <Ticker/>
      <div style={{flex:1,display:'grid',gridTemplateColumns:'260px 1fr 300px',overflow:'hidden',minHeight:0}}>
        <LeftPanel alerts={alerts} stats={stats} sources={sources} onAcknowledge={handleAck}/>
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <MapArea suppliers={suppliers}/>
          <BottomPanels suppliers={suppliers}/>
        </div>
        <RightPanel feed={feed} timeline={timeline} sources={sources}/>
      </div>
    </div>
  );
}
