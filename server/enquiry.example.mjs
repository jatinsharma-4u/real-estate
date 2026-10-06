// Minimal reference endpoint for the lead form (Node 18+, no dependencies).  Run: node server/enquiry.example.mjs
// Put it behind your real stack (or port it to your CRM webhook / serverless function). It shows the checks the
// client cannot be trusted with: validation, honeypot, timing, per-IP rate limiting, size limits.
import http from 'node:http';

const PORT = process.env.PORT || 8787;
const hits = new Map();                       // ip -> [timestamps]
const LIMIT = 5, WINDOW_MS = 10 * 60 * 1000;  // 5 enquiries / 10 minutes / IP

const phoneOk = (v) => { const d = String(v).replace(/\D/g, ''); return (d.length >= 10 && d.length <= 15); };
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v));

http.createServer((req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': process.env.ALLOW_ORIGIN || '*', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') return send(204, {});
  if (req.method !== 'POST' || req.url !== '/api/enquiry') return send(404, { error: 'not found' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return send(429, { error: 'rate limited' });

  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 20_000) req.destroy(); });
  req.on('end', () => {
    let d; try { d = JSON.parse(body); } catch { return send(400, { error: 'bad json' }); }
    if (d.company_website) return send(200, { ok: true });                 // honeypot: pretend success, store nothing
    if (!d.name || String(d.name).length < 2 || !phoneOk(d.phone) || !emailOk(d.email)) return send(422, { error: 'invalid' });
    if (now - Number(d.ts || 0) < 1200) return send(200, { ok: true });    // too fast to be human
    recent.push(now); hits.set(ip, recent);
    console.log('LEAD', { name: d.name, phone: d.phone, email: d.email, type: d.propertyType, budget: d.budget, visit: d.visitDate, source: d.source });
    // TODO: push to CRM / email / sheet here
    send(200, { ok: true });
  });
}).listen(PORT, () => console.log(`enquiry endpoint on :${PORT}`));
