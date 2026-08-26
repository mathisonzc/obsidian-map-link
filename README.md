# Map Link

把地图分享链接渲染成 Obsidian 笔记内可交互的地图视图。目前支持**高德地图**的多种
位置链接（短链、URI API 链接、App 唤起 scheme 等，见下方「支持的链接格式」），
后续计划支持 Google Maps、OpenStreetMap 等更多地图来源。同样适用于 Spaced Repetition 插件弹出的复习卡片中。

## 安装

**方式一：社区插件市场**（插件发布后可用）

Obsidian 设置 → 第三方插件 → 浏览 → 搜索「Map Link」→ 安装并启用。

**方式二：手动安装**

从 [Releases](../../releases) 下载最新版本的 `manifest.json`、`main.js`、`styles.css`
三个文件，拷贝到 `<你的 Vault>/.obsidian/plugins/map-link/` 目录下，
然后在 Obsidian 的「第三方插件」设置中启用「Map Link」。

## 用法

在笔记里用 `maplink` 代码块包裹地图分享链接：

````markdown
```maplink
https://surl.amap.com/msaUAvMjaTf
```
````

切换到阅读模式后，代码块会被替换为一个内嵌地图。

- 地图瓦片直接使用对应地图源，视觉效果与原始地图一致
- 标记出分享的坐标点，并显示地点名称
- 支持点击缩放按钮 / 双击 / 双指缩放；鼠标滚轮需要按住 `Ctrl`（Mac 上是 `⌘`）才会缩放地图，
  不按修饰键滚动时按普通笔记滚动处理，不会抢笔记的滚动
- 无法解析时会退化为一个可点击的原始链接，不影响笔记正常渲染

只渲染 `maplink` 代码块内的链接，不会扫描笔记里其它位置出现的短链，
以避免和其它插件对链接/文本的处理产生冲突。

## 支持的链接格式（高德地图）

| 链接形态 | 示例 | 说明 |
| --- | --- | --- |
| 短链 | `https://surl.amap.com/xxxx` | App / 网页「分享地点」产生的链接，最常见，需要联网解析一次 |
| URI API 单点 | `https://uri.amap.com/marker?position=经度,纬度&name=名称` | 本地解析，支持 `coordinate=wgs84` |
| URI API 多点 | `https://uri.amap.com/marker?markers=经度,纬度,名称\|...` | 本地解析，取第一个点 |
| PC 落地页 | `https://ditu.amap.com/regeo?lng=&lat=&name=` | 本地解析 |
| 中转页 | `http://wb.amap.com/?p=POIID,纬度,经度,名称,城市,adcode` | 本地解析，短链展开后的形态 |
| 唤起页 / 手机版 | `http://m.amap.com/callAPP?...`、`.../navigation/index/...daddr=经度,纬度,名称` | 本地解析 |
| App scheme | `iosamap://viewMap?lat=&lon=&poiname=`、`androidamap://...` | 本地解析，支持 `dev=1`（GPS 坐标） |

除短链外的格式都自带明文坐标，**完全本地解析、不发任何网络请求**。

只有 POI ID 而不带坐标的链接（如 `https://www.amap.com/place/<POIID>`、
`https://uri.amap.com/marker?poiid=...`）无法在不申请高德 key 的情况下拿到坐标，
会退化为可点击的原始链接。

坐标系方面，高德链接默认是 GCJ-02，和底图天然对齐；标注了 `coordinate=wgs84` / `dev=1`
的链接会在本地做一次 GCJ-02 纠偏后再标点。

## 原理（高德短链）

高德短链在第一跳重定向的 `Location` 响应头中，直接以明文携带坐标：

```
Location: http://wb.amap.com/?p=<POI_ID>,<纬度>,<经度>,<名称>,<城市>,<行政区码>&src=...
```

插件先尝试从链接本身解析坐标；只有短链这种拿不到坐标的形态才会联网。
桌面端使用 Node 原生 `https` 模块发起请求并读取这一跳的 `Location` 头（不跟随后续跳转），
移动端 / 该方式不可用时退化为 Obsidian 的 `requestUrl`。解析结果会按短链缓存，避免重复请求。

地图瓦片使用高德的公开切图接口，坐标体系（GCJ-02）与瓦片切片方式天然对齐，因此不需要做坐标纠偏。

后续接入 Google Maps / OpenStreetMap 时，会按同样的模式新增各自的链接解析器和瓦片图层，
核心的渲染/交互逻辑（缩放按钮、禁用滚轮、卡片内渲染等）保持不变。

## 开发者

本地开发与调试见 [`DEVELOPMENT.md`](./DEVELOPMENT.md)，发布到社区插件市场的流程见
[`PUBLISHING.md`](./PUBLISHING.md)。
