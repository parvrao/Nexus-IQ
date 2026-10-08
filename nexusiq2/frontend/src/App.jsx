import { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import { useSocket } from './useSocket.js';
import TopBar       from './components/TopBar.jsx';
import Ticker       from './components/Ticker.jsx';
import LeftPanel    from './components/LeftPanel.jsx';
import MapArea      from './components/MapArea.jsx';
import BottomPanels from './components/BottomPanels.jsx';
import RightPanel   from './components/RightPanel.jsx';
import { SUPPLIERS } from './data.js';

const BASE = import.meta.env.VITE_API_URL || 'https://nexus-iq-dxza.onrender.com';

// Merge live risk scores into the static supplier register (names, sites, coordinates).
const mapSuppliers = live => SUPPLIERS.map(s=>{ const l=(live||[]).find(x=>x.id===s.id); return l?{...s,risk:l.risk}:s; });

// ── Mobile detection hook ─────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(()=>{
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  },[]);
  return isMobile;
}

// ── Scenarios view (shared between desktop and mobile) ────────────────────────
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
    <div style={{flex:1,overflow:'auto',padding:'20px 16px',background:'var(--bg)'}}>
      <div style={{maxWidth:960,margin:'0 auto'}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700,color:'var(--text)',marginBottom:4}}>Scenario Modeler</div>
          <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>Model port disruption impact across your supply chain.</div>
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'16px',marginBottom:16,}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:12}}>Configure Scenario</div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:600,color:'var(--text2)',display:'block',marginBottom:6}}>Port / Chokepoint</label>
            <select value={port} onChange={e=>setPort(e.target.value)}
              style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',padding:'10px 12px',color:'var(--text)',fontSize:13,fontFamily:'var(--sans)',cursor:'pointer',outline:'none'}}>
              {PORTS.map(p=><option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <label style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>Capacity Reduction</label>
              <span style={{fontSize:13,fontFamily:'var(--mono)',fontWeight:700,color:'var(--amber)'}}>{capacity}%</span>
            </div>
            <input type="range" min="0" max="100" value={capacity}
              onChange={e=>setCapacity(Number(e.target.value))}
              style={{width:'100%',WebkitAppearance:'none',height:5,background:`linear-gradient(to right,var(--blue) ${capacity}%,var(--bg4) ${capacity}%)`,cursor:'pointer',outline:'none',border:'none'}}/>
          </div>
        </div>
        {result && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {[
                { label:'Revenue at Risk', value:`$${result.revenueAtRisk}M`, sub:'weekly exposure',   color:'var(--red)'   },
                { label:'Lanes Affected',  value:result.lanesAffected,        sub:`of ${result.totalLanes} total`, color:'var(--amber)' },
                { label:'Suppliers Hit',   value:result.suppliersHit,         sub:`of ${result.totalSuppliers}`,   color:'var(--amber)' },
                { label:'Recovery Time',   value:`${result.recoveryDays}d`,   sub:'est. normalization',color:result.recoveryDays>20?'var(--red)':'var(--amber)' },
              ].map(c=>(
                <div key={c.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'14px 12px'}}>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:6,fontWeight:600}}>{c.label}</div>
                  <div style={{fontSize:24,fontWeight:800,fontFamily:'var(--mono)',color:c.color,lineHeight:1}}>{c.value}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'14px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:8}}>Alternate Routes</div>
              <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>
                {result.alternateRoutes > 0
                  ? `${result.alternateRoutes} alternate routing option${result.alternateRoutes>1?'s':''} identified. Contact your 3PL to activate contingency lanes.`
                  : 'No viable alternate routes at this capacity reduction. Pre-position buffer stock immediately.'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Intelligence view (shared) ────────────────────────────────────────────────
function IntelligenceView() {
  const [news,     setNews]     = useState([]);
  const [forecast, setForecast] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [subTab,   setSubTab]   = useState('news');

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

  const sevColor = s => s==='critical'?'#b42318':s==='high'?'#b36b00':s==='medium'?'#12171b':'#2f7d6b';
  const trendIcon = t => t==='rising'?'↑':t==='falling'?'↓':'→';
  const trendCol  = t => t==='rising'?'#b42318':t==='falling'?'#2f7d6b':'#65727a';

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'var(--bg)'}}>
      {/* Sub tabs */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',background:'var(--bg2)',flexShrink:0}}>
        {['news','forecast'].map(t=>(
          <div key={t} onClick={()=>setSubTab(t)}
            style={{flex:1,padding:'10px 4px',textAlign:'center',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'var(--mono)',
              color:subTab===t?'var(--blue)':'var(--text3)',
              borderBottom:subTab===t?'2px solid var(--blue)':'2px solid transparent',
              background:subTab===t?'var(--blue-glow)':'transparent',
            }}>{t==='news'?`News ${news.length>0?`(${news.length})`:''}`:' Forecast'}</div>
        ))}
      </div>

      {subTab==='news' && (
        <div style={{flex:1,overflow:'auto',padding:'12px 16px'}}>
          {loading && <div style={{padding:20,textAlign:'center',color:'var(--text3)',fontSize:13}}>Loading...</div>}
          {news.map((n,i)=>(
            <div key={n.id||i} onClick={()=>setExpanded(expanded===i?null:i)}
              style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'14px',marginBottom:10,borderLeft:`3px solid ${sevColor(n.impactSeverity)}`,cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text)',lineHeight:1.4,flex:1}}>{n.title}</div>
                <span style={{fontSize:10,fontWeight:700,color:sevColor(n.impactSeverity),padding:'2px 6px',background:`${sevColor(n.impactSeverity)}10`,border:`1px solid ${sevColor(n.impactSeverity)}25`,whiteSpace:'nowrap',flexShrink:0}}>
                  {(n.impactSeverity||'').toUpperCase()}
                </span>
              </div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
                {(n.affectedRegions||[]).map(r=>(
                  <span key={r} style={{fontSize:10,fontFamily:'var(--mono)',padding:'2px 6px',background:'rgba(18,23,27,0.07)',color:'var(--blue)',border:'1px solid rgba(18,23,27,0.15)'}}>{r}</span>
                ))}
                {(n.estimatedDelayDays||0)>0 && (
                  <span style={{fontSize:10,fontFamily:'var(--mono)',padding:'2px 6px',background:'rgba(179,107,0,0.07)',color:'var(--amber)',border:'1px solid rgba(179,107,0,0.2)'}}>+{n.estimatedDelayDays}d</span>
                )}
              </div>
              <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>{n.source} · {expanded===i?'▲ collapse':'▼ expand'}</div>
              {expanded===i && (
                <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                  {n.description && n.description!==n.title && <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.5,marginBottom:8}}>{n.description}</div>}
                  {n.recommendedAction && (
                    <div style={{padding:'8px 10px',background:'rgba(18,23,27,0.05)',border:'1px solid rgba(18,23,27,0.15)',marginBottom:8}}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',marginBottom:3}}>▶ Action</div>
                      <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.5}}>{n.recommendedAction}</div>
                    </div>
                  )}
                  {n.forecastImpact && <div style={{fontSize:11,color:'var(--text3)',fontStyle:'italic',lineHeight:1.5}}>{n.forecastImpact}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {subTab==='forecast' && forecast && (
        <div style={{flex:1,overflow:'auto',padding:'12px 16px'}}>
          <div style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'14px',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Overall Risk</span>
              <span style={{fontSize:11,fontWeight:700,color:sevColor(forecast.overallRiskLevel),padding:'3px 10px',background:`${sevColor(forecast.overallRiskLevel)}10`,border:`1px solid ${sevColor(forecast.overallRiskLevel)}25`}}>
                {(forecast.overallRiskLevel||'').toUpperCase()}
              </span>
            </div>
            <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.6}}>{forecast.summary}</div>
          </div>
          {(forecast.regions||[]).map(r=>(
            <div key={r.name} style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'12px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{r.name}</span>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:12,fontWeight:700,color:trendCol(r.trend)}}>{trendIcon(r.trend)}</span>
                  <span style={{fontSize:13,fontFamily:'var(--mono)',fontWeight:700,color:sevColor(r.riskScore>=80?'critical':r.riskScore>=50?'high':'low')}}>{r.riskScore}</span>
                </div>
              </div>
              <div style={{height:4,background:'var(--bg3)',overflow:'hidden',marginBottom:5}}>
                <div style={{height:'100%',width:`${r.riskScore}%`,background:sevColor(r.riskScore>=80?'critical':r.riskScore>=50?'high':'medium'),}}/>
              </div>
              <div style={{fontSize:11,color:'var(--text3)'}}>{r.keyThreat} · <span style={{fontFamily:'var(--mono)'}}>{r.timeframe}</span></div>
            </div>
          ))}
          {(forecast.recommendations||[]).length>0 && (
            <div style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'14px',marginTop:4}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:10}}>Recommendations</div>
              {forecast.recommendations.map((r,i)=>(
                <div key={i} style={{display:'flex',gap:8,marginBottom:8}}>
                  <div style={{width:18,height:18,borderRadius:'50%',background:'var(--blue-glow)',border:'1px solid rgba(18,23,27,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:10,fontFamily:'var(--mono)',color:'var(--blue)',fontWeight:700}}>{i+1}</div>
                  <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.5}}>{r}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOBILE LAYOUT
// ══════════════════════════════════════════════════════════════════════════════
function MobileApp({ stats, suppliers, alerts, feed, sources, timeline, onAcknowledge }) {
  const [activeTab, setActiveTab] = useState('overview');

  const TABS = [
    { id:'overview',  label:'Overview'  },
    { id:'map',        label:'Map'       },
    { id:'scenarios', label:'Scenarios' },
    { id:'intel',     label:'Intel'     },
  ];

  const sevColor = s => s==='critical'?'var(--red)':s==='high'?'var(--amber)':'var(--text3)';

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'var(--bg)'}}>

      {/* Mobile header */}
      <div style={{background:'var(--bg2)',borderBottom:'1px solid var(--border)',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,background:'var(--blue)',display:'grid',placeItems:'center',flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#fff" strokeWidth="1.5" fill="none"/>
              <circle cx="9" cy="9" r="1.5" fill="#fff"/>
            </svg>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:'var(--text)',}}>NEXUS<span style={{color:'var(--blue)'}}>IQ</span></div>
            <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)',}}>SUPPLY CHAIN INTEL</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:5,fontFamily:'var(--mono)',fontSize:10,color:'var(--green)',background:'var(--green-glow)',border:'1px solid rgba(47,125,107,0.2)',padding:'3px 8px',}}>
            <div style={{width:4,height:4,borderRadius:'50%',background:'var(--green)',animation:'blink 1.4s infinite'}}/>
            {(stats.signalCount||0).toLocaleString()}
          </div>
          {alerts.length>0 && (
            <div style={{width:20,height:20,borderRadius:'50%',background:'var(--red)',display:'grid',placeItems:'center',fontSize:10,fontWeight:700,color:'#fff'}}>
              {alerts.length>9?'9+':alerts.length}
            </div>
          )}
        </div>
      </div>

      {/* Ticker */}
      <div style={{height:20,background:'var(--bg3)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',overflow:'hidden',flexShrink:0}}>
        <div style={{padding:'0 8px',fontSize:10,fontWeight:700,color:'var(--blue)',whiteSpace:'nowrap',borderRight:'1px solid var(--border)',fontFamily:'var(--mono)',flexShrink:0}}>LIVE</div>
        <div style={{overflow:'hidden',flex:1,padding:'0 8px'}}>
          <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text2)',whiteSpace:'nowrap',animation:'scrollTicker 60s linear infinite',display:'inline-block'}}>
            {[
              '● CRITICAL: Typhoon Gaemi Cat-3 landfall probability 87% — Port Kaohsiung Aug 3',
              '● HIGH: Red Sea — 94% Asia-EU tonnage now Cape routing, spot rates +340%',
              '● HIGH: Port Shanghai average wait time 4.2 days — 23 vessels at anchor',
              '● CRITICAL: UAW-Magna negotiations stalled — strike probability 61%',
            ].join('    ')}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>

        {/* OVERVIEW TAB */}
        {activeTab==='overview' && (
          <div style={{flex:1,overflow:'auto'}}>
            {/* KPI cards */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,padding:'12px 16px 0'}}>
              {[
                { label:'Active Alerts',    value:stats.openAlerts,       sub:`${stats.criticalAlerts||0} critical`, color:'var(--red)'   },
                { label:'Suppliers at Risk',value:stats.suppliersAtRisk,  sub:'↑ 6 vs yesterday',                   color:'var(--amber)' },
                { label:'Revenue Exposed',  value:`$${stats.revenueExposed}M`, sub:'weekly throughput',             color:'var(--text)'  },
                { label:'Signals Today',    value:(stats.signalCount||0).toLocaleString(), sub:'400+ sources',      color:'var(--blue)'  },
              ].map(s=>(
                <div key={s.label} style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'12px',}}>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:4,fontWeight:600}}>{s.label}</div>
                  <div style={{fontSize:20,fontWeight:800,fontFamily:'var(--mono)',color:s.color,lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:3}}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            <div style={{padding:'12px 16px 0'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:8}}>
                Alert Center <span style={{color:'var(--red)',fontFamily:'var(--mono)'}}>{alerts.length} open</span>
              </div>
              {alerts.length===0 && (
                <div style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'16px',textAlign:'center',color:'var(--text3)',fontSize:12}}>All alerts acknowledged ✓</div>
              )}
              {alerts.map(a=>(
                <div key={a.id} style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'12px 14px',marginBottom:8,borderLeft:`3px solid ${sevColor(a.priority)}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:10,fontWeight:700,color:sevColor(a.priority),fontFamily:'var(--mono)',}}>{(a.priority||'').toUpperCase()}</span>
                    <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)'}}>{a.type} · {a.impact}</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text)',lineHeight:1.3,marginBottom:4}}>{a.title}</div>
                  <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.4,marginBottom:8}}>{a.detail}</div>
                  <div style={{padding:'6px 10px',background:'rgba(18,23,27,0.05)',border:'1px solid rgba(18,23,27,0.15)',marginBottom:8}}>
                    <div style={{fontSize:10,color:'var(--text2)',lineHeight:1.4}}>{a.action}</div>
                  </div>
                  <button onClick={()=>onAcknowledge(a.id)}
                    style={{fontSize:10,fontFamily:'var(--mono)',fontWeight:600,color:'var(--blue)',background:'var(--blue-glow)',border:'1px solid rgba(18,23,27,0.2)',padding:'4px 10px',cursor:'pointer'}}>
                    ✓ Acknowledge
                  </button>
                </div>
              ))}
            </div>

            {/* Network exposure */}
            <div style={{padding:'12px 16px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:8}}>Network Exposure</div>
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'12px'}}>
                {[...suppliers].sort((a,b)=>b.risk-a.risk).slice(0,10).map(s=>{
                  const col=s.risk>=80?'#b42318':s.risk>=50?'#b36b00':'#2f7d6b';
                  return (
                    <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <div style={{fontSize:10,width:110,flexShrink:0,color:'var(--text2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'var(--mono)'}} title={s.name}>
                        {s.name.split(' ').slice(0,2).join(' ')}
                      </div>
                      <div style={{flex:1,height:8,background:'var(--bg3)',overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${s.risk}%`,background:col,}}/>
                      </div>
                      <div style={{fontSize:10,fontFamily:'var(--mono)',width:24,textAlign:'right',color:col,fontWeight:700}}>{s.risk}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signals feed */}
            <div style={{padding:'0 16px 80px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text2)',marginBottom:8}}>Live Signals</div>
              {(feed||[]).slice(0,8).map((f,i)=>(
                <div key={f.id||i} style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'10px 12px',marginBottom:6}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)',}}>{f.source}</span>
                    <span style={{fontSize:10,fontFamily:'var(--mono)',fontWeight:600,color:f.conf>=85?'var(--red-l)':f.conf>=70?'var(--amber-l)':'var(--text2)'}}>CONF {f.conf}%</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--text)',lineHeight:1.4}}>{f.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAP TAB */}
        {activeTab==='map' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
            <MapArea suppliers={mapSuppliers(suppliers)}/>
          </div>
        )}

        {/* SCENARIOS TAB */}
        {activeTab==='scenarios' && (
          <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
            <ScenariosView/>
          </div>
        )}

        {/* INTELLIGENCE TAB */}
        {activeTab==='intel' && (
          <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
            <IntelligenceView/>
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div style={{display:'flex',background:'var(--bg2)',borderTop:'1px solid var(--border)',flexShrink:0,paddingBottom:'env(safe-area-inset-bottom)',}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'8px 4px',cursor:'pointer',transition:'.15s',
              color:activeTab===t.id?'var(--blue)':'var(--text3)',
              background:activeTab===t.id?'var(--blue-glow)':'transparent',
              borderTop:activeTab===t.id?'2px solid var(--blue)':'2px solid transparent',
            }}>
            <span style={{fontSize:10,fontWeight:600,fontFamily:'var(--mono)',}}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP — detects mobile/desktop and renders correct layout
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const isMobile = useIsMobile();
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
        <div style={{marginBottom:8,opacity:.4,fontSize:10,}}>NEXUSIQ</div>
        <div>Initialising intelligence feeds...</div>
        <div style={{width:140,height:2,background:'var(--bg4)',overflow:'hidden',margin:'12px auto 0'}}>
          <div style={{height:'100%',background:'var(--blue)',animation:'loadBar 1.4s ease-in-out infinite',width:'40%'}}/>
        </div>
      </div>
    </div>
  );

  // ── MOBILE ─────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <MobileApp
        stats={stats}
        suppliers={suppliers}
        alerts={alerts}
        feed={feed}
        sources={sources}
        timeline={timeline}
        onAcknowledge={handleAck}
      />
    );
  }

  // ── DESKTOP (completely unchanged) ─────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <TopBar stats={stats} onTabChange={setActiveTab}/>
      <Ticker/>

      {activeTab===0 && (
        <div style={{flex:1,display:'grid',gridTemplateColumns:'260px 1fr 300px',overflow:'hidden',minHeight:0}}>
          <LeftPanel alerts={alerts} stats={stats} sources={sources} onAcknowledge={handleAck}/>
          <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <MapArea suppliers={mapSuppliers(suppliers)}/>
            <BottomPanels suppliers={suppliers}/>
          </div>
          <RightPanel feed={feed} timeline={timeline} sources={sources}/>
        </div>
      )}

      {activeTab===1 && (
        <div style={{flex:1,overflow:'hidden',minHeight:0,display:'flex',flexDirection:'column'}}>
          <div style={{padding:'10px 20px',background:'var(--bg2)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:16,flexShrink:0}}>
            <span style={{fontSize:11,fontWeight:700,color:'var(--text2)',}}>Network Map</span>
            <span style={{fontSize:11,color:'var(--text3)'}}>
              {suppliers.length} suppliers · {suppliers.filter(s=>s.risk>=80).length} critical · {suppliers.filter(s=>s.risk>=50&&s.risk<80).length} high risk
            </span>
          </div>
          <MapArea suppliers={mapSuppliers(suppliers)}/>
        </div>
      )}

      {activeTab===2 && (
        <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
          <ScenariosView/>
        </div>
      )}

      {activeTab===3 && (
        <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
          <IntelligenceView/>
        </div>
      )}
    </div>
  );
}
