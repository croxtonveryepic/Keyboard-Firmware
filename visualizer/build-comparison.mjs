import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseKeymap } from "./src/keymap-parser.mjs";
import { glove80Rows, mapGlove80Layer } from "../bin/glove80-layout.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = async (path) => (await readFile(resolve(root, path), "utf8")).replaceAll("\r\n", "\n");
const advantage = parseKeymap(await load("config/adv360.keymap"));
const glove80 = parseKeymap(await load("config/glove80/glove80.keymap"), { expectedKeyCount: 80 });
if (advantage.hasInvalidLayers || glove80.hasInvalidLayers || advantage.layers.length !== glove80.layers.length) {
  throw new Error("Cannot compare invalid or mismatched keymaps.");
}
for (const layer of advantage.layers) {
  if (JSON.stringify(mapGlove80Layer(layer).flat()) !== JSON.stringify(glove80.layers[layer.index].bindings)) {
    throw new Error("Glove80 keymap is stale. Run node bin/sync_glove80.mjs first.");
  }
}
const info = JSON.parse(await load("config/info.json"));
const gloveGeometry = JSON.parse(await load("visualizer/glove80-geometry.json"));
const advantageKeys = Object.values(info.layouts)[0].layout.map((key, position) => ({
  position, x: key.x, y: key.y, width: key.w ?? 1, height: key.h ?? 1,
  rotation: key.r ?? 0, rotationX: key.rx ?? key.x, rotationY: key.ry ?? key.y,
}));
const data = {
  layers: advantage.layers.map((layer) => ({ id: layer.id, name: layer.name, index: layer.index })),
  advantage: { keys: advantageKeys, layers: advantage.layers.map((layer) => layer.bindings) },
  glove80: { keys: gloveGeometry.keys.map((key, position) => ({ ...key, position })), layers: glove80.layers.map((layer) => layer.bindings) },
  mapping: glove80Rows.flat().map((source, position) => typeof source === "number" ? source : `extra:${position}`),
};
const publicDirectory = resolve(root, "visualizer/public/comparison");
const dataJson = JSON.stringify(data);
const template = await load("visualizer/public/comparison/index.html");
const styles = (await load("visualizer/public/comparison/style.css")).replace(/^@import[^\n]*\n/gm, "");
const script = await load("visualizer/public/comparison/app.js");
const escapeClosingTag = (text, tag) => text.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
const standalone = template
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${escapeClosingTag(styles, "style")}</style>`)
  .replace('<script type="module" src="app.js"></script>', () => `<script type="application/json" id="comparison-data">${dataJson.replaceAll("<", "\\u003c")}</script>\n  <script type="module">\n${escapeClosingTag(script, "script")}</script>`);
const outputs = new Map([
  ["visualizer/public/comparison/data.json", dataJson],
  ["docs/keyboard-layout-comparison.html", standalone],
]);
const check = process.argv.includes("--check");
for (const [path, content] of outputs) {
  if (check) {
    if (await load(path) !== content) throw new Error(`${path} is stale. Run node visualizer/build-comparison.mjs.`);
  } else {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    await writeFile(resolve(root, path), content);
  }
}
const destinationArgument = process.argv.slice(2).find((argument) => argument !== "--check");
if (destinationArgument && !check) {
  const destination = resolve(destinationArgument);
  await mkdir(destination, { recursive: true });
  for (const file of ["index.html", "style.css", "app.js", "data.json"]) {
    await copyFile(resolve(publicDirectory, file), resolve(destination, file));
  }
}
console.log(`Comparison ${check ? "verified" : "built"}: ${advantage.layers.length} layers, 76 Advantage keys, 80 Glove80 keys; standalone copy at docs/keyboard-layout-comparison.html.`);
