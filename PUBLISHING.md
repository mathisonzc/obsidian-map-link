# Obsidian 插件发布指南

通用的 Obsidian 社区插件发布流程，从代码就绪到用户能在 Obsidian
「设置 → 第三方插件 → 浏览」里搜到为止。不局限于某个具体插件，任何 Obsidian
插件项目都可以照这个流程发布。本项目的本地开发/测试说明见 [`DEVELOPMENT.md`](./DEVELOPMENT.md)。

> ⚠️ 官方在 2026 年把提交流程从「fork `obsidianmd/obsidian-releases`、改
> `community-plugins.json`、提 PR」换成了网页表单（community.obsidian.md）。
> `obsidianmd/obsidian-releases` 这个仓库现在**不接受外部 PR**
> （`pull_request_creation_policy: collaborators_only`）。网上/旧文档里
> 很多还是讲 PR 流程的，那些已经过时了，以本文档为准。

## 总览

```
准备 manifest.json/LICENSE
        ↓
推送代码到 GitHub（公开仓库）
        ↓
打一个带构建产物的 Release
        ↓
在 community.obsidian.md 关联 GitHub 账号（只需一次，见步骤 5）
        ↓
在 community.obsidian.md 提交插件（填仓库地址）
        ↓
等待自动 / 人工审核
        ↓
出现在 Obsidian 客户端的社区插件市场
```

---

## 步骤 1：前置准备

- 一个 **GitHub 账号**（仓库必须是**公开的**）+ 一个 **Obsidian 账号**
  （提交在 community.obsidian.md 完成，用 Obsidian 账号登录）。
- 仓库根目录必须有 **`LICENSE`** 文件（没有会被拒）。
- `manifest.json` 里的 `id` 必须**全局唯一**，且**不能包含 "obsidian"** 字样
  （提交时系统会自动校验，也可以先去
  [community-plugins.json](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json)
  搜一下有没有被占用——这个文件目前仍是市场索引的实际数据源，只是不再接受外部 PR）。

## 步骤 2：完善 `manifest.json`

```json
{
	"id": "your-plugin-id",
	"name": "Your Plugin Name",
	"version": "1.0.0",
	"minAppVersion": "1.0.0",
	"description": "一句话说明插件做什么。",
	"author": "your-github-username",
	"authorUrl": "https://github.com/your-github-username",
	"isDesktopOnly": false
}
```

要点：
- `id` 一旦提交审核通过，**以后不能再改**（改了等于变成一个新插件）。
- `id`/`name` 都**不能包含 "obsidian"** 字样（官方规则，避免和官方产品混淆）。
- `description` 建议控制在 250 字符以内，不要用 "Obsidian" 开头。
- `isDesktopOnly`：如果插件依赖了移动端不可用的 API（比如 Node 原生模块），
  测试过移动端跑不了的话就设为 `true`；桌面/移动都测过没问题就保持 `false`。

## 步骤 3：把代码推到 GitHub

```bash
git init                      # 如果还没初始化
git add .                     # main.js 之类的构建产物应保持在 .gitignore 里
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> `main.js`（构建产物）不需要提交到分支里，只在下一步的 **Release** 里上传。

没有 LICENSE 的话补一个（例如 MIT）：

```bash
curl -s https://raw.githubusercontent.com/licenses/license-templates/master/templates/mit.txt \
  -o LICENSE   # 或直接去 GitHub 新建仓库时勾选 "Choose a license"
```

## 步骤 4：打 Release

Obsidian 官方的插件商店**不从源码构建**，而是直接从你 GitHub 仓库的某个
**Release** 里下载三个文件：`manifest.json`、`main.js`、`styles.css`
（没有自定义样式的话 `styles.css` 可以不传）。

**本地构建**

```bash
npm install
npm run build      # 生成 main.js
```

**创建 Release**

**Release 的 tag 名必须和 `manifest.json` 里的 `version` 完全一致**
（不要加 `v` 前缀，例如 tag 就叫 `1.0.0`，不是 `v1.0.0`）。

用 GitHub 网页操作：仓库页面 → `Releases` → `Draft a new release` →
`Choose a tag` 填版本号（新建）→ 把 `manifest.json`/`main.js`/`styles.css`
作为二进制附件**直接拖拽上传**（不要打包成 zip）→ `Publish release`。

也可以用 `gh` CLI 一次性完成：

```bash
gh release create 1.0.0 \
  manifest.json main.js styles.css \
  --title "1.0.0" \
  --notes "首个版本说明"
```

## 步骤 5：在 community.obsidian.md 关联 GitHub 账号（首次发布必做）

这一步很容易漏掉——**Obsidian 账号登录之后不会自动关联 GitHub**，提交插件前必须
手动连一次，否则提交时会报错：

> `You do not own this repository. Connect your GitHub account and ensure
> the repo owner matches your username or an organization you administer.`

操作步骤：
1. 打开 <https://community.obsidian.md>，右上角点头像（User menu）→ **Account**，
   或者直接访问 <https://community.obsidian.md/account/profile>。
2. 找到 **GitHub** 这一栏，未关联时会显示 **"Not connected"** 和一个
   **Connect** 按钮（旁边说明"We request read-only access to your public
   profile to verify account ownership"）。
3. 点 **Connect**，走一遍 GitHub OAuth 授权（只读公开 profile 权限）。
4. 授权成功后这一栏会变成 **"Connected as \<你的 GitHub 用户名\>"**，
   旁边有 `Refresh organizations` / `Disconnect` 按钮。

这一步需要你本人登录点击，没有办法脚本化代劳。**只需要做一次**，
之后提交任何仓库下的插件都不用重新连。

## 步骤 6：在 community.obsidian.md 提交插件

1. 右上角 User menu → **Your plugins**（`/account/plugins`），
   页面提示 "Claim repositories to manage their plugin listings"。
2. 点 **New plugin**（`/account/plugins/new`），进入"Submit a new plugin"表单：
   - **GitHub repository URL**：填你的插件仓库地址，例如
     `https://github.com/<你的用户名>/<仓库名>`
   - **Owner**：选 `Myself` 或者你管理的某个组织
     （这个字段只影响谁来维护这条市场条目，不受仓库实际 GitHub owner 限制）
   - 勾选 **"I have read and agree to the Developer Policies."**
     （链接：<https://docs.obsidian.md/Developer+policies>）
   - 勾选 **"I commit to continue supporting this plugin, and remove it or
     transfer it if I can no longer provide support."**
   - 两个勾都打上后 **Submit** 按钮才会点亮，点击提交。

提交时系统会自动读取仓库**默认分支 HEAD** 的 `manifest.json` 做校验。

## 步骤 7：处理审核反馈

- 提交后系统会自动审核，不通过的地方直接显示在 community.obsidian.md 的
  提交/插件详情页上（不是 GitHub PR 评论的形式）。
- 需要改动时：改代码 → 把 `manifest.json` 的 `version` 往上加 → 打一个新
  Release → 系统会自动读取最新状态，不需要重新走一遍提交表单。
- 通过后插件会出现在 Obsidian 客户端「浏览社区插件」列表里。

## 步骤 8：后续更新版本

以后每次发新版本，只需要：

1. 修改 `manifest.json` 的 `version`（例如 `1.0.1`），如果提高了
   `minAppVersion` 也一并更新。
2. 在 `versions.json` 里补一条 `"1.0.1": "1.0.0"`（表示这个插件版本
   最低支持的 Obsidian 版本）。
3. `npm run build`，打一个新的 Release（tag 同样必须等于新版本号），
   上传新的 `manifest.json` / `main.js` / `styles.css`。
4. **不需要**再去 community.obsidian.md 重新提交——市场索引里只记录了你的
   仓库地址，Obsidian 客户端会自动去你仓库最新 Release 拉取更新，用户端会
   收到更新提示。

---

## 常见问题 / 打回原因（提前自查）

- **`You do not own this repository...`**：GitHub 账号没关联，回到步骤 5。
- `manifest.json` 的 `id` 和市场里已有插件冲突，或者 `id`/`name` 里包含 "obsidian"。
- 忘记打 `LICENSE`。
- Release 的 tag 和 `manifest.json` 的 `version` 不一致。
- Release 里没有直接上传 `main.js` / `manifest.json`（而是打包成了 zip）。
- 代码里有硬编码的密钥/token，或请求了跟插件功能无关的外部服务。
- 使用了 `innerHTML`/`eval` 等官方不建议的写法。
- `README.md` 里没有说明插件的用途和使用方法。

## 参考链接

- 官方提交插件文档：<https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>
- 插件规范/审核清单：<https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines>
- 开发者政策：<https://docs.obsidian.md/Developer+policies>
- 插件提交入口：<https://community.obsidian.md/account/plugins/new>
- 账号 GitHub 关联页：<https://community.obsidian.md/account/profile>
