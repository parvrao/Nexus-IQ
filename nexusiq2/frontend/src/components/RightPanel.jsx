import { useEffect, useRef, useState } from 'react';
import { Chart } from 'chart.js/auto';
import { api } from '../api.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTs(ts){
  const d=Date.now()-ts;
  if(d<60000) return 'Just now';
  if(d<3600000) return `${Math.round(d/60000)}m ago`;
  if(d<86400000) return `${Math.round(d/3600000)}hr ago`;
  return `${Math.round(d/86400000)}d ago`;
}

function severityColor(s){
  if(s==='critical') return '#ef4444';
  if(s==='high')     return '#f59e0b';
  if(s==='medium')   return '#3b82f6';
  return '#10b981';
}

function trendIcon(t){
  if(t==='rising')  return '↑';
  if(t==='falling') return '↓';
  return '→';
}

function trendColor(t){
  if(t==='rising')  return '#ef4444';
  if(t==='falling') return '#10b981';
  return '#94a3b8';
}

// ── Existing signal feed item ─────────────────────────────────────────────────
function FeedItem({ item }){
  const conf=item.conf;
  const col=conf>=85?'var(--red-l)':conf>=70?'var(--amber-l)':'var(--text2)';
  return (
    <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(37,99,235,0.06)',cursor:'pointer',transition:'.15s',animation:'fadeUp .3s ease'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:8,fontFamily:'var(--mono)',fontWeight:500,letterSpacing:.5,color:'var(--text3)',textTransform:'uppercase'}}>{item.source}</span>
        <span style={{fontFamily:'var(--mono)',fontSize:9,fontWeight:600,color:col}}>CONF {conf}%</span>
      </div>
      <div style={{fontSize:10,color:'var(--text)',lineHeight:1.5,marginBottom:4}}>{item.text}</div>
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:3}}>
        {(item.tags||[]).map(t=>(
          <span key={t} style={{fontSize:8,fontFamily:'var(--mono)',padding:'1px 5px',borderRadius:2,background:'rgba(37,99,235,0.1)',color:'var(--blue-ll)',border:'1px solid rgba(37,99,235,0.2)'}}>{t}</span>
        ))}
      </div>
      <div style={{fontFamily:'var(--mono)',fontSize:8,color:'var(--text3)'}}>{fmtTs(item.ts)}</div>
    </div>
  );
}

// ── News intelligence item ────────────────────────────────────────────────────
function NewsItem({ item }){
  const [expanded, setExpanded] = useState(false);
  const col = severityColor(item.impactSeverity);
  return (
    <div onClick={()=>setExpanded(e=>!e)}
      style={{padding:'10px 14px',borderBottom:'1px solid rgba(37,99,235,0.06)',cursor:'pointer',transition:'.15s',borderLeft:`2px solid ${col}`,background:expanded?'rgba(255,255,255,0.02)':'transparent'}}>
      {/* Header row */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:8,fontFamily:'var(--mono)',color:'var(--text3)',textTransform:'uppercase',letterSpacing:.5}}>{item.source}</span>
        <span style={{fontSize:8,fontFamily:'var(--mono)',fontWeight:700,color:col,padding:'1px 5px',borderRadius:2,background:`${col}18`,border:`1px solid ${col}44`}}>
          {(item.impactSeverity||'').toUpperCase()}
        </span>
      </div>
      {/* Title */}
      <div style={{fontSize:10,fontWeight:600,color:'var(--text)',lineHeight:1.4,marginBottom:5}}>{item.title}</div>
      {/* Regions */}
      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:4}}>
        {(item.affectedRegions||[]).map(r=>(
          <span key={r} style={{fontSize:8,fontFamily:'var(--mono)',padding:'1px 5px',borderRadius:2,background:'rgba(37,99,235,0.1)',color:'var(--blue-ll)',border:'1px solid rgba(37,99,235,0.2)'}}>{r}</span>
        ))}
        {(item.estimatedDelayDays||0)>0 && (
          <span style={{fontSize:8,fontFamily:'var(--mono)',padding:'1px 5px',borderRadius:2,background:'rgba(245,158,11,0.12)',color:'var(--amber-l)',border:'1px solid rgba(245,158,11,0.25)'}}>+{item.estimatedDelayDays}d delay</span>
        )}
      </div>
      {/* Expanded detail */}
      {expanded && (
        <div style={{marginTop:6}}>
          {item.description && item.description !== item.title && (
            <div style={{fontSize:10,color:'var(--text2)',lineHeight:1.5,marginBottom:6}}>{item.description}</div>
          )}
          {(item.suppliersAtRisk||[]).length>0 && (
            <div style={{marginBottom:5}}>
              <span style={{fontSize:8,color:'var(--text3)',fontFamily:'var(--mono)'}}>SUPPLIERS AT RISK: </span>
              <span style={{fontSize:8,color:'var(--red-l)',fontFamily:'var(--mono)'}}>{item.suppliersAtRisk.join(', ')}</span>
            </div>
          )}
          {item.recommendedAction && (
            <div style={{padding:'6px 8px',background:'rgba(37,99,235,0.07)',borderRadius:3,border:'1px solid rgba(37,99,235,0.2)',marginBottom:4}}>
              <div style={{fontSize:8,color:'var(--blue-ll)',fontFamily:'var(--mono)',fontWeight:600,marginBottom:2}}>▶ ACTION</div>
              <div style={{fontSize:9,color:'var(--text2)',lineHeight:1.4}}>{item.recommendedAction}</div>
            </div>
          )}
          {item.forecastImpact && (
            <div style={{fontSize:9,color:'var(--text3)',fontStyle:'italic',lineHeight:1.4}}>{item.forecastImpact}</div>
          )}
          {item.url && item.url !== '#' && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              style={{display:'inline-block',marginTop:4,fontSize:8,color:'var(--blue-ll)',fontFamily:'var(--mono)',textDecoration:'none'}}>
              Read full article →
            </a>
          )}
        </div>
      )}
      <div style={{fontFamily:'var(--mono)',fontSize:8,color:'var(--text3)',marginTop:4}}>{fmtTs(item.ts)} · {item.source_type==='ai-analyzed'?'AI analyzed':item.source_type==='curated'?'Curated':'Keyword match'}</div>
    </div>
  );
}

// ── 30-Day Forecast panel ─────────────────────────────────────────────────────
function ForecastPanel({ forecast }){
  if(!forecast) return (
    <div style={{padding:'16px 14px',fontSize:10,color:'var(--text3)',textAlign:'center'}}>
      Loading forecast...
    </div>
  );

  const overallCol = severityColor(forecast.overallRiskLevel);

  return (
    <div style={{overflowY:'auto',flex:1}}>
      {/* Overall risk badge */}
      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <span style={{fontSize:9,fontFamily:'var(--mono)',color:'var(--text3)',letterSpacing:.5}}>OVERALL RISK</span>
          <span style={{fontSize:9,fontFamily:'var(--mono)',fontWeight:700,color:overallCol,padding:'2px 8px',borderRadius:3,background:`${overallCol}18`,border:`1px solid ${overallCol}44`}}>
            {(forecast.overallRiskLevel||'').toUpperCase()}
          </span>
        </div>
        {forecast.summary && (
          <div style={{fontSize:9,color:'var(--text2)',lineHeight:1.5}}>{forecast.summary}</div>
        )}
        {forecast.generatedAt && (
          <div style={{fontSize:8,color:'var(--text3)',fontFamily:'var(--mono)',marginTop:4}}>
            Updated {fmtTs(new Date(forecast.generatedAt).getTime())}
          </div>
        )}
      </div>

      {/* Regional risk scores */}
      {(forecast.regions||[]).length>0 && (
        <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)'}}>
          <div style={{fontSize:8,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text3)',marginBottom:6}}>REGIONAL RISK</div>
          {forecast.regions.map(r=>(
            <div key={r.name} style={{marginBottom:7}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:9,color:'var(--text)',fontWeight:600}}>{r.name}</span>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:9,fontFamily:'var(--mono)',fontWeight:700,color:trendColor(r.trend)}}>{trendIcon(r.trend)}</span>
                  <span style={{fontSize:10,fontFamily:'var(--mono)',fontWeight:700,color:severityColor(r.riskScore>=80?'critical':r.riskScore>=50?'high':'low')}}>{r.riskScore}</span>
                </div>
              </div>
              {/* Risk bar */}
              <div style={{height:3,background:'var(--bg3)',borderRadius:2,overflow:'hidden',marginBottom:3}}>
                <div style={{height:'100%',width:`${r.riskScore}%`,background:severityColor(r.riskScore>=80?'critical':r.riskScore>=50?'high':'medium'),borderRadius:2,transition:'width .5s'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:8,color:'var(--text3)'}}>{r.keyThreat}</span>
                <span style={{fontSize:8,fontFamily:'var(--mono)',color:'var(--text3)'}}>{r.timeframe}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top threats */}
      {(forecast.topThreats||[]).length>0 && (
        <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)'}}>
          <div style={{fontSize:8,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text3)',marginBottom:6}}>TOP THREATS</div>
          {forecast.topThreats.map((t,i)=>(
            <div key={i} style={{marginBottom:7,padding:'7px 9px',background:'var(--bg3)',borderRadius:4,border:`1px solid ${severityColor(t.impact)}22`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:8,fontFamily:'var(--mono)',fontWeight:700,color:severityColor(t.impact)}}>{(t.impact||'').toUpperCase()}</span>
                <span style={{fontSize:9,fontFamily:'var(--mono)',fontWeight:700,color:t.probability>=70?'var(--red-l)':t.probability>=40?'var(--amber-l)':'var(--text2)'}}>
                  {t.probability}% prob
                </span>
              </div>
              <div style={{fontSize:9,color:'var(--text)',lineHeight:1.4,marginBottom:4}}>{t.threat}</div>
              <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                {(t.affectedLanes||[]).map(l=>(
                  <span key={l} style={{fontSize:7,fontFamily:'var(--mono)',padding:'1px 4px',borderRadius:2,background:'rgba(37,99,235,0.1)',color:'var(--blue-ll)',border:'1px solid rgba(37,99,235,0.2)'}}>{l}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {(forecast.recommendations||[]).length>0 && (
        <div style={{padding:'8px 14px'}}>
          <div style={{fontSize:8,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text3)',marginBottom:6}}>RECOMMENDATIONS</div>
          {forecast.recommendations.map((r,i)=>(
            <div key={i} style={{display:'flex',gap:7,marginBottom:6}}>
              <div style={{width:14,height:14,borderRadius:'50%',background:'var(--blue-glow)',border:'1px solid rgba(37,99,235,0.3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:7,fontFamily:'var(--mono)',color:'var(--blue-ll)',marginTop:1}}>{i+1}</div>
              <div style={{fontSize:9,color:'var(--text2)',lineHeight:1.5}}>{r}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Timeline chart ────────────────────────────────────────────────────────────
function TimelineChart({ data }){
  const ref=useRef(null); const chartRef=useRef(null);
  useEffect(()=>{
    if(!data||!ref.current) return;
    chartRef.current?.destroy();
    const days=data.days||45;
    const labels=Array.from({length:days},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()+i);
      return i%7===0?`${d.getMonth()+1}/${d.getDate()}`:'';
    });
    chartRef.current=new Chart(ref.current,{
      type:'line',
      data:{ labels, datasets:[
        {label:'Asia-Pacific',data:data.apac,borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,0.06)',borderWidth:1.5,pointRadius:0,tension:.4,fill:true},
        {label:'Middle East', data:data.me,  borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.04)',borderWidth:1.5,pointRadius:0,tension:.4,fill:true},
        {label:'Europe',      data:data.eu,  borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.04)',borderWidth:1.5,pointRadius:0,tension:.4},
        {label:'Americas',    data:data.am,  borderColor:'#10b981',backgroundColor:'rgba(16,185,129,0.04)',borderWidth:1.5,pointRadius:0,tension:.4},
      ]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:true,position:'top',labels:{color:'rgba(148,163,184,0.8)',font:{size:9,family:'DM Mono'},boxWidth:12,padding:6}},
          tooltip:{backgroundColor:'rgba(9,18,38,0.95)',borderColor:'rgba(37,99,235,0.3)',borderWidth:1,titleFont:{family:'DM Mono',size:10},bodyFont:{family:'DM Mono',size:9}},
        },
        scales:{
          x:{ticks:{color:'rgba(71,85,105,0.8)',font:{size:8,family:'DM Mono'}},grid:{color:'rgba(37,99,235,0.06)'},border:{display:false}},
          y:{min:0,max:100,ticks:{color:'rgba(71,85,105,0.8)',font:{size:8,family:'DM Mono'},stepSize:25,callback:v=>v+'%'},grid:{color:'rgba(37,99,235,0.06)'},border:{display:false}},
        },
      }
    });
    return ()=>chartRef.current?.destroy();
  },[data]);
  return <div style={{height:160,padding:'8px 14px',position:'relative'}}><canvas ref={ref}/></div>;
}

// ── Main RightPanel ───────────────────────────────────────────────────────────
export default function RightPanel({ feed, timeline, sources }){
  const [activeTab, setActiveTab]   = useState('signals');
  const [news,      setNews]        = useState([]);
  const [forecast,  setForecast]    = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);

  // Load news and forecast on mount
  useEffect(()=>{
    Promise.all([
      fetch((import.meta.env.VITE_API_URL||'')+'/api/news').then(r=>r.json()),
      fetch((import.meta.env.VITE_API_URL||'')+'/api/forecast').then(r=>r.json()),
    ]).then(([n,f])=>{
      setNews(Array.isArray(n)?n:[]);
      setForecast(f);
      setNewsLoading(false);
    }).catch(()=>setNewsLoading(false));

    // Refresh news every 15 min
    const interval = setInterval(()=>{
    fetch((import.meta.env.VITE_API_URL||'https://nexus-iq-dxza.onrender.com')+'/api/news')
        .then(r=>r.json())
        .then(n=>setNews(Array.isArray(n)?n:[]))
        .catch(()=>{});
    }, 15*60*1000);

    return ()=>clearInterval(interval);
  },[]);

  const TABS = [
    { id:'signals',  label:'Signals',  count:(feed||[]).length },
    { id:'news',     label:'News',     count:news.length, alert:news.filter(n=>n.impactSeverity==='critical').length>0 },
    { id:'forecast', label:'Forecast', count:null },
  ];

  return (
    <div style={{background:'var(--bg2)',borderLeft:'1px solid var(--border)',overflow:'hidden',display:'flex',flexDirection:'column',animation:'fadeUp .4s ease .1s both'}}>

      {/* Tab bar */}
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        {TABS.map(t=>(
          <div key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{flex:1,padding:'9px 4px',textAlign:'center',cursor:'pointer',transition:'.15s',fontSize:9,fontWeight:700,letterSpacing:.8,textTransform:'uppercase',fontFamily:'var(--mono)',
              color:activeTab===t.id?'var(--blue-ll)':'var(--text3)',
              borderBottom:activeTab===t.id?'2px solid var(--blue-ll)':'2px solid transparent',
              background:activeTab===t.id?'rgba(37,99,235,0.05)':'transparent',
              position:'relative',
            }}>
            {t.label}
            {t.count!=null && t.count>0 && (
              <span style={{marginLeft:4,fontSize:8,fontFamily:'var(--mono)',padding:'0 4px',borderRadius:8,
                background:t.alert?'var(--red-glow)':activeTab===t.id?'var(--blue-glow)':'rgba(255,255,255,0.06)',
                color:t.alert?'var(--red-l)':activeTab===t.id?'var(--blue-ll)':'var(--text3)',
                border:t.alert?'1px solid rgba(239,68,68,0.3)':'none',
              }}>{t.count}</span>
            )}
            {t.alert && activeTab!==t.id && (
              <div style={{position:'absolute',top:6,right:6,width:5,height:5,borderRadius:'50%',background:'var(--red)',animation:'blink 1.4s infinite'}}/>
            )}
          </div>
        ))}
      </div>

      {/* ── SIGNALS TAB ────────────────────────────────────────────────────── */}
      {activeTab==='signals' && <>
        <div style={{flex:1,overflowY:'auto',minHeight:0}}>
          {(feed||[]).map((f,i)=><FeedItem key={f.id||i} item={f}/>)}
        </div>
        <div style={{borderTop:'1px solid var(--border)',flexShrink:0}}>
          <div style={{padding:'7px 14px',fontSize:8,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text3)'}}>45-Day Disruption Probability</div>
          <TimelineChart data={timeline}/>
        </div>
        <div style={{borderTop:'1px solid var(--border)',flexShrink:0}}>
          <div style={{padding:'7px 14px',fontSize:8,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text3)'}}>Data Source Health</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:'var(--border)'}}>
            {(sources||[]).slice(0,6).map(s=>(
              <div key={s.id} style={{background:'var(--bg2)',padding:'7px 10px',display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,
                  background:s.status==='ok'?'var(--green-l)':s.status==='warn'?'var(--amber)':'var(--red)',
                  boxShadow:`0 0 5px ${s.status==='ok'?'var(--green)':s.status==='warn'?'var(--amber)':'var(--red)'}`,
                  animation:s.status==='ok'?'sigPulse 3s infinite':''}}/>
                <div>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--text)'}}>{s.name}</div>
                  <div style={{fontSize:8,fontFamily:'var(--mono)',color:'var(--text3)'}}>
                    {s.status==='err'?'OFFLINE':`${(s.count||0).toLocaleString()} rec`} · {s.last===0?'live':`${Math.round((s.last||0)/60)}m ago`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* ── NEWS TAB ───────────────────────────────────────────────────────── */}
      {activeTab==='news' && <>
        <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:9,color:'var(--text2)'}}>
            {news.filter(n=>n.impactSeverity==='critical').length} critical &nbsp;·&nbsp;
            {news.filter(n=>n.impactSeverity==='high').length} high &nbsp;·&nbsp;
            {news.length} total
          </span>
          <span style={{fontSize:8,fontFamily:'var(--mono)',color:'var(--text3)'}}>Updates every 15m</span>
        </div>
        <div style={{flex:1,overflowY:'auto',minHeight:0}}>
          {newsLoading && (
            <div style={{padding:'20px 14px',fontSize:10,color:'var(--text3)',textAlign:'center'}}>Loading intelligence...</div>
          )}
          {!newsLoading && news.length===0 && (
            <div style={{padding:'20px 14px',fontSize:10,color:'var(--text3)',textAlign:'center'}}>No news articles loaded</div>
          )}
          {news.map((n,i)=><NewsItem key={n.id||i} item={n}/>)}
        </div>
      </>}

      {/* ── FORECAST TAB ───────────────────────────────────────────────────── */}
      {activeTab==='forecast' && <>
        <div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:9,color:'var(--text2)'}}>30-Day Disruption Forecast</span>
          <span style={{fontSize:8,fontFamily:'var(--mono)',color:'var(--text3)'}}>AI · Updates 6hr</span>
        </div>
        <ForecastPanel forecast={forecast}/>
      </>}

    </div>
  );
}
