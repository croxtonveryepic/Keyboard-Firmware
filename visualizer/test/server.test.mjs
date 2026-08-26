import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createVisualizerServer } from "../server.mjs";

function keymapSource(bindings) {
  return `/ { keymap { live_layer { display-name = "Live"; bindings = < ${bindings.join(" ")} >; }; }; };`;
}

async function readServerEvent(response, eventName) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      throw new Error(`Event stream closed before ${eventName}.`);
    }
    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      const lines = message.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
      const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
      if (event === eventName && data) {
        await reader.cancel();
        return JSON.parse(data);
      }
    }
  }
}

test("serves the parsed keymap and pushes updates when the file changes", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "adv360-visualizer-"));
  const keymapPath = join(temporaryDirectory, "test.keymap");
  const layoutPath = join(temporaryDirectory, "info.json");
  await writeFile(layoutPath, JSON.stringify({ id: "test", layouts: { LAYOUT: { layout: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] } } }));
  await writeFile(keymapPath, keymapSource(["&kp A", "&kp B", "&kp C"]));

  const visualizer = await createVisualizerServer({ port: 0, keymapPath, layoutPath });
  try {
    const initialResponse = await fetch(`${visualizer.url}/api/keymap`);
    const initialSnapshot = await initialResponse.json();
    assert.equal(initialSnapshot.layers[0].keyCount, 3);
    assert.equal(initialSnapshot.layers[0].validKeyCount, true);

    const pageResponse = await fetch(visualizer.url);
    const viewModelResponse = await fetch(`${visualizer.url}/view-model.js`);
    assert.equal(pageResponse.status, 200);
    assert.match(pageResponse.headers.get("content-type"), /text\/html/);
    assert.equal(viewModelResponse.status, 200);
    assert.match(viewModelResponse.headers.get("content-type"), /text\/javascript/);

    const eventResponse = await fetch(`${visualizer.url}/events`);
    const updatePromise = readServerEvent(eventResponse, "keymap");
    await writeFile(keymapPath, keymapSource(["&kp A", "&kp B", "&kp C", "&kp D"]));
    const timeout = AbortSignal.timeout(3000);
    const updatedSnapshot = await Promise.race([
      updatePromise,
      new Promise((_, reject) => timeout.addEventListener("abort", () => reject(new Error("Timed out waiting for hot reload.")), { once: true })),
    ]);

    assert.equal(updatedSnapshot.revision, 2);
    assert.equal(updatedSnapshot.layers[0].keyCount, 4);
    assert.match(updatedSnapshot.layers[0].warnings.join(" "), /shown as overflow/);
  } finally {
    await visualizer.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
