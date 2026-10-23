import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHandler, fold, publicRecord, findMatches } from '../src/core.mjs';
const HTML = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const env = { NOTION_API_TOKEN: 'synthetic-test-credential' };
const prop = (type, value) => type === 'select' ? { type, select: { name: value } } : { type, [type]: [{ plain_text: value }] };
function page(n, title = '10 Đường Mẫu, Quận 1', district = 'Quận 1') {
  return { object: 'page', id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, archived: false, in_trash: false,
    public_url: `https://example.notion.site/asset-${n}`, properties: {
      Name: prop('title', title), 'Tên đường': prop('rich_text', 'Đường Mẫu'),
      'Quận cũ': prop('select', district), 'Phường hiện hành': prop('rich_text', 'Phường Mẫu'), 'Tình trạng': prop('select', 'Đang bán'),
      'private-note': prop('rich_text', 'DO NOT EXPOSE') } };
}
const result = (rows, more = false, cursor = null) => Response.json({ results: rows, has_more: more, next_cursor: cursor });
const req = q => new Request('https://widget.example/api/search?q=' + encodeURIComponent(q));
const make = fetcher => createHandler(HTML, { fetcher, sleep: async () => {} });
test('Vietnamese diacritic folding preserves street numbers', () => { assert.equal(fold('Đường 69A — Bình Phú'), 'duong 69a binh phu'); });
test('unpublished, archived and unsafe URLs are excluded', () => {
  for (const change of [{ public_url: null }, { archived: true }, { in_trash: true }, { public_url: 'javascript:alert(1)' }, { public_url: 'https://evil.test' }, { public_url: 'https://notion.site.evil.test' }, { public_url: 'http://example.notion.site/a' }]) assert.equal(publicRecord({ ...page(1), ...change }), null);
});
test('no authenticated URL fallback for unpublished records', () => { assert.equal(publicRecord({ ...page(1), public_url: null, url: 'https://notion.so/private' }), null); });
test('allows approved custom domain URLs', () => { assert.equal(publicRecord({ ...page(1), public_url: 'https://www.dulieunhapho.com/asset' }).url, 'https://www.dulieunhapho.com/asset'); });
test('a search supports accents and no accents', () => { const rows = [publicRecord(page(1))]; assert.equal(findMatches(rows, 'duong mau').total, 1); assert.equal(findMatches(rows, 'đường mẫu').total, 1); });
test('Q1/Quận 1 does not return Quận 10', () => {
  const rows = [publicRecord(page(1)), publicRecord(page(2, '10 Đường Mẫu, Quận 10', 'Quận 10'))];
  assert.equal(findMatches(rows, 'quan 1').total, 1); assert.equal(findMatches(rows, 'q1').total, 1);
});
test('preview has fixed allowlist and opens public URL', () => {
  const item = findMatches([publicRecord(page(1))], 'mau').items[0];
  assert.deepEqual(Object.keys(item), ['id', 'title', 'url', 'district', 'status']); assert(!JSON.stringify(item).includes('DO NOT EXPOSE'));
});
test('result list is limited without losing total count', () => { const data = findMatches(Array.from({length: 20}, (_, n) => publicRecord(page(n + 1))), 'mau'); assert.equal(data.total, 20); assert.equal(data.items.length, 12); assert.equal(data.hasMore, true); });
test('HTML is served without credentials and is embeddable', async () => {
  const response = await make(() => { throw Error(); }).fetch(new Request('https://widget.example/'), env);
  assert.equal(response.status, 200); assert(response.headers.get('content-security-policy').includes('frame-ancestors *')); assert(!(await response.text()).includes(env.NOTION_API_TOKEN));
});
test('only GET is accepted; no mutation endpoint', async () => { const response = await make(() => {}).fetch(new Request('https://widget.example/api/search', { method: 'POST' }), env); assert.equal(response.status, 405); });
test('missing secret fails closed with generic error', async () => { const response = await make(() => { throw Error(); }).fetch(req('mau')); assert.equal(response.status, 503); assert(!(await response.text()).includes('NOTION_API_TOKEN')); });
test('empty query does not call Notion', async () => { let calls = 0; const response = await make(() => { calls++; }).fetch(req('')); assert.equal(response.status, 200); assert.equal(calls, 0); });
test('rejects overly long query', async () => { assert.equal((await make(() => {}).fetch(req('a'.repeat(101)), env)).status, 400); });
test('pagination uses exact data source and selected property names', async () => {
  const requests = [];
  const handler = make(async (url, options) => { requests.push([url, options]); return requests.length === 1 ? result([page(1)], true, 'next') : result([page(2)]); });
  const response = await handler.fetch(req('mau'), env); const body = await response.json();
  assert.equal(body.total, 2); assert.equal(requests.length, 2);
  assert.equal(requests[0][0].pathname, '/v1/data_sources/38f6bd68-5348-8029-b8a2-000b30978089/query');
  assert.deepEqual(requests[0][0].searchParams.getAll('filter_properties'), ['Name', 'Tên đường', 'Quận cũ', 'Phường hiện hành', 'Tình trạng']);
  assert.equal(JSON.parse(requests[1][1].body).start_cursor, 'next'); assert.equal(requests[0][1].headers['Notion-Version'], '2026-03-11'); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('shared index avoids duplicate API calls across concurrent searches', async () => {
  let calls = 0; const handler = make(async () => { calls++; await new Promise(r => setTimeout(r, 5)); return result([page(1)]); });
  await Promise.all([handler.fetch(req('mau'), env), handler.fetch(req('duong'), env)]); assert.equal(calls, 1);
});
test('index expires and re-reads changed data, not a static snapshot', async () => {
  let time = 100_000, calls = 0;
  const handler = createHandler(HTML, { now: () => time, sleep: async () => {}, fetcher: async () => result([page(++calls)]) });
  assert.equal((await (await handler.fetch(req('mau'), env)).json()).items[0].id, page(1).id);
  time += 119_000; await handler.fetch(req('mau'), env); assert.equal(calls, 1);
  time += 1001; assert.equal((await (await handler.fetch(req('mau'), env)).json()).items[0].id, page(2).id); assert.equal(calls, 2);
});
test('token rotation invalidates old memory cache', async () => { let calls = 0; const handler = make(async () => { calls++; return result([page(calls)]); }); await handler.fetch(req('mau'), env); await handler.fetch(req('mau'), { NOTION_API_TOKEN: 'second-synthetic-test-credential' }); assert.equal(calls, 2); });
test('upstream auth errors do not leak credentials or upstream body', async () => {
  const response = await make(async () => new Response('sensitive upstream detail', { status: 401 })).fetch(req('mau'), env);
  const body = await response.text(); assert.equal(response.status, 503); assert(!body.includes('sensitive')); assert(!body.includes(env.NOTION_API_TOKEN));
});
test('does not serve stale public records after failed refresh', async () => {
  let time = 100_000, calls = 0;
  const handler = createHandler(HTML, { now: () => time, sleep: async () => {}, fetcher: async () => ++calls === 1 ? result([page(1)]) : new Response('', {status: 500}) });
  await handler.fetch(req('mau'), env); time += 120_001; const response = await handler.fetch(req('mau'), env); assert.equal(response.status, 503); assert(!(await response.text()).includes(page(1).id));
});
test('rate-limit response is retried once then succeeds', async () => { let calls = 0; const handler = make(async () => ++calls === 1 ? new Response('', {status: 429, headers: {'Retry-After':'1'}}) : result([page(1)])); assert.equal((await handler.fetch(req('mau'), env)).status, 200); assert.equal(calls, 2); });
test('incomplete query is rejected rather than cached as complete', async () => { const response = await make(async () => Response.json({results: [page(1)], request_status:{type:'incomplete'}, has_more:false})).fetch(req('mau'), env); assert.equal(response.status, 503); });
test('invalid pagination fails closed', async () => { assert.equal((await make(async () => result([page(1)], true, null)).fetch(req('mau'), env)).status, 503); });
test('search limit is enforced', async () => { const handler = make(async () => result([page(1)])); for(let i=0;i<40;i++) assert.equal((await handler.fetch(req('mau'), env)).status, 200); assert.equal((await handler.fetch(req('mau'), env)).status, 429); });
test('no private page is included in live index output', async () => { const handler = make(async () => result([page(1),{...page(2),public_url:null}])); const data = await (await handler.fetch(req('mau'), env)).json(); assert.equal(data.total, 1); });
test('shared KV index makes fresh search independent of upstream latency', async () => {
  const time = 1_000_000;
  const kv = { get: async () => ({sourceId:'38f6bd68-5348-8029-b8a2-000b30978089',rows:[publicRecord(page(1))],fetchedAt:time-30_000}) };
  const handler = createHandler(HTML,{now:()=>time,fetcher:async()=>{throw Error('must not fetch')}});
  const response = await handler.fetch(req('mau'),{...env,SEARCH_CACHE:kv}); assert.equal(response.status,200); assert.equal((await response.json()).total,1);
});
test('cache grace period returns promptly while refreshing in background', async () => {
  const time = 1_000_000; let calls=0,writes=0;const tasks=[];
  const kv={get:async()=>({sourceId:'38f6bd68-5348-8029-b8a2-000b30978089',rows:[publicRecord(page(1))],fetchedAt:time-130_000}),put:async()=>{writes++}};
  const handler=createHandler(HTML,{now:()=>time,sleep:async()=>{},fetcher:async()=>{calls++;return result([page(2)])}});
  const data=await(await handler.fetch(req('mau'),{...env,SEARCH_CACHE:kv},{waitUntil:p=>tasks.push(p)})).json();assert.equal(data.items[0].id,page(1).id);await Promise.all(tasks);assert.equal(calls,1);assert.equal(writes,1);
});
test('KV cache older than three minutes is never returned', async()=>{
 const time=1_000_000;const kv={get:async()=>({sourceId:'38f6bd68-5348-8029-b8a2-000b30978089',rows:[publicRecord(page(1))],fetchedAt:time-181_000}),put:async()=>{}};
 const handler=createHandler(HTML,{now:()=>time,sleep:async()=>{},fetcher:async()=>new Response('',{status:500})});
 const response=await handler.fetch(req('mau'),{...env,SEARCH_CACHE:kv},{waitUntil:()=>{}});assert.equal(response.status,503);
});
test('scheduled refresh writes only the curated public index',async()=>{
 let stored;const kv={put:async(key,value,options)=>{stored={key,value,options}}};const handler=make(async()=>result([page(1),{...page(2),public_url:null}]));
 await handler.scheduled({}, {...env,SEARCH_CACHE:kv}, {waitUntil:()=>{}});const parsed=JSON.parse(stored.value);assert.equal(parsed.rows.length,1);assert(!stored.value.includes('DO NOT EXPOSE'));assert(!stored.value.includes(env.NOTION_API_TOKEN));assert.equal(stored.options.expirationTtl,600);
});

function addressPage(n, title, ward, district = 'Tân Bình', road = 'Hoàng Văn Thụ') {
 const row = page(n, title, district);
 row.properties['Tên đường'] = prop('rich_text', road);
 row.properties['Phường hiện hành'] = prop('rich_text', ward);
 return publicRecord(row);
}
test('missing first letter in street name is tolerated; exact ranks first',()=>{
 const rows=[addressPage(1,'128 Hoàng Văn Thụ','Tân Sơn Hòa'),addressPage(2,'128 Oàng Văn Thụ','Tân Sơn Hòa')];
 const found=findMatches(rows,'128 oàng văn thụ');assert.equal(found.total,2);assert.equal(found.items[0].id,rows[1].id);
});
test('p/p./phường aliases match current named ward with accents or not',()=>{
 const rows=[addressPage(1,'128 Hoàng Văn Thụ','Phường Tân Sơn Hòa')];
 for(const q of ['p tan son hoa','p. tân sơn hòa','phường tân sơn hoà','128 oàng văn thụ, p tân sơn hòa','p tan son ha'])assert.equal(findMatches(rows,q).total,1,q);
});
test('numeric ward aliases are exact and cannot match district or house number',()=>{
 const rows=[addressPage(1,'128 Hoàng Văn Thụ','Phường 9'),addressPage(2,'129 Hoàng Văn Thụ','Phường 19'),addressPage(3,'9 Hoàng Văn Thụ','Tân Sơn Hòa','Quận 9')];
 for(const q of ['p9','p.9','p 9','phường 9','phường 09']){const r=findMatches(rows,q);assert.equal(r.total,1,q);assert.equal(r.items[0].id,rows[0].id);}
});
test('numeric house numbers do not prefix-match or fuzzy-match',()=>{
 const rows=[addressPage(1,'128 Hoàng Văn Thụ','Tân Sơn Hòa'),addressPage(2,'1280 Hoàng Văn Thụ','Tân Sơn Hòa'),addressPage(3,'129 Hoàng Văn Thụ','Tân Sơn Hòa')];
 assert.equal(findMatches(rows,'128 oang van thu').total,1);assert.equal(findMatches(rows,'127 hoang van thu').total,0);
});
test('ward filter never inferred from title, nearby street or old ward',()=>{
 const rows=[addressPage(1,'128 Hoàng Văn Thụ, Phường 9','Tân Sơn Hòa'),addressPage(2,'129 Hoàng Văn Thụ','')];
 assert.equal(findMatches(rows,'p9').total,0);assert.equal(findMatches(rows,'phường tân sơn hòa').total,1);
});
test('combined query enforces street, current ward and district',()=>{
 const rows=[addressPage(1,'128 Hoàng Văn Thụ','Tân Sơn Hòa'),addressPage(2,'128 Hoàng Văn Thụ','Bảy Hiền'),addressPage(3,'128 Hoàng Văn Thụ','Tân Sơn Hòa','Quận 1')];
 const r=findMatches(rows,'128 oang van thu p tan son hoa q tan binh');assert.equal(r.total,1);assert.equal(r.items[0].id,rows[0].id);
});
test('transposition typo works but unrelated and overly vague words fail',()=>{
 const rows=[addressPage(1,'128 Hoàng Văn Thụ','Tân Sơn Hòa')];
 assert.equal(findMatches(rows,'128 haong van thu').total,1);assert.equal(findMatches(rows,'zzzzzzzz').total,0);assert.equal(findMatches(rows,'ha').total,0);assert.equal(findMatches(rows,'128 0ang van thu').total,0);
});
