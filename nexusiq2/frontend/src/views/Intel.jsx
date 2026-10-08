import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || 'https://nexus-iq-dxza.onrender.com';
const sevC = s => s==='critical'?'var(--crit)':s==='high'?'var(--high)':s==='medium'?'var(--elev)':'var(--ok)';
const riskC = n => n>=80?'var(--crit)':n>=50?'var(--high)':'var(--ok)';
const arrow = t => t==='rising'?'rising':t==='falling'?'falling':'flat';

export default function Intel() {
  const [tab, setTab] = useState('news');
  const [news, setNews] = useState(null);
  const [fc, setFc] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(()=>{
    const get = p => fetch(`${BASE}${p}`).then(r=>r.json());
    get('/api/news').then(n=>setNews(Array.isArray(n)?n:[])).catch(()=>setNews([]));
    get('/api/forecast').then(setFc).catch(()=>setFc(false));
    const id=setInterval(()=>get('/api/news').then(n=>Array.isArray(n)&&setNews(n)).catch(()=>{}),15*60*1000);
    return ()=>clearInterval(id);
  },[]);
  return (
    <div className="page"><div className="page-in">
      <h1>Intelligence</h1>
      <p className="lede">Disruption reporting from open news sources, scored for supply-chain impact, plus a model forecast by region.</p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab==='news'} onClick={()=>setTab('news')}>News{news?` (${news.length})`:''}</button>
        <button role="tab" aria-selected={tab==='fc'} onClick={()=>setTab('fc')}>Regional forecast</button>
      </div>

      {tab==='news' && <div>
        {news===null && <div className="empty">Loading reports…</div>}
        {news && !news.length && <div className="empty"><b>No reports yet</b>The news collector has not returned anything. It refreshes every 15 minutes.</div>}
        {(news||[]).map((n,i)=>(
          <button key={n.id||i} className="brief" style={{'--c':sevC(n.impactSeverity)}} onClick={()=>setOpen(open===i?null:i)} aria-expanded={open===i}>
            <i className="bar"/>
            <div className="in">
              <div className="row"><h3>{n.title}</h3><span className="sev">{n.impactSeverity}{(n.estimatedDelayDays||0)>0?` · +${n.estimatedDelayDays}d`:''}</span></div>
              <div className="tags">{(n.affectedRegions||[]).map(r=><span key={r} className="tag">{r}</span>)}</div>
              <div className="src">{n.source}</div>
              {open===i && <div className="more">
                {n.description&&n.description!==n.title&&<p>{n.description}</p>}
                {n.recommendedAction&&<div className="actionbox"><b>Recommended action</b>{n.recommendedAction}</div>}
                {n.forecastImpact&&<p>{n.forecastImpact}</p>}
              </div>}
            </div>
          </button>
        ))}
      </div>}

      {tab==='fc' && <div>
        {fc===null && <div className="empty">Loading forecast…</div>}
        {fc===false && <div className="empty"><b>Forecast unavailable</b>The forecast endpoint did not respond.</div>}
        {fc && <>
          <p className="verdictline" style={{'--c':sevC(fc.overallRiskLevel),marginTop:24,maxWidth:'46ch'}}><span className="c" style={{textTransform:'capitalize'}}>{fc.overallRiskLevel}</span> overall risk. {fc.summary}</p>
          <div className="regions">
            {(fc.regions||[]).map(r=>(
              <div key={r.name} className="region" style={{'--c':riskC(r.riskScore),'--w':`${r.riskScore}%`}}>
                <div className="n">{r.name}<div className="kt">{r.keyThreat}</div></div>
                <div className="bar"><i/></div>
                <div className="s">{r.riskScore}</div>
                <div className="tf">{arrow(r.trend)} · {r.timeframe}</div>
              </div>
            ))}
          </div>
          {(fc.recommendations||[]).length>0 && <>
            <h2 style={{fontSize:13,margin:'28px 0 6px'}}>What to do</h2>
            <ul style={{listStyle:'none',maxWidth:'70ch'}}>{fc.recommendations.map((x,i)=><li key={i} style={{padding:'9px 0',borderBottom:'1px solid var(--line)',color:'var(--ink2)',lineHeight:1.55}}>{x}</li>)}</ul>
          </>}
        </>}
      </div>}
    </div></div>
  );
}
