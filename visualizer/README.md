# Advantage360 keymap visualizer

This local web app watches `config/adv360.keymap` and renders every active layer on the physical Advantage360 Pro geometry from `config/info.json`. Changes to the keymap appear in the browser without a page refresh.

## Run

From this directory:

```sh
npm start
```

Then open <http://127.0.0.1:3036>.

No package installation is required. The visualizer uses Node.js 20 or newer and has no third-party runtime dependencies.

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
