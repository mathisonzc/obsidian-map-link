import { Platform, requestUrl } from "obsidian";

export interface AmapPoint {
	lat: number;
	lng: number;
	name: string;
}

// 高德短链 (surl.amap.com) 首次跳转的 Location 头里直接携带坐标，
// 形如: http://wb.amap.com/?p=POIID,纬度,经度,名称,城市,adcode&src=...
// 因此只需要拿到这一跳的重定向地址即可，不需要真正跟随跳转。

const UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 " +
	"(KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

export async function resolveAmapShortLink(shortUrl: string): Promise<AmapPoint | null> {
	const location = await fetchRedirectLocation(shortUrl);
	if (!location) return null;
	return parseAmapLocation(location);
}

async function fetchRedirectLocation(url: string): Promise<string | null> {
	if (!Platform.isMobileApp) {
		const viaNode = await fetchRedirectLocationNode(url).catch(() => null);
		if (viaNode) return viaNode;
	}
	return fetchRedirectLocationRequestUrl(url).catch(() => null);
}

// 桌面端 (Electron/Node 环境) 下用原生 https 模块发起请求，
// 这样可以拿到未被自动跟随的 302 响应及其 Location 头。
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

// 移动端 (或 Node 方式不可用时) 退化为 Obsidian 的 requestUrl。
// 部分平台会自动跟随重定向，此时会返回 200 且拿不到中间的 Location，
// 这种情况下会解析失败，UI 侧会给出可点击的原始短链兜底。
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

function parseAmapLocation(location: string): AmapPoint | null {
	try {
		const abs = location.startsWith("http") ? location : `https://wb.amap.com${location}`;
		const u = new URL(abs);
		const p = u.searchParams.get("p");
		if (p) {
			// id,纬度,经度,名称,城市,adcode
			const parts = p.split(",");
			const lat = parseFloat(parts[1]);
			const lng = parseFloat(parts[2]);
			const name = parts[3] ?? "";
			if (isFinite(lat) && isFinite(lng)) {
				return { lat, lng, name };
			}
		}
	} catch (e) {
		// 忽略，走下面的兜底正则
	}
	const m = location.match(/(-?\d{1,3}\.\d{3,8}),(-?\d{1,3}\.\d{3,8})/);
	if (m) {
		const a = parseFloat(m[1]);
		const b = parseFloat(m[2]);
		if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
			return { lat: a, lng: b, name: "" };
		}
	}
	return null;
}
