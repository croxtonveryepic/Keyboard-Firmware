import { buildLayerView, keyboardBounds } from "./view-model.js";

const svgNamespace = "http://www.w3.org/2000/svg";
const state = { snapshot: null, selectedLayerId: null };

const elements = {
  connectionDot: document.querySelector("#connection-dot"),
  connectionLabel: document.querySelector("#connection-label"),
  sourcePath: document.querySelector("#source-path"),
  updatedAt: document.querySelector("#updated-at"),
  layerTotal: document.querySelector("#layer-total"),
  layerList: document.querySelector("#layer-list"),
  globalWarnings: document.querySelector("#global-warnings"),
  layerNodeName: document.querySelector("#layer-node-name"),
  layerName: document.querySelector("#layer-name"),
  keyCount: document.querySelector("#key-count"),
  layerHealth: document.querySelector("#layer-health"),
  layerWarnings: document.querySelector("#layer-warnings"),
  keyboard: document.querySelector("#keyboard"),
  overflowSection: document.querySelector("#overflow-section"),
  overflowCount: document.querySelector("#overflow-count"),
  overflowList: document.querySelector("#overflow-list"),
  warningTemplate: document.querySelector("#warning-template"),
};

function setConnection(status, label) {
  elements.connectionDot.dataset.status = status;
  elements.connectionLabel.textContent = label;
}

function renderWarnings(container, warnings) {
  container.replaceChildren();
  for (const warning of warnings) {
    const fragment = elements.warningTemplate.content.cloneNode(true);
    fragment.querySelector("p").textContent = warning;
    container.append(fragment);
  }
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNamespace, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, String(value));
  }
  return element;
}

function renderKeyboard(layer, layerView) {
  const layoutKeys = layerView.slots;
  const scale = 100;
  const padding = 34;
  const bounds = keyboardBounds(layoutKeys, scale);
  const viewBox = [bounds.minX - padding, bounds.minY - padding, bounds.maxX - bounds.minX + padding * 2, bounds.maxY - bounds.minY + padding * 2];
  elements.keyboard.setAttribute("viewBox", viewBox.join(" "));
  elements.keyboard.setAttribute("aria-label", `${layer.name}, ${layer.keyCount} bindings on a ${layoutKeys.length}-key Advantage360 layout`);
  elements.keyboard.replaceChildren(createSvgElement("title", { id: "keyboard-title" }));
  elements.keyboard.firstElementChild.textContent = `${layer.name} keyboard layout`;

  for (const key of layoutKeys) {
    const { binding, description } = key;
    const x = key.x * scale;
    const y = key.y * scale;
    const width = key.width * scale;
    const height = key.height * scale;
    const group = createSvgElement("g", {
      class: `key${description.empty ? " key-empty" : ""}`,
      transform: key.rotation ? `rotate(${key.rotation} ${key.rotationX * scale} ${key.rotationY * scale})` : "",
      tabindex: "0",
      role: "group",
      "aria-label": `Position ${key.position}: ${binding ?? "empty"}`,
    });
    group.append(createSvgElement("rect", { x: x + 4, y: y + 4, width: width - 8, height: height - 8, rx: 10 }));

    const foreignObject = createSvgElement("foreignObject", { x: x + 10, y: y + 9, width: width - 20, height: height - 18 });
    const keyContent = document.createElement("div");
    keyContent.className = "key-content";

    const position = document.createElement("span");
    position.className = "key-position";
    position.textContent = key.position;
    const primary = document.createElement("strong");
    primary.textContent = description.primary;
    const secondary = document.createElement("span");
    secondary.className = "key-secondary";
    secondary.textContent = description.secondary;
    keyContent.append(position, primary, secondary);
    foreignObject.append(keyContent);
    group.append(foreignObject);

    const title = createSvgElement("title");
    title.textContent = `Position ${key.position}: ${binding ?? "empty"}`;
    group.append(title);
    elements.keyboard.append(group);
  }
}

function renderOverflow(layerView) {
  const { overflow } = layerView;
  elements.overflowSection.hidden = overflow.length === 0;
  elements.overflowCount.textContent = overflow.length;
  elements.overflowList.replaceChildren();

  overflow.forEach(({ binding, description, position: bindingPosition }) => {
    const card = document.createElement("article");
    card.className = "overflow-key";
    const position = document.createElement("span");
    position.textContent = `Position ${bindingPosition}`;
    const primary = document.createElement("strong");
    primary.textContent = description.primary;
    const raw = document.createElement("code");
    raw.textContent = binding;
    card.append(position, primary, raw);
    elements.overflowList.append(card);
  });
}

function renderLayerList() {
  elements.layerList.replaceChildren();
  for (const layer of state.snapshot.layers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "layer-button";
    button.dataset.selected = String(layer.id === state.selectedLayerId);
    button.addEventListener("click", () => {
      state.selectedLayerId = layer.id;
      render();
    });

    const number = document.createElement("span");
    number.className = "layer-number";
    number.textContent = String(layer.index);
    const label = document.createElement("span");
    label.className = "layer-button-label";
    label.innerHTML = `<strong></strong><small></small>`;
    label.querySelector("strong").textContent = layer.name;
    label.querySelector("small").textContent = layer.nodeName;
    const health = document.createElement("span");
    health.className = `layer-indicator${layer.validKeyCount ? "" : " invalid"}`;
    health.title = layer.validKeyCount ? "Valid key count" : layer.warnings.join(" ");
    button.append(number, label, health);
    elements.layerList.append(button);
  }
}

function render() {
  const snapshot = state.snapshot;
  if (!snapshot) {
    return;
  }

  if (!snapshot.layers.some((layer) => layer.id === state.selectedLayerId)) {
    state.selectedLayerId = snapshot.layers[0]?.id ?? null;
  }

  elements.sourcePath.textContent = snapshot.sourcePath;
  elements.updatedAt.textContent = `Updated ${new Date(snapshot.updatedAt).toLocaleTimeString()} · revision ${snapshot.revision}`;
  elements.layerTotal.textContent = snapshot.layers.length;
  renderWarnings(elements.globalWarnings, snapshot.warnings);
  renderLayerList();

  const layer = snapshot.layers.find((candidate) => candidate.id === state.selectedLayerId);
  if (!layer) {
    elements.layerNodeName.textContent = "No layers";
    elements.layerName.textContent = "Nothing to display";
    elements.keyCount.textContent = "0 keys";
    elements.layerHealth.textContent = "Unavailable";
    elements.layerHealth.dataset.status = "warning";
    elements.keyboard.replaceChildren();
    elements.overflowSection.hidden = true;
    return;
  }

  elements.layerNodeName.textContent = `Layer ${layer.index} · ${layer.nodeName}`;
  elements.layerName.textContent = layer.name;
  elements.keyCount.textContent = `${layer.keyCount} / ${snapshot.expectedKeyCount} keys`;
  elements.layerHealth.textContent = layer.validKeyCount ? "Key count valid" : "Needs attention";
  elements.layerHealth.dataset.status = layer.validKeyCount ? "valid" : "warning";
  renderWarnings(elements.layerWarnings, layer.warnings);
  const layerView = buildLayerView(snapshot, layer);
  renderKeyboard(layer, layerView);
  renderOverflow(layerView);
}

async function loadInitialSnapshot() {
  const response = await fetch("/api/keymap", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Keymap request failed with ${response.status}.`);
  }
  state.snapshot = await response.json();
  render();
}

function connectEvents() {
  const events = new EventSource("/events");
  events.addEventListener("open", () => setConnection("connected", "Watching for changes"));
  events.addEventListener("keymap", (event) => {
    state.snapshot = JSON.parse(event.data);
    render();
    setConnection("connected", "Updated just now");
  });
  events.addEventListener("reload-error", (event) => {
    const detail = JSON.parse(event.data);
    setConnection("error", detail.message);
  });
  events.addEventListener("error", () => setConnection("reconnecting", "Reconnecting"));
}

try {
  await loadInitialSnapshot();
  connectEvents();
} catch (error) {
  setConnection("error", error instanceof Error ? error.message : String(error));
}
