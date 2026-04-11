import { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import { useSocket } from './useSocket.js';
import TopBar       from './components/TopBar.jsx';
import Ticker       from './components/Ticker.jsx';
import LeftPanel    from './components/LeftPanel.jsx';
import MapArea      from './components/MapArea.jsx';
import BottomPanels from './components/BottomPanels.jsx';
import RightPanel   from './components/RightPanel.jsx';

// ── Scenarios full page ───────────────────────────────────────────────────────
function ScenariosView() {
  const [port,     setPort]     = useState('POLAX');
  const [capacity, setCapacity] = useState(40);
  const [result,   setResult]   = useState(null);

  const PORTS = [
    { code:'POLAX', label:'Port of Los Angeles — POLAX' },
    { code:'CNSHA', label:'Port of Shanghai — CNSHA'    },
    { code:'NLRTM', label:'Port of Rotterdam — NLRTM'   },
    { code:'SUEZ',  label:'Suez Canal — Transit Corridor'},
    { code:'TWKHH', label:'Port of Kaohsiung — TWKHH'   },
    { code:'SGSIN', label:'Port of Singapore — SGSIN'   },
  ];

  useEffect(()=>{
    api.scenario(port, capacity).then(setResult).catch(()=>{});
  },[port, capacity]);

  return (
    <div style={{flex:1,overflow:'auto',padding:'32px',background:'var(--bg)'}}>
      <div style={{maxWidth:960,margin:'0 auto'}}>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:22,fontWeight:700,color:'var(--text)',marginBottom:6}}>Scenario Modeler</div>
          <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>
            Model the cascading impact of a port or chokepoint disruption across your supply chain network. Adjust capacity reduction to see revenue exposure, affected lanes, and estimated recovery time.
          </div>
        </div>

        {/* Controls */}
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'24px',marginBottom:24,boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:16}}>Configure Disruption Scenario</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text2)',display:'block',marginBottom:8}}>Port / Chokepoint</label>
              <select value={port} onChange={e=>setPort(e.target.value)}
                style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:7,padding:'10px 14px',color:'var(--text)',fontSize:13,fontFamily:'var(--sans)',cursor:'pointer',outline:'none',appearance:'none'}}>
                {PORTS.map(p=><option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <label style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>Capacity Reduction</label>
                <span style={{fontSize:14,fontFamily:'var(--mono)',fontWeight:700,color:'var(--amber)'}}>{capacity}%</span>
              </div>
              <input type="range" min="0" max="100" value={capacity}
                onChange={e=>setCapacity(Number(e.target.value))}
                style={{width:'100%',WebkitAppearance:'none',height:5,borderRadius:3,background:`linear-gradient(to right,var(--blue) ${capacity}%,var(--bg4) ${capacity}%)`,cursor:'pointer',outline:'none',border:'none',marginTop:8}}/>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:24}}>
              {[
                { label:'Revenue at Risk',  value:`$${result.revenueAtRisk}M`, sub:'weekly exposure',         color:'var(--red)'   },
                { label:'Lanes Affected',   value:result.lanesAffected,        sub:`of ${result.totalLanes} total`,    color:'var(--amber)' },
                { label:'Suppliers Hit',    value:result.suppliersHit,         sub:`of ${result.totalSuppliers} dependent`, color:'var(--amber)' },
                { label:'Recovery Time',    value:`${result.recoveryDays}d`,   sub:'est. normalization',      color:result.recoveryDays>20?'var(--red)':'var(--amber)' },
              ].map(c=>(
                <div key={c.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'20px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
                  <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:.8,marginBottom:8,fontWeight:600}}>{c.label}</div>
                  <div style={{fontSize:32,fontWeight:800,fontFamily:'var(--mono)',color:c.color,letterSpacing:-1,lineHeight:1}}>{c.value}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:6}}>{c.sub}</div>
                </div>
              ))}
            </div>

            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'20px',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:10}}>Alternate Routes</div>
              <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.7}}>
                {result.alternateRoutes > 0
                  ? `${result.alternateRoutes} alternate routing option${result.alternateRoutes>1?'s':''} identified for this scenario. Contact your 3PL to activate contingency lanes before disruption escalates.`
                  : 'No viable alternate routes available for this scenario at this capacity reduction level. Pre-position buffer stock immediately and notify tier-1 suppliers.'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Intelligence full page ────────────────────────────────────────────────────
function IntelligenceView() {
  const [news,     setNews]     = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);
  const BASE = import.meta.env.VITE_API_URL || 'https://nexus-iq-dxza.onrender.com';

  useEffect(()=>{
    Promise.all([
      fetch(`${BASE}/api/news`).then(r=>r.json()),
      fetch(`${BASE}/api/forecast`).then(r=>r.json()),
    ]).then(([n,f])=>{
      setNews(Array.isArray(n)?n:[]);
      setForecast(f);
      setLoading(false);
    }).catch(()=>setLoading(false));

    const interval = setInterval(()=>{
      fetch(`${BASE}/api/news`).then(r=>r.json()).then(n=>setNews(Array.isArray(n)?n:[])).catch(()=>{});
    }, 15*60*1000);
    return ()=>clearInterval(interval);
  },[]);

  const sevColor = s => s==='critical'?'#dc2626':s==='high'?'#d97706':s==='medium'?'#2563eb':'#059669';
  const trendIcon = t => t==='rising'?'↑':t==='falling'?'↓':'→';
  const trendCol  = t => t==='rising'?'#dc2626':t==='falling'?'#059669':'#94a3b8';

  return (
    <div style={{flex:1,overflow:'auto',padding:'32px',background:'var(--bg)'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:22,fontWeight:700,color:'var(--text)',marginBottom:6}}>Intelligence Center</div>
          <div style={{fontSize:13,color:'var(--text2)'}}>
            Global supply chain disruption news, AI-analyzed and ranked by impact severity. Updated every 15 minutes.
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:24,alignItems:'start'}}>

          {/* News feed */}
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase'}}>
                Live News — {news.length} articles
              </div>
              <div style={{display:'flex',gap:8}}>
                {['critical','high','medium'].map(s=>(
                  <span key={s} style={{fontSize:10,fontFamily:'var(--mono)',padding:'2px 8px',borderRadius:3,background:`${sevColor(s)}10`,color:sevColor(s),border:`1px solid ${sevColor(s)}25`,cursor:'pointer'}}>
                    {news.filter(n=>n.impactSeverity===s).length} {s}
                  </span>
                ))}
              </div>
            </div>

            {loading && (
              <div style={{padding:'40px 20px',textAlign:'center',color:'var(--text3)',fontSize:13}}>Loading intelligence feeds...</div>
            )}

            {!loading && news.length===0 && (
              <div style={{padding:'40px 20px',textAlign:'center',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12}}>
                <div style={{fontSize:16,marginBottom:8}}>📡</div>
                <div style={{fontSize:13,color:'var(--text2)',marginBottom:4}}>No articles loaded yet</div>
                <div style={{fontSize:11,color:'var(--text3)'}}>Backend is fetching news — check again in 60 seconds</div>
              </div>
            )}

            {news.map((n,i)=>(
              <div key={n.id||i}
                onClick={()=>setExpanded(expanded===i?null:i)}
                style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'18px 20px',marginBottom:12,borderLeft:`3px solid ${sevColor(n.impactSeverity)}`,cursor:'pointer',transition:'.15s',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:8}}>
                  <div style={{fontSize:14,fontWeight:600,color:'var(--text)',lineHeight:1.4,flex:1}}>{n.title}</div>
                  <span style={{fontSize:10,fontWeight:700,color:sevColor(n.impactSeverity),padding:'3px 8px',borderRadius:4,background:`${sevColor(n.impactSeverity)}10`,border:`1px solid ${sevColor(n.impactSeverity)}25`,whiteSpace:'nowrap',flexShrink:0}}>
                    {(n.impactSeverity||'').toUpperCase()}
                  </span>
                </div>

                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                  {(n.affectedRegions||[]).map(r=>(
                    <span key={r} style={{fontSize:10,fontFamily:'var(--mono)',padding:'2px 7px',borderRadius:3,background:'rgba(37,99,235,0.07)',color:'var(--blue)',border:'1px solid rgba(37,99,235,0.15)'}}>{r}</span>
                  ))}
                  {(n.estimatedDelayDays||0)>0 && (
                    <span style={{fontSize:10,fontFamily:'var(--mono)',padding:'2px 7px',borderRadius:3,background:'rgba(217,119,6,0.07)',color:'var(--amber)',border:'1px solid rgba(217,119,6,0.2)'}}>+{n.estimatedDelayDays}d delay</span>
                  )}
                </div>

                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>{n.source}</span>
                  <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>{expanded===i?'▲ collapse':'▼ expand'}</span>
                </div>

                {expanded===i && (
                  <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)'}}>
                    {n.description && n.description!==n.title && (
                      <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.6,marginBottom:12}}>{n.description}</div>
                    )}
                    {(n.suppliersAtRisk||[]).length>0 && (
                      <div style={{marginBottom:10}}>
                        <span style={{fontSize:11,fontWeight:600,color:'var(--text2)'}}>Suppliers at risk: </span>
                        <span style={{fontSize:11,color:'var(--red)',fontFamily:'var(--mono)'}}>{n.suppliersAtRisk.join(', ')}</span>
                      </div>
                    )}
                    {n.recommendedAction && (
                      <div style={{padding:'10px 14px',background:'rgba(37,99,235,0.05)',border:'1px solid rgba(37,99,235,0.15)',borderRadius:7,marginBottom:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:'var(--blue)',marginBottom:4}}>▶ Recommended Action</div>
                        <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.5}}>{n.recommendedAction}</div>
                      </div>
                    )}
                    {n.forecastImpact && (
                      <div style={{fontSize:12,color:'var(--text3)',fontStyle:'italic',lineHeight:1.5,marginBottom:8}}>{n.forecastImpact}</div>
                    )}
                    {n.url && n.url!=='#' && (
                      <a href={n.url} target="_blank" rel="noopener noreferrer"
                        onClick={e=>e.stopPropagation()}
                        style={{fontSize:12,color:'var(--blue)',textDecoration:'none',fontWeight:600}}>
                        Read full article →
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Forecast sidebar */}
          {forecast && (
            <div style={{position:'sticky',top:0}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:14}}>30-Day Forecast</div>

              {/* Overall risk */}
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'16px',marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Overall Risk</span>
                  <span style={{fontSize:11,fontWeight:700,color:sevColor(forecast.overallRiskLevel),padding:'3px 10px',borderRadius:4,background:`${sevColor(forecast.overallRiskLevel)}10`,border:`1px solid ${sevColor(forecast.overallRiskLevel)}25`}}>
                    {(forecast.overallRiskLevel||'').toUpperCase()}
                  </span>
                </div>
                <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>{forecast.summary}</div>
                <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginTop:8}}>
                  Updated {new Date(forecast.generatedAt).toLocaleTimeString()}
                </div>
              </div>

              {/* Regional risk */}
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'16px',marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:12}}>Regional Risk</div>
                {(forecast.regions||[]).map(r=>(
                  <div key={r.name} style={{marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{r.name}</span>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:12,fontWeight:700,color:trendCol(r.trend)}}>{trendIcon(r.trend)}</span>
                        <span style={{fontSize:13,fontFamily:'var(--mono)',fontWeight:700,color:sevColor(r.riskScore>=80?'critical':r.riskScore>=50?'high':'low')}}>{r.riskScore}</span>
                      </div>
                    </div>
                    <div style={{height:4,background:'var(--bg3)',borderRadius:2,overflow:'hidden',marginBottom:4}}>
                      <div style={{height:'100%',width:`${r.riskScore}%`,background:sevColor(r.riskScore>=80?'critical':r.riskScore>=50?'high':'medium'),borderRadius:2,transition:'width .5s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{fontSize:11,color:'var(--text3)'}}>{r.keyThreat}</span>
                      <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)'}}>{r.timeframe}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top threats */}
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'16px',marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:12}}>Top Threats</div>
                {(forecast.topThreats||[]).map((t,i)=>(
                  <div key={i} style={{padding:'10px 12px',background:'var(--bg3)',borderRadius:7,marginBottom:8,border:`1px solid ${sevColor(t.impact)}18`}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                      <span style={{fontSize:10,fontWeight:700,color:sevColor(t.impact)}}>{(t.impact||'').toUpperCase()}</span>
                      <span style={{fontSize:11,fontFamily:'var(--mono)',fontWeight:700,color:t.probability>=70?'var(--red)':t.probability>=40?'var(--amber)':'var(--text2)'}}>
                        {t.probability}% prob
                      </span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text)',lineHeight:1.4,marginBottom:6}}>{t.threat}</div>
                    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                      {(t.affectedLanes||[]).map(l=>(
                        <span key={l} style={{fontSize:9,fontFamily:'var(--mono)',padding:'1px 5px',borderRadius:3,background:'rgba(37,99,235,0.07)',color:'var(--blue)',border:'1px solid rgba(37,99,235,0.15)'}}>{l}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:12,padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',letterSpacing:.8,textTransform:'uppercase',marginBottom:12}}>Recommendations</div>
                {(forecast.recommendations||[]).map((r,i)=>(
                  <div key={i} style={{display:'flex',gap:10,marginBottom:10}}>
                    <div style={{width:20,height:20,borderRadius:'50%',background:'var(--blue-glow)',border:'1px solid rgba(37,99,235,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:10,fontFamily:'var(--mono)',color:'var(--blue)',fontWeight:700,marginTop:1}}>{i+1}</div>
                    <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>{r}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState(0);
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
        api.stats(), api.suppliers(), api.alerts(),
        api.feed(), api.sources(), api.timeline()
      ]);
      setStats(s); setSuppliers(sup); setAlerts(al);
      setFeed(f); setSources(src); setTimeline(tl);
    } catch(e){ console.error('Load error:',e.message); }
    finally{ setLoading(false); }
  },[]);

  useEffect(()=>{ loadAll(); },[]);

  useSocket({
    'signal:count':       ({count}) => setStats(p=>({...p,signalCount:count})),
    'risk:update':        drifts    => setSuppliers(p=>p.map(s=>{ const d=drifts.find(d=>d.id===s.id); return d?{...s,risk:d.risk}:s; })),
    'feed:new':           item      => setFeed(p=>[item,...p].slice(0,20)),
    'alert:acknowledged': ({id})    => { setAlerts(p=>p.filter(a=>a.id!==id)); setStats(p=>({...p,openAlerts:Math.max(0,p.openAlerts-1)})); },
  });

  const handleAck = async id => {
    try {
      await api.acknowledge(id);
      setAlerts(p=>p.filter(a=>a.id!==id));
      setStats(p=>({...p,openAlerts:Math.max(0,p.openAlerts-1)}));
    } catch(e){ console.error(e); }
  };

  if (loading) return (
    <div style={{height:'100vh',display:'grid',placeItems:'center',background:'var(--bg)',fontFamily:'var(--mono)',color:'var(--blue)',fontSize:13}}>
      <div style={{textAlign:'center'}}>
        <div style={{marginBottom:8,opacity:.4,fontSize:10,letterSpacing:2}}>NEXUSIQ</div>
        <div>Initialising intelligence feeds...</div>
        <div style={{width:140,height:2,background:'var(--bg4)',borderRadius:1,overflow:'hidden',margin:'12px auto 0'}}>
          <div style={{height:'100%',background:'var(--blue)',borderRadius:1,animation:'loadBar 1.4s ease-in-out infinite',width:'40%'}}/>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <TopBar stats={stats} onTabChange={setActiveTab}/>
      <Ticker/>

      {/* Tab 0 — Risk Overview: full dashboard */}
      {activeTab===0 && (
        <div style={{flex:1,display:'grid',gridTemplateColumns:'260px 1fr 300px',overflow:'hidden',minHeight:0}}>
          <LeftPanel alerts={alerts} stats={stats} sources={sources} onAcknowledge={handleAck}/>
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <MapArea suppliers={suppliers}/>
            <BottomPanels suppliers={suppliers}/>
          </div>
          <RightPanel feed={feed} timeline={timeline} sources={sources}/>
        </div>
      )}

      {/* Tab 1 — Network Map: full screen map */}
      {activeTab===1 && (
        <div style={{flex:1,overflow:'hidden',minHeight:0,display:'flex',flexDirection:'column'}}>
          <div style={{padding:'10px 20px',background:'var(--bg2)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
            <span style={{fontSize:11,fontWeight:700,color:'var(--text2)',letterSpacing:.5,textTransform:'uppercase'}}>Network Map</span>
            <span style={{fontSize:11,color:'var(--text3)'}}>
              {suppliers.length} suppliers · {suppliers.filter(s=>s.risk>=80).length} critical · {suppliers.filter(s=>s.risk>=50&&s.risk<80).length} high risk
            </span>
          </div>
          <MapArea suppliers={suppliers}/>
        </div>
      )}

      {/* Tab 2 — Scenarios: full page modeler */}
      {activeTab===2 && (
        <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
          <ScenariosView/>
        </div>
      )}

      {/* Tab 3 — Intelligence: news + forecast */}
      {activeTab===3 && (
        <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
          <IntelligenceView/>
        </div>
      )}

      {/* Tabs 4 and 5 hidden from nav — not shown */}
    </div>
  );
}
