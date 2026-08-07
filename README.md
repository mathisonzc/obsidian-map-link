# MapLink

把地图分享链接渲染成 Obsidian 笔记内可交互的地图视图。目前支持**高德地图短链**
（如 `https://surl.amap.com/msaUAvMjaTf`），后续计划支持 Google Maps、
OpenStreetMap 等更多地图来源。同样适用于 Spaced Repetition 插件弹出的复习卡片中。

## 安装

**方式一：社区插件市场**（插件发布后可用）

Obsidian 设置 → 第三方插件 → 浏览 → 搜索「MapLink」→ 安装并启用。

**方式二：手动安装**

从 [Releases](../../releases) 下载最新版本的 `manifest.json`、`main.js`、`styles.css`
三个文件，拷贝到 `<你的 Vault>/.obsidian/plugins/maplink/` 目录下，
然后在 Obsidian 的「第三方插件」设置中启用「MapLink」。

## 用法

在笔记里用 `maplink` 代码块包裹地图分享链接（当前支持 `https://surl.amap.com/xxxx`）：

````markdown
```maplink
https://surl.amap.com/msaUAvMjaTf
```
````

切换到阅读模式后，代码块会被替换为一个内嵌地图。

- 地图瓦片直接使用对应地图源，视觉效果与原始地图一致
- 标记出分享的坐标点，并显示地点名称
- 只支持点击缩放按钮 / 双击 / 双指缩放，**禁用了鼠标滚轮缩放**
- 无法解析时会退化为一个可点击的原始链接，不影响笔记正常渲染

只渲染 `maplink` 代码块内的链接，不会扫描笔记里其它位置出现的短链，
以避免和其它插件对链接/文本的处理产生冲突。

## 原理（高德地图）

高德短链在第一跳重定向的 `Location` 响应头中，直接以明文携带坐标：

```
Location: http://wb.amap.com/?p=<POI_ID>,<纬度>,<经度>,<名称>,<城市>,<行政区码>&src=...
```

插件在桌面端使用 Node 原生 `https` 模块发起请求并读取这一跳的 `Location` 头（不跟随后续跳转），
移动端 / 该方式不可用时退化为 Obsidian 的 `requestUrl`。解析结果会按短链缓存，避免重复请求。

地图瓦片使用高德的公开切图接口，坐标体系（GCJ-02）与瓦片切片方式天然对齐，因此不需要做坐标纠偏。

后续接入 Google Maps / OpenStreetMap 时，会按同样的模式新增各自的链接解析器和瓦片图层，
核心的渲染/交互逻辑（缩放按钮、禁用滚轮、卡片内渲染等）保持不变。

## 开发者

插件开发、本地调试与发布到社区插件市场的流程见 [`DEVELOPMENT.md`](./DEVELOPMENT.md)。
