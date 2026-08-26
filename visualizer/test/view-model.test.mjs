import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildLayerView, describeBinding, keyboardBounds } from "../public/view-model.js";
import { parseKeymap } from "../src/keymap-parser.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "..", "..");

async function loadAdvantage360Geometry() {
  const info = JSON.parse(await readFile(resolve(repositoryRoot, "config", "info.json"), "utf8"));
  return info.layouts.LAYOUT.layout.map((key, position) => ({
    position,
    x: Number(key.x ?? 0),
    y: Number(key.y ?? 0),
    width: Number(key.w ?? 1),
    height: Number(key.h ?? 1),
    rotation: Number(key.r ?? 0),
    rotationX: Number(key.rx ?? key.x ?? 0),
    rotationY: Number(key.ry ?? key.y ?? 0),
  }));
}

test("builds 76 physical slots and leaves missing bindings empty", async () => {
  const keys = await loadAdvantage360Geometry();
  const source = await readFile(resolve(testDirectory, "fixtures", "invalid-layers.keymap"), "utf8");
  const parsed = parseKeymap(source, { expectedKeyCount: keys.length });
  const snapshot = { ...parsed, keyboard: { keys } };
  const shortLayerView = buildLayerView(snapshot, parsed.layers[0]);

  assert.equal(shortLayerView.slots.length, 76);
  assert.equal(shortLayerView.missingCount, 70);
  assert.equal(shortLayerView.slots[5].binding, "&kp F");
  assert.equal(shortLayerView.slots[6].binding, null);
  assert.deepEqual(shortLayerView.slots[6].description, { primary: "Empty", secondary: "No binding", empty: true });
  assert.deepEqual(shortLayerView.overflow, []);
});

test("partitions extra bindings into positioned overflow cards", async () => {
  const keys = await loadAdvantage360Geometry();
  const source = await readFile(resolve(testDirectory, "fixtures", "invalid-layers.keymap"), "utf8");
  const parsed = parseKeymap(source, { expectedKeyCount: keys.length });
  const snapshot = { ...parsed, keyboard: { keys } };
  const overflowLayerView = buildLayerView(snapshot, parsed.layers[1]);

  assert.equal(overflowLayerView.slots.length, 76);
  assert.equal(overflowLayerView.missingCount, 0);
  assert.deepEqual(overflowLayerView.overflow.map(({ position, binding }) => ({ position, binding })), [
    { position: 76, binding: "&none" },
    { position: 77, binding: "&trans" },
  ]);
});

test("computes bounds that include the Advantage360 rotated thumb clusters", async () => {
  const keys = await loadAdvantage360Geometry();
  const bounds = keyboardBounds(keys);

  assert.equal(keys.length, 76);
  assert.ok(keys.some((key) => key.rotation === 15 && key.height === 2));
  assert.ok(keys.some((key) => key.rotation === -15 && key.height === 2));
  assert.ok(bounds.maxX - bounds.minX > 1750);
  assert.ok(bounds.maxY - bounds.minY > 700);
});

test("creates concise labels for common and custom ZMK bindings", () => {
  assert.deepEqual(describeBinding("&kp C_PLAY_PAUSE"), { primary: "Play / Pause", secondary: "Key press", empty: false });
  assert.deepEqual(describeBinding("&to 4"), { primary: "Layer 4", secondary: "Go to", empty: false });
  assert.deepEqual(describeBinding("&rgb_batt"), { primary: "Rgb Batt", secondary: "Custom behavior", empty: false });
});
