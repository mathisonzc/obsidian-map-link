import { Platform, requestUrl } from "obsidian";

export interface AmapPoint {
	lat: number;
	lng: number;
	name: string;
}

// AMap location links come in two kinds:
// 1. Links that carry plain-text coordinates themselves (uri.amap.com / ditu.amap.com / wb.amap.com /
//    m.amap.com / androidamap:// etc.), which are parsed locally without any request;
// 2. surl.amap.com short links, whose coordinates hide in the Location header of the first redirect and need the network.
// Always try local parsing first and fall back to the network only when that fails.

const UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 " +
	"(KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

const AMAP_HOST_RE = /(^|\.)(amap\.com|gaode\.com)$/i;
const AMAP_SCHEME_RE = /^(androidamap|iosamap|amapuri):\/\//i;
const SHORT_LINK_HOST = "surl.amap.com";

export function isAmapLink(url: string): boolean {
	if (AMAP_SCHEME_RE.test(url)) return true;
	try {
		return AMAP_HOST_RE.test(new URL(url).hostname);
	} catch (e) {
		return false;
	}
}

function isShortLink(url: string): boolean {
	try {
		return new URL(url).hostname.toLowerCase() === SHORT_LINK_HOST;
	} catch (e) {
		return false;
	}
}

export async function resolveAmapLink(url: string): Promise<AmapPoint | null> {
	const local = parseAmapUrl(url);
	if (local) return local;
	if (isShortLink(url)) return resolveAmapShortLink(url);
	return null;
}

export async function resolveAmapShortLink(shortUrl: string): Promise<AmapPoint | null> {
	const location = await fetchRedirectLocation(shortUrl);
	if (!location) return null;
	return parseAmapUrl(location);
}

async function fetchRedirectLocation(url: string): Promise<string | null> {
	if (!Platform.isMobileApp) {
		const viaNode = await fetchRedirectLocationNode(url).catch(() => null);
		if (viaNode) return viaNode;
	}
	return fetchRedirectLocationRequestUrl(url).catch(() => null);
}

// On desktop (Electron/Node) use the native https module, so we get the
// 302 response and its Location header without the redirect being followed.
function fetchRedirectLocationNode(url: string): Promise<string | null> {
	return new Promise((resolve, reject) => {
		let https: typeof import("https");
		try {
			https = require("https");
		} catch (e) {
			reject(e);
			return;
		}
		const req = https.get(
			url,
			{ headers: { "User-Agent": UA }, timeout: 8000 },
			(res) => {
				const location = res.headers.location;
				res.resume();
				resolve(location ?? null);
			}
		);
		req.on("timeout", () => req.destroy(new Error("timeout")));
		req.on("error", reject);
	});
}

// On mobile (or when the Node approach is unavailable) fall back to Obsidian's requestUrl.
// Some platforms follow redirects automatically, returning 200 without the intermediate Location;
// resolving fails in that case and the UI falls back to a clickable original short link.
async function fetchRedirectLocationRequestUrl(url: string): Promise<string | null> {
	const res = await requestUrl({
		url,
		method: "GET",
		throw: false,
		headers: { "User-Agent": UA },
	});
	if (res.status >= 300 && res.status < 400) {
		const loc = res.headers["location"] ?? res.headers["Location"];
		if (loc) return loc;
	}
	return null;
}

// ---- Local parsing ----

// AMap parameters are sometimes appended to the path instead of the query
// (e.g. m.amap.com/navigation/index/autoSearch=1&daddr=116.47,39.99,name),
// so instead of URL.searchParams we scan the whole string for key=value. The first occurrence of a key wins.
function collectParams(input: string): Map<string, string> {
	const params = new Map<string, string>();
	const re = /([A-Za-z_][A-Za-z0-9_]*)=([^&#]*)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(input)) !== null) {
		if (!params.has(m[1].toLowerCase())) params.set(m[1].toLowerCase(), m[2]);
	}
	return params;
}

function decode(value: string | undefined): string {
	if (!value) return "";
	try {
		return decodeURIComponent(value.replace(/\+/g, " "));
	} catch (e) {
		return value;
	}
}

function num(value: string | undefined): number {
	if (value === undefined) return NaN;
	return parseFloat(value);
}

function makePoint(lat: number, lng: number, name: string, wgs84: boolean): AmapPoint | null {
	if (!isFinite(lat) || !isFinite(lng)) return null;
	if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
	if (lat === 0 && lng === 0) return null;
	const p = wgs84 ? wgs84ToGcj02(lat, lng) : { lat, lng };
	return { lat: p.lat, lng: p.lng, name: name.trim() };
}

export function parseAmapUrl(url: string): AmapPoint | null {
	return parseAmapString(url.trim(), 0);
}

function parseAmapString(input: string, depth: number): AmapPoint | null {
	const params = collectParams(input);
	// coordinate=wgs84 (URI API) and dev=1 (App scheme) both mean the input is raw GPS coordinates
	const coordinate = decode(params.get("coordinate")).toLowerCase();
	const wgs84 = coordinate === "wgs84" || coordinate === "gps" || params.get("dev") === "1";
	const name =
		decode(params.get("name")) ||
		decode(params.get("poiname")) ||
		decode(params.get("title")) ||
		decode(params.get("destname"));

	// wb.amap.com/?p=POIID,lat,lng,name,city,adcode
	const p = decode(params.get("p"));
	if (p) {
		const f = p.split(",");
		const pt = makePoint(num(f[1]), num(f[2]), name || (f[3] ?? ""), wgs84);
		if (pt) return pt;
	}

	// uri.amap.com/marker?position=lng,lat
	const position = decode(params.get("position"));
	if (position) {
		const f = position.split(",");
		const pt = makePoint(num(f[1]), num(f[0]), name || (f[2] ?? ""), wgs84);
		if (pt) return pt;
	}

	// uri.amap.com/marker?markers=lng,lat,name|lng,lat,name (take the first point)
	const markers = decode(params.get("markers"));
	if (markers) {
		const f = markers.split("|")[0].split(",");
		const pt = makePoint(num(f[1]), num(f[0]), name || (f[2] ?? ""), wgs84);
		if (pt) return pt;
	}

	// ditu.amap.com/regeo?lng=&lat=  /  androidamap://viewMap?lat=&lon=
	const lat = num(decode(params.get("lat")));
	const lng = num(decode(params.get("lng") ?? params.get("lon") ?? params.get("longitude")));
	if (isFinite(lat) && isFinite(lng)) {
		const pt = makePoint(lat, lng, name, wgs84);
		if (pt) return pt;
	}

	// m.amap.com navigation page: daddr / dest = lng,lat,name
	const dest = decode(params.get("daddr") ?? params.get("dest") ?? params.get("to"));
	if (dest) {
		const f = dest.split(",");
		const pt = makePoint(num(f[1]), num(f[0]), name || (f[2] ?? ""), wgs84);
		if (pt) return pt;
	}

	// iOS-side format in m.amap.com/callAPP: q=lat,lng,name,city,POIID
	const q = decode(params.get("q"));
	if (q) {
		const f = q.split(",");
		const pt = makePoint(num(f[0]), num(f[1]), name || (f[2] ?? ""), wgs84);
		if (pt) return pt;
	}

	// The callAPP page encodes the real target link in the ios/android/wp/mo params; unwrap and parse each one
	if (depth < 2) {
		for (const key of ["mo", "ios", "android", "wp"]) {
			const nested = params.get(key);
			if (!nested) continue;
			const pt = parseAmapString(decode(nested), depth + 1);
			if (pt) return pt;
		}
	}

	return null;
}

// ---- WGS84 -> GCJ-02 ----
// Links with coordinate=wgs84 / dev=1 carry raw GPS coordinates, which land a few hundred meters off on AMap tiles.
// AMap's server corrects them during redirects; to stay purely local we convert them with the public GCJ-02 offset algorithm.

const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function wgs84ToGcj02(lat: number, lng: number): { lat: number; lng: number } {
	if (outOfChina(lat, lng)) return { lat, lng };
	let dLat = transformLat(lng - 105.0, lat - 35.0);
	let dLng = transformLng(lng - 105.0, lat - 35.0);
	const radLat = (lat / 180.0) * Math.PI;
	let magic = Math.sin(radLat);
	magic = 1 - GCJ_EE * magic * magic;
	const sqrtMagic = Math.sqrt(magic);
	dLat = (dLat * 180.0) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
	dLng = (dLng * 180.0) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
	return { lat: lat + dLat, lng: lng + dLng };
}

function outOfChina(lat: number, lng: number): boolean {
	return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
	let ret =
		-100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
	ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
	ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
	ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
	return ret;
}

function transformLng(x: number, y: number): number {
	let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
	ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
	ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
	ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
	return ret;
}
