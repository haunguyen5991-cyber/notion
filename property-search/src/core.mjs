const SOURCE_ID = '38f6bd68-5348-8029-b8a2-000b30978089';
const FIELDS = ['Name', 'Tên đường', 'Quận cũ', 'Phường hiện hành', 'Tình trạng', 'Giá bán (đ)', 'Cấp hiển thị', 'Ngày bắt đầu gói', 'Ngày hết hạn gói'];
const TTL = 120_000;
const STALE_LIMIT = 180_000;
const CACHE_KEY = "published-search-index:v3";
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors *";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function fold(value = '') {
  return String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/đ/g, 'd').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
// Normalize only address labels, never infer a ward or rewrite source data.
export function normalizeAddress(value = '') {
  return fold(value).replace(/\b([pq])(?=\d)/g, '$1 ')
    .replace(/\bp\b/g, 'phuong').replace(/\bq\b/g, 'quan')
    .replace(/\b(phuong|quan)\s+0+(\d)/g, '$1 $2');
}
function oneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return i + 1 < a.length && a[i] === b[i + 1] && a[i + 1] === b[i]
      && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
function scopedQuery(query) {
  const groups = { general: [], ward: [], district: [] };
  let scope = 'general';
  for (const token of normalizeAddress(query).split(' ').filter(Boolean)) {
    if (token === 'phuong') scope = 'ward';
    else if (token === 'quan') scope = 'district';
    else groups[scope].push(token);
  }
  return groups;
}
function groupScore(tokens, words) {
  if (!tokens.length) return { edits: 0, shortEdits: 0, anchors: 0 };
  const unmatched = []; let anchors = 0;
  for (const token of tokens) {
    const numeric = /\d/.test(token);
    if (words.some(word => numeric ? word === token : word.startsWith(token))) {
      if (numeric || token.length >= 3) anchors++;
    } else unmatched.push(token);
  }
  let edits = 0, shortEdits = 0;
  for (const token of unmatched) {
    // Numbers and mixed letter-number identifiers must match exactly.
    if (/\d/.test(token) || token.length < 2 || !words.some(word => !/\d/.test(word) && word.length >= 2 && oneEdit(token, word))) return null;
    edits++; if (token.length < 4) shortEdits++;
  }
  return { edits, shortEdits, anchors };
}
function text(property) {
  if (!property) return '';
  if (property.type === 'select') return property.select?.name || '';
  return (property.title || property.rich_text || []).map(t => t.plain_text ?? t.text?.content ?? '').join('');
}
function publishedUrl(value) {
  try {
    const u = new URL(value);
    const host = u.hostname;
    const allowed = ['notion.site', 'notion.so', 'app.notion.com', 'dulieunhapho.com', 'www.dulieunhapho.com'];
    if (u.protocol !== 'https:' || u.username || u.password || !allowed.some(h => host === h || (h === 'notion.site' && host.endsWith('.notion.site')))) return null;
    return u.href;
  } catch { return null; }
}
export function publicRecord(page) {
  if (page.object !== 'page' || page.archived || page.in_trash || !uuid.test(page.id || '')) return null;
  // Publishing is an explicit gate. Never fall back to the authenticated `url`.
  const url = publishedUrl(page.public_url);
  if (!url) return null;
  const p = page.properties || {};
  const title = text(p.Name).trim();
  if (!title) return null;
  const road = text(p['Tên đường']);
  const district = text(p['Quận cũ']);
  const ward = text(p['Phường hiện hành']);
  const status = text(p['Tình trạng']);
  const d = normalizeAddress(district);
  const search = normalizeAddress([title, road, district, ward].join(' '));
  return { id: page.id, title, url, district, status, search,
    words: search.split(' '), nameKey: normalizeAddress(title), roadKey: normalizeAddress(road), districtKey: d,
    wardKey: normalizeAddress(ward).replace(/^phuong\s+/, ''),
    price: Number.isFinite(p['Giá bán (đ)']?.number) && p['Giá bán (đ)'].number > 0 ? p['Giá bán (đ)'].number : null,
    tier: text(p['Cấp hiển thị']), packageStart: p['Ngày bắt đầu gói']?.date?.start || null, packageEnd: p['Ngày hết hạn gói']?.date?.start || null };
}
export function findMatches(records, query, limit = 12) {
  const q = normalizeAddress(query), groups = scopedQuery(query);
  if (![...groups.general, ...groups.ward, ...groups.district].length) return { items: [], total: 0, hasMore: false };
  const found = [];
  const wardMemo = new Map(), districtMemo = new Map();
  const zero = { edits: 0, shortEdits: 0, anchors: 0 };
  for (const item of records) {
    const general = groups.general.length ? groupScore(groups.general, item.words || item.search.split(' ')) : zero;
    if (general === null) continue;
    let ward = zero, district = zero;
    if (groups.ward.length) {
      const key = item.wardKey || '';
      if (!wardMemo.has(key)) wardMemo.set(key, groupScore(groups.ward, key.split(' ')));
      ward = wardMemo.get(key); if (ward === null) continue;
    }
    if (groups.district.length) {
      const key = item.districtKey;
      if (!districtMemo.has(key)) districtMemo.set(key, groupScore(groups.district, key.replace(/^quan\s+/, '').split(' ')));
      district = districtMemo.get(key); if (district === null) continue;
    }
    const scores = [general, ward, district];
    const edits = scores.reduce((n, x) => n + x.edits, 0);
    const anchors = scores.reduce((n, x) => n + x.anchors, 0);
    const shortEdits = scores.reduce((n, x) => n + x.shortEdits, 0);
    // Bounded typo tolerance: at most two tokens, short words need context.
    if (edits > 2 || (shortEdits && anchors < 2)) continue;
    const rank = item.nameKey === q ? 0 : item.nameKey.startsWith(q) ? 1 : item.nameKey.includes(q) ? 2 : item.roadKey.startsWith(q) ? 3 : 4;
    found.push({ item, score: edits * 100 + rank });
  }
  found.sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title, 'vi', { numeric: true }));
  // Send only a fixed allowlist. Ward keys and matching internals stay server-side.
  const items = found.slice(0, limit).map(({ item: { id, title, url, district, status } }) => ({ id, title, url, district, status }));
  return { items, total: found.length, hasMore: found.length > limit };
}

function packageTime(value) {
  if (typeof value !== 'string') return NaN;
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00+07:00' : value);
}
export function featuredRank(item, at = Date.now()) {
  if (item.status !== 'Đang bán') return 4;
  const start = packageTime(item.packageStart), end = packageTime(item.packageEnd);
  if (!Number.isFinite(end) || at >= end || (Number.isFinite(start) && at < start)) return 4;
  if (item.tier === 'Premier') {
    if (!Number.isFinite(start) || end <= start) return 4;
    return at < start + 7 * 86400000 ? 1 : 2;
  }
  if (item.tier === 'Signature') return 2;
  if (item.tier === 'Priority') return 3;
  return 4;
}
export function findFeatured(records, at = Date.now()) {
  const eligible = records.map(item => ({ item, rank: featuredRank(item, at) }))
    .filter(({ item, rank }) => rank < 4 && publishedUrl(item.url));
  eligible.sort((a, b) => a.rank - b.rank || a.item.title.localeCompare(b.item.title, 'vi', { numeric: true }));
  return { items: eligible.slice(0, 3).map(({ item: { id, title, url, district, status, price } }) => ({ id, title, url, district, status, price })), mode: 'featured' };
}
class SearchError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
export function createHandler(html, deps = {}) {
  const fetcher = deps.fetcher || globalThis.fetch;
  const now = deps.now || Date.now;
  const sleep = deps.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  let cached = null;
  let pending = null;
  let tokenInUse;
  let notBefore = 0;
  const clients = new Map();
  async function pageRequest(env, body) {
    const target = new URL(`https://api.notion.com/v1/data_sources/${SOURCE_ID}/query`);
    for (const name of FIELDS) target.searchParams.append('filter_properties', name);
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(Math.max(0, notBefore - now()));
      notBefore = now() + 400;
      let response;
      try {
        response = await fetcher(target, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.NOTION_API_TOKEN}`, 'Notion-Version': '2026-03-11', 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: AbortSignal.timeout(15_000)
        });
      } catch { throw new SearchError('upstream_unavailable'); }
      if (response.status === 429 && attempt < 2) {
        const retry = Number(response.headers.get('Retry-After'));
        await response.body?.cancel();
        await sleep(Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1000, 5000) : 1500);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new SearchError([401, 403, 404].includes(response.status) ? 'source_access' : 'upstream_unavailable');
      }
      let data;
      try { data = await response.json(); } catch { throw new SearchError('invalid_response'); }
      if (!Array.isArray(data.results) || (data.request_status && data.request_status.type !== 'complete')) throw new SearchError('incomplete_response');
      return data;
    }
    throw new SearchError('upstream_busy');
  }
  async function load(env) {
    const rows = [];
    const seen = new Set();
    let cursor;
    for (let page = 0; page < 30; page++) {
      const body = { page_size: 100, is_archived: false };
      if (cursor) body.start_cursor = cursor;
      const data = await pageRequest(env, body);
      for (const row of data.results) { const item = publicRecord(row); if (item) rows.push(item); }
      if (!data.has_more) return { rows, fetchedAt: now() };
      if (!data.next_cursor || seen.has(data.next_cursor)) throw new SearchError('invalid_pagination');
      cursor = data.next_cursor;
      seen.add(cursor);
    }
    // Fail closed rather than silently returning a truncated inventory.
    throw new SearchError('source_limit');
  }
  function prepare(env) {
    if (tokenInUse !== env.NOTION_API_TOKEN) {
      tokenInUse = env.NOTION_API_TOKEN;
      cached = null;
      pending = null;
    }
  }
  function refresh(env, ctx) {
    prepare(env);
    if (!pending) {
      const thisToken = env.NOTION_API_TOKEN;
      const work = (async () => {
        try {
          const result = await load(env);
          if (tokenInUse === thisToken) cached = result;
          if (env.SEARCH_CACHE) {
            try { await env.SEARCH_CACHE.put(CACHE_KEY, JSON.stringify({ ...result, sourceId: SOURCE_ID }), { expirationTtl: 600 }); }
            catch { console.warn('property-search: cache_write'); }
          }
          return result;
        } finally {
          if (pending === work) pending = null;
        }
      })();
      pending = work;
      ctx?.waitUntil?.(work.catch(() => {}));
    }
    return pending;
  }
  async function index(env, ctx) {
    prepare(env);
    if (cached && now() - cached.fetchedAt < TTL) return cached;
    if (env.SEARCH_CACHE) {
      try {
        const stored = await env.SEARCH_CACHE.get(CACHE_KEY, 'json');
        const valid = stored && stored.sourceId === SOURCE_ID && Number.isFinite(stored.fetchedAt)
          && stored.fetchedAt <= now() && Array.isArray(stored.rows)
          && stored.rows.every(r => typeof r.title === 'string' && typeof r.search === 'string' && typeof r.nameKey === 'string' && typeof r.roadKey === 'string' && typeof r.districtKey === 'string' && typeof r.wardKey === 'string' && publishedUrl(r.url));
        if (valid && now() - stored.fetchedAt < TTL) { cached = stored; return stored; }
        // A short grace period avoids blocking while the scheduled refresh completes.
        // Never serve a cache older than three minutes.
        if (valid && now() - stored.fetchedAt < STALE_LIMIT && ctx?.waitUntil) {
          refresh(env, ctx);
          return stored;
        }
      } catch { console.warn('property-search: cache_read'); }
    }
    return refresh(env, ctx);
  }
  function json(body, status = 200, extra = {}) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra } });
  }
  function permitted(request) {
    const key = request.headers.get('CF-Connecting-IP') || 'local';
    const t = now();
    if (clients.size >= 2048) for (const [ip, value] of clients) if (value.until <= t) clients.delete(ip);
    if (!clients.has(key) && clients.size >= 2048) return false;
    const value = clients.get(key);
    if (!value || value.until <= t) { clients.set(key, { until: t + 60_000, count: 1 }); return true; }
    return ++value.count <= 40;
  }
  return {
    async scheduled(_controller, env, ctx) {
      if (!env.NOTION_API_TOKEN || !env.SEARCH_CACHE) return;
      await refresh(env, ctx);
    },
    async fetch(request, env = {}, ctx) {
      const url = new URL(request.url);
      if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' } });
      }
      const featured = url.pathname === '/api/featured';
      if (url.pathname !== '/api/search' && !featured) return json({ error: 'not_found' }, 404);
      if (!permitted(request)) return json({ error: 'busy', message: 'Bạn tìm quá nhanh. Vui lòng thử lại sau ít phút.' }, 429, { 'Retry-After': '60' });
      const q = (url.searchParams.get('q') || '').trim();
      if (q.length > 100) return json({ error: 'invalid_query' }, 400);
      if (!featured && fold(q).length < 2) return json({ items: [], total: 0, hasMore: false, minLength: 2 });
      if (!env.NOTION_API_TOKEN) return json({ error: 'unavailable', message: 'Chưa thể tải kết quả. Vui lòng thử lại sau.' }, 503);
      try {
        const data = await index(env, ctx);
        return json({ ...(featured ? findFeatured(data.rows, now()) : findMatches(data.rows, q)), updatedAt: new Date(data.fetchedAt).toISOString(), refreshSeconds: 120 });
      } catch (error) {
        // Do not log request headers, token, query text or raw Notion response.
        console.warn('property-search:', error instanceof SearchError ? error.code : 'unexpected');
        return json({ error: 'unavailable', code: error instanceof SearchError ? error.code : 'unexpected', message: 'Chưa thể tải kết quả. Vui lòng thử lại sau.' }, 503);
      }
    }
  };
}
