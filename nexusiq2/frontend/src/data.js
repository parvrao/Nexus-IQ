// Static supplier register (name, site, coordinates, tier). Live risk scores are merged in from the API.
export const SUPPLIERS = [
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

export const sevOf  = r => r>=80?'critical':r>=50?'high':'low';
export const sevName= r => r>=80?'Critical':r>=50?'High':'Stable';
export const sevVar = r => r>=80?'var(--crit)':r>=50?'var(--high)':'var(--ok)';

export const PORTS = [
  { code:'POLAX', label:'Port of Los Angeles', note:'POLAX' },
  { code:'CNSHA', label:'Port of Shanghai',    note:'CNSHA' },
  { code:'NLRTM', label:'Port of Rotterdam',   note:'NLRTM' },
  { code:'SUEZ',  label:'Suez Canal corridor', note:'SUEZ'  },
  { code:'TWKHH', label:'Port of Kaohsiung',   note:'TWKHH' },
  { code:'SGSIN', label:'Port of Singapore',   note:'SGSIN' },
];

export function ago(ts){
  const d=Math.max(0,Date.now()-ts);
  if(d<60000) return 'now';
  if(d<3600000) return `${Math.round(d/60000)}m`;
  if(d<86400000) return `${Math.round(d/3600000)}h`;
  return `${Math.round(d/86400000)}d`;
}
export function utc(ts=Date.now()){
  const d=new Date(ts); const p=n=>String(n).padStart(2,'0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
export function dms(lat,lng){
  const f=(v,p,n)=>`${Math.abs(v).toFixed(2)}°${v>=0?p:n}`;
  return `${f(lat,'N','S')} ${f(lng,'E','W')}`;
}
// Which alerts / signals mention a supplier: match its company name or site city as a whole word.
const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function keysOf(s){
  return [s.name.split(' ')[0].replace(/'s$/,''), s.loc.split(',')[0]].map(k=>k.trim()).filter(k=>k.length>2);
}
export function linked(s, items, fields){
  const re = new RegExp(`(^|[^\\p{L}])(${keysOf(s).map(esc).join('|')})([^\\p{L}]|$)`,'iu');
  return items.filter(it=>fields.some(f=>re.test(Array.isArray(it[f])?it[f].join(' '):String(it[f]||''))));
}
