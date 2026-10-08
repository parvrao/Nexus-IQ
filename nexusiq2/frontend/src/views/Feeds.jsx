import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

const stateC = s => s==='ok'?'var(--ok)':s==='warn'?'var(--high)':'var(--crit)';
const stateT = s => s==='ok'?'reporting':s==='warn'?'delayed':'offline';
function lastSeen(sec){ if(!sec) return 'live'; if(sec<3600) return `${Math.round(sec/60)}m ago`; return `${Math.round(sec/3600)}h ago`; }

function Timeline({ data }) {
  const ref = useRef(null);
  useEffect(()=>{
    if(!ref.current||!data) return;
    const days=data.days||data.apac.length;
    const labels=Array.from({length:days},(_,i)=>{ const d=new Date(Date.now()-(days-1-i)*864e5); return `${d.getUTCMonth()+1}/${d.getUTCDate()}`; });
    const ln=(label,arr,color,w=1.4,dash)=>({label,data:arr,borderColor:color,borderWidth:w,borderDash:dash,pointRadius:0,tension:.25});
    const ch=new Chart(ref.current,{type:'line',data:{labels,datasets:[
      ln('Asia-Pacific',data.apac,'#12171b',2),ln('Middle East',data.me,'#b36b00'),ln('Europe',data.eu,'#2b6a8f'),ln('Americas',data.am,'#2f7d6b',1.4,[4,3])]},
      options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{position:'bottom',align:'start',labels:{color:'#46525a',boxWidth:10,boxHeight:2,font:{family:'Martian Mono',size:9.5},padding:14}},
          tooltip:{backgroundColor:'#f5f6f5',borderColor:'#b4bdc0',borderWidth:1,titleColor:'#12171b',bodyColor:'#46525a',titleFont:{family:'Martian Mono',size:10},bodyFont:{family:'Martian Mono',size:10},cornerRadius:0}},
        scales:{x:{grid:{display:false},border:{color:'#b4bdc0'},ticks:{color:'#65727a',font:{family:'Martian Mono',size:9},maxTicksLimit:8}},
                y:{min:0,max:100,grid:{color:'#d9dfe0'},border:{display:false},ticks:{color:'#65727a',font:{family:'Martian Mono',size:9},stepSize:25}}}}});
    return ()=>ch.destroy();
  },[data]);
  return <div style={{height:230}}><canvas ref={ref}/></div>;
}

export default function Feeds({ sources, timeline }) {
  const ok=sources.filter(s=>s.status==='ok').length;
  return (
    <div className="page"><div className="page-in">
      <h1>Feeds</h1>
      <p className="lede">Every collector behind the watch floor and whether it is reporting. A delayed or offline feed means the signals that depend on it are stale. {sources.length?`${ok} of ${sources.length} are reporting.`:''}</p>
      <div className="feeds">
        <div>
          {sources.map(s=>(
            <div key={s.id} className="srcrow" style={{'--c':stateC(s.status)}}>
              <i className="d"/><span style={{fontWeight:600}}>{s.name}</span>
              <span className="c">{s.status==='err'?stateT(s.status):`${(s.count||0).toLocaleString()} records`}</span>
              <span className="a">{s.status==='err'?'seen '+lastSeen(s.last):lastSeen(s.last)}</span>
            </div>
          ))}
          {!sources.length && <div className="empty"><b>No feed status yet</b>The backend has not reported any collectors.</div>}
        </div>
        <div className="chartbox">
          <h4>Regional risk, last {timeline?.days||45} days</h4>
          <p>Composite score 0–100 per region.</p>
          {timeline ? <Timeline data={timeline}/> : <div className="empty" style={{padding:0}}>Loading…</div>}
        </div>
      </div>
    </div></div>
  );
}
