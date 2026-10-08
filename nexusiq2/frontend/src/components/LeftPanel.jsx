import { useState } from 'react';

const PCOLOR = { critical:'var(--red)',  high:'var(--amber)',  medium:'var(--blue-l)' };
const PTEXT  = { critical:'var(--red-l)',high:'var(--amber-l)',medium:'var(--blue-ll)' };

function AlertItem({ alert, onAcknowledge }) {
  const [expanded, setExpanded] = useState(false);
  const [acked,    setAcked]    = useState(false);
  const handleAck = e => {
    e.stopPropagation();
    setAcked(true);
    setTimeout(()=>onAcknowledge(alert.id), 500);
  };
  return (
    <div onClick={()=>setExpanded(x=>!x)}
      style={{padding:'10px 16px',borderBottom:'1px solid rgba(18,23,27,0.07)',cursor:'pointer',transition:'.15s',borderLeft:`2px solid ${PCOLOR[alert.priority]}`,background:expanded?'rgba(18,23,27,0.04)':'transparent'}}>
      <div style={{fontSize:10,fontWeight:700,fontFamily:'var(--mono)',color:PTEXT[alert.priority]}}>{alert.priority.toUpperCase()}</div>
      <div style={{fontSize:11,fontWeight:600,color:'var(--text)',margin:'3px 0 2px',lineHeight:1.35}}>{alert.title}</div>
      <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',display:'flex',gap:8,flexWrap:'wrap'}}>
        <span>{alert.lane}</span><span>{alert.type}</span><span>{alert.impact}</span>
      </div>
      <div style={{fontSize:10,color:'var(--text2)',marginTop:4,lineHeight:1.4}}>{alert.detail}</div>
      {expanded && (
        <div style={{marginTop:6,padding:'8px 10px',background:'rgba(18,23,27,0.07)',border:'1px solid rgba(18,23,27,0.2)'}}>
          <div style={{fontSize:10,color:'var(--blue-ll)',fontWeight:600,marginBottom:3}}>▶ Recommended Action</div>
          <div style={{fontSize:10,color:'var(--text2)',lineHeight:1.5}}>{alert.action}</div>
          <div onClick={handleAck} style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:6,padding:'3px 10px',background:acked?'var(--green-glow)':'var(--blue-glow)',border:`1px solid ${acked?'rgba(47,125,107,.3)':'var(--border2)'}`,fontSize:10,fontWeight:600,color:acked?'var(--green-l)':'var(--blue-ll)',cursor:'pointer',fontFamily:'var(--mono)',transition:'.3s'}}>
            {acked ? '✓ Acknowledged' : '✓ Acknowledge'}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeftPanel({ alerts, stats, sources, onAcknowledge }) {
  return (
    <div style={{background:'var(--bg2)',borderRight:'1px solid var(--border)',overflow:'hidden',display:'flex',flexDirection:'column',animation:'fadeUp .4s ease .05s both'}}>
      {/* KPI header */}
      <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontSize:10,fontWeight:700,color:'var(--text2)'}}>Network Health</span>
        <span style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 6px',background:'var(--red-glow)',color:'var(--red-l)',border:'1px solid rgba(180,35,24,.3)'}}>↑ {stats.openAlerts} alerts</span>
      </div>
      {/* Stats grid */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:'var(--border)',flexShrink:0}}>
        {[
          { label:'Active Alerts',    value:stats.openAlerts,                         color:'var(--red-l)',   sub:`${stats.criticalAlerts} critical` },
          { label:'Suppliers at Risk',value:stats.suppliersAtRisk,                    color:'var(--amber)',   sub:'↑ 6 vs yesterday' },
          { label:'Revenue Exposed',  value:`$${stats.revenueExposed}M`,              color:'var(--text)',    sub:'weekly throughput', sm:true },
          { label:'Signals Today',    value:(stats.signalCount||0).toLocaleString(),  color:'var(--blue-ll)', sub:'400+ sources',      sm:true },
        ].map(s=>(
          <div key={s.label} style={{background:'var(--bg2)',padding:'12px 14px',cursor:'pointer',transition:'.15s'}}>
            <div style={{fontSize:10,fontWeight:600,color:'var(--text3)',marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:s.sm?17:22,fontWeight:800,lineHeight:1,color:s.color}}>{s.value}</div>
            <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)',marginTop:3}}>{s.sub}</div>
          </div>
        ))}
      </div>
      {/* Alerts */}
      <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontSize:10,fontWeight:700,color:'var(--red-l)'}}>Alert Center</span>
        <span style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 6px',background:'var(--red-glow)',color:'var(--red-l)',border:'1px solid rgba(180,35,24,.3)'}}>{alerts.length} open</span>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {alerts.length===0
          ? <div style={{padding:'20px 16px',fontSize:11,color:'var(--text3)',textAlign:'center'}}>All alerts acknowledged ✓</div>
          : alerts.map(a=><AlertItem key={a.id} alert={a} onAcknowledge={onAcknowledge}/>)
        }
      </div>
      {/* Signal status */}
      <div style={{padding:'7px 16px',background:'var(--bg3)',borderTop:'1px solid var(--border)',fontSize:10,fontWeight:700,color:'var(--text3)',flexShrink:0}}>Data Feeds</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:1,background:'var(--border)',flexShrink:0}}>
        {sources.slice(0,6).map(s=>(
          <div key={s.id} style={{background:'var(--bg2)',padding:'7px 10px',display:'flex',alignItems:'center',gap:7}}>
            <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,
              background:s.status==='ok'?'var(--green-l)':s.status==='warn'?'var(--amber)':'var(--red)',
              
              animation:s.status==='ok'?'sigPulse 3s infinite':''}}/>
            <div>
              <div style={{fontSize:10,fontWeight:600,color:'var(--text)'}}>{s.name}</div>
              <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)'}}>{s.status==='err'?'OFFLINE':`${(s.count||0).toLocaleString()} rec`} · {s.last===0?'live':`${Math.round((s.last||0)/60)}m ago`}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
