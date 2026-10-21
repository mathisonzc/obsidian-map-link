# Local Development and Testing Guide

For plugin developers. See [`README.md`](./README.md) for end-user installation and usage,
and [`PUBLISHING.md`](./PUBLISHING.md) for publishing to the Obsidian community plugin directory.

---

## Local deployment and testing

Before submitting to the community plugin directory (see [`PUBLISHING.md`](./PUBLISHING.md)),
run the plugin in your own vault and verify it.

### Option 1: Copy into your vault manually (simplest)

Good for checking the result once when you don't plan to change the code often.

```bash
npm install
npm run build   # produces main.js
```

Copy the three build files into your vault's plugin directory:

```bash
mkdir -p "<path-to-your-vault>/.obsidian/plugins/map-link"
cp manifest.json main.js styles.css \
  "<path-to-your-vault>/.obsidian/plugins/map-link/"
```

Then:

1. Open Obsidian → Settings → Community plugins
2. If "Restricted mode" is on, turn it off first
3. Find "Map Link" in the installed plugins list and enable it

After changing code you need to repeat `npm run build` + `cp` + restart/reload in Obsidian to see the changes.

### Option 2: Dev mode + symlink (recommended, changes take effect automatically)

Good for repeated debugging and code changes, saving you from building and copying by hand each time.

**1. Build in watch mode**

```bash
npm install
npm run dev
```

`npm run dev` starts esbuild in watch mode and regenerates `main.js` whenever the source changes.
Keep the terminal running.

**2. Symlink the plugin directory into your vault**

Instead of copying files each time, symlink the whole project directory into the vault's plugin directory:

```bash
ln -s "$(pwd)" "<path-to-your-vault>/.obsidian/plugins/map-link"
```

> On Windows without WSL, create the symlink with `mklink /D` from an administrator prompt,
> or just copy manually as in Option 1.

**3. Make Obsidian pick up code changes**

Obsidian doesn't reload the plugin automatically when `main.js` changes; trigger it manually:

- Simplest: `Ctrl/Cmd + P` to open the command palette → run `Reload app without saving`
- Or install the community plugin **Hot Reload** (by pjeby), which watches the plugin directory and
  disables/re-enables the plugin for you, with no need to restart Obsidian

### What to test / Checklist

**Basic rendering**

- [ ] Create a note, paste the following code blocks, and switch to reading view

      ```maplink
      https://uri.amap.com/marker?position=116.397428,39.90923&name=Tiananmen
      ```

      ```maplink
      https://surl.amap.com/xxxx
      ```
      (replace `xxxx` with a short link generated via "Share location" in the AMap app)
- [ ] The map container shows correctly (not blank or collapsed to 0 height)
- [ ] Map tiles load and match what the AMap app/website shows
- [ ] A marker appears on the map, and its position and name (e.g. "Tiananmen") match the shared place
- [ ] Multiple different links in the same note each render independently without interfering

**Interaction limits**

- [ ] Scrolling over the map without a modifier key does **not** zoom, and the note scrolls normally
- [ ] Holding `Ctrl` (`⌘` on Mac) while scrolling zooms the map without scrolling the note
- [ ] Scrolling over the map without a modifier shows the "Hold Ctrl/⌘ and scroll to zoom the map" hint,
      which disappears after 1–2 seconds; after moving the mouse out of the map and back in, the hint can appear again
- [ ] The top-left of the map has `+`/`−` zoom buttons that zoom in and out
- [ ] Drag panning works
- [ ] Pinch zoom/drag works on touch devices (if mobile support is needed)

**Spaced Repetition cards (important)**

- [ ] Install and enable the Spaced Repetition plugin
- [ ] Add a note containing a map link to the review queue (with the flashcard markers the plugin requires)
- [ ] Open the review screen; the map renders correctly in the card (not blank or erroring)
- [ ] When flipping a card (question → answer) or moving to the next card, the map re-renders correctly
      with no leftover old maps or signs of memory leaks (flip through a dozen cards and watch for slowdowns)
- [ ] Zoom buttons, dragging and `Ctrl`/`⌘` + wheel zoom also work on the map inside cards

**Network failures / edge cases**

- [ ] Opening a note with a short link while offline degrades gracefully to a clickable original short link,
      rather than erroring or breaking note rendering
- [ ] A short link that is invalid/revoked degrades gracefully as well
- [ ] Opening the same note repeatedly uses the cached short link result instead of making a new request each time
      (check in your system's network monitor that the second open makes no new `surl.amap.com` request)

**Platforms**

- [ ] Desktop (any one of Windows / macOS / Linux; core resolving goes through Node `https`)
- [ ] Mobile (either iOS or Android) — this matters because mobile resolving goes through the
      `requestUrl` fallback path, so whether coordinates resolve needs real-device testing; on failure the fallback link is shown

### Troubleshooting

**The map area is blank, only a gray background**
Most likely the tiles didn't load; check whether you can reach `webrd0{1-4}.is.autonavi.com`.
The container may also have 0 height; inspect the actual size of `.maplink-map` in the
browser/Obsidian developer tools (`Ctrl+Shift+I`).

**Stuck on "Resolving AMap link…"**
The short link request never returned. Open the Console/Network panels in the developer tools to look for errors,
or check whether your network can reach `surl.amap.com` at all.

**The marker is in the wrong place**
First confirm the shared link points to the right place (generate a new share link in the AMap mobile app to compare).
If the position is systematically offset, check whether the tile URL of the tile layer has been changed.

**Opening the developer tools**
`Ctrl/Cmd + Shift + I`, or run `Toggle Developer Tools` from the command palette.
