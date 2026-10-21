# Obsidian Plugin Publishing Guide

A general process for publishing an Obsidian community plugin, from code-ready to users being able to find it under
Obsidian's "Settings → Community plugins → Browse". It isn't specific to any one plugin; any Obsidian
plugin project can follow it. For this project's local development/testing notes, see [`DEVELOPMENT.md`](./DEVELOPMENT.md).

> ⚠️ In 2026 Obsidian replaced the submission process of "fork `obsidianmd/obsidian-releases`, edit
> `community-plugins.json`, open a PR" with a web form (community.obsidian.md).
> The `obsidianmd/obsidian-releases` repository now **does not accept external PRs**
> (`pull_request_creation_policy: collaborators_only`). Many online/older docs
> still describe the PR process; those are outdated, so follow this document instead.

## Overview

```
Prepare manifest.json/LICENSE
        ↓
Push the code to GitHub (public repository)
        ↓
Create a Release with the build artifacts
        ↓
Connect your GitHub account on community.obsidian.md (once only, see Step 5)
        ↓
Submit the plugin on community.obsidian.md (enter the repository URL)
        ↓
Wait for automated / manual review
        ↓
The plugin appears in the community plugin directory in Obsidian
```

---

## Step 1: Prerequisites

- A **GitHub account** (the repository must be **public**) + an **Obsidian account**
  (submission happens on community.obsidian.md, signed in with your Obsidian account).
- The repository root must contain a **`LICENSE`** file (submissions without one are rejected).
- The `id` in `manifest.json` must be **globally unique** and **must not contain "obsidian"**
  (this is validated automatically on submission; you can also search
  [community-plugins.json](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json)
  first to see if it's taken — that file is still the actual data source of the directory index, it just no longer accepts external PRs).

## Step 2: Complete `manifest.json`

```json
{
	"id": "your-plugin-id",
	"name": "Your Plugin Name",
	"version": "1.0.0",
	"minAppVersion": "1.0.0",
	"description": "One sentence describing what the plugin does.",
	"author": "your-github-username",
	"authorUrl": "https://github.com/your-github-username",
	"isDesktopOnly": false
}
```

Key points:
- Once the `id` passes review, it **can never be changed** (changing it effectively makes a new plugin).
- Neither `id` nor `name` may **contain "obsidian"** (an official rule to avoid confusion with official products).
- Keep `description` under 250 characters, and don't start it with "Obsidian".
- `isDesktopOnly`: if the plugin depends on APIs unavailable on mobile (such as native Node modules)
  and you've confirmed it doesn't run on mobile, set it to `true`; if you've tested both desktop and mobile, keep it `false`.

## Step 3: Push the code to GitHub

```bash
git init                      # if not initialized yet
git add .                     # build artifacts such as main.js should stay in .gitignore
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

> `main.js` (a build artifact) doesn't need to be committed to the branch; it's only uploaded in the **Release** in the next step.

If you don't have a LICENSE, add one (e.g. MIT):

```bash
curl -s https://raw.githubusercontent.com/licenses/license-templates/master/templates/mit.txt \
  -o LICENSE   # or tick "Choose a license" when creating the repository on GitHub
```

## Step 4: Create a Release

Obsidian's plugin directory **does not build from source**; it downloads three files directly from a
**Release** in your GitHub repository: `manifest.json`, `main.js` and `styles.css`
(`styles.css` can be omitted if you have no custom styles).

**Build locally**

```bash
npm install
npm run build      # produces main.js
```

**Create the Release**

**The Release tag name must exactly match the `version` in `manifest.json`**
(no `v` prefix: the tag is `1.0.0`, not `v1.0.0`).

On the GitHub website: repository page → `Releases` → `Draft a new release` →
`Choose a tag` and enter the version (create new) → **drag and drop** `manifest.json`/`main.js`/`styles.css`
as binary attachments (don't zip them) → `Publish release`.

Or do it all at once with the `gh` CLI:

```bash
gh release create 1.0.0 \
  manifest.json main.js styles.css \
  --title "1.0.0" \
  --notes "Initial release"
```

## Step 5: Connect your GitHub account on community.obsidian.md (required for your first submission)

This step is easy to miss — **signing in with your Obsidian account does not connect GitHub automatically**. You must
connect it manually once before submitting a plugin, or submission fails with:

> `You do not own this repository. Connect your GitHub account and ensure
> the repo owner matches your username or an organization you administer.`

Steps:
1. Open <https://community.obsidian.md>, click your avatar in the top right (User menu) → **Account**,
   or go directly to <https://community.obsidian.md/account/profile>.
2. Find the **GitHub** row. When not connected it shows **"Not connected"** and a
   **Connect** button (with the note "We request read-only access to your public
   profile to verify account ownership").
3. Click **Connect** and go through GitHub OAuth authorization (read-only public profile access).
4. Once authorized, the row changes to **"Connected as \<your GitHub username\>"**,
   with `Refresh organizations` / `Disconnect` buttons next to it.

You need to sign in and click through this yourself; it can't be scripted. **You only need to do it once**;
after that, submitting plugins from any repository doesn't require reconnecting.

## Step 6: Submit the plugin on community.obsidian.md

1. Top-right User menu → **Your plugins** (`/account/plugins`);
   the page says "Claim repositories to manage their plugin listings".
2. Click **New plugin** (`/account/plugins/new`) to open the "Submit a new plugin" form:
   - **GitHub repository URL**: your plugin repository URL, e.g.
     `https://github.com/<your-username>/<repo-name>`
   - **Owner**: choose `Myself` or an organization you administer
     (this only determines who maintains the directory listing and isn't restricted by the repository's actual GitHub owner)
   - Tick **"I have read and agree to the Developer Policies."**
     (link: <https://docs.obsidian.md/Developer+policies>)
   - Tick **"I commit to continue supporting this plugin, and remove it or
     transfer it if I can no longer provide support."**
   - The **Submit** button only becomes active once both boxes are ticked; click it to submit.

On submission, the system automatically reads `manifest.json` from the **HEAD of the default branch** for validation.

## Step 7: Handle review feedback

- After submission the system reviews automatically, and problems are shown directly on the
  submission/plugin details page on community.obsidian.md (not as GitHub PR comments).
- When changes are needed: fix the code → bump `version` in `manifest.json` → create a new
  Release → the system picks up the latest state automatically, with no need to fill in the submission form again.
- Once approved, the plugin appears in Obsidian's "Browse community plugins" list.

## Step 8: Releasing later versions

For each new version, you only need to:

1. Update `version` in `manifest.json` (e.g. `1.0.1`), and update
   `minAppVersion` too if you raised it.
2. Add an entry `"1.0.1": "1.0.0"` to `versions.json` (meaning the minimum Obsidian version
   this plugin version supports).
3. Run `npm run build` and create a new Release (the tag must again equal the new version),
   uploading the new `manifest.json` / `main.js` / `styles.css`.
4. You **don't need** to resubmit on community.obsidian.md — the directory index only records your
   repository URL; Obsidian automatically pulls updates from your repository's latest Release, and users
   get an update notification.

---

## Common issues / rejection reasons (check beforehand)

- **`You do not own this repository...`**: your GitHub account isn't connected; go back to Step 5.
- The `id` in `manifest.json` conflicts with an existing plugin, or `id`/`name` contains "obsidian".
- Forgot to add a `LICENSE`.
- The Release tag doesn't match `version` in `manifest.json`.
- `main.js` / `manifest.json` weren't uploaded directly to the Release (they were zipped instead).
- The code contains hard-coded keys/tokens, or calls external services unrelated to the plugin's function.
- Uses discouraged patterns such as `innerHTML`/`eval`.
- `README.md` doesn't explain what the plugin does and how to use it.

## Reference links

- Official plugin submission docs: <https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>
- Plugin guidelines/review checklist: <https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines>
- Developer policies: <https://docs.obsidian.md/Developer+policies>
- Plugin submission page: <https://community.obsidian.md/account/plugins/new>
- Account GitHub connection page: <https://community.obsidian.md/account/profile>
