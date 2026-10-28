# 测试说明

## 环境与重现

源码 v3.3，数据 30/32/36；Node.js 22.12+、Python 3、Playwright Chromium。报告区分源码回归与线上抽查，不把本地通过写成已部署。

启动 `python3 -m http.server 4399 --bind 127.0.0.1`，另开终端：

```sh
npm ci
npx playwright install chromium
npm test
TEST_URL=http://127.0.0.1:4399/ npm run test:ui
TEST_URL=http://127.0.0.1:4399/ npm run test:dossier
TEST_URL=http://127.0.0.1:4399/ npm run test:visual
TEST_URL=http://127.0.0.1:4399/ npm run test:recent
TEST_URL=http://127.0.0.1:4399/ npm run test:intake
TEST_URL=http://127.0.0.1:4399/ node tests/accessibility.mjs
TEST_URL=http://127.0.0.1:4399/ node tests/dossier-accessibility.mjs
npm run test:sources
AUDIT_URL=https://instant-onyx-p1wbm1g-8hryvn2pzr-2601.vercel.app/ node tests/submission-audit.mjs
```

输出至 `test-results/`；本次精确结果、命令日志与抽样截图见交付包 `06_测试说明/`，不沿用旧报告的通过数。

本次还将所有浏览器回归的 `TEST_URL` 指向新版公开域名执行；对应日志与报告在新版交付包中。隔离材料只拦截测试浏览器的 JSON 响应，不修改线上数据。

## 用例矩阵

| 范围 | 预期与脚本 |
| --- | --- |
| 主链路 | 搜索/筛选/分页/关注/导出：`browser.mjs` |
| 数据与时间 | ID、引用、顺序、近期批次、不改历史核验时间：`engine.test.js` |
| 档案与版本 | V1 不泄漏未来事实、对照/星图/PNG：`dossier.test.js`、`dossier-browser.mjs` |
| 新材料闭环 | Fed 12 月真实材料归并为 V3 → 人工确认 → 站内未读：`intake-browser.mjs` |
| 输入异常 | 重复 URL、早到材料、不安全 URL、传闻与推测不改结论：`intake-browser.mjs` |
| 数据/接口异常 | HTTP 错误、加载失败、无效 JSON 结构、禁用/损坏存储：`browser.mjs` |
| UI | 主题、素材、触点、320px、近期长内容：`archive-browser.mjs`、`recent-browser.mjs` |
| 无障碍 | 两个 accessibility 脚本，报告 axe 违规，不冒充人工读屏 |
| 来源 | HTTPS、状态及非错误文档标题：`check-sources.mjs`，不代表语义验证 |
| 线上/仓库 | URL、目录错位、版本差异、Fed 数字：`submission-audit.mjs` |

## 合规与验证边界

无行情/LLM 接口，异常测试针对静态 JSON，不声称真实行情或模型接口稳定性验证。推测和传闻不自动升级、覆盖率不是概率、合成演练不写真实库、未知时间不编造。更正/否认/过期演练标为虚构；真实库没有过期调度。

输入未认证来源，关键词和否认→终止映射可能误判；不承诺复杂语义裁决。来源站点可能日后改版，失败保留在报告。未验收所有设备/浏览器、全量语义、外部通知送达或长期在线 SLA。
