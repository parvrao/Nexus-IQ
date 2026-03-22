const BASE = import.meta.env.VITE_API_URL || '';

export async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function post(path, body={}) {
  const res = await fetch(`${BASE}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  stats:       ()        => get('/api/stats'),
  suppliers:   ()        => get('/api/suppliers'),
  alerts:      ()        => get('/api/alerts'),
  feed:        ()        => get('/api/feed'),
  sources:     ()        => get('/api/sources'),
  timeline:    ()        => get('/api/timeline'),
  scenario:    (p,c)     => get(`/api/scenario?port=${p}&capacity=${c}`),
  acknowledge: id        => post(`/api/alerts/${id}/acknowledge`),
  liveVessels: ()        => get('/api/live/vessels'),
  liveAircraft:()        => get('/api/live/aircraft'),
  liveGround:  ()        => get('/api/live/ground'),
  liveSummary: ()        => get('/api/live/summary'),
};
