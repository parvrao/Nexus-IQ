import { useEffect, useRef, useState, useCallback } from 'react';
import { select, zoom, zoomIdentity, zoomTransform, geoNaturalEarth1, geoPath, geoGraticule } from 'd3';
import { feature, mesh } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { useLiveTracking } from '../useLiveTracking.js';
import { sevVar, sevName, dms, keysOf } from '../data.js';

const COL = { vessel:'#2b6a8f', tanker:'#b36b00', aircraft:'#12171b', ground:'#2f7d6b' };

function filterVessels(vessels){
  return vessels.filter(v =>
    (v.lng>100&&v.lng<145&&v.lat>0&&v.lat<45)||(v.lng>-10&&v.lng<40&&v.lat>30&&v.lat<65)||
    (v.lng>25&&v.lng<45&&v.lat>10&&v.lat<35)||(v.lng>50&&v.lng<100&&v.lat>-10&&v.lat<30)||
    (v.lng>-90&&v.lng<-60&&v.lat>20&&v.lat<50)||(v.lng>140||v.lng<-110)||
    (v.lng>-10&&v.lng<20&&v.lat>-35&&v.lat<10)
  ).slice(0,300);
}

export default function MapArea({ suppliers, selectedId, onSelect }){
  const wrapRef = useRef(null);
  const svgRef  = useRef(null);
  const mapRef  = useRef(null);       // { proj, root, layers..., k }
  const cursorRef = useRef(null);
  const zoomRef = useRef(null);
  const selRef  = useRef(onSelect);
  selRef.current = onSelect;
  const [ver, setVer]         = useState(0);
  const [tip, setTip]         = useState(null);
  const [layers, setLayers]   = useState({ suppliers:true, vessels:true, aircraft:true, ground:true });
  const [size, setSize]       = useState({ w:0, h:0 });
  const { vessels, aircraft, ground, summary } = useLiveTracking();

  // marker placement is counter-scaled so glyphs keep their pixel size while zooming
  const place = (g, k) => g.attr('transform', function(){
    const e=this.__d; return `translate(${e.x},${e.y}) rotate(${e.rot||0}) scale(${1/k})`;
  });

  /* ── base map ── */
  const build = useCallback(()=>{
    const wrap=wrapRef.current, el=svgRef.current; if(!wrap||!el) return;
    const W=wrap.clientWidth, H=wrap.clientHeight; if(W<10||H<10) return;
    const svg=select(el).attr('viewBox',`0 0 ${W} ${H}`); svg.selectAll('*').remove();

    const proj=geoNaturalEarth1().fitExtent([[18,34],[W-18,H-26]],{type:'Sphere'});
    const path=geoPath(proj);
    const root=svg.append('g');
    root.append('path').datum({type:'Sphere'}).attr('d',path).attr('fill','#d9e3e7').attr('stroke','#9fadb2').attr('stroke-width',.8);
    root.append('path').datum(geoGraticule().step([30,30])()).attr('d',path).attr('fill','none').attr('stroke','#c9d6db').attr('stroke-width',.6);
    root.append('g').selectAll('path').data(feature(world,world.objects.countries).features).join('path')
      .attr('d',path).attr('fill','#f3f3ee');
    root.append('path').datum(mesh(world,world.objects.countries,(a,b)=>a!==b)).attr('d',path)
      .attr('fill','none').attr('stroke','#c3ccc9').attr('stroke-width',.6).attr('stroke-linejoin','round');

    const gGround=root.append('g'), gVessel=root.append('g'), gAir=root.append('g'),
          gSup=root.append('g'), gSel=root.append('g').style('pointer-events','none');
    const m={ proj, path, root, gGround, gVessel, gAir, gSup, gSel, k:1, W, H };
    mapRef.current=m;

    const z=zoom().scaleExtent([1,7]).translateExtent([[-W*.1,-H*.1],[W*1.1,H*1.1]])
      .on('zoom',ev=>{
        m.k=ev.transform.k; root.attr('transform',ev.transform);
        root.selectAll('.mk').call(place,m.k);
        root.selectAll('.route').attr('stroke-width',1/m.k*1.2).attr('stroke-dasharray',`${3/m.k},${4/m.k}`);
      });
    zoomRef.current=z; svg.call(z).on('dblclick.zoom',null);

    svg.on('mousemove.c',ev=>{
      if(!cursorRef.current) return;
      const [px,py]=[ev.offsetX,ev.offsetY];
      const t=zoomTransform(el); const p=proj.invert([(px-t.x)/t.k,(py-t.y)/t.k]);
      cursorRef.current.textContent = p&&isFinite(p[0])&&Math.abs(p[1])<=90 ? dms(p[1],p[0]) : '—';
    }).on('mouseleave.c',()=>{ if(cursorRef.current) cursorRef.current.textContent='—'; });
    svg.on('click.bg',ev=>{ if(ev.target===el||ev.target.tagName==='path') selRef.current?.(null); });

    setSize({w:W,h:H}); setVer(v=>v+1);
  },[]);

  useEffect(()=>{
    build();
    let t; const ro=new ResizeObserver(()=>{ clearTimeout(t); t=setTimeout(build,180); });
    ro.observe(wrapRef.current);
    return ()=>{ ro.disconnect(); clearTimeout(t); };
  },[build]);

  /* ── suppliers ── */
  useEffect(()=>{
    const m=mapRef.current; if(!m) return;
    m.gSup.style('display',layers.suppliers?null:'none');
    m.gSup.selectAll('*').remove();
    [...suppliers].sort((a,b)=>a.lat-b.lat).forEach((s,li)=>{
      const pt=m.proj([s.lng,s.lat]); if(!pt) return;
      const col=sevVar(s.risk), r=3.2+s.rev*1.5;
      const g=m.gSup.append('g').attr('class','mk').style('cursor','pointer');
      g.node().__d={x:pt[0],y:pt[1]};
      if(s.risk>=80) g.append('circle').attr('r',r).attr('fill','none').attr('stroke',col).attr('stroke-width',1).attr('class','ping');
      g.append('circle').attr('r',r).attr('fill',col).attr('fill-opacity',.92).attr('stroke','#f5f6f5').attr('stroke-width',1.2);
      if(s.risk>=80||s.id===selectedId)
        g.append('text').attr('x',r+5).attr('y',li%2?12:-3).text(keysOf(s)[0]).attr('font-family','Martian Mono, monospace').attr('font-size',9)
          .attr('fill','#46525a').attr('paint-order','stroke').attr('stroke','#f3f3ee').attr('stroke-width',3).attr('pointer-events','none');
      g.on('mouseenter',ev=>{ const rc=wrapRef.current.getBoundingClientRect(); setTip({type:'supplier',d:s,x:ev.clientX-rc.left,y:ev.clientY-rc.top}); })
       .on('mousemove',ev=>{ const rc=wrapRef.current.getBoundingClientRect(); setTip(t=>t&&{...t,x:ev.clientX-rc.left,y:ev.clientY-rc.top}); })
       .on('mouseleave',()=>setTip(null))
       .on('click',ev=>{ ev.stopPropagation(); selRef.current?.(s.id); });
      place(g,m.k);
    });
  },[ver,suppliers,layers.suppliers,selectedId]);

  /* ── selection reticle ── */
  useEffect(()=>{
    const m=mapRef.current; if(!m) return;
    m.gSel.selectAll('*').remove();
    const s=suppliers.find(x=>x.id===selectedId); if(!s) return;
    const pt=m.proj([s.lng,s.lat]); if(!pt) return;
    const g=m.gSel.append('g').attr('class','mk'); g.node().__d={x:pt[0],y:pt[1]};
    const r=3.2+s.rev*1.5+6;
    g.append('circle').attr('r',r).attr('fill','none').attr('stroke','#12171b').attr('stroke-width',1);
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy])=>g.append('line').attr('x1',dx*(r-3)).attr('y1',dy*(r-3)).attr('x2',dx*(r+6)).attr('y2',dy*(r+6)).attr('stroke','#12171b').attr('stroke-width',1));
    place(g,m.k);
  },[ver,selectedId,suppliers]);

  /* ── vessels ── */
  useEffect(()=>{
    const m=mapRef.current; if(!m) return;
    m.gVessel.style('display',layers.vessels?null:'none');
    const rel=layers.vessels?filterVessels(vessels):[];
    const sel=m.gVessel.selectAll('g.v').data(rel,v=>v.mmsi);
    sel.exit().remove();
    const en=sel.enter().append('g').attr('class','v mk').style('cursor','crosshair');
    en.append('path').attr('d','M0,-5 L3,3.5 L0,1.5 L-3,3.5 Z');
    en.on('mouseenter',function(ev,v){ const rc=wrapRef.current.getBoundingClientRect(); setTip({type:'vessel',d:v,x:ev.clientX-rc.left,y:ev.clientY-rc.top}); })
      .on('mousemove',ev=>{ const rc=wrapRef.current.getBoundingClientRect(); setTip(t=>t&&{...t,x:ev.clientX-rc.left,y:ev.clientY-rc.top}); })
      .on('mouseleave',()=>setTip(null));
    en.merge(sel).each(function(v){
      const pt=m.proj([v.lng,v.lat]); if(!pt) return;
      this.__d={x:pt[0],y:pt[1],rot:v.heading||0};
      select(this).select('path').attr('fill',v.typeLabel==='Tanker'?COL.tanker:COL.vessel).attr('opacity',.9);
    }).call(place,m.k);
  },[ver,vessels,layers.vessels]);

  /* ── aircraft ── */
  useEffect(()=>{
    const m=mapRef.current; if(!m) return;
    m.gAir.style('display',layers.aircraft?null:'none');
    const rel=layers.aircraft?aircraft.filter(a=>a.lat&&a.lng):[];
    const sel=m.gAir.selectAll('g.a').data(rel,a=>a.icao24);
    sel.exit().remove();
    const en=sel.enter().append('g').attr('class','a mk').style('cursor','crosshair');
    en.append('path').attr('d','M0,-6 L1.6,-1 L6,1.5 L6,2.6 L1.4,1.4 L1,4.5 L2.6,5.6 L2.6,6.6 L0,6 L-2.6,6.6 L-2.6,5.6 L-1,4.5 L-1.4,1.4 L-6,2.6 L-6,1.5 L-1.6,-1 Z').attr('transform','scale(.8)');
    en.on('mouseenter',function(ev,a){ const rc=wrapRef.current.getBoundingClientRect(); setTip({type:'aircraft',d:a,x:ev.clientX-rc.left,y:ev.clientY-rc.top}); })
      .on('mousemove',ev=>{ const rc=wrapRef.current.getBoundingClientRect(); setTip(t=>t&&{...t,x:ev.clientX-rc.left,y:ev.clientY-rc.top}); })
      .on('mouseleave',()=>setTip(null));
    en.merge(sel).each(function(a){
      const pt=m.proj([a.lng,a.lat]); if(!pt) return;
      this.__d={x:pt[0],y:pt[1],rot:a.heading||0};
      select(this).select('path').attr('fill',COL.aircraft).attr('opacity',.85);
    }).call(place,m.k);
  },[ver,aircraft,layers.aircraft]);

  /* ── ground routes ── */
  useEffect(()=>{
    const m=mapRef.current; if(!m) return;
    m.gGround.style('display',layers.ground?null:'none');
    m.gGround.selectAll('*').remove();
    if(!layers.ground) return;
    ground.forEach(route=>{
      if(!route.waypoints||route.waypoints.length<2) return;
      m.gGround.append('path').datum({type:'LineString',coordinates:route.waypoints}).attr('d',m.path).attr('class','route')
        .attr('fill','none').attr('stroke',COL.ground).attr('stroke-opacity',.55).attr('stroke-width',1.2/m.k).attr('stroke-dasharray',`${3/m.k},${4/m.k}`);
      if(route.lat!=null&&route.lng!=null){
        const pt=m.proj([route.lng,route.lat]); if(!pt) return;
        const g=m.gGround.append('g').attr('class','mk').style('cursor','crosshair'); g.node().__d={x:pt[0],y:pt[1]};
        g.append('rect').attr('x',-3.5).attr('y',-3.5).attr('width',7).attr('height',7).attr('fill',COL.ground);
        g.on('mouseenter',ev=>{ const rc=wrapRef.current.getBoundingClientRect(); setTip({type:'ground',d:route,x:ev.clientX-rc.left,y:ev.clientY-rc.top}); })
         .on('mousemove',ev=>{ const rc=wrapRef.current.getBoundingClientRect(); setTip(t=>t&&{...t,x:ev.clientX-rc.left,y:ev.clientY-rc.top}); })
         .on('mouseleave',()=>setTip(null));
        place(g,m.k);
      }
    });
  },[ver,ground,layers.ground]);

  const resetView = ()=>{ if(svgRef.current&&zoomRef.current) select(svgRef.current).transition().duration(350).call(zoomRef.current.transform,zoomIdentity); };

  /* ── tooltip ── */
  const Tip=()=>{
    if(!tip) return null;
    const {type,d}=tip;
    const left=Math.min(tip.x+16,Math.max(8,size.w-270)), top=Math.max(8,Math.min(tip.y-10,size.h-190));
    const rows = type==='supplier' ? [['Site',d.loc],['Weekly revenue',`$${d.rev}M`],['Tier',`T${d.tier}`],['Signal',d.threat]]
      : type==='vessel'   ? [['Type',d.typeLabel||'—'],['Speed',`${(d.speed||0).toFixed(1)} kn`],['Heading',`${Math.round(d.heading||0)}°`],['Destination',d.destination||'—'],['Flag',d.flag||'—']]
      : type==='aircraft' ? [['Operator',d.airlineName||'—'],['Altitude',`${(d.altitude||0).toLocaleString()} ft`],['Speed',`${d.speed||0} kn`],['Heading',`${Math.round(d.heading||0)}°`]]
      : [['Distance',`${d.distanceKm} km`],['Duration',`${d.durationHrs} h`],['Trucks',d.truckCount||'—']];
    const title = type==='aircraft'?d.callsign:d.name;
    const head = type==='supplier' ? <span style={{color:sevVar(d.risk)}} className="num">{d.risk} · {sevName(d.risk)}</span>
      : <span className="mono" style={{color:'var(--ink3)',fontSize:10}}>{type}</span>;
    return (
      <div className="maptip" style={{left,top}}>
        <h4><span>{title}</span>{head}</h4>
        <dl>{rows.map(([k,v])=><div key={k} style={{display:'contents'}}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        {d.source&&<div className="note">source: {d.source==='simulated'?'simulated — no live key configured':d.source}</div>}
        {type==='supplier'&&<div className="note">click to open dossier</div>}
      </div>
    );
  };

  const L=({k,label,n,live,c})=>(
    <button aria-pressed={layers[k]} onClick={()=>setLayers(p=>({...p,[k]:!p[k]}))} style={{'--c':c}}>
      <i className="sw"/><span>{label}</span><span className="n">{n}{live===undefined?'':live?' live':' sim'}</span>
    </button>
  );

  return (
    <div className="mapwrap" ref={wrapRef}>
      <svg ref={svgRef} role="img" aria-label="World map of suppliers, vessels, aircraft and truck routes"/>
      <div className="hud tl">
        <div className="layers">
          <L k="suppliers" label="Supplier sites" n={suppliers.length} c="var(--crit)"/>
          <L k="vessels"   label="Vessels (AIS)"  n={Math.max(summary.vessels,vessels.length)}  live={summary.aisLive}     c={COL.vessel}/>
          <L k="aircraft"  label="Cargo aircraft" n={Math.max(summary.aircraft,aircraft.length)} live={summary.openskyLive} c={COL.aircraft}/>
          <L k="ground"    label="HGV routes"     n={Math.max(summary.groundRoutes,ground.length)} live={summary.orsLive}  c={COL.ground}/>
        </div>
      </div>
      <div className="hud bl"><span ref={cursorRef}>—</span><span>scroll to zoom · drag to pan</span></div>
      <div className="hud br" style={{pointerEvents:'auto'}}>
        <div className="legend">
          <span style={{'--c':'var(--crit)'}}><i/>critical 80+</span>
          <span style={{'--c':'var(--high)'}}><i/>high 50–79</span>
          <span style={{'--c':'var(--ok)'}}><i/>stable</span>
        </div>
        <span className="provenance">marker size = weekly revenue · <button onClick={resetView} style={{color:'var(--ink2)',textDecoration:'underline',font:'inherit'}}>reset view</button></span>
      </div>
      <Tip/>
      {!ver && <div className="maploading"><div>Rendering basemap<i/></div></div>}
    </div>
  );
}
