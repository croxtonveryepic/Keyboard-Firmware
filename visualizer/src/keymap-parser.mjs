function maskNonCode(source) {
  const chars = source.split("");
  let state = "code";

  for (let index = 0; index < chars.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (char === "/" && next === "/") {
        chars[index] = " ";
        chars[index + 1] = " ";
        state = "line-comment";
        index += 1;
      } else if (char === "/" && next === "*") {
        chars[index] = " ";
        chars[index + 1] = " ";
        state = "block-comment";
        index += 1;
      } else if (char === '"') {
        chars[index] = " ";
        state = "string";
      }
      continue;
    }

    if (state === "line-comment") {
      if (char === "\n") {
        state = "code";
      } else {
        chars[index] = " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        chars[index] = " ";
        chars[index + 1] = " ";
        state = "code";
        index += 1;
      } else if (char !== "\n") {
        chars[index] = " ";
      }
      continue;
    }

    if (char === "\\") {
      chars[index] = " ";
      if (index + 1 < chars.length) {
        chars[index + 1] = source[index + 1] === "\n" ? "\n" : " ";
        index += 1;
      }
    } else if (char === '"') {
      chars[index] = " ";
      state = "code";
    } else if (char !== "\n") {
      chars[index] = " ";
    }
  }

  return chars.join("");
}

function findMatching(source, openIndex, openChar, closeChar, limit = source.length) {
  let depth = 0;
  for (let index = openIndex; index < limit; index += 1) {
    if (source[index] === openChar) {
      depth += 1;
    } else if (source[index] === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function findKeymapNode(maskedSource) {
  const match = /\bkeymap\s*\{/g.exec(maskedSource);
  if (!match) {
    return null;
  }

  const openIndex = maskedSource.indexOf("{", match.index);
  const closeIndex = findMatching(maskedSource, openIndex, "{", "}");
  return { openIndex, closeIndex: closeIndex === -1 ? maskedSource.length : closeIndex, closed: closeIndex !== -1 };
}

function findLayerNodes(source, maskedSource, keymapNode) {
  const nodes = [];
  let cursor = keymapNode.openIndex + 1;

  while (cursor < keymapNode.closeIndex) {
    const openIndex = maskedSource.indexOf("{", cursor);
    if (openIndex === -1 || openIndex >= keymapNode.closeIndex) {
      break;
    }

    let headerStart = openIndex - 1;
    while (headerStart > keymapNode.openIndex && !";{}".includes(maskedSource[headerStart])) {
      headerStart -= 1;
    }
    headerStart += 1;

    const header = source.slice(headerStart, openIndex).trim();
    const headerMatch = /(?:(?<label>[A-Za-z_][\w-]*)\s*:\s*)?(?<name>[A-Za-z_][\w,@-]*)\s*$/.exec(header);
    const closeIndex = findMatching(maskedSource, openIndex, "{", "}", keymapNode.closeIndex + 1);
    const effectiveCloseIndex = closeIndex === -1 ? keymapNode.closeIndex : closeIndex;

    if (headerMatch) {
      nodes.push({
        id: headerMatch.groups.label ?? headerMatch.groups.name,
        nodeName: headerMatch.groups.name,
        openIndex,
        closeIndex: effectiveCloseIndex,
        closed: closeIndex !== -1,
      });
    }

    cursor = effectiveCloseIndex + 1;
  }

  return nodes;
}

function extractStringProperty(blockSource, propertyName) {
  const pattern = new RegExp(`\\b${propertyName.replace("-", "\\-")}\\s*=\\s*"([^"]*)"\\s*;`);
  return pattern.exec(blockSource)?.[1] ?? null;
}

function splitBindings(bindingSource) {
  const maskedBindings = maskNonCode(bindingSource);
  const starts = [];

  for (let index = 0; index < maskedBindings.length; index += 1) {
    if (maskedBindings[index] === "&") {
      starts.push(index);
    }
  }

  return starts.map((start, bindingIndex) => {
    const end = starts[bindingIndex + 1] ?? bindingSource.length;
    return bindingSource
      .slice(start, end)
      .replace(/\/\/[^\n]*/g, " ")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/[\s,]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }).filter(Boolean);
}

function extractBindings(source, maskedSource, node) {
  const blockStart = node.openIndex + 1;
  const maskedBlock = maskedSource.slice(blockStart, node.closeIndex);
  const propertyMatch = /\bbindings\s*=\s*</g.exec(maskedBlock);

  if (!propertyMatch) {
    return { bindings: [], warning: "Layer has no bindings property." };
  }

  const openIndex = blockStart + maskedBlock.indexOf("<", propertyMatch.index);
  const closeIndex = findMatching(maskedSource, openIndex, "<", ">", node.closeIndex);
  const effectiveCloseIndex = closeIndex === -1 ? node.closeIndex : closeIndex;
  return {
    bindings: splitBindings(source.slice(openIndex + 1, effectiveCloseIndex)),
    warning: closeIndex === -1 ? "Bindings block is missing its closing >; parsed through the end of the layer." : null,
  };
}

export function parseKeymap(source, { expectedKeyCount = 76, sourcePath = "" } = {}) {
  if (typeof source !== "string") {
    throw new TypeError("Keymap source must be a string.");
  }

  const warnings = [];
  const maskedSource = maskNonCode(source);
  const keymapNode = findKeymapNode(maskedSource);

  if (!keymapNode) {
    return { sourcePath, expectedKeyCount, layers: [], warnings: ["Could not find a keymap node."], hasInvalidLayers: false };
  }

  if (!keymapNode.closed) {
    warnings.push("The keymap node is missing its closing brace; parsed through the end of the file.");
  }

  const layers = [];
  for (const node of findLayerNodes(source, maskedSource, keymapNode)) {
    const blockSource = source.slice(node.openIndex + 1, node.closeIndex);
    if (extractStringProperty(blockSource, "status") === "reserved") {
      continue;
    }

    const bindingResult = extractBindings(source, maskedSource, node);
    const layerWarnings = [];
    if (!node.closed) {
      layerWarnings.push("Layer is missing its closing brace.");
    }
    if (bindingResult.warning) {
      layerWarnings.push(bindingResult.warning);
    }

    const keyCount = bindingResult.bindings.length;
    if (keyCount < expectedKeyCount) {
      layerWarnings.push(`Expected ${expectedKeyCount} keys but found ${keyCount}; ${expectedKeyCount - keyCount} slots will be empty.`);
    } else if (keyCount > expectedKeyCount) {
      layerWarnings.push(`Expected ${expectedKeyCount} keys but found ${keyCount}; ${keyCount - expectedKeyCount} keys will be shown as overflow.`);
    }

    layers.push({
      id: node.id,
      nodeName: node.nodeName,
      name: extractStringProperty(blockSource, "display-name") ?? node.id.replaceAll("_", " "),
      index: layers.length,
      keyCount,
      bindings: bindingResult.bindings,
      warnings: layerWarnings,
      validKeyCount: keyCount === expectedKeyCount,
    });
  }

  if (layers.length === 0) {
    warnings.push("No non-reserved layers were found inside the keymap node.");
  }

  return {
    sourcePath,
    expectedKeyCount,
    layers,
    warnings,
    hasInvalidLayers: layers.some((layer) => !layer.validKeyCount),
  };
}
