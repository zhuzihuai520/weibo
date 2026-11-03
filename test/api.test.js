'use strict';

/**
 * 本地测试：验证 /api/generate 的核心处理逻辑（不实际请求微博，SUB 无效时无法真实调用）。
 * 运行：node test/api.test.js
 */

const path = require('path');
const handler = require(path.join(__dirname, '..', 'api', 'generate.js'));

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader() {},
  };
}

async function run(name, req, fetchImpl, env) {
  const saved = { fetch: global.fetch, SUB: process.env.SUB, UID: process.env.UID };
  global.fetch = fetchImpl;
  process.env.SUB = env.SUB;
  process.env.UID = env.UID;
  const res = mockRes();
  let err = null;
  try {
    await handler(req, res);
  } catch (e) {
    err = e.message;
  }
  global.fetch = saved.fetch;
  process.env.SUB = saved.SUB;
  process.env.UID = saved.UID;
  console.log(`[${name}] status=${res.statusCode} body=${JSON.stringify(res.body)}${err ? ' threw=' + err : ''}`);
  return { statusCode: res.statusCode, body: res.body };
}

(async () => {
  let failures = 0;
  const ok = (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      console.error('FAIL:', msg, '期望', JSON.stringify(b), '实际', JSON.stringify(a));
      failures++;
    } else {
      console.log('PASS:', msg);
    }
  };

  let calls = 0;
  const mockFetch = (impl) => async (url, opts) => { calls++; return impl(url, opts); };

  // 1. 未配置 SUB → 500 NO_SUB（不应触发微博请求）
  let r = await run('no-sub', { method: 'POST', headers: { 'content-type': 'application/json' }, body: { url: 'https://example.com' } }, mockFetch(async () => { throw new Error('不应调用微博'); }), { SUB: '', UID: '' });
  ok(r.body.error, 'NO_SUB', '未配置 SUB 时应返回 NO_SUB');

  // 2. 非法 URL → 400 BAD_URL
  r = await run('bad-url', { method: 'POST', headers: { 'content-type': 'application/json' }, body: { url: 'ftp://x' } }, mockFetch(async () => { throw new Error('不应调用微博'); }), { SUB: 'test_sub', UID: '' });
  ok(r.body.error, 'BAD_URL', '非法 URL 应返回 BAD_URL');

  // 3. 非 POST → 405
  r = await run('method', { method: 'GET', headers: {} }, mockFetch(async () => { throw new Error('不应调用微博'); }), { SUB: 'test_sub', UID: '' });
  ok(r.body.error, 'METHOD_NOT_ALLOWED', 'GET 应返回 METHOD_NOT_ALLOWED');

  // 4. 成功：校验请求体与 Cookie 构造、响应映射
  r = await run('success', { method: 'POST', headers: { 'content-type': 'application/json' }, body: { url: 'https://example.com/long' } }, mockFetch(async (url, opts) => {
    const body = opts.body;
    if (!body.includes('text=https%3A%2F%2Fexample.com%2Flong')) throw new Error('body 缺少 text 字段或编码不对');
    if (!body.includes('extensions=%7B%22clientid%22%3A%223dsmt6xbjdfbulag51gjd8ia91npxk%22%7D')) throw new Error('extensions 编码与 PHP 版不一致');
    if (!body.includes('uid=4079769806')) throw new Error('uid 默认值不对');
    if (!opts.headers.Cookie.includes('SUB=test_sub;')) throw new Error('Cookie 头构造不对');
    if (!opts.headers.Referer.includes('api.weibo.com/chat')) throw new Error('Referer 头不对');
    return { json: async () => ({ url_objects: [{ info: { result: true, url_short: 'https://t.cn/A12345' } }] }) };
  }), { SUB: 'test_sub', UID: '' });
  ok(r.body.ok, true, '成功时应 ok=true');
  ok(r.body.url_short, 'https://t.cn/A12345', '成功时应返回短链接');

  // 5. SUB 过期（21301）→ SUB_EXPIRED
  r = await run('expired', { method: 'POST', headers: { 'content-type': 'application/json' }, body: { url: 'https://example.com' } }, mockFetch(async () => ({ json: async () => ({ error_code: 21301 }) })), { SUB: 'test_sub', UID: '' });
  ok(r.body.error, 'SUB_EXPIRED', '21301 应返回 SUB_EXPIRED');

  // 6. 微博接口异常响应 → WEIBO_BAD_RESPONSE
  r = await run('bad-response', { method: 'POST', headers: { 'content-type': 'application/json' }, body: { url: 'https://example.com' } }, mockFetch(async () => ({ json: async () => { throw new Error('bad json'); } })), { SUB: 'test_sub', UID: '' });
  ok(r.body.error, 'WEIBO_BAD_RESPONSE', '无法解析的响应应返回 WEIBO_BAD_RESPONSE');

  console.log('微博请求触发次数（应为 3：success/expired/bad-response）：', calls);
  console.log(failures === 0 ? '\n全部测试通过 ✔' : `\n${failures} 项测试失败 ✘`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
