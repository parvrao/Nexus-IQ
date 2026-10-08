import { useEffect, useRef } from 'react';
import { ago } from '../data.js';

export default function SignalLog({ feed, onPick, focusedIds }) {
  const seen = useRef(new Set());
  const first = useRef(true);
  useEffect(()=>{ feed.forEach(f=>seen.current.add(f.id)); first.current=false; },[feed]);
  return (
    <section className="log" aria-label="Signal log">
      <div className="log-head"><span>Age</span><span>Source</span><span>Signal</span><span style={{textAlign:'right'}}>Confidence</span></div>
      <div className="scroll">
        {feed.map((f,i)=>(
          <button key={f.id||i} className={`log-row${!first.current&&!seen.current.has(f.id)?' fresh':''}`} aria-pressed={focusedIds?.has(f.id)} onClick={()=>onPick(f)}>
            <span className="ts">{ago(f.ts)}</span>
            <span className="src">{f.source}</span>
            <span className="tx">{f.text}</span>
            <span className="conf"><span>{f.conf}%</span><i style={{'--w':`${f.conf}%`}}/></span>
          </button>
        ))}
        {!feed.length && <div className="empty"><b>Waiting for signals</b>Items appear as collectors report in.</div>}
      </div>
    </section>
  );
}
