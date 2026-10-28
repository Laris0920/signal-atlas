# Fed 主案例演示

主案例：**美联储 2024：三次降息的证据链**。新版录像 141.60 秒，真实浏览器操作、可见中文字幕、无音轨；重录时以实际元数据为准。

全程操作新版公开站：https://instant-onyx-p1wbm1g-8hryvn2pzr-2601.vercel.app/#event=fed-cycle 。前段展示三版本、原文、四种时间、对照、事实/观点与导出。后段仍访问同一公开域名，只在隔离浏览器的 JSON 响应中移除 Fed 最后一版及对应来源，再输入真实 2024-12-18 官方材料，展示归并、分类、人工确认、追加和通知。不切换本地页面，不修改静态库或线上数据。

字幕持续标注“公开站点实录”或“公开网站·历史回放沙箱（隔离演示）”。输入标题前加 Fed 别名以命中词项规则，不冒充通用语义 AI。原指定旧 URL 仍是旧快照；新版域名的完整入口与旧链接区分说明。

## 重录

安装 Playwright Chromium 后运行，无需启动本地服务：

```sh
DEMO_PUBLIC_ONLY=1 DEMO_PUBLIC_URL=https://instant-onyx-p1wbm1g-8hryvn2pzr-2601.vercel.app/#event=fed-cycle node tests/record-fed-demo.mjs
```

结果在 `artifacts/final-demo/`：`fed-demo.webm`、`fed-demo.zh.vtt`、元数据及关键截图。默认公开 URL 为用户指定地址，支持 `DEMO_PUBLIC_URL` 显式替换。WebM 可用 Chromium/Edge 或常见播放器打开。
