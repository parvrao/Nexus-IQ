import { useEffect, useRef, useState, useCallback } from 'react';
import { useLiveTracking } from '../useLiveTracking.js';

const SUPPLIERS = [
  { id:'S01', name:'Foxconn Electronics',    loc:'Shenzhen, China',        lng:114.1, lat:22.5,  risk:92, threat:'Labor dispute — 14,000 workers',   rev:3.8, tier:1 },
  { id:'S02', name:'TSMC Fab 5',             loc:'Hsinchu, Taiwan',         lng:120.9, lat:24.8,  risk:88, threat:'Typhoon Gaemi — Cat 3 track',       rev:2.1, tier:1 },
  { id:'S03', name:'Samsung Semiconductor',  loc:'Hwaseong, S.Korea',       lng:127.0, lat:37.2,  risk:74, threat:'Export restriction escalating',     rev:1.9, tier:1 },
  { id:'S04', name:'LG Chem Battery',        loc:'Ochang, S.Korea',         lng:127.4, lat:36.6,  risk:68, threat:'Lithium price spike +34%',          rev:1.2, tier:2 },
  { id:'S05', name:'Yanlord Logistics',      loc:'Shanghai, China',         lng:121.4, lat:31.2,  risk:61, threat:'Port congestion 4.2d avg delay',    rev:0.9, tier:2 },
  { id:'S06', name:'Flextronics India',      loc:'Chennai, India',          lng:80.2,  lat:13.0,  risk:55, threat:'Monsoon flooding risk elevated',    rev:0.7, tier:2 },
  { id:'S07', name:"Magna Int'l",            loc:'Ontario, Canada',         lng:-80.5, lat:43.6,  risk:42, threat:'UAW contract expiry Dec 1',         rev:1.1, tier:1 },
  { id:'S08', name:'BASF SE',                loc:'Ludwigshafen, Germany',   lng:8.4,   lat:49.5,  risk:38, threat:'Energy cost +28% YoY',              rev:0.6, tier:2 },
  { id:'S09', name:'ABB Robotics',           loc:'Zürich, Switzerland',     lng:8.5,   lat:47.4,  risk:35, threat:'CHF currency volatility',           rev:0.4, tier:3 },
  { id:'S10', name:'Michelin Tire Mfg',      loc:'Clermont-Ferrand, France',lng:3.1,   lat:45.8,  risk:31, threat:'Port Marseille strike risk',        rev:0.5, tier:2 },
  { id:'S11', name:'Rio Tinto Minerals',     loc:'Perth, Australia',        lng:115.8, lat:-31.9, risk:29, threat:'Cyclone season elevated risk',      rev:0.8, tier:2 },
  { id:'S12', name:'Cemex Mexico',           loc:'Monterrey, Mexico',       lng:-100.3,lat:25.7,  risk:27, threat:'Water scarcity Q4 risk',            rev:0.3, tier:3 },
  { id:'S13', name:'Dow Chemical',           loc:'Freeport, TX',            lng:-95.4, lat:28.9,  risk:48, threat:'Hurricane Patricia modeling',       rev:0.9, tier:1 },
  { id:'S14', name:'ArcelorMittal',          loc:'Luxembourg',              lng:6.1,   lat:49.6,  risk:44, threat:'Steel tariff escalation risk',      rev:0.7, tier:2 },
  { id:'S15', name:'Reliance Industries',    loc:'Jamnagar, India',         lng:70.1,  lat:22.5,  risk:33, threat:'Red Sea diversion +12 days',       rev:0.4, tier:3 },
];

const AIRLINE_COLORS = { FDX:'#7c3aed',UPS:'#92400e',DHK:'#dc2626',BCS:'#dc2626',CLX:'#1d4ed8',GTI:'#0369a1',KAL:'#0f766e',UAE:'#b45309',CPA:'#15803d',LRC:'#6d28d9',BAW:'#1e3a8a',AFR:'#9a3412' };

function riskColor(r){ return r>=80?'#ef4444':r>=50?'#f59e0b':'#10b981'; }
function acColor(al){ return AIRLINE_COLORS[al]||'#60a5fa'; }
function bearing(lng1,lat1,lng2,lat2){
  const d=Math.PI/180,dL=(lng2-lng1)*d,l1=lat1*d,l2=lat2*d;
  return ((Math.atan2(Math.sin(dL)*Math.cos(l2),Math.cos(l1)*Math.sin(l2)-Math.sin(l1)*Math.cos(l2)*Math.cos(dL))*180/Math.PI)+360)%360;
}
function rotPoly(pts,h,cx,cy){
  const r=h*Math.PI/180;
  return pts.map(([px,py])=>`${px*Math.cos(r)-py*Math.sin(r)+cx},${px*Math.sin(r)+py*Math.cos(r)+cy}`).join(' ');
}

// ── FIX 3: Filter vessels to supply chain relevant zones only ─────────────────
// Covers: Asia-Pacific, Europe/Med, Indian Ocean, US East/Gulf, Trans-Pacific
// Caps at 300 rendered vessels max — smooth in any browser
function filterVessels(vessels) {
  return vessels.filter(v =>
    (v.lng > 100  && v.lng < 145  && v.lat > 0   && v.lat < 45)  || // Asia-Pacific
    (v.lng > -10  && v.lng < 40   && v.lat > 30  && v.lat < 65)  || // Europe / North Sea
    (v.lng > 25   && v.lng < 45   && v.lat > 10  && v.lat < 35)  || // Red Sea / Suez
    (v.lng > 50   && v.lng < 100  && v.lat > -10 && v.lat < 30)  || // Indian Ocean
    (v.lng > -90  && v.lng < -60  && v.lat > 20  && v.lat < 50)  || // US East / Gulf Coast
    (v.lng > 140  || v.lng < -110)                                || // Trans-Pacific lanes
    (v.lng > -10  && v.lng < 20   && v.lat > -35 && v.lat < 10)     // West Africa / Cape
  ).slice(0, 300);
}

export default function MapArea({ suppliers: liveSuppliers }) {
  const wrapRef   = useRef(null);
  const svgRef    = useRef(null);
  const d3Ref     = useRef(null);
  const builtRef  = useRef(false);
  const [tooltip, setTooltip] = useState(null);
  const [ttPos,   setTtPos]   = useState({x:0,y:0});
  const [loading, setLoading] = useState(true);
  const [layers,  setLayers]  = useState({vessels:true,aircraft:true,ground:true,suppliers:true});
  const { vessels, aircraft, ground, summary } = useLiveTracking();

  const suppliers = SUPPLIERS.map(s=>{
    const live=(liveSuppliers||[]).find(l=>l.id===s.id);
    return live?{...s,risk:live.risk}:s;
  });

  // ── Build static D3 map (once) ────────────────────────────────────────────
  const buildMap = useCallback((d3,topojson,world)=>{
    const wrap=wrapRef.current, el=svgRef.current;
    if(!wrap||!el||builtRef.current) return;
    builtRef.current=true;
    const W=wrap.clientWidth, H=wrap.clientHeight;
    d3.select(el).selectAll('*').remove();
    const svg=d3.select(el).attr('width',W).attr('height',H);
    const defs=svg.append('defs');

    const bg=defs.append('radialGradient').attr('id','map-bg').attr('cx','50%').attr('cy','50%').attr('r','70%');
   bg.append('stop').attr('offset','0%').attr('stop-color','#dde8f5');
bg.append('stop').attr('offset','100%').attr('stop-color','#c8d8ee');

    const gf=defs.append('filter').attr('id','glow').attr('x','-80%').attr('y','-80%').attr('width','260%').attr('height','260%');
    gf.append('feGaussianBlur').attr('in','SourceGraphic').attr('stdDeviation','4').attr('result','blur');
    const gm=gf.append('feMerge'); gm.append('feMergeNode').attr('in','blur'); gm.append('feMergeNode').attr('in','SourceGraphic');

    const gsm=defs.append('filter').attr('id','glow-sm').attr('x','-100%').attr('y','-100%').attr('width','300%').attr('height','300%');
    gsm.append('feGaussianBlur').attr('in','SourceGraphic').attr('stdDeviation','2').attr('result','blur');
    const gsm2=gsm.append('feMerge'); gsm2.append('feMergeNode').attr('in','blur'); gsm2.append('feMergeNode').attr('in','SourceGraphic');

    const vig=defs.append('radialGradient').attr('id','vig').attr('cx','50%').attr('cy','50%').attr('r','70%');
    vig.append('stop').attr('offset','55%').attr('stop-color','transparent');
    vig.append('stop').attr('offset','100%').attr('stop-color','rgba(6,12,26,0.6)');

    const proj=d3.geoNaturalEarth1().scale(W/6.2).translate([W/2,H/2+10]);
    const path=d3.geoPath().projection(proj);

    svg.append('rect').attr('width',W).attr('height',H).attr('fill','url(#map-bg)');
    svg.append('path').datum(d3.geoGraticule().step([30,30])()).attr('d',path).attr('fill','none').attr('stroke','rgba(37,99,235,0.06)').attr('stroke-width',.5);
    svg.append('path').datum({type:'Sphere'}).attr('d',path).attr('fill','none').attr('stroke','rgba(37,99,235,0.18)').attr('stroke-width',1);

    const countries=topojson.feature(world,world.objects.countries);
    svg.append('g').selectAll('path').data(countries.features).enter().append('path')
  .attr('d',path).attr('fill','#b8cce0').attr('stroke','rgba(37,99,235,0.35)').attr('stroke-width',.45).attr('stroke-linejoin','round');
    svg.append('path').datum(topojson.mesh(world,world.objects.countries,(a,b)=>a!==b))
      .attr('d',path).attr('fill','none').attr('stroke','rgba(37,99,235,0.15)').attr('stroke-width',.25);

    [[120,15,'ASIA-PACIFIC'],[10,52,'EUROPE'],[-100,42,'NORTH AMERICA'],[-58,-18,'SOUTH AMERICA'],[20,8,'AFRICA'],[135,-28,'AUSTRALIA'],[50,28,'MIDDLE EAST']].forEach(([lng,lat,lbl])=>{
      const pt=proj([lng,lat]); if(!pt) return;
      svg.append('text').attr('x',pt[0]).attr('y',pt[1]).attr('text-anchor','middle').attr('font-family','"DM Mono",monospace').attr('font-size',8).attr('fill','rgba(148,163,184,0.18)').attr('letter-spacing',2).attr('pointer-events','none').text(lbl);
    });

    const groundLayer   = svg.append('g').attr('id','l-ground');
    const vesselLayer   = svg.append('g').attr('id','l-vessels');
    const aircraftLayer = svg.append('g').attr('id','l-aircraft');
    const supplierLayer = svg.append('g').attr('id','l-suppliers');
    svg.append('rect').attr('width',W).attr('height',H).attr('fill','url(#vig)').attr('pointer-events','none');

    d3Ref.current = { svg, proj, path, groundLayer, vesselLayer, aircraftLayer, supplierLayer, W, H };
    drawSuppliers(d3, proj, supplierLayer, wrap);
    setLoading(false);
  },[]);

  const drawSuppliers = (d3,proj,layer,wrap) => {
    layer.selectAll('*').remove();
    suppliers.forEach(s=>{
      const pt=proj([s.lng,s.lat]); if(!pt) return;
      const col=riskColor(s.risk), r=s.risk>=80?7:s.risk>=50?5.5:4.5;
      const g=layer.append('g').style('cursor','pointer');
      g.append('circle').attr('cx',pt[0]).attr('cy',pt[1]).attr('r',r+6).attr('fill',col).attr('opacity',.18).attr('filter','url(#glow)');
      if(s.risk>=80){
        [0,700].forEach(delay=>{
          const ring=g.append('circle').attr('cx',pt[0]).attr('cy',pt[1]).attr('r',r).attr('fill','none').attr('stroke',col).attr('stroke-width',1.2).attr('opacity',0);
          function pulse(){ring.attr('r',r).attr('opacity',.9).transition().delay(delay).duration(2200).ease(d3.easeLinear).attr('r',r+20).attr('opacity',0).on('end',pulse);}
          pulse();
        });
      }
      const core=g.append('circle').attr('cx',pt[0]).attr('cy',pt[1]).attr('r',r).attr('fill',col).attr('stroke','rgba(0,0,0,0.45)').attr('stroke-width',1.2);
      g.append('circle').attr('cx',pt[0]-r*.28).attr('cy',pt[1]-r*.28).attr('r',r*.38).attr('fill','rgba(255,255,255,0.5)').attr('pointer-events','none');
      g.on('mouseenter',ev=>{
        const rc=wrap.getBoundingClientRect();
        setTooltip({type:'supplier',data:s});
        setTtPos({x:ev.clientX-rc.left+16,y:ev.clientY-rc.top-14});
        core.transition().duration(100).attr('r',r*1.55);
      }).on('mousemove',ev=>{
        const rc=wrap.getBoundingClientRect();
        setTtPos({x:ev.clientX-rc.left+16,y:ev.clientY-rc.top-14});
      }).on('mouseleave',()=>{setTooltip(null);core.transition().duration(100).attr('r',r);});
    });
  };

  // ── Update vessel layer (Fix 3 applied here) ──────────────────────────────
  useEffect(()=>{
    const refs=d3Ref.current; if(!refs||!window.d3) return;
    const {vesselLayer:vl,proj}=refs; const d3=window.d3; const wrap=wrapRef.current;
    vl.style('display',layers.vessels?null:'none');
    if(!layers.vessels) return;

    // ── FIX 3: Only render vessels in supply chain zones, max 300 ─────────
    const relevant = filterVessels(vessels);

    relevant.forEach(v=>{
      if(!v.lat||!v.lng) return;
      const pt=proj([v.lng,v.lat]); if(!pt) return;
      const col=v.typeLabel==='Tanker'?'#f59e0b':'#60a5fa';
      let g=vl.select(`#v-${v.mmsi}`);
      if(g.empty()){
        g=vl.append('g').attr('id',`v-${v.mmsi}`).style('cursor','pointer');
        g.append('polygon').attr('class','vs');
        g.on('mouseenter',ev=>{const rc=wrap?.getBoundingClientRect();setTooltip({type:'vessel',data:v});setTtPos({x:ev.clientX-(rc?.left||0)+16,y:ev.clientY-(rc?.top||0)-14});})
         .on('mousemove',ev=>{const rc=wrap?.getBoundingClientRect();setTtPos({x:ev.clientX-(rc?.left||0)+16,y:ev.clientY-(rc?.top||0)-14});})
         .on('mouseleave',()=>setTooltip(null));
      }
      g.select('.vs').attr('points',rotPoly([[0,-5],[3,3],[0,1],[-3,3]],v.heading||0,pt[0],pt[1])).attr('fill',col).attr('opacity',.88).attr('filter','url(#glow-sm)');
    });

    // Remove vessels no longer in the relevant set
    vl.selectAll('g[id^="v-"]').each(function(){
      const id=d3.select(this).attr('id').replace('v-','');
      if(!relevant.find(v=>v.mmsi===id)) d3.select(this).remove();
    });
  },[vessels,layers.vessels]);

  // ── Update aircraft layer ─────────────────────────────────────────────────
  useEffect(()=>{
    const refs=d3Ref.current; if(!refs||!window.d3) return;
    const {aircraftLayer:al,proj}=refs; const d3=window.d3; const wrap=wrapRef.current;
    al.style('display',layers.aircraft?null:'none');
    if(!layers.aircraft) return;
    aircraft.forEach(a=>{
      if(!a.lat||!a.lng) return;
      const pt=proj([a.lng,a.lat]); if(!pt) return;
      const col=acColor(a.airline);
      let g=al.select(`#a-${a.icao24}`);
      if(g.empty()){
        g=al.append('g').attr('id',`a-${a.icao24}`).style('cursor','pointer');
        g.append('polygon').attr('class','as');
        g.on('mouseenter',ev=>{const rc=wrap?.getBoundingClientRect();setTooltip({type:'aircraft',data:a});setTtPos({x:ev.clientX-(rc?.left||0)+16,y:ev.clientY-(rc?.top||0)-14});})
         .on('mousemove',ev=>{const rc=wrap?.getBoundingClientRect();setTtPos({x:ev.clientX-(rc?.left||0)+16,y:ev.clientY-(rc?.top||0)-14});})
         .on('mouseleave',()=>setTooltip(null));
      }
      g.select('.as').attr('points',rotPoly([[0,-6],[2.5,2],[0,0],[-2.5,2]],a.heading||0,pt[0],pt[1])).attr('fill',col).attr('opacity',.92).attr('filter','url(#glow-sm)');
    });
    al.selectAll('g[id^="a-"]').each(function(){
      const id=d3.select(this).attr('id').replace('a-','');
      if(!aircraft.find(a=>a.icao24===id)) d3.select(this).remove();
    });
  },[aircraft,layers.aircraft]);

  // ── Update ground layer ───────────────────────────────────────────────────
  useEffect(()=>{
    const refs=d3Ref.current; if(!refs||!window.d3) return;
    const {groundLayer:gl,proj,path}=refs; const wrap=wrapRef.current;
    gl.style('display',layers.ground?null:'none');
    if(!layers.ground||!ground.length) return;
    gl.selectAll('*').remove();
    ground.forEach(route=>{
      if(!route.waypoints||route.waypoints.length<2) return;
      gl.append('path').datum({type:'LineString',coordinates:route.waypoints})
        .attr('d',path).attr('fill','none').attr('stroke','rgba(16,185,129,0.22)').attr('stroke-width',.9).attr('stroke-dasharray','3,4');
      if(route.lat!=null&&route.lng!=null){
        const pt=proj([route.lng,route.lat]); if(!pt) return;
        const g=gl.append('g').style('cursor','pointer');
        g.append('rect').attr('x',pt[0]-4).attr('y',pt[1]-3).attr('width',8).attr('height',6).attr('fill','#10b981').attr('opacity',.85).attr('rx',1).attr('filter','url(#glow-sm)');
        g.append('rect').attr('x',pt[0]-2.5).attr('y',pt[1]-5).attr('width',4).attr('height',2.5).attr('fill','#34d399').attr('opacity',.7).attr('rx',.5);
        g.on('mouseenter',ev=>{const rc=wrap?.getBoundingClientRect();setTooltip({type:'ground',data:route});setTtPos({x:ev.clientX-(rc?.left||0)+16,y:ev.clientY-(rc?.top||0)-14});})
         .on('mousemove',ev=>{const rc=wrap?.getBoundingClientRect();setTtPos({x:ev.clientX-(rc?.left||0)+16,y:ev.clientY-(rc?.top||0)-14});})
         .on('mouseleave',()=>setTooltip(null));
      }
    });
  },[ground,layers.ground]);

  // ── Load D3 + world atlas ─────────────────────────────────────────────────
  useEffect(()=>{
    function loadScript(src){
      return new Promise((res,rej)=>{
        if(document.querySelector(`script[src="${src}"]`)){res();return;}
        const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
    }
    loadScript('https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js')
      .then(()=>loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js'))
      .then(()=>fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'))
      .then(r=>r.json())
      .then(world=>buildMap(window.d3,window.topojson,world))
      .catch(err=>{console.error('Map load failed:',err);setLoading(false);});
  },[buildMap]);

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const W = wrapRef.current?.clientWidth||800;
  const renderTooltip=()=>{
    if(!tooltip) return null;
    const {type,data:d}=tooltip;
    const left=Math.min(ttPos.x,W-240), top=Math.max(4,ttPos.y);
   const base={position:'absolute',left,top,background:'rgba(9,18,38,0.97)',borderRadius:8,padding:'12px 15px',fontSize:11,zIndex:600,minWidth:215,backdropFilter:'blur(14px)',pointerEvents:'none',boxShadow:'0 8px 32px rgba(0,0,0,0.7)'};
const row=(k,v)=>(
  <div key={k} style={{display:'flex',justifyContent:'space-between',gap:14,marginBottom:4,fontFamily:'var(--mono)',fontSize:10}}>
    <span style={{color:'#94a3b8',flexShrink:0}}>{k}</span>
    <span style={{color:'#ffffff',fontWeight:600,textAlign:'right',maxWidth:140}}>{v}</span>
  </div>
);
      <div key={k} style={{display:'flex',justifyContent:'space-between',gap:14,marginBottom:4,fontFamily:'var(--mono)',fontSize:10}}>
      <span style={{color:'#94a3b8',flexShrink:0}}>{k}</span>
<span style={{color:'#ffffff',fontWeight:600,textAlign:'right',maxWidth:140}}>{v}</span>
      </div>
    );
    if(type==='supplier'){
      const col=riskColor(d.risk);
      return <div style={{...base,border:`1px solid ${col}44`}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <div style={{width:9,height:9,borderRadius:'50%',background:col,boxShadow:`0 0 10px ${col}`}}/>
          <div style={{fontWeight:700,fontSize:12.5,color:'#fff'}}>{d.name}</div>
        </div>
        {[['Location',d.loc],['Risk Score',`${d.risk}/100`],['Revenue',`$${d.rev}M/wk`],['Signal',d.threat],['Tier',`Tier ${d.tier}`]].map(([k,v])=>row(k,v))}
        <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${col}25`,fontSize:9,fontFamily:'var(--mono)',fontWeight:600,color:col}}>
          {d.risk>=80?'⚠ CRITICAL — Immediate action required':d.risk>=50?'▲ HIGH — Monitor closely':'● STABLE — No action required'}
        </div>
      </div>;
    }
    if(type==='vessel'){
      const col=d.typeLabel==='Tanker'?'#f59e0b':'#60a5fa';
      return <div style={{...base,border:'1px solid rgba(96,165,250,0.3)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:16}}>🚢</span>
          <span style={{fontWeight:700,fontSize:12,color:'#fff'}}>{d.name}</span>
          <span style={{marginLeft:'auto',fontSize:8,fontFamily:'var(--mono)',background:`${col}22`,color:col,padding:'2px 6px',borderRadius:3}}>{d.typeLabel}</span>
        </div>
        {[['Speed',`${(d.speed||0).toFixed(1)} kts`],['Heading',`${Math.round(d.heading||0)}°`],['Destination',d.destination||'—'],['Flag',d.flag||'—'],['Source',d.source]].map(([k,v])=>row(k,v))}
        {d.source==='simulated'&&<div style={{marginTop:6,fontSize:8,color:'var(--text3)',fontFamily:'var(--mono)'}}>Add AIS_API_KEY to .env for live data</div>}
      </div>;
    }
    if(type==='aircraft'){
      const col=acColor(d.airline);
      return <div style={{...base,border:`1px solid ${col}44`}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:16}}>✈</span>
          <span style={{fontWeight:700,fontSize:12,color:'#fff'}}>{d.callsign}</span>
          <span style={{marginLeft:'auto',fontSize:8,fontFamily:'var(--mono)',background:`${col}22`,color:col,padding:'2px 6px',borderRadius:3}}>{d.airlineName}</span>
        </div>
        {[['Altitude',`${(d.altitude||0).toLocaleString()} ft`],['Speed',`${d.speed||0} kts`],['Heading',`${Math.round(d.heading||0)}°`],['Source',d.source]].map(([k,v])=>row(k,v))}
        {d.source==='simulated'&&<div style={{marginTop:6,fontSize:8,color:'var(--text3)',fontFamily:'var(--mono)'}}>Add OPENSKY_USER/PASS to .env for live data</div>}
      </div>;
    }
    if(type==='ground'){
      return <div style={{...base,border:'1px solid rgba(16,185,129,0.3)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:16}}>🚛</span>
          <span style={{fontWeight:700,fontSize:12,color:'#fff'}}>{d.name}</span>
          <span style={{marginLeft:'auto',fontSize:8,fontFamily:'var(--mono)',background:'rgba(16,185,129,0.15)',color:'var(--green-l)',padding:'2px 6px',borderRadius:3}}>{d.source}</span>
        </div>
        {[['Distance',`${d.distanceKm} km`],['Est. Duration',`${d.durationHrs} hrs`],['Active Trucks',d.truckCount||'—']].map(([k,v])=>row(k,v))}
      </div>;
    }
    return null;
  };

  const LayerBtn=({k,label,count,col})=>(
    <button onClick={()=>setLayers(p=>({...p,[k]:!p[k]}))} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 9px',background:layers[k]?'rgba(9,18,38,0.9)':'rgba(9,18,38,0.5)',border:`1px solid ${layers[k]?col+'44':'rgba(37,99,235,0.1)'}`,borderRadius:4,cursor:'pointer',fontFamily:'var(--mono)',fontSize:9,color:layers[k]?col:'var(--text3)',transition:'.15s'}}>
      <div style={{width:6,height:6,borderRadius:'50%',background:layers[k]?col:'var(--text3)',boxShadow:layers[k]?`0 0 5px ${col}`:''}}/>
      {label} <span style={{opacity:.6}}>{count}</span>
    </button>
  );

  // Compute filtered count for display
  const relevantVessels = filterVessels(vessels);

  return (
    <div ref={wrapRef} style={{flex:1,position:'relative',background:'var(--bg)',minHeight:0,overflow:'hidden'}}>
      <svg ref={svgRef} style={{display:'block',width:'100%',height:'100%'}}/>
      {renderTooltip()}

      {/* Layer toggles — top left */}
      <div style={{position:'absolute',top:12,left:12,display:'flex',flexDirection:'column',gap:4}}>
        <LayerBtn k="vessels"  label="Vessels"  count={relevantVessels.length} col="#60a5fa"/>
        <LayerBtn k="aircraft" label="Aircraft" count={aircraft.length}         col="#a78bfa"/>
        <LayerBtn k="ground"   label="Trucks"   count={ground.length}           col="#34d399"/>
        <LayerBtn k="suppliers"label="Suppliers"count={suppliers.length}        col="#f59e0b"/>
      </div>

      {/* Live source badges — bottom left */}
      <div style={{position:'absolute',bottom:10,left:12,display:'flex',gap:5}}>
        {[
          {label:'AIS',     live:summary.aisLive,     color:'var(--green-l)'},
          {label:'OPENSKY', live:summary.openskyLive, color:'var(--green-l)'},
          {label:'ORS',     live:summary.orsLive,     color:'var(--green-l)'},
        ].map(b=>(
          <div key={b.label} style={{background:'rgba(9,18,38,0.88)',border:'1px solid var(--border)',borderRadius:4,padding:'3px 8px',fontFamily:'var(--mono)',fontSize:8,display:'flex',alignItems:'center',gap:4,color:b.live?b.color:'var(--text3)'}}>
            <div style={{width:4,height:4,borderRadius:'50%',background:b.live?b.color:'var(--text3)',animation:b.live?'blink 1.4s infinite':''}}/>
            {b.label} {b.live?'LIVE':'SIM'}
          </div>
        ))}
      </div>

      {/* Legend — top right */}
      <div style={{position:'absolute',top:12,right:12,background:'rgba(9,18,38,0.9)',border:'1px solid var(--border)',borderRadius:7,padding:'11px 13px',fontSize:9,fontFamily:'var(--mono)',backdropFilter:'blur(10px)',minWidth:145}}>
        <div style={{color:'var(--text3)',letterSpacing:1.5,marginBottom:8,fontSize:8}}>RISK LEVEL</div>
        {[['#ef4444','Critical','≥ 80'],['#f59e0b','High','50–79'],['#10b981','Normal','< 50']].map(([gc,label,range])=>(
          <div key={label} style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:gc,boxShadow:`0 0 7px ${gc}`,flexShrink:0}}/>
            <span style={{color:'var(--text2)'}}>{label}</span>
            <span style={{color:'var(--text3)',marginLeft:'auto'}}>{range}</span>
          </div>
        ))}
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:4}}>
          <div style={{color:'var(--text3)',fontSize:8,marginBottom:6}}>TRANSPORT</div>
          {[['#60a5fa','▶ Vessels (AIS)'],['#a78bfa','✈ Aircraft (ADS-B)'],['#34d399','■ Trucks (ORS)']].map(([c,l])=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,fontSize:8}}>
              <span style={{color:c,fontSize:10}}>{l.slice(0,1)}</span>
              <span style={{color:'var(--text2)'}}>{l.slice(2)}</span>
            </div>
          ))}
        </div>
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:6}}>
          <div style={{color:'var(--text3)',fontSize:8,marginBottom:2}}>SUPPLIERS</div>
          <div style={{fontSize:16,fontWeight:700,color:'var(--blue-ll)'}}>{suppliers.length}</div>
          <div style={{fontSize:8,color:'var(--text3)',marginTop:1}}>{suppliers.filter(s=>s.risk>=80).length} critical · {suppliers.filter(s=>s.risk>=50&&s.risk<80).length} high</div>
        </div>
      </div>

      {loading&&(
        <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',background:'#060c1a',color:'var(--text2)',fontFamily:'var(--mono)',fontSize:11,zIndex:50}}>
          <div style={{textAlign:'center'}}>
            <div style={{color:'var(--blue-ll)',marginBottom:8}}>Loading geospatial data</div>
            <div style={{width:140,height:2,background:'var(--bg4)',borderRadius:1,overflow:'hidden',margin:'0 auto'}}>
              <div style={{height:'100%',background:'var(--blue)',borderRadius:1,animation:'loadBar 1.4s ease-in-out infinite',width:'40%'}}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
