import { useState } from 'react';
import { SUPPLIERS, sevOf, sevName, sevVar, linked, ago } from '../data.js';

function Gauge({ v }) {
  const on = Math.round(v/5);
  return (
    <div>
      <div className="gauge" role="img" aria-label={`Risk ${v} of 100`}>{Array.from({length:20},(_,i)=><i key={i} className={i<on?'on':''}/>)}</div>
      <div className="gauge-scale"><span>0</span><span>50 high</span><span>80 critical</span><span>100</span></div>
    </div>
  );
}

export function Ranking({ suppliers, onFocus }) {
  const rows=[...suppliers].sort((a,b)=>b.risk-a.risk);
  return (
    <>
      <div className="ph"><h2>Supplier exposure</h2><span className="meta">ranked by risk score</span></div>
      <div className="scroll">
        {rows.map((s,i)=>(
          <button key={s.id} className="rank" style={{'--c':sevVar(s.risk),'--w':`${s.risk}%`}} onClick={()=>onFocus({type:'supplier',id:s.id})}>
            <span className="i">{String(i+1).padStart(2,'0')}</span>
            <span className="n">{s.name}</span>
            <span className="b"><i/></span>
            <span className="v">{s.risk}</span>
          </button>
        ))}
        <div className="empty">Select a supplier here or on the map to open its dossier. Select an alert to see what it touches.</div>
      </div>
    </>
  );
}

function SupplierDossier({ s, alerts, feed, onFocus, onSignal }) {
  const la = linked(s, alerts, ['title','detail']);
  const lf = linked(s, feed, ['text','tags']);
  const c = sevVar(s.risk);
  return (
    <div className="dossier" style={{'--c':c}}>
      <div className="d-top">
        <div><h3>{s.name}</h3><div className="loc">{s.loc}</div></div>
        <div className="score">{s.risk}<small>{sevName(s.risk)}</small></div>
      </div>
      <Gauge v={s.risk}/>
      <dl className="facts">
        <div><dt>Weekly revenue</dt><dd>${s.rev}M</dd></div>
        <div><dt>Supplier tier</dt><dd>Tier {s.tier}</dd></div>
        <div className="wide"><dt>Driving signal</dt><dd>{s.threat}</dd></div>
        <div className="wide"><dt>Coordinates</dt><dd className="mono" style={{fontFamily:'var(--mono)',fontSize:12}}>{s.lat.toFixed(2)}, {s.lng.toFixed(2)}</dd></div>
      </dl>
      <div className="sec">
        <h4>Open alerts <span>{la.length}</span></h4>
        {la.map(a=>(
          <button key={a.id} className={`link sev-${a.priority}`} style={{display:'block',width:'100%',textAlign:'left'}} onClick={()=>onFocus({type:'alert',id:a.id})}>
            <div className="h"><span className="c">{a.priority}</span><span>{a.lane}</span></div>{a.title}
          </button>
        ))}
        {!la.length && <div className="link" style={{color:'var(--ink3)'}}>No open alert names this supplier.</div>}
      </div>
      <div className="sec">
        <h4>Linked signals <span>{lf.length}</span></h4>
        {lf.slice(0,4).map(f=>(
          <button key={f.id} className="link" style={{display:'block',width:'100%',textAlign:'left'}} onClick={()=>onSignal(f)}>
            <div className="h"><span>{f.source}</span><span>{f.conf}% · {ago(f.ts)}</span></div>
            {f.text.length>150?f.text.slice(0,150)+'…':f.text}
          </button>
        ))}
        {!lf.length && <div className="link" style={{color:'var(--ink3)'}}>No collected signal mentions this supplier yet.</div>}
      </div>
    </div>
  );
}

function AlertDossier({ a, suppliers, onFocus, onAck }) {
  const [busy,setBusy]=useState(false);
  const hit = suppliers.filter(s=>linked(s,[a],['title','detail']).length);
  const c = a.priority==='critical'?'var(--crit)':a.priority==='high'?'var(--high)':'var(--elev)';
  return (
    <div className="dossier" style={{'--c':c}}>
      <div className="d-top">
        <div><h3>{a.title}</h3><div className="loc">{a.lane}</div></div>
        <div className="score" style={{fontSize:13,fontFamily:'var(--sans)',fontWeight:700,textTransform:'capitalize'}}>{a.priority}<small>{a.type}</small></div>
      </div>
      <dl className="facts">
        <div><dt>Category</dt><dd>{a.type}</dd></div>
        <div><dt>Window</dt><dd>{a.impact}</dd></div>
      </dl>
      <p style={{lineHeight:1.55,color:'var(--ink2)',fontSize:12.5}}>{a.detail}</p>
      <div className="actionbox"><b>Recommended action</b>{a.action}</div>
      <button className="btn" disabled={busy} onClick={()=>{setBusy(true);onAck(a.id);}}>{busy?'Acknowledging…':'Acknowledge alert'}</button>
      <div className="sec">
        <h4>Suppliers named <span>{hit.length}</span></h4>
        {hit.map(s=>(
          <button key={s.id} className="rank" style={{'--c':sevVar(s.risk),'--w':`${s.risk}%`,padding:'9px 0',gridTemplateColumns:'minmax(0,1fr) 78px 30px'}} onClick={()=>onFocus({type:'supplier',id:s.id})}>
            <span className="n">{s.name}</span><span className="b"><i/></span><span className="v">{s.risk}</span>
          </button>
        ))}
        {!hit.length && <div className="link" style={{color:'var(--ink3)'}}>This alert is about a lane or region, not a specific supplier site.</div>}
      </div>
    </div>
  );
}

export default function Dossier({ focus, suppliers, alerts, feed, onFocus, onAck, onSignal, onClose }) {
  if (!focus) return <Ranking suppliers={suppliers} onFocus={onFocus}/>;
  const s = focus.type==='supplier' ? suppliers.find(x=>x.id===focus.id) : null;
  const a = focus.type==='alert' ? alerts.find(x=>x.id===focus.id) : null;
  if (!s && !a) return <Ranking suppliers={suppliers} onFocus={onFocus}/>;
  return (
    <>
      <div className="ph"><h2>{s?'Supplier dossier':'Alert detail'}</h2><button className="meta" onClick={onClose} style={{textDecoration:'underline'}}>close (esc)</button></div>
      <div className="scroll">
        {s ? <SupplierDossier s={s} alerts={alerts} feed={feed} onFocus={onFocus} onSignal={onSignal}/>
           : <AlertDossier a={a} suppliers={suppliers} onFocus={onFocus} onAck={onAck}/>}
      </div>
    </>
  );
}
