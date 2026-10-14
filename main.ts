import { MarkdownPostProcessorContext, MarkdownRenderChild, Platform, Plugin } from "obsidian";
import * as L from "leaflet";
import { AmapPoint, isAmapLink, resolveAmapLink } from "./amapResolver";

const BLOCK_TYPE = "maplink";
// 先粗粒度地把代码块里的链接都抓出来，再交给解析器判断是不是高德的链接。
const LINK_RE = /(?:https?|androidamap|iosamap|amapuri):\/\/[^\s<>"')]+/g;
// 预览的初始缩放级别。数字越大范围越小：16 约为「一个路口」，14 约为「周边几个街区」。
const DEFAULT_ZOOM = 14;

export default class MapLinkPlugin extends Plugin {
	cache: Map<string, AmapPoint> = new Map();

	async onload() {
		// 只处理 ```maplink 代码块，不扫描整篇笔记的渲染结果，
		// 避免和其它插件对链接/文本节点的处理产生冲突。
		this.registerMarkdownCodeBlockProcessor(BLOCK_TYPE, (source, el, ctx) => {
			this.renderBlock(source, el, ctx);
		});
	}

	private renderBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		const link = (source.match(LINK_RE) ?? []).find((u) => isAmapLink(u));
		if (!link) {
			el.createDiv({
				cls: "maplink-status",
				text: "未在代码块中找到高德地图链接，请填入形如 https://surl.amap.com/xxxx 的链接",
			});
			return;
		}
		const child = new MapEmbed(el, link, this);
		ctx.addChild(child);
	}
}

class MapEmbed extends MarkdownRenderChild {
	private map: L.Map | null = null;
	private mapEl: HTMLElement | null = null;
	private point: AmapPoint | null = null;
	private ro: ResizeObserver | null = null;
	private io: IntersectionObserver | null = null;
	private destroyed = false;
	private hintTimer: number | null = null;

	constructor(
		private container: HTMLElement,
		private url: string,
		private plugin: MapLinkPlugin
	) {
		super(container);
	}

	onload() {
		this.render();
	}

	onunload() {
		this.destroyed = true;
		this.io?.disconnect();
		this.io = null;
		if (this.hintTimer !== null) window.clearTimeout(this.hintTimer);
		this.teardownMap();
	}

	private async render() {
		this.container.empty();
		this.container.addClass("maplink-embed");
		const status = this.container.createDiv({
			cls: "maplink-status",
			text: "正在解析高德地图链接…",
		});

		let point = this.plugin.cache.get(this.url);
		if (!point) {
			const resolved = await resolveAmapLink(this.url).catch(() => null);
			if (resolved) {
				point = resolved;
				this.plugin.cache.set(this.url, point);
			}
		}

		if (this.destroyed) return;

		if (!point) {
			status.setText("无法解析该高德地图链接，请检查链接格式或网络连接");
			this.container.createEl("a", {
				text: this.url,
				href: this.url,
				cls: "maplink-fallback-link",
			});
			return;
		}

		status.remove();
		this.point = point;
		this.mapEl = this.container.createDiv({ cls: "maplink-map" });
		this.setupWheelZoomGuard();
		const footer = this.container.createDiv({ cls: "maplink-footer" });
		footer.createEl("a", {
			text: "在高德地图中打开",
			href: this.url,
		});

		// Spaced Repetition 等插件把渲染上下文挂在插件自身上，换卡/关闭弹窗时
		// 并不会 unload 我们，导致 Leaflet 实例（window resize 监听、瓦片图片）一直泄漏，
		// 复习久了 Obsidian 会内存耗尽白屏。所以这里自己盯住容器：
		// 进入视口时才创建地图，容器被移出文档时立即销毁地图，重新挂回来时再重建。
		this.io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting && entry.target.isConnected) {
						this.buildMap();
					} else if (!entry.target.isConnected) {
						this.teardownMap();
					}
				}
			},
			{ rootMargin: "200px" }
		);
		this.io.observe(this.container);
	}

	private teardownMap() {
		this.ro?.disconnect();
		this.ro = null;
		this.map?.remove();
		this.map = null;
	}

	private buildMap() {
		const point = this.point;
		const mapEl = this.mapEl;
		if (this.map || this.destroyed || !point || !mapEl) return;

		const map = L.map(mapEl, {
			center: [point.lat, point.lng],
			zoom: DEFAULT_ZOOM,
			minZoom: 3,
			maxZoom: 18,
			zoomControl: true,
			scrollWheelZoom: true,
			attributionControl: true,
		});
		this.map = map;

		L.tileLayer(
			"https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}",
			{
				subdomains: ["1", "2", "3", "4"],
				maxZoom: 18,
				minZoom: 3,
				attribution: "&copy; 高德地图",
			}
		).addTo(map);

		const icon = L.divIcon({
			className: "maplink-marker",
			html: '<div class="maplink-marker-pin"></div>',
			iconSize: [22, 30],
			iconAnchor: [11, 30],
		});
		// 预览里只保留位置标识，不展示地点名称（名称仍作为 title 供悬停查看）。
		L.marker([point.lat, point.lng], { icon, title: point.name || undefined }).addTo(map);

		// 弹出卡片/模态框展开动画结束前地图容器可能尺寸为 0，
		// 用 ResizeObserver 在尺寸稳定后重新计算地图尺寸，避免瓦片错位或空白。
		this.ro = new ResizeObserver(() => {
			if (this.map === map) map.invalidateSize();
		});
		this.ro.observe(this.container);

		window.setTimeout(() => {
			if (this.map === map) map.invalidateSize();
		}, 50);
	}

	// 直接开滚轮缩放会导致划过地图时笔记没法正常滚动，
	// 所以约定 Ctrl/Cmd + 滚轮才缩放；不按修饰键时在捕获阶段拦下事件，
	// 不调用 preventDefault，让浏览器按默认行为滚动笔记。
	private setupWheelZoomGuard() {
		const hint = this.container.createDiv({
			cls: "maplink-scroll-hint",
			text: Platform.isMacOS ? "按住 ⌘ 滚动可缩放地图" : "按住 Ctrl 滚动可缩放地图",
		});
		let hintShown = false;

		this.container.addEventListener(
			"wheel",
			(e: WheelEvent) => {
				if (e.ctrlKey || e.metaKey) return;
				e.stopPropagation();
				if (hintShown) return;
				hintShown = true;
				hint.addClass("is-visible");
				if (this.hintTimer !== null) window.clearTimeout(this.hintTimer);
				this.hintTimer = window.setTimeout(() => hint.removeClass("is-visible"), 1500);
			},
			{ capture: true, passive: true }
		);
		this.container.addEventListener("mouseleave", () => {
			hintShown = false;
		});
	}
}
