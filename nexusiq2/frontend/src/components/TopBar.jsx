import { useState, useEffect } from 'react';

// Only show tabs that actually do something
const NAV = [
  { label:'Risk Overview',  idx:0 },
  { label:'Network Map',    idx:1 },
  { label:'Scenarios',      idx:2 },
  { label:'Intelligence',   idx:3 },
];

export default function TopBar({ stats, onTabChange }) {
  const [active, setActive] = useState(0);
  const [clock,  setClock]  = useState('');

  useEffect(()=>{
    const tick=()=>{
      const e=new Date(new Date().toLocaleString('en-US',{timeZone:'America/New_York'}));
      setClock(`${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}:${String(e.getSeconds()).padStart(2,'0')} EST`);
    };
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);

  const handleNav = i => {
    setActive(i);
    if (onTabChange) onTabChange(i);
  };

  return (
    <div style={{height:52,background:'var(--bg2)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',padding:'0 20px',flexShrink:0,zIndex:200,}}>

      {/* Logo */}
      <div style={{display:'flex',alignItems:'center',gap:10,minWidth:220}}>
        <div style={{width:32,height:32,background:'var(--blue)',display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#fff" strokeWidth="1.5" fill="none"/>
            <path d="M9 5L13 7.5V12.5L9 15L5 12.5V7.5L9 5Z" fill="rgba(255,255,255,0.3)"/>
            <circle cx="9" cy="9" r="1.5" fill="#fff"/>
          </svg>
        </div>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:'var(--text)'}}>
            NEXUS<span style={{color:'var(--blue)'}}>IQ</span>
          </div>
          <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)',marginTop:1}}>
            Supply Chain Intelligence
          </div>
        </div>
      </div>

      {/* Nav — only functional tabs */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:2}}>
        {NAV.map(n=>(
          <div key={n.idx} onClick={()=>handleNav(n.idx)}
            style={{padding:'6px 16px',fontSize:12,fontWeight:600,cursor:'pointer',transition:'.15s',
              color:active===n.idx?'var(--blue)':'var(--text2)',
              background:active===n.idx?'var(--blue-glow)':'transparent',
              border:active===n.idx?'1px solid rgba(18,23,27,0.2)':'1px solid transparent',
            }}
            onMouseEnter={e=>{ if(active!==n.idx) e.currentTarget.style.background='var(--bg3)'; }}
            onMouseLeave={e=>{ if(active!==n.idx) e.currentTarget.style.background='transparent'; }}
          >{n.label}</div>
        ))}
      </div>

      {/* Right */}
      <div style={{display:'flex',alignItems:'center',gap:14,minWidth:220,justifyContent:'flex-end'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,fontFamily:'var(--mono)',fontSize:10,fontWeight:500,
          color:'var(--green)',background:'var(--green-glow)',border:'1px solid rgba(47,125,107,0.2)',padding:'4px 10px',}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:'var(--green)',animation:'blink 1.4s infinite'}}/>
          LIVE — {(stats.signalCount||0).toLocaleString()} signals
        </div>
        <div style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)'}}>{clock}</div>
        <div style={{position:'relative',cursor:'pointer',color:'var(--text2)',display:'flex',alignItems:'center'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {stats.openAlerts>0 && (
            <div style={{position:'absolute',top:-2,right:-2,width:14,height:14,borderRadius:'50%',background:'var(--red)',fontSize:10,fontWeight:700,display:'grid',placeItems:'center',color:'#fff',border:'2px solid var(--bg2)'}}>
              {stats.openAlerts>9?'9+':stats.openAlerts}
            </div>
          )}
        </div>
        <div style={{width:30,height:30,borderRadius:'50%',background:'var(--text)',display:'grid',placeItems:'center',fontSize:11,fontWeight:700,color:'#fff',cursor:'pointer'}}>
          JC
        </div>
      </div>
    </div>
  );
}
