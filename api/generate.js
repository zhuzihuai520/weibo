'use strict';

/**
 * 微博短链接 t.cn 生成 —— Vercel Serverless 函数
 *
 * 由开源项目 WeiBoShortLink（PHP 版，github.com/yuantuo666/WeiBoShortLink）
 * 改造而来，逻辑与原版一致，仅供学习参考。
 *
 * 所需环境变量（在 Vercel 项目 Settings → Environment Variables 中配置）：
 *   SUB —— 必填。微博网页版登录 Cookie 中的 SUB 字段。
 *          获取方式：登录 weibo.cn 后按 F12 打开开发者工具，在 Network 面板
 *          复制任意请求 Cookie 中 SUB= 后面的值。该值会过期，过期后需重新抓取。
 *   UID —— 选填。发送者 UID，默认 4079769806（与原版一致）。
 */

const WEIBO_API = 'https://api.weibo.com/webim/2/direct_messages/new.json';
const DEFAULT_UID = '4079769806';
// 微博网页版私信接口的固定扩展参数（与原版一致，URLSearchParams 会按同一规则编码）
const EXTENSIONS = '{"clientid":"3dsmt6xbjdfbulag51gjd8ia91npxk"}';

function buildRequestBody(url, uid) {
  return new URLSearchParams({
    text: url,
    uid: String(uid),
    extensions: EXTENSIONS,
    is_encoded: '0',
    decodetime: '1',
    source: '209678993',
  }).toString();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED', message: '仅支持 POST 请求' });
  }

  const SUB = (process.env.SUB || '').trim();
  if (!SUB) {
    return res.status(500).json({
      ok: false,
      error: 'NO_SUB',
      message: '未配置 SUB 环境变量。请在 Vercel 项目 Settings → Environment Variables 中设置 SUB（微博 Cookie 中的 SUB 字段）。',
    });
  }

  // 解析 URL 参数（兼容 JSON 与表单两种提交方式）
  const raw = req.body && typeof req.body.url === 'string' ? req.body.url.trim() : '';
  if (!/^https?:\/\//i.test(raw)) {
    return res.status(400).json({ ok: false, error: 'BAD_URL', message: '请输入以 http:// 或 https:// 开头的完整链接。' });
  }

  try {
    const weiboRes = await fetch(WEIBO_API, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.514.1919.810 Safari/537.36',
        'Cookie': `SUB=${SUB};`,
        'Referer': 'https://api.weibo.com/chat/',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildRequestBody(raw, process.env.UID || DEFAULT_UID),
    });

    const json = await weiboRes.json().catch(() => null);
    if (!json) {
      return res.status(502).json({ ok: false, error: 'WEIBO_BAD_RESPONSE', message: '微博接口返回了无法解析的内容。' });
    }

    // SUB 过期（微博错误码 21301）
    if (json.error_code === 21301) {
      return res.status(200).json({
        ok: false,
        error: 'SUB_EXPIRED',
        message: '当前配置的 SUB 已过期，请重新抓取微博 Cookie 中的 SUB 字段并更新环境变量，再试一次。',
      });
    }

    const info = json.url_objects && json.url_objects[0] && json.url_objects[0].info;
    if (info && info.result === true && info.url_short) {
      return res.status(200).json({ ok: true, url_short: info.url_short, message: '生成成功' });
    }

    // 其他未知错误，原样回传微博返回内容便于排查
    return res.status(502).json({
      ok: false,
      error: 'WEIBO_UNKNOWN',
      message: '微博接口返回未知错误，请将下方 detail 提交到原项目 issues 排查。',
      detail: json,
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'WEIBO_NETWORK_ERROR', message: '请求微博接口失败：' + e.message });
  }
};
