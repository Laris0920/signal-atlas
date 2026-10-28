# GitHub 补传指南

仓库：https://github.com/Laris0920/signal-atlas ，分支 `main`。

**本次已代传完成，无需你重复手动上传。** 通过 GitHub 官方授权核实账号 Laris0920 及仓库写权限后，新增/覆盖35个路径、核验全部41个源码文件，没有删除其他文件。新版公开站：https://instant-onyx-p1wbm1g-8hryvn2pzr-2601.vercel.app/#event=fed-cycle 。以下步骤保留供以后维护。

## 文件在哪里

最终 ZIP 解压后，进入 **`02_源代码仓库/上传到GitHub的源码/`**，这里是完整项目，不需要从旧附件拼文件。

- 需覆盖：这一层的 `index.html`、`app.js`、`engine.js`、`polish.css`、`archive.css`。
- 缺失背景：**`assets/archive-hero.webp`**，不是根目录的同名文件。
- 测试：`tests/`；设计：`design/`，都要保留目录。

## 推荐一次上传完整项目

1. 打开仓库 `main` → **Add file → Upload files**。
2. 打开本包 `02_源代码仓库/上传到GitHub的源码/`，拖入**里面的文件和子文件夹**。不要拖入外层“上传到GitHub的源码”目录，也不要上传整个六目录交付包。
3. 保留 `assets/`、`tests/`、`design/` 层级；整文件夹拖放，不把文件逐个抽出平铺。
4. 提交前确认列表有 `index.html`、`assets/archive-hero.webp`、`tests/engine.test.js`、`README.md`、`package.json`、`vercel.json`。
5. 点 **Commit changes**，覆盖同路径文件；不要命名为“副本”或 `index (1).html`。若有冲突提示，按提示替换/编辑原文件。
6. 隐藏的 `.gitignore`、`.vercelignore` 也要上传；Mac 可用 Command + Shift + . 显示。

## 只补背景图的稳妥方法

仓库首页 → **Add file → Create new file**，文件名填 `assets/.gitkeep`，正文写 `assets folder`，提交。进入 `assets` 文件夹 → **Add file → Upload files**，上传本包的 `assets/archive-hero.webp`。最终路径必须是 `assets/archive-hero.webp`；`.gitkeep` 不影响运行。

## 不要上传

其他五类交付目录、演示视频和最终 ZIP 不需要放入网站根目录。不上传 `.vercel/`、`node_modules/`、`.env`、密钥、日志、测试结果、旧压缩包；网页上传不能依赖 `.gitignore` 自动排除。

当前仓库存在平铺图片、测试与设计旧副本；新目录上传完成后可清理这些不再引用的副本，但不要求先删除，避免误删正常代码。

## Vercel

Other；Root Directory 为仓库根目录；Build Command 不设置；Output Directory `.`；无需环境变量。确认 Settings → Git 连接本仓库 main，提交后等待新部署 Ready。

**用户指定 URL 是旧部署固定快照，补传不会更新它。** 打开最新部署或生产域名核对材料处理台与背景；若坚持仅用旧 URL，就需接受旧快照的功能差异，不能宣称最新版已在旧地址上线。
