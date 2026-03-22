import { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

function fmtTs(ts){
  const d=Date.now()-ts;
  if(d<60000) return 'Just now';
  if(d<3600000) return `${Math.round(d/60000)}m ago`;
  return `${Math.round(d/3600000)}hr ago`;
}

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
  return <div style={{height:170,padding:'10px 14px',position:'relative'}}><canvas ref={ref}/></div>;
}

export default function RightPanel({ feed, timeline, sources }){
  return (
    <div style={{background:'var(--bg2)',borderLeft:'1px solid var(--border)',overflow:'hidden',display:'flex',flexDirection:'column',animation:'fadeUp .4s ease .1s both'}}>
      {/* Feed header */}
      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:'var(--blue-ll)'}}>Risk Intelligence Feed</span>
        <span style={{fontFamily:'var(--mono)',fontSize:9,padding:'2px 6px',borderRadius:3,background:'var(--blue-glow)',color:'var(--blue-ll)',border:'1px solid rgba(59,130,246,.3)'}}>Live</span>
      </div>
      {/* Feed items */}
      <div style={{flex:1,overflowY:'auto',minHeight:0}}>
        {(feed||[]).map((f,i)=><FeedItem key={f.id||i} item={f}/>)}
      </div>
      {/* Timeline */}
      <div style={{borderTop:'1px solid var(--border)',flexShrink:0}}>
        <div style={{padding:'7px 14px',fontSize:8,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:'var(--text3)'}}>45-Day Disruption Probability</div>
        <TimelineChart data={timeline}/>
      </div>
      {/* Source health */}
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
    </div>
  );
}
