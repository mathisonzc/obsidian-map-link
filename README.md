# Map Link

Render map share links as interactive maps inside your Obsidian notes. It currently supports
many kinds of **AMap (Gaode Maps)** location links (short links, URI API links, app schemes, etc.;
see "Supported link formats" below), with Google Maps, OpenStreetMap and other map sources planned.
It also works inside the review cards shown by the Spaced Repetition plugin.

## Installation

**Option 1: Community plugin browser** (available once the plugin is published)

Obsidian Settings → Community plugins → Browse → search for "Map Link" → Install and enable.

**Option 2: Manual installation**

Download `manifest.json`, `main.js` and `styles.css` from the latest [Release](../../releases),
copy them into `<your vault>/.obsidian/plugins/map-link/`,
then enable "Map Link" under Obsidian's "Community plugins" settings.

## Usage

Wrap a map share link in a `maplink` code block in your note:

````markdown
```maplink
https://uri.amap.com/marker?position=116.397428,39.90923&name=Tiananmen
```
````

In reading view, the code block is replaced with an embedded map.

- Map tiles come straight from the corresponding map source, so it looks just like the original map
- The shared coordinate is marked on the map, with the place name shown on hover
- Zoom with the zoom buttons, double-click or pinch; the mouse wheel only zooms while holding `Ctrl`
  (`⌘` on Mac), so scrolling without a modifier scrolls the note as usual instead of being captured by the map
- If a link can't be resolved, it falls back to a clickable original link without breaking the note

Only links inside `maplink` code blocks are rendered; short links elsewhere in the note are not scanned,
to avoid conflicting with how other plugins process links/text.

## Supported link formats (AMap)

| Link type | Example | Notes |
| --- | --- | --- |
| Short link | `https://surl.amap.com/xxxx` | Produced by "Share location" in the app / website. The most common form; needs one network request to resolve |
| URI API single point | `https://uri.amap.com/marker?position=lng,lat&name=Name` | Parsed locally, supports `coordinate=wgs84` |
| URI API multiple points | `https://uri.amap.com/marker?markers=lng,lat,Name\|...` | Parsed locally, uses the first point |
| PC landing page | `https://ditu.amap.com/regeo?lng=&lat=&name=` | Parsed locally |
| Redirect page | `http://wb.amap.com/?p=POIID,lat,lng,Name,City,adcode` | Parsed locally; this is what a short link expands to |
| App launch page / mobile site | `http://m.amap.com/callAPP?...`, `.../navigation/index/...daddr=lng,lat,Name` | Parsed locally |
| App scheme | `iosamap://viewMap?lat=&lon=&poiname=`, `androidamap://...` | Parsed locally, supports `dev=1` (GPS coordinates) |

All formats except short links carry plain-text coordinates and are **parsed entirely locally with no network requests**.

Links that only have a POI ID and no coordinates (such as `https://www.amap.com/place/<POIID>` or
`https://uri.amap.com/marker?poiid=...`) can't be resolved to coordinates without an AMap API key,
so they fall back to a clickable original link.

As for coordinate systems, AMap links use GCJ-02 by default, which lines up with the base map; links marked
with `coordinate=wgs84` / `dev=1` are converted to GCJ-02 locally before the marker is placed.

## How it works (AMap short links)

An AMap short link carries the coordinates in plain text in the `Location` header of its first redirect:

```
Location: http://wb.amap.com/?p=<POI_ID>,<lat>,<lng>,<name>,<city>,<adcode>&src=...
```

The plugin first tries to parse coordinates from the link itself; only forms without coordinates, like short links,
go to the network. On desktop it uses Node's native `https` module to make the request and read that hop's `Location`
header (without following further redirects); on mobile, or when that isn't available, it falls back to Obsidian's
`requestUrl`. Results are cached per short link to avoid repeated requests.

Map tiles use AMap's public tile service, whose coordinate system (GCJ-02) and tiling scheme line up naturally,
so no coordinate correction is needed.

When Google Maps / OpenStreetMap support is added, each will get its own link resolver and tile layer following the
same pattern, while the core rendering/interaction logic (zoom buttons, wheel guard, rendering inside cards, etc.)
stays the same.

## For developers

See [`DEVELOPMENT.md`](./DEVELOPMENT.md) for local development and debugging, and
[`PUBLISHING.md`](./PUBLISHING.md) for publishing to the community plugin directory.
