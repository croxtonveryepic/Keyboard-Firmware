# Keyboard keymap visualizer and comparison

This local web app watches `config/adv360.keymap` and renders every active layer on the physical Advantage360 Pro geometry from `config/info.json`. Changes to the keymap appear in the browser without a page refresh.

## Run

From this directory:

```sh
npm start
```

Then open <http://127.0.0.1:3036>.

No package installation is required. The visualizer uses Node.js 20 or newer and has no third-party runtime dependencies.

## Compare the Advantage and Glove80

Open the saved [standalone comparison](../docs/keyboard-layout-comparison.html) directly in a browser. It embeds all data, styling, and JavaScript, uses system fonts, and needs no server, network connection, or authentication. Download the raw HTML if viewing this repository on GitHub. The current [hosted copy](https://advantage-glove80-layout.jccroxton.chatgpt.site) is private and uses ChatGPT sign-in.

Run `npm run compare` from this directory to rebuild the standalone page and `public/comparison/data.json`. To preview the separate web assets, run `npm start` and open <http://127.0.0.1:3036/comparison/index.html>. Both forms present the physical keyboard layouts side by side, with seven layer selectors, matching-key tracing, inherited labels, and highlights for moved media keys, thumb clusters, added keys, and hardware adaptations.

The comparison is a snapshot of both keymap files. Regenerate it after editing the layouts; if the Glove80 keymap is stale, first run `node bin/sync_glove80.mjs` from the repository root. Its Glove80 geometry comes from the pinned MoErgo board definition recorded in `glove80-geometry.json`.

Run `npm run compare:check` to verify that both saved outputs match the current keymaps and page source; CI runs the same check. To prepare a static hosting directory, run `node build-comparison.mjs <destination>`; this copies `index.html`, `style.css`, `app.js`, and `data.json` to that directory. The standalone HTML can also be served on its own. Updating generated files does not redeploy the hosted copy.

To watch a different keymap or listen on a different port:

```sh
node server.mjs --keymap ../config/adv360.keymap --port 4000
```

The `--layout` option can point to another QMK-style `info.json`, although this project defaults to the Advantage360 geometry.

## Validation behavior

The physical layout defines the expected key count. A short layer remains visible with dashed empty slots, and an oversized layer remains visible with extra bindings collected beneath the keyboard as overflow. Both cases produce visible warnings instead of preventing the rest of the keymap from rendering.

## Tests

```sh
npm test
```

The tests cover this repository's real keymap, short layers, overflowing layers, missing bindings, comment handling, the HTTP API, and filesystem-driven hot reload.
