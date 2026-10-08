import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { api } from './api.js';
import { useSocket } from './useSocket.js';
import { SUPPLIERS, linked } from './data.js';
import { Rail, Strip, Palette, SECTIONS } from './components/Shell.jsx';
import { Situation, AlertQueue } from './components/AlertQueue.jsx';
import MapArea from './components/MapArea.jsx';
import SignalLog from './components/SignalLog.jsx';
import Dossier from './components/Dossier.jsx';
import Model from './views/Model.jsx';
import Intel from './views/Intel.jsx';
const Feeds = lazy(()=>import('./views/Feeds.jsx'));

const STEPS = [
  ['stats','Signal counters'], ['suppliers','Supplier register'], ['alerts','Alert queue'],
  ['feed','Signal log'], ['sources','Feed health'], ['timeline','Regional timeline'],
];

function Boot({ done, slow }) {
  return (
    <div className="boot"><div>
      <div style={{color:'var(--ink)',fontWeight:600,fontFamily:'var(--sans)',fontSize:13}}>NexusIQ</div>
      <ol>{STEPS.map(([k,l])=><li key={k} className={done[k]?'done':''}>{l}</li>)}</ol>
      {slow && <p style={{marginTop:16,lineHeight:1.5}}>The backend is waking up. Free hosting can take up to a minute on a cold start.</p>}
    </div></div>
  );
}

export default function App() {
  const [section, setSection] = useState('watch');
  const [stats, setStats]       = useState({ openAlerts:0, criticalAlerts:0, suppliersAtRisk:0, revenueExposed:'0', signalCount:0 });
  const [live, setLive]         = useState([]);
  const [alerts, setAlerts]     = useState([]);
  const [feed, setFeed]         = useState([]);
  const [sources, setSources]   = useState([]);
  const [timeline, setTimeline] = useState(null);
  const [done, setDone]         = useState({});
  const [ready, setReady]       = useState(false);
  const [slow, setSlow]         = useState(false);
  const [apiDown, setApiDown]   = useState(false);
  const [focus, setFocus]       = useState(null);
  const [palette, setPalette]   = useState(false);

  const load = useCallback(async ()=>{
    const mark = k => v => { setDone(d=>({...d,[k]:true})); return v; };
    try {
      const [s,sup,al,f,src,tl] = await Promise.all([
        api.stats().then(mark('stats')), api.suppliers().then(mark('suppliers')), api.alerts().then(mark('alerts')),
        api.feed().then(mark('feed')), api.sources().then(mark('sources')), api.timeline().then(mark('timeline')),
      ]);
      setStats(s); setLive(sup); setAlerts(al); setFeed(f); setSources(src); setTimeline(tl);
      setApiDown(false); setReady(true);
    } catch { setApiDown(true); }
  },[]);

  useEffect(()=>{ load(); const t=setTimeout(()=>setSlow(true),5000); return ()=>clearTimeout(t); },[load]);
  useEffect(()=>{ if(!apiDown||ready) return; const id=setTimeout(load,4000); return ()=>clearTimeout(id); },[apiDown,ready,load]);
  useEffect(()=>{ if(!ready) return; const id=setInterval(()=>api.sources().then(setSources).catch(()=>{}),60000); return ()=>clearInterval(id); },[ready]);

  useSocket({
    'signal:count':       ({count}) => setStats(p=>({...p,signalCount:count})),
    'risk:update':        drifts    => setLive(p=>p.map(s=>{ const d=drifts.find(d=>d.id===s.id); return d?{...s,risk:d.risk}:s; })),
    'feed:new':           item      => setFeed(p=>[item,...p].slice(0,20)),
    'alert:acknowledged': ({id})    => setAlerts(p=>p.filter(a=>a.id!==id)),
  });

  const suppliers = useMemo(()=>SUPPLIERS.map(s=>{ const l=live.find(x=>x.id===s.id); return l?{...s,risk:l.risk}:s; }),[live]);

  const ack = async id => {
    try { await api.acknowledge(id); setAlerts(p=>p.filter(a=>a.id!==id)); setFocus(f=>f?.type==='alert'&&f.id===id?null:f); } catch(e){ console.error(e); }
  };

  // signal → first supplier it names
  const pickSignal = f => { const s=suppliers.find(s=>linked(s,[f],['text','tags']).length); if(s){ setFocus({type:'supplier',id:s.id}); } };
  const focusedSignalIds = useMemo(()=>{
    const s=focus?.type==='supplier'?suppliers.find(x=>x.id===focus.id):null;
    return s?new Set(linked(s,feed,['text','tags']).map(f=>f.id)):null;
  },[focus,suppliers,feed]);

  const paletteItems = useMemo(()=>[
    ...SECTIONS.map(s=>({key:'s'+s.id,label:s.label,hint:`section · ${s.k}`,go:()=>setSection(s.id)})),
    ...suppliers.map(s=>({key:s.id,label:s.name,hint:`supplier · ${s.loc}`,go:()=>{setSection('watch');setFocus({type:'supplier',id:s.id});}})),
    ...alerts.map(a=>({key:a.id,label:a.title,hint:`${a.priority} alert`,go:()=>{setSection('watch');setFocus({type:'alert',id:a.id});}})),
  ],[suppliers,alerts]);

  useEffect(()=>{
    const h=e=>{
      const typing=/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName);
      if(e.key==='Escape'&&!palette) setFocus(null);
      if(typing||e.metaKey||e.ctrlKey||e.altKey) return;
      if(e.key==='/'||e.key==='k'){ e.preventDefault(); setPalette(true); }
      const s=SECTIONS.find(s=>s.k===e.key); if(s) setSection(s.id);
    };
    window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);
  },[palette]);

  if (!ready) return <Boot done={done} slow={slow}/>;

  const selectedId = focus?.type==='supplier' ? focus.id : null;
  return (
    <div className="app">
      <Rail section={section} onSection={setSection} open={alerts.length}/>
      <Strip stats={stats} sources={sources} apiDown={apiDown} onPalette={()=>setPalette(true)}/>
      <main className="view">
        {section==='watch' && (
          <div className="floor">
            <aside className="col l" aria-label="Alerts">
              <Situation alerts={alerts} suppliers={suppliers}/>
              <div className="scroll"><AlertQueue alerts={alerts} focus={focus} onFocus={setFocus}/></div>
            </aside>
            <div className="center">
              <MapArea suppliers={suppliers} selectedId={selectedId} onSelect={id=>setFocus(id?{type:'supplier',id}:null)}/>
              <SignalLog feed={feed} onPick={pickSignal} focusedIds={focusedSignalIds}/>
            </div>
            <aside className="col r" aria-label="Detail">
              <Dossier focus={focus} suppliers={suppliers} alerts={alerts} feed={feed} onFocus={setFocus} onAck={ack} onSignal={pickSignal} onClose={()=>setFocus(null)}/>
            </aside>
          </div>
        )}
        {section==='model' && <Model/>}
        {section==='intel' && <Intel/>}
        {section==='feeds' && <Suspense fallback={<div className="empty">Loading…</div>}><Feeds sources={sources} timeline={timeline}/></Suspense>}
      </main>
      {palette && <Palette items={paletteItems} onClose={()=>setPalette(false)} onPick={it=>it.go()}/>}
    </div>
  );
}
