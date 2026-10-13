// See README.md: Glove80 layout mapping.
export const glove80Rows = [
  [6, 20, 34, "&kp F11", "&kp F12", "&kp F13", "&kp F14", 39, 21, 7],
  [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13],
  [14, 15, 16, 17, 18, 19, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, 31, 32, 33, 40, 41, 42, 43, 44, 45],
  [46, 47, 48, 49, 50, 51, 35, 36, 52, 53, 37, 38, 54, 55, 56, 57, 58, 59],
  [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
];

export const glove80Hands = {
  left: [0, 1, 2, 3, 4, 10, 11, 12, 13, 14, 15, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 46, 47, 48, 49, 50, 51, 64, 65, 66, 67, 68],
  right: [5, 6, 7, 8, 9, 16, 17, 18, 19, 20, 21, 28, 29, 30, 31, 32, 33, 40, 41, 42, 43, 44, 45, 58, 59, 60, 61, 62, 63, 75, 76, 77, 78, 79],
  thumbs: [52, 53, 54, 55, 56, 57, 69, 70, 71, 72, 73, 74],
};

const hardwareBindings = new Map([
  ["&stp STP_BAT", "&rgb_ug RGB_STATUS"],
  ["&bl BL_TOG", "&rgb_ug RGB_TOG"],
  ["&bl BL_INC", "&rgb_ug RGB_BRI"],
  ["&bl BL_DEC", "&rgb_ug RGB_BRD"],
]);

export function mapGlove80Layer(layer) {
  if (layer.bindings.length !== 76) {
    throw new Error(`${layer.id}: expected 76 Advantage bindings, found ${layer.bindings.length}`);
  }
  return glove80Rows.map((row) => row.map((position) => {
    const binding = typeof position === "number" ? layer.bindings[position]
      : layer.index === 3 ? "&none" : layer.index === 0 || layer.index === 4 || layer.index === 5 ? position : "&trans";
    return hardwareBindings.get(binding) ?? binding;
  }));
}
