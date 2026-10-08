import { useState, useEffect } from 'react';
import { api } from '../api.js';

const PORTS = [
  { code:'POLAX', label:'Port of Los Angeles — POLAX' },
  { code:'CNSHA', label:'Port of Shanghai — CNSHA'    },
  { code:'NLRTM', label:'Port of Rotterdam — NLRTM'   },
  { code:'SUEZ',  label:'Suez Canal — Transit Corridor'},
  { code:'TWKHH', label:'Port of Kaohsiung — TWKHH'   },
  { code:'SGSIN', label:'Port of Singapore — SGSIN'   },
];

function riskColor(r){ return r>=80?'#b42318':r>=50?'#b36b00':'#2f7d6b'; }

export default function BottomPanels({ suppliers }) {
  const [portCode,  setPortCode]  = useState('POLAX');
  const [capacity,  setCapacity]  = useState(40);
  const [scenario,  setScenario]  = useState(null);
  const [selected,  setSelected]  = useState(null);

  useEffect(()=>{
    api.scenario(portCode,capacity).then(setScenario).catch(()=>{});
  },[portCode,capacity]);

  const sorted=[...suppliers].sort((a,b)=>b.risk-a.risk).slice(0,15);

  const Hdr=({text,badge,col='var(--amber-l)',badgeBg='rgba(179,107,0,.1)',badgeBorder='rgba(179,107,0,.3)'})=>(
    <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
      <span style={{fontSize:10,fontWeight:700,color:col}}>{text}</span>
      <span style={{fontFamily:'var(--mono)',fontSize:10,padding:'2px 6px',background:badgeBg,color:col,border:`1px solid ${badgeBorder}`}}>{badge}</span>
    </div>
  );

  return (
    <div style={{height:230,display:'grid',gridTemplateColumns:'1fr 1fr',borderTop:'1px solid var(--border)',flexShrink:0}}>

      {/* Exposure */}
      <div style={{background:'var(--bg2)',display:'flex',flexDirection:'column',borderRight:'1px solid var(--border)',overflow:'hidden',animation:'fadeUp .4s ease .15s both'}}>
        <Hdr text="Network Exposure" badge="Top 15 by risk"/>
        <div style={{flex:1,overflowY:'auto'}}>
          {sorted.map(s=>{
            const col=riskColor(s.risk);
            return (
              <div key={s.id} onClick={()=>setSelected(selected===s.id?null:s.id)}
                style={{display:'flex',alignItems:'center',gap:6,padding:'3px 14px',cursor:'pointer',background:selected===s.id?'rgba(18,23,27,0.04)':'transparent',transition:'.15s'}}>
                <div style={{fontSize:10,width:110,flexShrink:0,color:'var(--text2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontFamily:'var(--mono)'}} title={s.name}>
                  {s.name.split(' ').slice(0,2).join(' ')}
                </div>
                <div style={{flex:1,height:10,background:'var(--bg3)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${s.risk}%`,background:col,opacity:.85,transition:'width .5s'}}/>
                </div>
                <div style={{fontFamily:'var(--mono)',fontSize:10,width:24,textAlign:'right',color:col}}>{s.risk}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scenario Modeler */}
      <div style={{background:'var(--bg2)',display:'flex',flexDirection:'column',overflow:'hidden',animation:'fadeUp .4s ease .2s both'}}>
        <Hdr text="Scenario Modeler" badge="ORS routing" col="var(--blue-ll)" badgeBg="var(--blue-glow)" badgeBorder="rgba(18,23,27,.3)"/>
        <div style={{padding:'12px 14px',flex:1,overflowY:'auto'}}>
          <select value={portCode} onChange={e=>setPortCode(e.target.value)}
            style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',padding:'6px 10px',color:'var(--text)',fontSize:11,fontFamily:'var(--sans)',cursor:'pointer',marginBottom:10,outline:'none'}}>
            {PORTS.map(p=><option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
          <div style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text2)',marginBottom:4}}>
              <span>Capacity reduction</span>
              <span style={{fontFamily:'var(--mono)',color:'var(--amber)'}}>{capacity}%</span>
            </div>
            <input type="range" min="0" max="100" value={capacity} onChange={e=>setCapacity(Number(e.target.value))}
              style={{width:'100%',WebkitAppearance:'none',height:3,background:`linear-gradient(to right,var(--blue) ${capacity}%,var(--bg4) ${capacity}%)`,cursor:'pointer',outline:'none',border:'none'}}/>
          </div>
          {scenario&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
              {[
                {label:'Revenue at Risk', value:`$${scenario.revenueAtRisk}M`, color:'var(--red-l)',   sub:'weekly exposure'},
                {label:'Lanes Affected',  value:scenario.lanesAffected,        color:'var(--amber-l)', sub:`of ${scenario.totalLanes} total`},
                {label:'Suppliers Hit',   value:scenario.suppliersHit,         color:'var(--amber-l)', sub:`of ${scenario.totalSuppliers}`},
                {label:'Recovery Time',   value:`${scenario.recoveryDays}d`,   color:scenario.recoveryDays>20?'var(--red-l)':'var(--amber-l)', sub:'est. normalization'},
              ].map(c=>(
                <div key={c.label} style={{background:'var(--bg3)',border:'1px solid var(--border)',padding:'8px 10px'}}>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>{c.label}</div>
                  <div style={{fontSize:16,fontWeight:700,fontFamily:'var(--mono)',color:c.color}}>{c.value}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginTop:1}}>{c.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
