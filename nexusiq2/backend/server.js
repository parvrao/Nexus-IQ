const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { initTracking, registerTrackingRoutes } = require('./tracking');
const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET','POST'] }
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST'],
}));
app.use(express.json());
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests — try again in 15 minutes' },
});
app.use('/api/', limiter);


// Live tracking (AIS + OpenSky + ORS)
initTracking(io);
registerTrackingRoutes(app);

// ── In-memory state ───────────────────────────────────────────────────────────
let acknowledgedAlerts = new Set();
let signalCount        = 1247;
let activeConnections  = 0;

// ── Static data ───────────────────────────────────────────────────────────────
const SUPPLIERS = [
  { id:'S01', name:'Foxconn Electronics',    loc:'Shenzhen, China',        lng:114.1, lat:22.5,  risk:92, threat:'Labor dispute — 14,000 workers organized',    rev:3.8, tier:1 },
  { id:'S02', name:'TSMC Fab 5',             loc:'Hsinchu, Taiwan',         lng:120.9, lat:24.8,  risk:88, threat:'Typhoon Gaemi — Cat 3 direct track',          rev:2.1, tier:1 },
  { id:'S03', name:'Samsung Semiconductor',  loc:'Hwaseong, South Korea',   lng:127.0, lat:37.2,  risk:74, threat:'Export restriction risk escalating',          rev:1.9, tier:1 },
  { id:'S04', name:'LG Chem Battery',        loc:'Ochang, South Korea',     lng:127.4, lat:36.6,  risk:68, threat:'Lithium price spike +34%',                    rev:1.2, tier:2 },
  { id:'S05', name:'Yanlord Logistics',      loc:'Shanghai, China',         lng:121.4, lat:31.2,  risk:61, threat:'Port congestion — 4.2 day avg delay',         rev:0.9, tier:2 },
  { id:'S06', name:'Flextronics India',      loc:'Chennai, India',          lng:80.2,  lat:13.0,  risk:55, threat:'Monsoon flooding risk elevated',              rev:0.7, tier:2 },
  { id:'S07', name:"Magna Int'l",            loc:'Ontario, Canada',         lng:-80.5, lat:43.6,  risk:42, threat:'UAW contract expiry Dec 1',                   rev:1.1, tier:1 },
  { id:'S08', name:'BASF SE',                loc:'Ludwigshafen, Germany',   lng:8.4,   lat:49.5,  risk:38, threat:'Energy cost +28% YoY',                        rev:0.6, tier:2 },
  { id:'S09', name:'ABB Robotics',           loc:'Zürich, Switzerland',     lng:8.5,   lat:47.4,  risk:35, threat:'CHF currency volatility',                     rev:0.4, tier:3 },
  { id:'S10', name:'Michelin Tire Mfg',      loc:'Clermont-Ferrand, France',lng:3.1,   lat:45.8,  risk:31, threat:'Port Marseille strike risk',                  rev:0.5, tier:2 },
  { id:'S11', name:'Rio Tinto Minerals',     loc:'Perth, Australia',        lng:115.8, lat:-31.9, risk:29, threat:'Cyclone season — elevated risk',              rev:0.8, tier:2 },
  { id:'S12', name:'Cemex Mexico',           loc:'Monterrey, Mexico',       lng:-100.3,lat:25.7,  risk:27, threat:'Water scarcity Q4 risk',                      rev:0.3, tier:3 },
  { id:'S13', name:'Dow Chemical',           loc:'Freeport, TX',            lng:-95.4, lat:28.9,  risk:48, threat:'Hurricane Patricia track modeling',            rev:0.9, tier:1 },
  { id:'S14', name:'ArcelorMittal',          loc:'Luxembourg',              lng:6.1,   lat:49.6,  risk:44, threat:'Steel tariff escalation risk',                 rev:0.7, tier:2 },
  { id:'S15', name:'Reliance Industries',    loc:'Jamnagar, India',         lng:70.1,  lat:22.5,  risk:33, threat:'Red Sea diversion impact +12 days',           rev:0.4, tier:3 },
];

const ALERTS = [
  { id:'A01', priority:'critical', title:'Typhoon Gaemi — Taiwan Strait corridor', lane:'TWKHH → USLAX', type:'Weather', impact:'Aug 3–12', detail:'Landfall probability 87% at Port of Kaohsiung by Aug 3. Affects TSMC Fab 5, Foxconn HQ, AU Optronics, Pegatron — $2.3M weekly throughput.', action:'Pre-position 3-week buffer stock at Tijuana DC. Activate secondary supplier Wistron (Kunshan). Notify FedEx freight hold.', ts: Date.now()-900000 },
  { id:'A02', priority:'critical', title:'Foxconn Shenzhen — labor action imminent', lane:'SZX → Global', type:'Labor', impact:'Jul 28 – open', detail:'14,000 assembly workers organized. Satellite imagery: 48hr vehicle count -31%. iPhone 16 Pro build at risk.', action:'Escalate to Apple Tier-1. Activate Pegatron Kunshan secondary allocation. 11-day lead time exposure.', ts: Date.now()-1800000 },
  { id:'A03', priority:'high', title:'Suez Canal — Red Sea routing disruption', lane:'Asia → EU/USEC', type:'Security', impact:'Ongoing', detail:'95% of Asia-EU container traffic rerouted via Cape of Good Hope. Average +12 day transit. EU freight rates +340% WoW.', action:'Rotterdam buffer elevated to 4 weeks. Review Q4 EU delivery SLAs with 3 clients.', ts: Date.now()-3600000 },
  { id:'A04', priority:'high', title:'Port of Shanghai congestion — severe', lane:'CNSHA → Global', type:'Capacity', impact:'72hr', detail:'Average vessel wait 4.2 days (up from 1.1). 23 vessels at anchor. Berth utilization 112%. Shipment SL-2245 affected.', action:'Reroute SL-2245 via Ningbo (CNNBO). 8hr delay vs 4.2 day anchor wait.', ts: Date.now()-7200000 },
  { id:'A05', priority:'high', title:"UAW contract expiry — Magna Int'l", lane:'Ontario → USMW', type:'Labor', impact:'Dec 1', detail:'UAW Local 584 contract expires Dec 1. Strike probability 61% per NexusIQ Labor Model v4.2.', action:'Request 8-week buffer from Magna by Nov 15. Identify alternative stamped parts supplier.', ts: Date.now()-10800000 },
  { id:'A06', priority:'medium', title:'Hurricane Patricia — Gulf Coast modeling', lane:'US Gulf → USMW', type:'Weather', impact:'Aug 15–22', detail:'NHC Cat-2 landfall Corpus Christi Aug 15 (±3 days). Dow Freeport in impact zone. $900K weekly feedstock exposure.', action:'Monitor NHC 5-day cone. Trigger LyondellBasell contingency sourcing if Cat 2+ confirmed.', ts: Date.now()-14400000 },
  { id:'A07', priority:'medium', title:'TSMC export license — escalating controls', lane:'TWKHH → US', type:'Geopolitical', impact:'60–90 days', detail:'Commerce Dept reviewing ECRA controls on 3nm chips. 14 SKUs affected. $4.1M annual procurement.', action:'Legal review of ECCN classifications. Identify ITAR-compliant domestic alternatives.', ts: Date.now()-18000000 },
];

const FEED = [
  { id:'F01', source:'AIS Vessel Track',       conf:94, text:'MV Evergreen Ever Ace departed Port Kaohsiung 04:12 UTC — 6.3hr ahead of schedule, anticipating Typhoon Gaemi track shift. 4 component shipments aboard.', tags:['TWKHH','Ever Ace','Typhoon Gaemi'], ts: Date.now()-240000 },
  { id:'F02', source:'PACER Court Filings',    conf:89, text:'Chapter 11 filing: Pacific Rim Freight Forwarders LLC (Wilmington, DE) — $2.1M outstanding freight obligations. 2 of your active BOLs cross-referenced.', tags:['Bankruptcy','Freight Forwarder','BOL Risk'], ts: Date.now()-1020000 },
  { id:'F03', source:'Multilingual NLP — ZH',  conf:91, text:'Weibo trending near Foxconn Longhua: "工厂停工" (factory shutdown). Corroborated by 847 independent posts from Shenzhen industrial zone.', tags:['Foxconn','Labor','Shenzhen'], ts: Date.now()-1380000 },
  { id:'F04', source:'NOAA / WPC Model',       conf:87, text:'Typhoon Gaemi NWP ensemble: 74% Taiwan Strait transit probability Aug 1-3. Cat 3 at 115kt before landfall. Port Kaohsiung storm surge 2.1–3.4m.', tags:['Typhoon Gaemi','TWKHH','Taiwan'], ts: Date.now()-1860000 },
  { id:'F05', source:'Planet Labs SAR',        conf:82, text:'Foxconn Longhua parking count: 3,241 (baseline 4,712). 31% reduction vs 30-day avg. Consistent with organized absenteeism or production halt.', tags:['Foxconn','Satellite','Labor'], ts: Date.now()-4320000 },
  { id:'F06', source:'CBP Trade Data',         conf:76, text:'US Customs advance manifest: 18% decline in HTSUS 8542.31 (integrated circuits) from Taiwan — 7-day vs prior 4-week average.', tags:['Taiwan','Semiconductor','Customs'], ts: Date.now()-7200000 },
  { id:'F07', source:'OSHA Inspection Log',    conf:71, text:'Unusual spike in OSHA Form 300 filings at Dow Freeport, Huntsman Port Arthur, INEOS Texas City. Pre-hurricane clustering pattern (r=0.81).', tags:['OSHA','Hurricane','Gulf Coast'], ts: Date.now()-10800000 },
  { id:'F08', source:"Lloyd's List",           conf:68, text:'3 additional carriers announce Cape of Good Hope diversion. 94% Asia-EU tonnage on extended routing. Spot rates +340% since Jan.', tags:['Red Sea','Suez','Freight Rates'], ts: Date.now()-13500000 },
];

const DATA_SOURCES = [
  { id:'DS01', name:'AIS Vessel Track',   status:'ok',   count:2100000, last:0    },
  { id:'DS02', name:'Multilingual NLP',   status:'ok',   count:847000,  last:120  },
  { id:'DS03', name:'Planet Labs SAR',    status:'ok',   count:14200,   last:1080 },
  { id:'DS04', name:'PACER Court Files',  status:'ok',   count:3421,    last:240  },
  { id:'DS05', name:'CBP Trade Data',     status:'ok',   count:91000,   last:3600 },
  { id:'DS06', name:'NOAA Weather',       status:'ok',   count:2800000, last:0    },
  { id:'DS07', name:'OSHA Filings',       status:'warn', count:1204,    last:7200 },
  { id:'DS08', name:'Bloomberg Signal',   status:'ok',   count:447000,  last:300  },
  { id:'DS09', name:"Lloyd's List",       status:'ok',   count:8841,    last:1800 },
  { id:'DS10', name:'UN Comtrade',        status:'err',  count:0,       last:50400},
  { id:'DS11', name:'FreightWaves API',   status:'ok',   count:124000,  last:480  },
  { id:'DS12', name:'Panjiva Trade Intel',status:'ok',   count:221000,  last:720  },
];

// ── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status:'ok', ts:Date.now(), connections:activeConnections }));

app.get('/api/stats', (req, res) => {
  const open = ALERTS.filter(a => !acknowledgedAlerts.has(a.id));
  res.json({
    openAlerts:       open.length,
    criticalAlerts:   open.filter(a=>a.priority==='critical').length,
    suppliersAtRisk:  SUPPLIERS.filter(s=>s.risk>=50).length,
    revenueExposed:   SUPPLIERS.reduce((s,x)=>x.risk>=50?s+x.rev:s,0).toFixed(1),
    signalCount,
    activeConnections,
  });
});

app.get('/api/suppliers', (req, res) => {
  res.json(SUPPLIERS.map(s => ({ ...s, risk: Math.min(100,Math.max(0, s.risk + Math.floor((Math.random()-.5)*3))) })));
});

app.get('/api/alerts', (req, res) => res.json(ALERTS.filter(a=>!acknowledgedAlerts.has(a.id))));

app.post('/api/alerts/:id/acknowledge', (req, res) => {
  acknowledgedAlerts.add(req.params.id);
  io.emit('alert:acknowledged', { id: req.params.id });
  res.json({ success:true });
});

app.get('/api/feed',    (req, res) => res.json(FEED));
app.get('/api/sources', (req, res) => res.json(DATA_SOURCES.map(d=>({ ...d, count: d.status!=='err'?d.count+Math.floor(Math.random()*500):d.count }))));

app.get('/api/scenario', (req, res) => {
  const PORTS = {
    POLAX:{ name:'Port of Los Angeles', lanes:12, suppliers:8,  baseRev:4.2 },
    CNSHA:{ name:'Port of Shanghai',    lanes:18, suppliers:14, baseRev:6.8 },
    NLRTM:{ name:'Port of Rotterdam',   lanes:9,  suppliers:6,  baseRev:2.9 },
    SUEZ: { name:'Suez Canal',          lanes:22, suppliers:18, baseRev:8.1 },
    TWKHH:{ name:'Port of Kaohsiung',   lanes:7,  suppliers:5,  baseRev:3.1 },
    SGSIN:{ name:'Port of Singapore',   lanes:15, suppliers:11, baseRev:5.4 },
  };
const validPorts = ['POLAX','CNSHA','NLRTM','SUEZ','TWKHH','SGSIN'];
const port = validPorts.includes(req.query.port) ? req.query.port : 'POLAX';
const cap  = Math.min(100, Math.max(0, parseInt(req.query.capacity) || 40));
const d    = PORTS[port] || PORTS.POLAX;
  res.json({
    port:             d.name,
    capacityReduction:cap,
    lanesAffected:    Math.round(d.lanes*cap/100),
    totalLanes:       d.lanes,
    suppliersHit:     Math.round(d.suppliers*cap/100),
    totalSuppliers:   d.suppliers,
    revenueAtRisk:    parseFloat((d.baseRev*cap/100).toFixed(1)),
    recoveryDays:     Math.round(cap*0.35+2),
    alternateRoutes:  Math.max(0,3-Math.floor(cap/40)),
  });
});

app.get('/api/timeline', (req, res) => {
  const days = 45;
  let [a,e,m,me] = [72,35,28,55];
  const apac=[],eu=[],am=[],med=[];
  for(let i=0;i<days;i++){
    apac.push(Math.min(100,Math.max(0,Math.round(a+(Math.random()-.5)*4))));
    eu.push(Math.min(100,Math.max(0,Math.round(e+(Math.random()-.5)*3))));
    am.push(Math.min(100,Math.max(0,Math.round(m+(Math.random()-.5)*3))));
    med.push(Math.min(100,Math.max(0,Math.round(me+(Math.random()-.5)*3))));
    a=Math.max(15,a-1.2+(Math.random()*.4));
    e=Math.min(60,e+.4+(Math.random()*.3));
    m=Math.min(55,m+.5+(Math.random()*.2));
    me=Math.max(10,me-.9+(Math.random()*.3));
  }
  res.json({ apac, eu, am, me:med, days });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  activeConnections++;
  socket.on('disconnect', () => activeConnections--);
});

setInterval(()=>{ signalCount+=Math.floor(Math.random()*12)+3; io.emit('signal:count',{count:signalCount}); }, 3000);

setInterval(()=>{
  io.emit('risk:update', SUPPLIERS.map(s=>({ id:s.id, risk:Math.min(100,Math.max(0,s.risk+Math.floor((Math.random()-.48)*2))) })));
}, 30000);

const LIVE_SIGNALS = [
  'AIS: MV CMA CGM Marco Polo departed CNSHA 6hr early — 47K TEU aboard',
  'OSHA: Unusual inspection cluster Gulf Coast — pre-hurricane pattern r=0.81',
  'NLP-ZH: Foxconn Shenzhen absenteeism trending on Weibo (>1,200 posts)',
  'Planet Labs: Port Shanghai berth utilization 112% — 23 vessels at anchor',
  'FreightWaves: Trans-Pacific spot rate +22% WoW — demand surge confirmed',
  'NOAA: Hurricane Patricia advisory — Cat 2 landfall Corpus Christi Aug 15',
];
let liveIdx=0;
setInterval(()=>{
  io.emit('feed:new',{ id:`LIVE-${Date.now()}`, source:'NexusIQ Live Monitor', conf:70+Math.floor(Math.random()*25), text:LIVE_SIGNALS[liveIdx++%LIVE_SIGNALS.length], tags:['Live Signal'], ts:Date.now() });
}, 45000);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, ()=>{
  console.log(`\n🟢 NexusIQ running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV||'development'}\n`);
});
