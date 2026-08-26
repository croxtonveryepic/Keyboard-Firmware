export function formatKeyToken(token) {
  const aliases = new Map([
    ["ESCAPE", "Escape"], ["BACKSPACE", "Backspace"], ["DELETE", "Delete"], ["ENTER", "Enter"],
    ["SPACE", "Space"], ["TAB", "Tab"], ["PAGE_UP", "Page Up"], ["PAGE_DOWN", "Page Down"],
    ["C_PLAY_PAUSE", "Play / Pause"], ["C_VOLUME_UP", "Volume Up"], ["C_VOLUME_DOWN", "Volume Down"],
    ["C_NEXT", "Next Track"], ["C_PREV", "Previous Track"], ["C_MUTE", "Mute"],
    ["LEFT", "←"], ["RIGHT", "→"], ["UP", "↑"], ["DOWN", "↓"], ["UP_ARROW", "↑"],
  ]);
  if (aliases.has(token)) {
    return aliases.get(token);
  }
  if (/^N\d$/.test(token)) {
    return token.slice(1);
  }
  if (/^NUMBER_\d$/.test(token)) {
    return token.slice(-1);
  }
  return token.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function describeBinding(rawBinding) {
  if (!rawBinding) {
    return { primary: "Empty", secondary: "No binding", empty: true };
  }

  const tokens = rawBinding.trim().split(/\s+/);
  const behavior = tokens.shift()?.replace(/^&/, "") ?? "";

  if (behavior === "trans") {
    return { primary: "▽", secondary: "Transparent", empty: false };
  }
  if (behavior === "none") {
    return { primary: "∅", secondary: "None", empty: false };
  }
  if (behavior === "kp") {
    return { primary: formatKeyToken(tokens.join(" ")), secondary: "Key press", empty: false };
  }
  if (["to", "mo", "tog"].includes(behavior)) {
    const labels = { to: "Go to", mo: "Hold", tog: "Toggle" };
    return { primary: `Layer ${tokens[0] ?? "?"}`, secondary: labels[behavior], empty: false };
  }
  if (behavior === "lt") {
    return { primary: formatKeyToken(tokens.slice(1).join(" ")), secondary: `Hold layer ${tokens[0] ?? "?"}`, empty: false };
  }

  const primaryToken = tokens.at(-1) ?? behavior;
  const parameterSummary = tokens.slice(0, -1).join(" · ");
  return {
    primary: formatKeyToken(primaryToken),
    secondary: parameterSummary ? `${behavior} · ${parameterSummary}` : "Custom behavior",
    empty: false,
  };
}

export function rotatePoint(x, y, angle, pivotX, pivotY) {
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: pivotX + (x - pivotX) * cosine - (y - pivotY) * sine,
    y: pivotY + (x - pivotX) * sine + (y - pivotY) * cosine,
  };
}

export function keyboardBounds(keys, scale = 100) {
  const points = keys.flatMap((key) => {
    const x = key.x * scale;
    const y = key.y * scale;
    const width = key.width * scale;
    const height = key.height * scale;
    const pivotX = key.rotationX * scale;
    const pivotY = key.rotationY * scale;
    return [
      rotatePoint(x, y, key.rotation, pivotX, pivotY),
      rotatePoint(x + width, y, key.rotation, pivotX, pivotY),
      rotatePoint(x, y + height, key.rotation, pivotX, pivotY),
      rotatePoint(x + width, y + height, key.rotation, pivotX, pivotY),
    ];
  });
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

export function buildLayerView(snapshot, layer) {
  const slots = snapshot.keyboard.keys.map((key) => {
    const binding = layer.bindings[key.position] ?? null;
    return { ...key, binding, description: describeBinding(binding) };
  });
  const overflow = layer.bindings.slice(snapshot.expectedKeyCount).map((binding, overflowIndex) => ({
    binding,
    description: describeBinding(binding),
    position: snapshot.expectedKeyCount + overflowIndex,
  }));

  return {
    slots,
    overflow,
    missingCount: slots.filter((slot) => slot.binding === null).length,
  };
}
