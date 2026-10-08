import { useEffect, useState } from 'react';
import { utc } from '../data.js';

export const SECTIONS = [
  { id:'watch',  label:'Watch',  k:'1' },
  { id:'model',  label:'Model',  k:'2' },
  { id:'intel',  label:'Intel',  k:'3' },
  { id:'feeds',  label:'Feeds',  k:'4' },
];

export function Rail({ section, onSection, open }) {
  return (
    <nav className="rail" aria-label="Sections">
      <div className="mark" title="NexusIQ">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-label="NexusIQ">
          <circle cx="11" cy="11" r="9.25" stroke="#12171b" strokeWidth="1.2"/>
          <path d="M11 1.5v19M1.5 11h19" stroke="#12171b" strokeWidth="1.2"/>
          <rect x="8" y="8" width="6" height="6" fill="#b42318"/>
        </svg>
      </div>
      <div className="nav">
        {SECTIONS.map(s => (
          <button key={s.id} aria-current={section===s.id?'page':undefined} onClick={()=>onSection(s.id)}>
            <span className="k">{s.k}</span><span className="l">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="rail-foot">{open} open</div>
    </nav>
  );
}

export function Strip({ stats, sources, apiDown, onPalette }) {
  const [now, setNow] = useState(utc());
  useEffect(()=>{ const id=setInterval(()=>setNow(utc()),1000); return ()=>clearInterval(id); },[]);
  const ok = sources.filter(s=>s.status==='ok').length;
  return (
    <header className="strip">
      <div className="case">
        <b>NexusIQ · Global supply watch</b>
        <span>{apiDown ? 'backend unreachable — retrying' : 'open-source signals · 15 supplier sites · 3 transport layers'}</span>
      </div>
      <div className="sp"/>
      <div className="readout hide-md"><i>signals today</i><span className="num">{(stats.signalCount||0).toLocaleString()}</span></div>
      <div className="feedhealth readout" title={sources.map(s=>`${s.name}: ${s.status}`).join('\n')}>
        <i>feeds</i>
        <span className="pips">{sources.map(s=><span key={s.id} className={s.status==='ok'?'':s.status}/>)}</span>
        <span className="num">{ok}/{sources.length||'—'}</span>
      </div>
      <div className="readout"><span className="num">{now}</span><i>UTC</i></div>
      <button className="cmd" onClick={onPalette}><span>Jump to supplier, alert or section</span><kbd>/</kbd></button>
    </header>
  );
}

export function Palette({ items, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = items.filter(it => (it.label+' '+(it.hint||'')).toLowerCase().includes(q.toLowerCase())).slice(0,40);
  useEffect(()=>setI(0),[q]);
  const key = e => {
    if (e.key==='Escape') onClose();
    else if (e.key==='ArrowDown'){ e.preventDefault(); setI(x=>Math.min(list.length-1,x+1)); }
    else if (e.key==='ArrowUp'){ e.preventDefault(); setI(x=>Math.max(0,x-1)); }
    else if (e.key==='Enter' && list[i]){ onPick(list[i]); onClose(); }
  };
  return (
    <div className="palette-bg" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="Jump to" onMouseDown={e=>e.stopPropagation()} onKeyDown={key}>
        <input autoFocus placeholder="Foxconn, typhoon, scenarios…" value={q} onChange={e=>setQ(e.target.value)} aria-label="Search"/>
        <ul role="listbox">
          {list.map((it,n)=>(
            <li key={it.key}><button role="option" aria-selected={n===i} onMouseEnter={()=>setI(n)} onClick={()=>{onPick(it);onClose();}}>
              <b style={{fontWeight:600}}>{it.label}</b><span>{it.hint}</span>
            </button></li>
          ))}
          {!list.length && <li className="none">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  );
}
