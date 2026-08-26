import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseKeymap } from "../src/keymap-parser.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "..", "..");

function fixtureWithBindings(bindings, extraLayerSource = "") {
  return `/ {
    keymap {
      compatible = "zmk,keymap";
      sample_layer {
        display-name = "Sample";
        bindings = < ${bindings.join(" ")} >;
      };
      ${extraLayerSource}
      reserved_layer {
        status = "reserved";
      };
    };
  };`;
}

test("parses every active repository layer with the physical key count", async () => {
  const source = await readFile(resolve(repositoryRoot, "config", "adv360.keymap"), "utf8");
  const result = parseKeymap(source, { expectedKeyCount: 76 });

  assert.deepEqual(result.layers.map((layer) => layer.name), ["Base", "Function Keys", "Mouse Keys", "Mod", "Plain", "Digits", "CapsSnk"]);
  assert.equal(result.layers.length, 7);
  assert.equal(result.hasInvalidLayers, false);
  assert.ok(result.layers.every((layer) => layer.keyCount === 76));
});

test("keeps short layers and reports empty physical slots", () => {
  const result = parseKeymap(fixtureWithBindings(["&kp A", "&kp B"]), { expectedKeyCount: 4 });
  const [layer] = result.layers;

  assert.equal(layer.keyCount, 2);
  assert.deepEqual(layer.bindings, ["&kp A", "&kp B"]);
  assert.equal(layer.validKeyCount, false);
  assert.match(layer.warnings.join(" "), /2 slots will be empty/);
});

test("keeps excess bindings and reports overflow", () => {
  const result = parseKeymap(fixtureWithBindings(["&kp A", "&kp B", "&kp C", "&kp D", "&kp E"]), { expectedKeyCount: 3 });
  const [layer] = result.layers;

  assert.equal(layer.keyCount, 5);
  assert.deepEqual(layer.bindings.slice(3), ["&kp D", "&kp E"]);
  assert.equal(layer.validKeyCount, false);
  assert.match(layer.warnings.join(" "), /2 keys will be shown as overflow/);
});

test("ignores comments and preserves behavior parameters as one binding", () => {
  const source = fixtureWithBindings([
    "&left_pinky LGUI S",
    "/* visual separator */ &kp LC(LS(A))",
    "// trailing note\n &lt 2 SPACE",
  ]);
  const result = parseKeymap(source, { expectedKeyCount: 3 });

  assert.deepEqual(result.layers[0].bindings, ["&left_pinky LGUI S", "&kp LC(LS(A))", "&lt 2 SPACE"]);
  assert.equal(result.layers[0].validKeyCount, true);
});

test("shows non-reserved layers without a bindings property instead of dropping them", () => {
  const source = `/ { keymap { empty_layer { display-name = "Empty"; }; }; };`;
  const result = parseKeymap(source, { expectedKeyCount: 76 });

  assert.equal(result.layers[0].keyCount, 0);
  assert.match(result.layers[0].warnings.join(" "), /no bindings property/i);
  assert.match(result.layers[0].warnings.join(" "), /76 slots will be empty/);
});

test("the browser warning fixture contains both underflow and overflow layers", async () => {
  const source = await readFile(resolve(testDirectory, "fixtures", "invalid-layers.keymap"), "utf8");
  const result = parseKeymap(source, { expectedKeyCount: 76 });

  assert.deepEqual(result.layers.map((layer) => layer.keyCount), [6, 78]);
  assert.ok(result.layers.every((layer) => !layer.validKeyCount));
  assert.match(result.layers[0].warnings.join(" "), /70 slots will be empty/);
  assert.match(result.layers[1].warnings.join(" "), /2 keys will be shown as overflow/);
});
