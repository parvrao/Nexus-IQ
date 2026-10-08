import { SUPPLIERS, linked } from '../data.js';

const ORDER = [['critical','Critical'],['high','High'],['medium','Medium']];

export function Situation({ alerts, suppliers }) {
  const crit = alerts.filter(a=>a.priority==='critical').length;
  const hot  = suppliers.filter(s=>s.risk>=80);
  const exposed = hot.reduce((n,s)=>n+s.rev,0);
  const high = suppliers.filter(s=>s.risk>=50&&s.risk<80).length;
  const calm = suppliers.filter(s=>s.risk<50).length;
  return (
    <div className="sit">
      {alerts.length===0
        ? <p>No open alerts.</p>
        : <p>{crit>0 ? <em style={{display:'block'}}>{crit} critical {crit===1?'alert':'alerts'} open</em> : null}
            {hot.length>0 ? <>${exposed.toFixed(1)}M a week runs through {hot.length} {hot.length===1?'supplier':'suppliers'} scoring 80 or above.</> : 'No supplier scores 80 or above.'}</p>}
      <div className="sub">{alerts.length} open · {high} suppliers elevated · {calm} stable</div>
      <div className="tally" aria-hidden>
        {hot.length>0 && <i style={{flex:hot.length,'--c':'var(--crit)'}}/>}
        {high>0 && <i style={{flex:high,'--c':'var(--high)'}}/>}
        {calm>0 && <i style={{flex:calm,'--c':'var(--ok)'}}/>}
      </div>
    </div>
  );
}

export function AlertQueue({ alerts, focus, onFocus }) {
  if (!alerts.length) return <div className="empty"><b>Queue is clear</b>Every alert has been acknowledged. New ones appear here as signals cross threshold.</div>;
  return ORDER.map(([p,label])=>{
    const rows = alerts.filter(a=>a.priority===p);
    if (!rows.length) return null;
    return (
      <section key={p}>
        <div className="q-group"><span>{label}</span><span className="mono">{rows.length}</span></div>
        {rows.map(a=>(
          <button key={a.id} className={`q-item sev-${a.priority}`} aria-pressed={focus?.type==='alert'&&focus.id===a.id} onClick={()=>onFocus({type:'alert',id:a.id})}>
            <i className="bar"/>
            <div className="body">
              <div className="t">{a.title}</div>
              <div className="m"><span>{a.type}</span><span>{a.lane}</span><span>{a.impact}</span></div>
            </div>
          </button>
        ))}
      </section>
    );
  });
}
