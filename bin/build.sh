#!/usr/bin/env bash
set -euo pipefail

KEYBOARD="${KEYBOARD:-adv360}"
VARIANT="${VARIANT:-clique}"
TIMESTAMP="${TIMESTAMP:-$(date -u +"%Y%m%d%H%M")}"
COMMIT="${COMMIT:-xxxxxx}"
BUILD_RIGHT="${BUILD_RIGHT:-true}"
WORKSPACE=$(pwd)

case "$KEYBOARD" in
    adv360)
        LEFT_BOARD=adv360_left
        RIGHT_BOARD=adv360_right
        CONFIG_DIR="$WORKSPACE/config"
        MODULE_ARGS=()
        ;;
    glove80)
        LEFT_BOARD=glove80_lh
        RIGHT_BOARD=glove80_rh
        CONFIG_DIR="$WORKSPACE/config/glove80"
        MODULE_ARGS=("-DZMK_EXTRA_MODULES=$WORKSPACE/config")
        ;;
    *) echo "Unknown keyboard: $KEYBOARD" >&2; exit 2 ;;
esac

STUDIO_ARGS=()
STUDIO_CONFIG=()
case "$VARIANT" in
    clique)
        STUDIO_ARGS=(-S studio-rpc-usb-uart)
        STUDIO_CONFIG=(-DCONFIG_ZMK_STUDIO=y)
        ;;
    legacy) ;;
    *) echo "Unknown variant: $VARIANT" >&2; exit 2 ;;
esac

mkdir -p firmware
PREFIX="firmware/$TIMESTAMP-$COMMIT-$KEYBOARD"
west build -s zmk/app -p -d "build/$KEYBOARD/left" -b "$LEFT_BOARD" "${STUDIO_ARGS[@]}" -- \
    "-DZMK_CONFIG=$CONFIG_DIR" "${MODULE_ARGS[@]}" "${STUDIO_CONFIG[@]}"
grep -vE '(^#|^$)' "build/$KEYBOARD/left/zephyr/.config"
cp "build/$KEYBOARD/left/zephyr/zmk.uf2" "$PREFIX-left-$VARIANT.uf2"

if [ "$BUILD_RIGHT" = true ]; then
    west build -s zmk/app -p -d "build/$KEYBOARD/right" -b "$RIGHT_BOARD" -- \
        "-DZMK_CONFIG=$CONFIG_DIR" "${MODULE_ARGS[@]}"
    grep -vE '(^#|^$)' "build/$KEYBOARD/right/zephyr/.config"
    cp "build/$KEYBOARD/right/zephyr/zmk.uf2" "$PREFIX-right-$VARIANT.uf2"
    if [ "$KEYBOARD" = glove80 ]; then
        # See README.md: Glove80 firmware artifacts.
        cat "$PREFIX-left-$VARIANT.uf2" "$PREFIX-right-$VARIANT.uf2" > "$PREFIX-combined-$VARIANT.uf2"
    fi
fi
