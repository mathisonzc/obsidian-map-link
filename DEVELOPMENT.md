# 开发、测试与发布指南

面向插件开发者。终端用户的安装和使用说明见 [`README.md`](./README.md)。

---

## 一、本地部署与测试

在提交到社区插件市场（见下文「发布」）之前，先在自己的 Vault 里把插件跑起来验证一遍。

### 方式一：手动复制到 Vault（最简单）

适合只想验证一次效果、不打算频繁改代码的情况。

```bash
npm install
npm run build   # 生成 main.js
```

把三个产物文件复制到你的 Vault 插件目录：

```bash
mkdir -p "<你的Vault路径>/.obsidian/plugins/maplink"
cp manifest.json main.js styles.css \
  "<你的Vault路径>/.obsidian/plugins/maplink/"
```

然后：

1. 打开 Obsidian → 设置 → 第三方插件
2. 如果「安全模式」是开着的，先关闭它
3. 在已安装插件列表里找到「MapLink」，点击启用

改代码后需要重复 `npm run build` + `cp` + 在 Obsidian 里重启/重载才能看到效果。

### 方式二：开发模式 + 软链接（推荐，改代码自动生效）

适合要反复调试、改代码的情况，省去每次手动构建和复制。

**1. 用 watch 模式构建**

```bash
npm install
npm run dev
```

`npm run dev` 会启动 esbuild 的 watch 模式，源码一改就自动重新生成 `main.js`，
终端保持运行、不要关掉。

**2. 用软链接把插件目录接入 Vault**

不用每次手动复制文件，直接把整个项目目录软链接到 Vault 的插件目录：

```bash
ln -s "$(pwd)" "<你的Vault路径>/.obsidian/plugins/maplink"
```

> Windows 用户如果不是用 WSL，需要用管理员权限的 `mklink /D` 命令创建符号链接，
> 或者直接用方式一手动复制。

**3. 修改代码后让 Obsidian 感知变化**

`main.js` 更新后，Obsidian 不会自动重新加载插件，需要手动触发：

- 最简单：`Ctrl/Cmd + P` 打开命令面板 → 输入并执行 `Reload app without saving`
- 或者装一个社区插件 **Hot Reload**（作者 pjeby），它会监听插件目录文件变化，
  自动帮你禁用再启用插件，不需要重启整个 Obsidian

### 测试重点 / Checklist

**基础渲染**

- [ ] 新建笔记，粘贴以下代码块，切换到阅读模式

      ```maplink
      https://surl.amap.com/msaUAvMjaTf
      ```
- [ ] 地图容器正确显示（不是空白/塌陷成 0 高度）
- [ ] 地图瓦片能正常加载，画面与高德地图 App/网页版内容一致
- [ ] 地图上出现坐标点标记，且标记位置、名称（如「五棵松」）与短链分享的地点一致
- [ ] 同一篇笔记里放多个不同的短链，各自独立渲染、互不干扰

**交互限制**

- [ ] 鼠标滚轮在地图上滚动**不会**触发缩放（页面本身正常滚动即可）
- [ ] 地图左上角有 `+`/`−` 缩放按钮，点击可以正常放大缩小
- [ ] 拖拽平移正常
- [ ] 触摸设备上双指缩放/拖拽正常（如果需要支持移动端）

**Spaced Repetition 卡片场景（重点）**

- [ ] 安装并启用 Spaced Repetition 插件
- [ ] 把包含短链的笔记加入复习队列（按插件要求打上 flashcard 标记）
- [ ] 打开复习界面，弹出卡片时地图能正确渲染（不是空白或报错）
- [ ] 卡片翻面（问题→答案）、切换到下一张卡片时，地图能正确重新渲染，
      没有残留的旧地图或内存泄漏迹象（可以连续翻十几张卡片观察是否变卡）
- [ ] 缩放按钮、拖拽在卡片内的地图上同样可用，滚轮缩放同样被禁用

**网络异常 / 边界情况**

- [ ] 断网状态下打开含短链的笔记，能优雅降级为一个可点击的原始短链文本，
      而不是报错或让笔记渲染中断
- [ ] 短链本身失效/被撤回的情况下，同样能优雅降级
- [ ] 反复打开同一篇笔记，短链解析结果被缓存，不会每次都重新发起网络请求
      （可以在系统的网络监控里确认第二次打开没有新的 `surl.amap.com` 请求）

**多平台**

- [ ] 桌面端（Windows / macOS / Linux 任选其一即可，核心解析逻辑走 Node `https`）
- [ ] 移动端（iOS / Android 任选其一）—— 这是重点，因为移动端解析走的是
      `requestUrl` 兜底路径，坐标解析能否成功需要实测确认，如果失败会显示兜底链接

### 常见问题排查

**地图区域一片空白，只有灰色底色**
多半是瓦片没加载出来，检查网络能否访问 `webrd0{1-4}.is.autonavi.com`；
也可能是容器高度为 0，观察一下浏览器/Obsidian 开发者工具（`Ctrl+Shift+I`）里
`.maplink-map` 的实际尺寸。

**一直卡在"正在解析高德地图短链…"**
说明短链解析请求没有返回。打开开发者工具的 Console/Network 面板看有没有报错，
或者是不是网络本身访问不了 `surl.amap.com`。

**地图标记的位置不对**
先确认短链本身分享的地点对不对（在手机高德 App 里重新生成一次分享链接核对），
如果位置系统性偏移，检查瓦片图层用的 tile URL 是否被改动过。

**打开开发者工具**
`Ctrl/Cmd + Shift + I`，或者命令面板执行 `Toggle Developer Tools`。

---

## 二、发布到 Obsidian 社区插件市场

把 `maplink` 提交到官方社区插件列表，让用户可以直接在 Obsidian
「设置 → 第三方插件 → 浏览」里搜索安装。整个流程是：**把插件发到自己的
GitHub 仓库 → 打一个带构建产物的 Release → 向 `obsidianmd/obsidian-releases`
仓库提交一个 PR，登记你的插件 → 等官方审核合并**。以下是完整步骤。

### 0. 前置准备

- 一个 GitHub 账号，且**这个仓库必须是公开（public）的**。
- `manifest.json` 中的 `id` 必须**全局唯一**（不能和市场里已有插件重名），
  建议先去 [obsidian-releases 仓库的 community-plugins.json](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json)
  搜一下 `maplink` 有没有被占用。
- 仓库根目录必须有 `LICENSE` 文件（没有会被审核直接打回）。

### 1. 完善 `manifest.json`

发布前检查这几个字段（示例基于当前项目）：

```json
{
	"id": "maplink",
	"name": "MapLink",
	"version": "1.0.0",
	"minAppVersion": "1.0.0",
	"description": "用 maplink 代码块把地图分享链接渲染成笔记内可交互的地图视图，目前支持高德地图短链，后续将支持 Google Maps、OpenStreetMap 等。可在 Spaced Repetition 卡片中正常显示。",
	"author": "mathisonzc",
	"authorUrl": "https://github.com/<你的用户名>",
	"isDesktopOnly": false
}
```

要点：
- `id` 一旦提交审核通过，**以后不能再改**（改了等于变成一个新插件）。
- `description` 建议控制在 250 字符以内，不要用 "Obsidian" 开头（官方审核规则）。
- 由于短链解析在移动端会退化到 `requestUrl`（不保证一定能拿到跳转坐标），
  如果你想更保险，可以把 `isDesktopOnly` 设为 `true`；如果测试过移动端可用，
  保持 `false` 即可。

### 2. 把代码推到 GitHub

```bash
git init                      # 如果还没初始化
git add manifest.json main.ts amapResolver.ts styles.css \
        package.json package-lock.json tsconfig.json \
        esbuild.config.mjs versions.json README.md .gitignore
git commit -m "Initial commit: maplink v1.0.0"
git branch -M main
git remote add origin https://github.com/<你的用户名>/maplink.git
git push -u origin main
```

> 注意：`main.js` 不要提交到分支里（保持 `.gitignore` 忽略它），
> 它只在下一步的 **Release** 里作为构建产物上传。

补一个 `LICENSE` 文件（例如 MIT）：

```bash
curl -s https://raw.githubusercontent.com/licenses/license-templates/master/templates/mit.txt \
  -o LICENSE   # 或直接去 GitHub 新建仓库时勾选 "Choose a license"
```

### 3. 打 Release（社区插件市场是从 Release 里拉取文件的）

Obsidian 官方的插件商店**不是**从源码构建，而是直接从你 GitHub 仓库的
某个 **Release** 里下载这三个文件：`manifest.json`、`main.js`、`styles.css`
（`styles.css` 如果没有可以不传）。

**3.1 本地构建**

```bash
npm install
npm run build      # 生成 main.js
```

**3.2 创建 Release**

**Release 的 tag 名必须和 `manifest.json` 里的 `version` 完全一致**（不要加 `v` 前缀，
例如 tag 就叫 `1.0.0`，不是 `v1.0.0`）。

用 GitHub 网页操作：
1. 仓库页面 → `Releases` → `Draft a new release`
2. `Choose a tag` 填 `1.0.0`（新建），目标分支选 `main`
3. Release title 随意（例如 `1.0.0`）
4. 把下面三个文件作为二进制附件上传（**直接拖拽上传，不要打包成 zip**）：
   - `manifest.json`
   - `main.js`
   - `styles.css`
5. 点击 `Publish release`

也可以用 `gh` CLI 一次性完成：

```bash
gh release create 1.0.0 \
  manifest.json main.js styles.css \
  --title "1.0.0" \
  --notes "首个版本：渲染高德地图短链为可交互地图，支持在 Spaced Repetition 卡片中显示"
```

### 4. 向官方仓库提交登记 PR

1. Fork [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases)
2. 克隆你 fork 的仓库，编辑根目录下的 `community-plugins.json`，
   在数组**末尾**追加一项（注意保持 JSON 合法，逗号别漏/别多）：

```json
{
	"id": "maplink",
	"name": "MapLink",
	"author": "mathisonzc",
	"description": "用 maplink 代码块把地图分享链接渲染成笔记内可交互的地图视图，目前支持高德地图短链，后续将支持 Google Maps、OpenStreetMap 等。可在 Spaced Repetition 卡片中正常显示。",
	"repo": "<你的用户名>/maplink"
}
```

   `repo` 字段格式固定为 `GitHub用户名/仓库名`，不要带 `https://github.com/` 前缀。

3. 提交并推送这个改动：

```bash
git checkout -b add-maplink
git add community-plugins.json
git commit -m "Add maplink plugin"
git push origin add-maplink
```

4. 回到 GitHub，对 `obsidianmd/obsidian-releases` 的 `master` 分支发起 Pull Request。
   官方有一个 PR 模板/Bot（`Obsidian Plugin Bot`）会自动检查：
   - `manifest.json` 里的字段是否合法
   - Release 里的资源文件是否齐全
   - `id` 是否重复
   - 仓库是否有 `LICENSE`

   Bot 检查全部通过（会在 PR 里打勾/评论）后，才会进入人工审核队列。

### 5. 人工审核

- 官方团队会人工审查代码（尤其关注：网络请求、安全性、是否有明显 bug、
  UI 是否符合 Obsidian 规范、是否有不必要的权限等）。
- 审核周期从几天到数周不等，视审核队列长度而定。
- 期间如果 reviewer 在 PR 里提出修改意见（常见如："别用行内样式"、
  "说明一下这个网络请求的用途"等），直接在你的插件仓库里改代码、
  发新的 Release（版本号 +1），PR 会自动带上最新状态，不需要重新开 PR。
  可以在 PR 评论区回复说明已修复。
- 通过后 PR 会被官方合并，插件会在**几小时到一天内**同步进
  Obsidian 客户端内的插件市场索引，用户就能在「浏览社区插件」里搜到。

### 6. 后续更新版本

以后每次发新版本，只需要：

1. 修改 `manifest.json` 的 `version`（例如 `1.0.1`），如果提高了
   `minAppVersion` 也一并更新。
2. 在 `versions.json` 里补一条 `"1.0.1": "1.0.0"`（表示这个插件版本
   最低支持的 Obsidian 版本）。
3. `npm run build`，打一个新的 Release（tag 同样必须等于新版本号），
   上传新的 `manifest.json` / `main.js` / `styles.css`。
4. **不需要**再向 `obsidian-releases` 提 PR ——市场索引里只记录了你的仓库地址，
   Obsidian 客户端会自动去你仓库最新 Release 拉取更新，用户端会收到更新提示。

### 常见被拒 / 打回原因（提前自查）

- `manifest.json` 的 `id` 和市场里已有插件冲突。
- 忘记打 `LICENSE`。
- Release 的 tag 和 `manifest.json` 的 `version` 不一致。
- Release 里没有直接上传 `main.js` / `manifest.json`（而是打包成了 zip）。
- 代码里有硬编码的密钥/token，或请求了跟插件功能无关的外部服务。
- 使用了 `innerHTML`/`eval` 等官方不建议的写法（本插件目前没有用到，无需修改）。
- `README.md` 里没有说明插件的用途和使用方法。

### 参考链接

- 官方提交插件文档：<https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>
- 插件规范/审核清单：<https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines>
- 官方登记仓库：<https://github.com/obsidianmd/obsidian-releases>

