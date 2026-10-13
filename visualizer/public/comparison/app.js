const embeddedData = document.querySelector("#comparison-data");
const data = embeddedData ? JSON.parse(embeddedData.textContent) : await fetch("data.json").then((response) => {
  if (!response.ok) throw new Error("The comparison data could not be loaded.");
  return response.json();
}).catch((error) => {
  const message = document.createElement("p");
  message.className = "error";
  message.textContent = error.message;
  document.querySelector(".workspace").prepend(message);
  throw error;
});

const names = ["Base", "Function", "Mouse", "Meta", "Plain", "Digits", "Caps Snake"];
const mediaKeys = new Set([6, 20, 34, 39, 21, 7]);
const thumbKeys = new Set([35, 36, 52, 65, 66, 67, 37, 38, 53, 68, 69, 70]);
const state = { layer: 0, inherited: true, selected: null, preview: null, filter: null };
const svgNS = "http://www.w3.org/2000/svg";
const alias = {
  NUMBER_1: "1", ESCAPE: "Esc", BACKSPACE: "Bksp", DELETE: "Del", ENTER: "Enter", TAB: "Tab", SPACE: "Space",
  HOME: "Home", END: "End", LEFT: "←", RIGHT: "→", UP: "↑", DOWN: "↓", PAGE_UP: "PgUp", PAGE_DOWN: "PgDn",
  PAUSE_BREAK: "Pause", SCROLLLOCK: "ScrLk", PRINTSCREEN: "PrtSc", K_CONTEXT_MENU: "Menu", C_MUTE: "Mute",
  C_VOLUME_UP: "Vol+", C_VOLUME_DOWN: "Vol−", C_PLAY_PAUSE: "Play", C_NEXT: "Next", C_PREV: "Prev",
  SLASH: "/", LEFT_BRACKET: "[", RIGHT_BRACKET: "]", GRAVE: "`", MINUS: "−", EQUAL: "=", SQT: "'",
  Z: "Z", PERIOD: ".", COMMA: ",", SEMICOLON: ";", BACKSLASH: "\\", UNDERSCORE: "_",
  LGUI: "GUI", LEFT_GUI: "GUI", LALT: "Alt", LEFT_ALT: "Alt", LCTRL: "Ctrl", LSHFT: "Shift", LEFT_SHIFT: "Shift",
};

function tokenLabel(token) {
  if (alias[token]) return alias[token];
  if (/^N\d$/.test(token)) return token.slice(1);
  if (/^LS\([A-Z]\)$/.test(token)) return token.slice(3, -1);
  if (/^LC\([A-Z]\)$/.test(token)) return `Ctrl+${token.slice(3, -1)}`;
  return token.replaceAll("_", " ");
}

function describe(binding, board) {
  const [behavior, ...args] = binding.split(/\s+/);
  if (behavior === "&kp") return [tokenLabel(args.join(" ")), /^LS\(/.test(args[0]) ? "Shift" : ""];
  if (/^&(left|right)_/.test(behavior)) return [tokenLabel(args.at(-1)), tokenLabel(args[0])];
  if (behavior === "&lt") return [tokenLabel(args[1]), `Hold ${names[Number(args[0])]}`];
  if (behavior === "&to") return [names[Number(args[0])] ?? `L${args[0]}`, "Go to"];
  if (behavior === "&mo") return [names[Number(args[0])] ?? `L${args[0]}`, "Hold"];
  if (behavior === "&trans") return ["▽", "Inherited"];
  if (behavior === "&none") return ["∅", "Disabled"];
  if (behavior === "&snake_td") return ["Snake", "Tap / ×2"];
  if (behavior === "&caps_snake") return ["Snake", "Cancel"];
  if (behavior === "&bootloader") return ["Boot", "Flash mode"];
  if (behavior === "&studio_unlock") return ["Unlock", "Studio"];
  if (behavior === "&macro_ver") return ["Version", "Type"];
  if (behavior === "&rgb_batt") return board === "advantage" ? ["Battery", "Hold"] : ["Status", "10 sec"];
  if (behavior === "&stp") return ["Battery", "Status"];
  if (behavior === "&bt") return args[0] === "BT_SEL" ? [`BT ${Number(args[1]) + 1}`, "Select"] : ["BT clear", "Pairing"];
  if (behavior === "&bl") return ["Light", { BL_TOG: "Toggle", BL_INC: "+", BL_DEC: "−" }[args[0]] ?? args[0]];
  if (behavior === "&rgb_ug") return args[0] === "RGB_STATUS" ? ["Status", "10 sec"] : ["RGB", { RGB_TOG: "Toggle", RGB_BRI: "+", RGB_BRD: "−" }[args[0]] ?? args[0]];
  if (behavior === "&msc") return ["Scroll", { SCRL_LEFT: "←", SCRL_RIGHT: "→", SCRL_UP: "↑", SCRL_DOWN: "↓" }[args[0]] ?? args[0]];
  return [behavior.slice(1), args.join(" ")];
}

function bindingAt(board, position) {
  const raw = data[board].layers[state.layer][position];
  if (raw !== "&trans" || !state.inherited) return { raw, display: raw, inherited: false };
  const fallbackLayers = state.layer === 5 ? [4, 0] : [0];
  for (const layer of fallbackLayers) {
    const binding = data[board].layers[layer][position];
    if (binding !== "&trans") return { raw, display: binding, inherited: true };
  }
  return { raw, display: raw, inherited: true };
}

function categories(source) {
  const result = [];
  if (typeof source === "string") return ["extra"];
  if (mediaKeys.has(source)) result.push("media");
  if (thumbKeys.has(source)) result.push("thumb");
  const position = data.mapping.indexOf(source);
  if (data.advantage.layers[state.layer][source] !== data.glove80.layers[state.layer][position] ||
      (state.layer === 3 && data.advantage.layers[state.layer][source] === "&rgb_batt")) result.push("hardware");
  return result;
}

function svgElement(tag, attributes, text) {
  const element = document.createElementNS(svgNS, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderKeyboard(board) {
  const svg = document.getElementById(board);
  svg.replaceChildren(svgElement("title", {}, `${board === "advantage" ? "Advantage 360 Pro" : "Glove80"} — ${names[state.layer]}`));
  for (const key of data[board].keys) {
    const source = board === "advantage" ? key.position : data.mapping[key.position];
    const binding = bindingAt(board, key.position);
    const [primary, secondary] = describe(binding.display, board);
    const types = categories(source);
    const type = types.at(-1);
    const offset = board === "advantage" ? 100 : 0;
    const x = key.x * 100;
    const y = key.y * 100 + offset;
    const width = key.width * 100;
    const height = key.height * 100;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const group = svgElement("g", {
      class: `key ${type ? `${type}-key` : ""} ${binding.inherited ? "inherited" : ""} ${binding.display === "&none" ? "disabled" : ""}`,
      transform: `rotate(${key.rotation} ${key.rotationX * 100} ${key.rotationY * 100 + offset})`,
      tabindex: "0", role: "button", "aria-label": `Position ${key.position}: ${primary}${secondary ? `, ${secondary}` : ""}. Select to compare.`,
      "data-source": source, "data-categories": types.join(" "), "data-position": key.position, "data-board": board,
    });
    group.append(svgElement("rect", { x: x + 4, y: y + 4, width: width - 8, height: height - 8, rx: 10 }));
    const labels = svgElement("g", { transform: `rotate(${-key.rotation} ${centerX} ${centerY})` });
    labels.append(svgElement("text", { x: centerX, y: centerY + (secondary ? -1 : 8), class: primary.length > 6 ? "label long" : "label" }, primary));
    if (secondary) labels.append(svgElement("text", { x: centerX, y: centerY + 22, class: "sublabel" }, secondary.replace("Function", "Fn").replace("Caps Snake", "Snake")));
    group.append(labels, svgElement("title", {}, `Position ${key.position}\n${binding.raw}${binding.inherited ? `\nInherited: ${binding.display}` : ""}`));
    const trace = () => { state.preview = source; updateTrace(); };
    const select = () => { state.selected = source; state.preview = null; updateTrace(); };
    group.addEventListener("pointerenter", trace);
    group.addEventListener("pointerleave", () => { state.preview = null; updateTrace(); });
    group.addEventListener("focus", trace);
    group.addEventListener("blur", () => { state.preview = null; updateTrace(); });
    group.addEventListener("click", select);
    group.addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key)) { event.preventDefault(); select(); }
      if (event.key === "Escape") clearSelection();
    });
    svg.append(group);
  }
}

function updateTrace() {
  const source = state.preview ?? state.selected;
  for (const key of document.querySelectorAll(".key")) {
    key.classList.toggle("trace-match", source !== null && key.dataset.source === String(source));
    key.classList.toggle("dimmed", Boolean(state.filter) && !key.dataset.categories.split(" ").includes(state.filter));
  }
  document.getElementById("clear").hidden = state.selected === null;
  const heading = document.getElementById("trace-heading");
  const note = document.getElementById("trace-note");
  const bindings = document.getElementById("trace-bindings");
  bindings.replaceChildren();
  if (source === null) {
    heading.textContent = state.filter ? `Showing ${state.filter === "extra" ? "added keys" : state.filter === "hardware" ? "hardware adaptations" : `${state.filter} keys`}` : "Find a key on both keyboards";
    note.textContent = "Hover, focus, or select a key. Its counterpart lights up on the other layout.";
    return;
  }
  const isExtra = typeof source === "string";
  const glovePosition = data.mapping.indexOf(source);
  const labels = describe(bindingAt("glove80", glovePosition).display, "glove80");
  heading.textContent = `${labels.filter(Boolean).join(" · ")} — ${isExtra ? "Glove80 only" : `Advantage ${source} ↔ Glove80 ${glovePosition}`}`;
  const types = categories(source);
  if (types.includes("hardware")) {
    const original = data.advantage.layers[state.layer][source];
    note.textContent = original.includes("&bl") ? "Advantage backlight control becomes the corresponding Glove80 RGB control." : "Glove80 uses its native status display, lasting about ten seconds after a press. The Advantage Enter-thumb battery peek lasts while held.";
  } else if (isExtra) {
    note.textContent = "An extra top-row key with no Advantage counterpart. F11–F14 are available in Base, Plain, and Digits; transparent in Function, Mouse, and Caps Snake; disabled in Meta.";
  } else if (types.includes("media")) {
    note.textContent = "Moved from the Advantage's inner keywell column to the Glove80's extra top row. Its layer-specific binding is preserved.";
  } else if (types.includes("thumb")) {
    note.textContent = "The same function in an adapted thumb cluster. Glove80 uses two curved rows of three keys per hand.";
  } else {
    note.textContent = "The same binding at the corresponding main-keywell position. Letter rows, modifier fingers, navigation, and corner switches are preserved.";
  }
  for (const board of ["advantage", "glove80"]) {
    const block = document.createElement("div");
    block.className = "binding-block";
    const caption = document.createElement("span");
    caption.textContent = board === "advantage" ? "Advantage" : "Glove80";
    const code = document.createElement("code");
    code.textContent = board === "advantage" && isExtra ? "No corresponding key" : data[board].layers[state.layer][board === "advantage" ? source : glovePosition];
    block.append(caption, code);
    bindings.append(block);
    if (board === "advantage") {
      const arrow = document.createElement("span");
      arrow.className = "trace-arrow";
      arrow.textContent = "→";
      bindings.append(arrow);
    }
  }
}

function clearSelection() { state.selected = null; state.preview = null; updateTrace(); }
function render() {
  document.querySelectorAll(".tab").forEach((tab) => tab.setAttribute("aria-pressed", Number(tab.dataset.layer) === state.layer ? "true" : "false"));
  document.getElementById("adv-layer").textContent = document.getElementById("glove-layer").textContent = `${names[state.layer]} · layer ${state.layer}`;
  renderKeyboard("advantage");
  renderKeyboard("glove80");
  updateTrace();
}

for (const layer of data.layers) {
  const button = document.createElement("button");
  button.className = "tab";
  button.dataset.layer = layer.index;
  button.textContent = names[layer.index];
  button.addEventListener("click", () => { state.layer = layer.index; state.preview = null; render(); });
  document.getElementById("layers").append(button);
}
document.getElementById("inherited").addEventListener("change", (event) => { state.inherited = event.target.checked; render(); });
document.getElementById("emphasize").addEventListener("change", (event) => document.querySelector(".workspace").classList.toggle("no-emphasis", !event.target.checked));
document.getElementById("clear").addEventListener("click", clearSelection);
for (const button of document.querySelectorAll(".row-focus")) {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    if (state.filter === "hardware") state.layer = 3;
    if (state.filter === "extra") state.layer = 0;
    clearSelection();
    document.querySelectorAll("tbody tr").forEach((row) => row.classList.toggle("active", row.dataset.category === state.filter));
    document.getElementById("reset-filter").hidden = false;
    render();
    document.querySelector(".workspace").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  });
}
document.getElementById("reset-filter").addEventListener("click", (event) => {
  state.filter = null;
  document.querySelectorAll("tbody tr").forEach((row) => row.classList.remove("active"));
  event.target.hidden = true;
  updateTrace();
});
render();
