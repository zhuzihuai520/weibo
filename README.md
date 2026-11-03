# WeiBoShortLink（Vercel 兼容版）

使用微博私信功能生成 t.cn 短链接。由开源项目 [WeiBoShortLink](https://github.com/yuantuo666/WeiBoShortLink)（PHP 版）改造为 **Vercel 兼容版**：静态前端 + Node.js Serverless 函数。逻辑与原版一致，仅供学习参考。

> 为什么要改：Vercel 不支持 PHP 运行时，原 `index.php` 在 Vercel 上只会被当作静态文件原样输出，功能不可用。

## 项目结构

```
weibo-vercel/
├── index.html          # 静态前端（原版界面的 HTML+JS 版）
├── api/
│   └── generate.js     # Serverless 函数：调用微博接口生成短链接
├── static/index.css    # 原版样式（未改动）
├── resource/           # 原版图片素材（未改动）
├── dev-server.js       # 零依赖本地开发服务器
├── test/api.test.js    # 本地逻辑测试
└── README.md
```

## 部署到 Vercel

1. 把本目录推送到你自己的 GitHub 仓库（`git init` → `git add .` → `git commit` → 推送到 GitHub）。
2. 打开 vercel.com → **Add New → Project** → 选择该仓库。框架会自动识别为 "Other"，直接 **Deploy**。
3. 部署完成后在项目 **Settings → Environment Variables** 中配置（改完环境变量需 **Redeploy** 一次才生效）：
   - `SUB`：**必填**。微博网页版登录 Cookie 中的 SUB 字段。获取：浏览器登录 weibo.cn → F12 → Network 面板 → 复制任意请求 Cookie 中 `SUB=` 后面的值。
   - `UID`：选填。发送者 UID，默认 `4079769806`（与原版一致）。
4. 访问 `https://你的项目名.vercel.app` 即可使用。

## 本地运行

```powershell
# 先设置 SUB 环境变量（PowerShell）
$env:SUB = '你的SUB值'

# 零依赖方式
node dev-server.js
# 然后浏览器打开 http://localhost:3000

# 或使用 Vercel CLI（自动读取云端环境变量）
npm i -g vercel
vercel dev
```

## 测试

```powershell
node test/api.test.js
```

测试会模拟微博接口，验证请求体构造、Cookie 头、错误分支等核心逻辑，**不会产生真实请求**。真实调用依赖有效的 SUB，无法在本地凭空验证。

## 与原版的差异

| 项目 | 原版（PHP） | 本版（Vercel） |
|---|---|---|
| 运行环境 | PHP 7+ | Node.js 18+（Serverless） |
| SUB / UID | 写死在 index.php | 改为环境变量，代码中不留凭证 |
| SUB 过期提醒 | 首页顶部横幅 | 生成失败时返回明确错误提示 |
| 界面 | PHP 动态渲染 | 静态 HTML + fetch 调用 /api |

## 注意事项

- **SUB 会过期**：原版设定约 14 天提醒阈值，失效后需重新抓取并更新环境变量，否则生成会返回 `SUB_EXPIRED`。
- **灰色用法风险**：通过微博私信接口生成短链接并非微博官方开放能力，存在账号风控/封禁风险，仅限学习、自用、小范围使用。
- 原作者要求保留导航栏 "Made by Yuan_Tuo" 链接，本版已保留。

## License

MIT（沿用原仓库 LICENSE）。
