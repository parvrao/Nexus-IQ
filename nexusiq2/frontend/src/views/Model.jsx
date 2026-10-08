import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { PORTS } from '../data.js';

export default function Model() {
  const [port, setPort] = useState('TWKHH');
  const [cap, setCap]   = useState(40);
  const [r, setR]       = useState(null);
  const [err, setErr]   = useState(false);
  useEffect(()=>{
    let live=true; const t=setTimeout(()=>{
      api.scenario(port,cap).then(x=>{ if(live){setR(x);setErr(false);} }).catch(()=>live&&setErr(true));
    },120);
    return ()=>{ live=false; clearTimeout(t); };
  },[port,cap]);
  const p = PORTS.find(x=>x.code===port);
  const sev = !r ? 'var(--ink)' : r.recoveryDays>20||r.revenueAtRisk>8 ? 'var(--crit)' : 'var(--high)';
  return (
    <div className="page"><div className="page-in">
      <h1>Disruption model</h1>
      <p className="lede">Pick a port or chokepoint and how much capacity it loses. The model returns revenue at risk, lanes and suppliers touched, and how long normal service takes to return.</p>
      <div className="model">
        <div className="ctl">
          <div className="f">
            <label htmlFor="port">Port or chokepoint</label>
            <select id="port" value={port} onChange={e=>setPort(e.target.value)}>
              {PORTS.map(x=><option key={x.code} value={x.code}>{x.label} ({x.note})</option>)}
            </select>
          </div>
          <div className="f">
            <div className="rv"><label htmlFor="cap" style={{margin:0}}>Capacity lost</label><output htmlFor="cap">{cap}%</output></div>
            <input id="cap" type="range" min="0" max="100" step="5" value={cap} style={{'--p':`${cap}%`}} onChange={e=>setCap(+e.target.value)}/>
            <div className="ticks"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
          </div>
        </div>
        <div style={{'--c':sev}}>
          {err && <div className="empty" style={{padding:0}}><b>Model unavailable</b>The backend did not answer. Check that it is running, then move a control to retry.</div>}
          {r && !err && <>
            <p className="verdictline">Losing {cap}% of {p.label} puts <span className="c num">${r.revenueAtRisk}M</span> a week at risk and takes about <span className="c num">{r.recoveryDays} days</span> to normalise.</p>
            <dl className="bigfacts">
              <div style={{'--c':'var(--crit)'}}><dt>Revenue at risk</dt><dd>${r.revenueAtRisk}M<small>weekly exposure</small></dd></div>
              <div><dt>Lanes affected</dt><dd>{r.lanesAffected}<small>of {r.totalLanes}</small></dd></div>
              <div><dt>Suppliers hit</dt><dd>{r.suppliersHit}<small>of {r.totalSuppliers}</small></dd></div>
              <div style={{'--c':r.recoveryDays>20?'var(--crit)':'var(--high)'}}><dt>Recovery</dt><dd>{r.recoveryDays}d<small>to normal service</small></dd></div>
            </dl>
            <p className="note-line">{r.alternateRoutes>0
              ? `${r.alternateRoutes} alternate routing option${r.alternateRoutes>1?'s':''} identified. Ask your freight forwarder to activate contingency lanes before the disruption lands.`
              : 'No viable alternate route exists at this level of capacity loss. Pre-position buffer stock now.'}</p>
          </>}
          {!r && !err && <div className="empty" style={{padding:0}}>Running model…</div>}
        </div>
      </div>
    </div></div>
  );
}
