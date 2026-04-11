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

function registerNewsRoutes(app) {
app.get('/api/news', (req, res) => res.json(newsCache.length ? newsCache : getStaticNews()));
  app.get('/api/forecast', (req, res) => res.json(forecastCache || getStaticForecast()));
}

module.exports = { initNews, registerNewsRoutes };
