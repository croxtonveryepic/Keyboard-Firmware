import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseKeymap } from "../../visualizer/src/keymap-parser.mjs";
import { glove80Rows, glove80Hands, mapGlove80Layer } from "../glove80-layout.mjs";

const advantage = parseKeymap(await readFile(new URL("../../config/adv360.keymap", import.meta.url), "utf8"));
const glove80 = parseKeymap(await readFile(new URL("../../config/glove80/glove80.keymap", import.meta.url), "utf8"), { expectedKeyCount: 80 });

test("all 76 Advantage positions survive exactly once, with four additional Glove80 keys", () => {
  const positions = glove80Rows.flat();
  assert.equal(positions.length, 80);
  assert.deepEqual(positions.filter(Number.isInteger).sort((a, b) => a - b), Array.from({ length: 76 }, (_, i) => i));
});

test("home-row trigger groups partition all keys on the correct physical hands", () => {
  const { left, right, thumbs } = glove80Hands;
  assert.deepEqual([...left, ...right, ...thumbs].sort((a, b) => a - b), Array.from({ length: 80 }, (_, i) => i));
  assert.ok([35, 36, 37, 38].every((position) => left.includes(position)));
  assert.ok([41, 42, 43, 44].every((position) => right.includes(position)));
  assert.deepEqual(thumbs, [52, 53, 54, 55, 56, 57, 69, 70, 71, 72, 73, 74]);
});

test("all seven layers retain their index and have exactly 80 keys", () => {
  assert.equal(advantage.hasInvalidLayers, false);
  assert.equal(glove80.hasInvalidLayers, false);
  assert.equal(glove80.layers.length, 7);
  assert.deepEqual(glove80.layers.map((layer) => layer.id), advantage.layers.map((layer) => layer.id));
  for (const layer of advantage.layers) {
    assert.deepEqual(glove80.layers[layer.index].bindings, mapGlove80Layer(layer).flat());
  }
});

test("base letters, modifier fingers, thumb layer taps, and corner switches match the Advantage", () => {
  const base = glove80.layers[0].bindings;
  assert.deepEqual(base.slice(34, 46), [
    "&kp X", "&left_pinky LGUI S", "&left_ring1 LALT N", "&left_middy LCTRL R", "&left_index LSHFT T", "&kp M",
    "&kp Y", "&right_index LSHFT C", "&right_middy LCTRL O", "&right_ring1 LALT I", "&right_pinky LGUI E", "&kp J",
  ]);
  assert.deepEqual(base.slice(69, 75), ["&lt 1 TAB", "&lt 2 SPACE", "&kp ESCAPE", "&kp DELETE", "&kp BACKSPACE", "&kp ENTER"]);
  assert.equal(base[10], "&to 0");
  assert.equal(base[21], "&to 2");
  assert.equal(base[64], "&to 4");
  assert.equal(base[79], "&to 1");
});

test("plain base, digits, and caps-snake remain usable on the remapped keys", () => {
  assert.equal(glove80.layers[4].bindings[35], "&kp S");
  assert.equal(glove80.layers[4].bindings[69], "&mo 5");
  assert.deepEqual(glove80.layers[5].bindings.slice(35, 40), ["&kp N1", "&kp N2", "&kp N3", "&kp N4", "&kp N5"]);
  assert.deepEqual(glove80.layers[5].bindings.slice(47, 52), ["&kp N6", "&kp N7", "&kp N8", "&kp N9", "&kp N0"]);
  assert.equal(glove80.layers[6].bindings[46], "&caps_snake CAPS_SNAKE_CANCEL");
  assert.equal(glove80.layers[6].bindings[54], "&kp UNDERSCORE");
});

test("media and bootloaders move to the top row, with native RGB status and brightness controls", () => {
  const base = glove80.layers[0].bindings;
  assert.deepEqual(base.slice(0, 3), ["&kp C_MUTE", "&kp C_VOLUME_UP", "&kp C_VOLUME_DOWN"]);
  assert.deepEqual(base.slice(7, 10), ["&kp C_PREV", "&kp C_NEXT", "&kp C_PLAY_PAUSE"]);
  const meta = glove80.layers[3].bindings;
  assert.equal(meta[1], "&bootloader");
  assert.equal(meta[8], "&bootloader");
  assert.equal(meta[7], "&rgb_ug RGB_STATUS");
  assert.equal(meta[72], "&rgb_ug RGB_TOG");
  assert.equal(meta[73], "&rgb_ug RGB_TOG");
  assert.equal(meta[74], "&rgb_batt");
  assert.equal(meta[75], "&rgb_ug RGB_BRI");
  assert.equal(meta[76], "&rgb_ug RGB_BRD");
  assert.ok(!meta.some((binding) => /^&(stp|bl)\b/.test(binding)));
});

test("refuses truncated or overflowing source layers", () => {
  for (const length of [75, 77]) {
    assert.throws(() => mapGlove80Layer({ id: "invalid", bindings: Array(length).fill("&trans") }), /expected 76 Advantage bindings/);
  }
});
