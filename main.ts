import { MarkdownPostProcessorContext, MarkdownRenderChild, Platform, Plugin } from "obsidian";
import * as L from "leaflet";
import { AmapPoint, isAmapLink, resolveAmapLink } from "./amapResolver";

const BLOCK_TYPE = "maplink";
// Grab every link in the code block coarsely first, then let the resolver decide which ones are AMap links.
const LINK_RE = /(?:https?|androidamap|iosamap|amapuri):\/\/[^\s<>"')]+/g;
// Initial zoom level of the preview. Higher means closer: 16 is roughly "one intersection", 14 is "a few surrounding blocks".
const DEFAULT_ZOOM = 14;

export default class MapLinkPlugin extends Plugin {
	cache: Map<string, AmapPoint> = new Map();

	async onload() {
		// Only handle ```maplink code blocks instead of scanning the whole rendered note,
		// to avoid conflicting with how other plugins process links/text nodes.
		this.registerMarkdownCodeBlockProcessor(BLOCK_TYPE, (source, el, ctx) => {
			this.renderBlock(source, el, ctx);
		});
	}

	private renderBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		const link = (source.match(LINK_RE) ?? []).find((u) => isAmapLink(u));
		if (!link) {
			el.createDiv({
				cls: "maplink-status",
				text: "No AMap link found in the code block. Please paste a link like https://surl.amap.com/xxxx",
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
			text: "Resolving AMap link…",
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
			status.setText("Unable to resolve this AMap link. Please check the link format or your network connection.");
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
			text: "Open in AMap",
			href: this.url,
		});

		// Plugins like Spaced Repetition attach the render context to themselves and never unload us
		// when switching cards or closing the modal, so Leaflet instances (window resize listeners,
		// tile images) leak, and after a long review session Obsidian runs out of memory and goes blank.
		// So we watch the container ourselves: build the map only when it enters the viewport,
		// tear it down as soon as the container leaves the document, and rebuild when it is reattached.
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
				attribution: "&copy; AMap",
			}
		).addTo(map);

		const icon = L.divIcon({
			className: "maplink-marker",
			html: '<div class="maplink-marker-pin"></div>',
			iconSize: [22, 30],
			iconAnchor: [11, 30],
		});
		// Only show the location marker in the preview, not the place name (the name is still the title, visible on hover).
		L.marker([point.lat, point.lng], { icon, title: point.name || undefined }).addTo(map);

		// The map container may have zero size until the card/modal open animation finishes;
		// use a ResizeObserver to recompute the map size once it settles, avoiding misaligned or blank tiles.
		this.ro = new ResizeObserver(() => {
			if (this.map === map) map.invalidateSize();
		});
		this.ro.observe(this.container);

		window.setTimeout(() => {
			if (this.map === map) map.invalidateSize();
		}, 50);
	}

	// Plain wheel zoom would stop the note from scrolling when the pointer passes over the map,
	// so zooming requires Ctrl/Cmd + wheel. Without a modifier we stop the event in the capture phase
	// without calling preventDefault, letting the browser scroll the note as usual.
	private setupWheelZoomGuard() {
		const hint = this.container.createDiv({
			cls: "maplink-scroll-hint",
			text: Platform.isMacOS ? "Hold ⌘ and scroll to zoom the map" : "Hold Ctrl and scroll to zoom the map",
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
