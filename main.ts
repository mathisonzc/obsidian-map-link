import { MarkdownPostProcessorContext, MarkdownRenderChild, Platform, Plugin } from "obsidian";
import * as L from "leaflet";
import { AmapPoint, resolveAmapShortLink } from "./amapResolver";

const BLOCK_TYPE = "maplink";
const SHORT_LINK_RE = /https?:\/\/surl\.amap\.com\/[A-Za-z0-9]+/;

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
		const match = source.match(SHORT_LINK_RE);
		if (!match) {
			el.createDiv({
				cls: "maplink-status",
				text: `未在代码块中找到高德地图短链，请填入形如 https://surl.amap.com/xxxx 的链接`,
			});
			return;
		}
		const child = new MapEmbed(el, match[0], this);
		ctx.addChild(child);
	}
}

class MapEmbed extends MarkdownRenderChild {
	private map: L.Map | null = null;
	private ro: ResizeObserver | null = null;
	private destroyed = false;
	private hintTimer: number | null = null;

	constructor(
		private container: HTMLElement,
		private shortUrl: string,
		private plugin: MapLinkPlugin
	) {
		super(container);
	}

	onload() {
		this.render();
	}

	onunload() {
		this.destroyed = true;
		this.ro?.disconnect();
		this.ro = null;
		if (this.hintTimer !== null) window.clearTimeout(this.hintTimer);
		this.map?.remove();
		this.map = null;
	}

	private async render() {
		this.container.empty();
		this.container.addClass("maplink-embed");
		const status = this.container.createDiv({
			cls: "maplink-status",
			text: "正在解析高德地图短链…",
		});

		let point = this.plugin.cache.get(this.shortUrl);
		if (!point) {
			const resolved = await resolveAmapShortLink(this.shortUrl).catch(() => null);
			if (resolved) {
				point = resolved;
				this.plugin.cache.set(this.shortUrl, point);
			}
		}

		if (this.destroyed) return;

		if (!point) {
			status.setText("无法解析该高德地图短链，请检查网络连接");
			this.container.createEl("a", {
				text: this.shortUrl,
				href: this.shortUrl,
				cls: "maplink-fallback-link",
			});
			return;
		}

		status.remove();
		this.buildMap(point);
	}

	private buildMap(point: AmapPoint) {
		const mapEl = this.container.createDiv({ cls: "maplink-map" });

		const map = L.map(mapEl, {
			center: [point.lat, point.lng],
			zoom: 16,
			minZoom: 3,
			maxZoom: 18,
			zoomControl: true,
			scrollWheelZoom: true,
			attributionControl: true,
		});
		this.map = map;

		this.setupWheelZoomGuard();

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
		const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
		if (point.name) {
			marker.bindPopup(point.name, { closeButton: false, autoPan: false }).openPopup();
		}

		const footer = this.container.createDiv({ cls: "maplink-footer" });
		footer.createEl("a", {
			text: point.name ? `📍 ${point.name} · 在高德地图中打开` : "在高德地图中打开",
			href: this.shortUrl,
		});

		// 弹出卡片/模态框展开动画结束前地图容器可能尺寸为 0，
		// 用 ResizeObserver 在尺寸稳定后重新计算地图尺寸，避免瓦片错位或空白。
		this.ro = new ResizeObserver(() => {
			map.invalidateSize();
		});
		this.ro.observe(this.container);

		window.setTimeout(() => map.invalidateSize(), 50);
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
				this.hintTimer = window.setTimeout(() => hint.removeClass("is-visible"), 1500);
			},
			{ capture: true, passive: true }
		);
		this.container.addEventListener("mouseleave", () => {
			hintShown = false;
		});
	}
}
