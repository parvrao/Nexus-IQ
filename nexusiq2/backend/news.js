// nexusiq2/backend/news.js
// Live news ingestion + AI impact analysis

const SEARCH_QUERIES = [
  'Strait of Hormuz shipping',
  'Red Sea Houthi shipping',
  'port strike congestion delay',
  'trade sanctions supply chain',
  'semiconductor shortage chip',
  'Suez Canal disruption',
  'South China Sea tension shipping',
  'typhoon hurricane port damage',
  'OPEC oil supply disruption',
  'freight rate spike container',
];

const SUPPLIER_REGIONS = [
  { name:'Taiwan Strait', keywords:['taiwan','taiwan strait','tsmc','foxconn','hsinchu'] },
  { name:'South Korea',   keywords:['south korea','korean','busan','incheon'] },
  { name:'China',         keywords:['china','shanghai','shenzhen','guangzhou','beijing'] },
  { name:'India',         keywords:['india','chennai','mumbai','delhi'] },
  { name:'Europe',        keywords:['europe','rotterdam','hamburg','germany','france'] },
  { name:'Middle East',   keywords:['hormuz','persian gulf','uae','saudi','dubai','oman'] },
  { name:'US Gulf Coast', keywords:['gulf coast','houston','new orleans','corpus christi'] },
  { name:'Red Sea',       keywords:['red sea','houthi','aden','bab el mandeb'] },
];

let newsCache    = [];
let forecastCache = [];
let io           = null;

function initNews(socketIoServer) {
  io = socketIoServer;
  console.log('[News] Initialising news intelligence layer...');
  fetchNews();
  setInterval(fetchNews, 15 * 60 * 1000); // every 15 min
  generateForecast();
  setInterval(generateForecast, 6 * 60 * 60 * 1000); // every 6 hrs
}

async function fetchNews() {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey || apiKey === 'your_newsapi_key_here') {
    console.warn('[News] No NEWS_API_KEY — using GDELT fallback');
    await fetchGDELT();
    return;
  }

  try {
    const query = encodeURIComponent(
      'shipping OR "supply chain" OR "port" OR "Hormuz" OR "Red Sea" OR "trade" OR "sanctions" OR "freight"'
    );
    const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=20&language=en&apiKey=${apiKey}`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
    const data = await res.json();

    const articles = (data.articles || []).map(a => ({
      id:          `news-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      title:       a.title,
      description: a.description || '',
      source:      a.source?.name || 'Unknown',
      url:         a.url,
      publishedAt: a.publishedAt,
      ts:          new Date(a.publishedAt).getTime(),
    }));

    // Analyze each article with AI
    const analyzed = await Promise.all(
      articles.slice(0, 10).map(a => analyzeArticle(a))
    );

    newsCache = analyzed.filter(Boolean).sort((a,b) => b.ts - a.ts);
    if (io) io.emit('news:update', newsCache);
    console.log(`[News] ${newsCache.length} articles fetched and analyzed`);

  } catch (err) {
    console.warn('[News] NewsAPI failed:', err.message, '— trying GDELT');
    await fetchGDELT();
  }
}

async function fetchGDELT() {
  try {
    // GDELT — free, no key, global coverage
    const query = encodeURIComponent('"supply chain" OR "shipping" OR "Hormuz" OR "Red Sea" OR "port strike"');
    const url   = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=20&format=json&sort=DateDesc`;

    const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`GDELT ${res.status}`);
    const data = await res.json();

    const articles = (data.articles || []).map(a => ({
      id:          `gdelt-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      title:       a.title,
      description: a.title, // GDELT doesn't give descriptions
      source:      a.domain || 'GDELT',
      url:         a.url,
      publishedAt: a.seendate,
      ts:          Date.now(),
    }));

    const analyzed = await Promise.all(
      articles.slice(0, 8).map(a => analyzeArticle(a))
    );

    newsCache = analyzed.filter(Boolean).sort((a,b) => b.ts - a.ts);
    if (io) io.emit('news:update', newsCache);

  } catch (err) {
    console.warn('[News] GDELT also failed:', err.message);
  }
}

async function analyzeArticle(article) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) {
    // No Gemini key — do basic keyword analysis
    return basicAnalysis(article);
  }

  try {
    const prompt = `You are a supply chain risk analyst. Analyze this news article and return ONLY a JSON object with no markdown, no explanation, just raw JSON.

Article title: "${article.title}"
Article description: "${article.description}"

Return this exact JSON structure:
{
  "relevanceScore": <0-100, how relevant to global supply chains>,
  "impactSeverity": <"critical"|"high"|"medium"|"low">,
  "affectedRegions": <array of affected regions from: ["Asia-Pacific","Middle East","Europe","Americas","Red Sea","Trans-Pacific"]>,
  "affectedLanes": <array of up to 3 specific shipping lanes affected>,
  "estimatedDelayDays": <number, estimated shipping delay in days, 0 if no delay>,
  "suppliersAtRisk": <array of supplier names from: ["Foxconn","TSMC","Samsung","LG Chem","Yanlord","Flextronics","Magna","BASF","Michelin","Dow Chemical","ArcelorMittal","Reliance Industries"]>,
  "recommendedAction": <string, one specific actionable recommendation under 20 words>,
  "forecastImpact": <string, one sentence on expected impact over next 30 days>
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown fences if present
    const clean = text.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);

    if (analysis.relevanceScore < 30) return null; // skip irrelevant articles

    return {
      ...article,
      ...analysis,
      analyzedAt: Date.now(),
      source_type: 'ai-analyzed',
    };

  } catch (err) {
    console.warn('[News] Gemini analysis failed for article:', err.message);
    return basicAnalysis(article);
  }
}

function basicAnalysis(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();

  // Keyword-based scoring
  const criticalKeywords = ['hormuz','houthi','red sea','war','sanctions','blockade','closure'];
  const highKeywords     = ['strike','typhoon','hurricane','congestion','shortage','delay','tariff'];
  const medKeywords      = ['tension','dispute','warning','elevated','concern','risk'];

  let severity = 'low';
  let score    = 20;

  if (criticalKeywords.some(k => text.includes(k))) { severity = 'critical'; score = 90; }
  else if (highKeywords.some(k => text.includes(k))) { severity = 'high';     score = 70; }
  else if (medKeywords.some(k => text.includes(k)))  { severity = 'medium';   score = 50; }

  if (score < 30) return null;

  const affectedRegions = SUPPLIER_REGIONS
    .filter(r => r.keywords.some(k => text.includes(k)))
    .map(r => r.name);

  return {
    ...article,
    relevanceScore:    score,
    impactSeverity:    severity,
    affectedRegions:   affectedRegions.length ? affectedRegions : ['Global'],
    affectedLanes:     [],
    estimatedDelayDays:severity === 'critical' ? 14 : severity === 'high' ? 7 : 2,
    suppliersAtRisk:   [],
    recommendedAction: 'Monitor situation closely and review contingency plans',
    forecastImpact:    'Continued monitoring required — impact assessment pending',
    analyzedAt:        Date.now(),
    source_type:       'keyword-analyzed',
  };
}

async function generateForecast() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

  // Build context from recent news
  const recentHeadlines = newsCache.slice(0, 10).map(n =>
    `- [${n.impactSeverity?.toUpperCase()}] ${n.title}`
  ).join('\n');

  if (!geminiKey || !recentHeadlines) {
    forecastCache = getStaticForecast();
    if (io) io.emit('forecast:update', forecastCache);
    return;
  }

  try {
    const prompt = `You are a global supply chain risk forecaster. Based on these recent news headlines, generate a 30-day supply chain disruption forecast. Return ONLY raw JSON, no markdown.

Recent headlines:
${recentHeadlines}

Return this exact JSON structure:
{
  "generatedAt": "${new Date().toISOString()}",
  "overallRiskLevel": <"critical"|"high"|"medium"|"low">,
  "summary": <2-3 sentence executive summary for a supply chain director>,
  "regions": [
    {
      "name": <region name>,
      "riskScore": <0-100>,
      "trend": <"rising"|"stable"|"falling">,
      "keyThreat": <main threat in under 10 words>,
      "timeframe": <"immediate"|"1-2 weeks"|"2-4 weeks"|"1-3 months">
    }
  ],
  "topThreats": [
    {
      "threat": <threat description under 15 words>,
      "probability": <0-100>,
      "impact": <"critical"|"high"|"medium">,
      "affectedLanes": <array of lane names>
    }
  ],
  "recommendations": [
    <up to 4 specific actionable recommendations as strings>
  ]
}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    forecastCache = JSON.parse(clean);
    if (io) io.emit('forecast:update', forecastCache);
    console.log('[News] Forecast updated via Gemini');

  } catch (err) {
    console.warn('[News] Forecast generation failed:', err.message);
    forecastCache = getStaticForecast();
    if (io) io.emit('forecast:update', forecastCache);
  }
}

function getStaticForecast() {
  return {
    generatedAt:      new Date().toISOString(),
    overallRiskLevel: 'high',
    summary:          'Elevated global supply chain risk driven by ongoing Red Sea / Strait of Hormuz tensions, persistent port congestion in Asia-Pacific, and labor action risk in North America. Freight rates remain elevated. Recommend 4-week buffer stock on critical components.',
    regions: [
      { name:'Middle East / Hormuz', riskScore:91, trend:'rising',  keyThreat:'Strait of Hormuz closure risk',     timeframe:'immediate'   },
      { name:'Red Sea / Suez',       riskScore:88, trend:'stable',  keyThreat:'Houthi attacks — Cape rerouting',  timeframe:'immediate'   },
      { name:'Asia-Pacific',         riskScore:74, trend:'rising',  keyThreat:'Port congestion + typhoon season', timeframe:'1-2 weeks'   },
      { name:'Europe',               riskScore:42, trend:'stable',  keyThreat:'Energy costs + labor pressure',    timeframe:'2-4 weeks'   },
      { name:'Americas',             riskScore:38, trend:'stable',  keyThreat:'UAW negotiations + hurricane season',timeframe:'2-4 weeks' },
    ],
    topThreats: [
      { threat:'Strait of Hormuz closure — Iran escalation',  probability:34, impact:'critical', affectedLanes:['Persian Gulf → Asia','Persian Gulf → Europe'] },
      { threat:'Red Sea attacks — extended Cape rerouting',    probability:89, impact:'high',     affectedLanes:['Asia → Europe','Asia → US East Coast'] },
      { threat:'Taiwan Strait tension — semiconductor supply', probability:28, impact:'critical', affectedLanes:['Taiwan → US','Taiwan → Europe'] },
      { threat:'US West Coast labor action — port slowdown',   probability:41, impact:'high',     affectedLanes:['Asia → USLAX','Asia → USSEA'] },
    ],
    recommendations: [
      'Elevate buffer stock on Middle East-sourced components to 6 weeks immediately',
      'Activate Cape of Good Hope routing for all Asia-Europe shipments',
      'Review Taiwan supplier concentration — identify secondary sources for critical chips',
      'Pre-book container capacity for Q4 before rate spike',
    ],
  };
}

function getStaticNews() {
  const now = Date.now();
  return [
    { id:'static-001', ts:now-300000, title:'Strait of Hormuz: Iran warns of closure amid escalating tensions', description:'Iranian officials have issued warnings regarding potential closure of the Strait of Hormuz. 21 million barrels of oil transit daily.', source:'Reuters', url:'#', publishedAt:new Date(now-300000).toISOString(), relevanceScore:95, impactSeverity:'critical', affectedRegions:['Middle East','Asia-Pacific','Europe'], affectedLanes:['Persian Gulf → Asia','Persian Gulf → Europe'], estimatedDelayDays:21, suppliersAtRisk:['Reliance Industries','BASF SE'], recommendedAction:'Elevate buffer stock on Middle East-sourced components to 6 weeks immediately', forecastImpact:'Closure would remove 20% of global oil supply within 48 hours', source_type:'curated' },
    { id:'static-002', ts:now-900000, title:'Red Sea attacks force 94% of Asia-Europe container traffic via Cape of Good Hope', description:'Houthi attacks continue to force major carriers to reroute via Cape of Good Hope, adding 12-14 days and driving spot rates up 340%.', source:"Lloyd's List", url:'#', publishedAt:new Date(now-900000).toISOString(), relevanceScore:92, impactSeverity:'critical', affectedRegions:['Red Sea','Europe','Asia-Pacific'], affectedLanes:['Asia → Europe','Asia → US East Coast'], estimatedDelayDays:14, suppliersAtRisk:['BASF SE','ArcelorMittal','Michelin Tire Mfg'], recommendedAction:'Activate Cape of Good Hope routing for all Asia-Europe shipments now', forecastImpact:'Rates expected to remain elevated through Q1 next year', source_type:'curated' },
    { id:'static-003', ts:now-1800000, title:'Port of Shanghai berth utilization hits 112% — 23 vessels at anchor', description:'Record congestion at Shanghai with average vessel wait times reaching 4.2 days.', source:'FreightWaves', url:'#', publishedAt:new Date(now-1800000).toISOString(), relevanceScore:85, impactSeverity:'high', affectedRegions:['Asia-Pacific'], affectedLanes:['CNSHA → USLAX','CNSHA → NLRTM'], estimatedDelayDays:5, suppliersAtRisk:['Foxconn Electronics','TSMC Fab 5','Yanlord Logistics'], recommendedAction:'Reroute urgent shipments via Ningbo or Qingdao to avoid Shanghai congestion', forecastImpact:'Congestion expected to persist 3-4 weeks', source_type:'curated' },
    { id:'static-004', ts:now-3600000, title:'Taiwan Strait tensions: US-China military exercises raise semiconductor supply fears', description:'Escalating military activity in the Taiwan Strait raises concerns. TSMC produces 90% of advanced chips globally.', source:'Bloomberg', url:'#', publishedAt:new Date(now-3600000).toISOString(), relevanceScore:90, impactSeverity:'critical', affectedRegions:['Asia-Pacific','Americas','Europe'], affectedLanes:['Taiwan → US','Taiwan → Europe'], estimatedDelayDays:30, suppliersAtRisk:['TSMC Fab 5','Samsung Semiconductor','LG Chem Battery'], recommendedAction:'Review Taiwan supplier concentration and identify alternative chip sources immediately', forecastImpact:'Any disruption cascades through global tech supply chains within 30 days', source_type:'curated' },
    { id:'static-005', ts:now-7200000, title:'UAW contract negotiations stall — strike probability rises to 61% at Magna facilities', description:'United Auto Workers negotiations with Magna International have stalled. Strike authorization vote scheduled for next week.', source:'Automotive News', url:'#', publishedAt:new Date(now-7200000).toISOString(), relevanceScore:78, impactSeverity:'high', affectedRegions:['Americas'], affectedLanes:['Ontario → US Midwest'], estimatedDelayDays:14, suppliersAtRisk:["Magna Int'l"], recommendedAction:'Request 8-week buffer stock from Magna by end of month', forecastImpact:'Work stoppage would impact North American auto production within 2 weeks', source_type:'curated' },
    { id:'static-006', ts:now-10800000, title:'NOAA upgrades hurricane season forecast — Gulf Coast facilities at elevated risk', description:'NOAA 2024 Atlantic hurricane season upgraded to extremely active with 19 named storms predicted.', source:'NOAA', url:'#', publishedAt:new Date(now-10800000).toISOString(), relevanceScore:72, impactSeverity:'high', affectedRegions:['Americas'], affectedLanes:['US Gulf → US Midwest'], estimatedDelayDays:7, suppliersAtRisk:['Dow Chemical'], recommendedAction:'Pre-position chemical feedstock inventory at inland DCs ahead of hurricane season', forecastImpact:'Each major hurricane landfall could disrupt Gulf Coast chemical supply for 2-4 weeks', source_type:'curated' },
  ];
}

function registerNewsRoutes(app) {
  app.get('/api/news', (req, res) => {
    try { res.json(newsCache.length ? newsCache : getStaticNews()); }
    catch(err) { res.json(getStaticNews()); }
  });
  app.get('/api/forecast', (req, res) => {
    try { res.json(forecastCache || getStaticForecast()); }
    catch(err) { res.json(getStaticForecast()); }
  });
}

module.exports = { initNews, registerNewsRoutes };
