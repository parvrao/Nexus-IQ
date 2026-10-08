const ITEMS = [
  { t:'crit', txt:'CRITICAL: Foxconn Shenzhen satellite confirms 31% vehicle reduction — labor action imminent' },
  { t:'warn', txt:'HIGH: TSMC Fab 12B production rate dropped 8% — Typhoon Gaemi pre-positioning underway' },
  { t:'info', txt:'AIS: MV CMA CGM Marco Polo departed CNSHA 6hr early — 47K TEU aboard' },
  { t:'crit', txt:'CRITICAL: Typhoon Gaemi Cat-3 landfall probability 87% — Port Kaohsiung Aug 3' },
  { t:'warn', txt:'HIGH: Port Shanghai average wait time 4.2 days — 23 vessels at anchor' },
  { t:'info', txt:'OSHA: Unusual inspection cluster Gulf Coast — pre-hurricane pattern match r=0.81' },
  { t:'warn', txt:'HIGH: Red Sea — 94% Asia-EU tonnage now Cape routing, spot rates +340%' },
  { t:'crit', txt:'CRITICAL: UAW-Magna negotiations stalled — strike probability 61% by Dec 1' },
  { t:'warn', txt:'HIGH: Hurricane Patricia NHC track — Corpus Christi landfall Aug 15 (Cat 2)' },
  { t:'info', txt:'LG Chem cost pass-through notice — lithium carbonate +34% vs 90 days ago' },
  { t:'info', txt:'ORS route update: Rotterdam-Frankfurt corridor congestion +22min avg delay' },
  { t:'warn', txt:'HIGH: OpenSky tracking 847 active cargo aircraft — FDX Memphis hub surge detected' },
];
const COL = { crit:'var(--red-l)', warn:'var(--amber)', info:'var(--blue-ll)' };
export default function Ticker() {
  const doubled = [...ITEMS,...ITEMS];
  return (
    <div style={{height:22,background:'var(--bg3)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',overflow:'hidden',flexShrink:0}}>
      <div style={{padding:'0 12px',fontSize:10,fontWeight:700,color:'var(--blue-ll)',whiteSpace:'nowrap',borderRight:'1px solid var(--border)',fontFamily:'var(--mono)',flexShrink:0}}>
        LIVE SIGNALS
      </div>
      <div style={{overflow:'hidden',flex:1}}>
        <div style={{display:'flex',animation:'scrollTicker 90s linear infinite',width:'max-content'}}>
          {doubled.map((item,i)=>(
            <div key={i} style={{whiteSpace:'nowrap',fontSize:10,fontFamily:'var(--mono)',color:'var(--text2)',padding:'0 18px',display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:4,height:4,borderRadius:'50%',background:COL[item.t],flexShrink:0}}/>
              {item.txt}
              <span style={{marginLeft:12,color:'var(--border2)'}}>|</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
