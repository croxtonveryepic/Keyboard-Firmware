# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZMK firmware configuration for matching Kinesis Advantage 360 Pro and MoErgo Glove80 layouts. The Advantage uses [ReFil/zmk](https://github.com/ReFil/zmk), branch `adv360-z3.5-2`, via `config/west.yml`; the Glove80 uses a pinned [MoErgo/zmk](https://github.com/moergo-sc/zmk) revision via `config/glove80/west.yml`. See README.md for layout mapping and hardware adaptations.

## Build Commands

**Local build (requires Docker or Podman):**

```
make          # Build both Advantage halves
make left     # Build Advantage left half only
make glove80  # Build both Glove80 halves
make glove80-left # Build Glove80 left half only
make keyboards # Build both keyboards
make clean    # Remove Docker image and firmware
make clean_firmware  # Remove compiled firmware only
```

`make` is not installed on this Windows machine (neither PowerShell nor Git Bash) — run `bash bin/local_build.sh [adv360|glove80] [left]` from Git Bash instead; Makefile targets use the same script. (`bin/build.sh` is the container-side script, not the one to run on the host.)

Output goes to `firmware/` as `.uf2` files. Builds retain previous UF2s for both models; `make clean_firmware` removes them. Local builds preserve the previous version macro and Git staging.

**Change workflow:** After any config change, build locally to validate (`bin/local_build.sh`, or `make` where available). The user then flashes and tests on the keyboard (see Flashing note below) — do not commit until the change has been tested on the board.

**CI:** Push to GitHub triggers `.github/workflows/build.yml`, which builds Advantage legacy, Advantage Clique, and Glove80 Clique. Studio builds use `-S studio-rpc-usb-uart` on the left half. Artifacts are timestamped UF2 files, including a combined Glove80 UF2.

Run `node bin/sync_glove80.mjs` after editing the Advantage keymap. CI checks the generated file with `--check` and runs `node --test bin/test/*.test.mjs`; the existing visualizer tests run with `node --test visualizer/test/*.test.mjs`. Firmware validation still requires ZMK/Zephyr compilation for both models.

Run `node visualizer/build-comparison.mjs` after keymap or comparison source changes. Commit both `docs/keyboard-layout-comparison.html` (self-contained offline page) and `visualizer/public/comparison/data.json`; CI checks them with `node visualizer/build-comparison.mjs --check`. The comparison source is in `visualizer/public/comparison/`, with physical Glove80 geometry in `visualizer/glove80-geometry.json`. See visualizer/README.md for serving or moving the page to another host. Hosted deployment is separate from Git pushes.

## Architecture

### Key Configuration Files

- **`config/adv360.keymap`** — Source-of-truth keymap (all layers). Both `adv360_left.keymap` and `adv360_right.keymap` are stubs that `#include` this file.
- **`config/keyboard-behaviors.dtsi`** — Shared timing settings, behavior definitions, and hardware-specific status macro.
- **`config/glove80/glove80.keymap`** — Generated Glove80 layers and home-row trigger positions; regenerate instead of editing directly.
- **`bin/glove80-layout.mjs`** — Physical position mapping and hardware binding substitutions.
- **`config/macros.dtsi`** — Macro definitions (bracket pairs, Windows shortcuts, macOS shortcuts, mouse macros). Included by the keymap.
- **`config/west.yml`** — West manifest pointing to the custom ZMK fork and revision.

### Board Definition (`config/boards/arm/adv360/`)

- `adv360.dtsi` — Shared device tree (matrix, LEDs, battery ADC, pin mappings)
- `adv360_left.dts` / `adv360_right.dts` — Per-side device trees
- `adv360_left_defconfig` / `adv360_right_defconfig` — Kconfig defaults (Bluetooth, RGB, backlighting, USB VID/PID, pointing)
- `adv360-layouts.dtsi` — Physical key layout matrix definitions
- `macros.dtsi` — Board-level macro definitions (version output)

### Keymap Structure

The keymap uses Devicetree syntax with ZMK bindings. Layers (0–7):

- **0**: Base layer with Miryoku-inspired home row mods (hold-tap per finger: pinky=GUI, ring=ALT, middle=CTRL, index=SHIFT)
- **1**: Function keys (F1–F12)
- **2**: Mouse/pointing keys + F13–F24
- **3**: Meta layer (Bluetooth profiles, bootloader, RGB/backlight controls)
- **4**: Plain Base (no home-row modifiers or layer taps)
- **5**: Digits (left home and bottom rows as 1–0)
- **6**: Caps Snake (shifted letters and underscore)
- **7**: Reserved for ZMK Studio

Home row mod timing is tuned per finger with `HOMEY_HOLDING_TIME` (200ms), `INDEX_HOLDING_TIME` (200ms via difficulty level 4), and `HOMEY_STREAK_DECAY` (200ms); index prior-idle timing remains 150ms. The `DIFFICULTY_LEVEL` define (1–5) selects default tapping thresholds.

### Key Position Reference

Key position numbers for use in `hold-trigger-key-positions` and combos are documented in `assets/key-positions.md` and `assets/key-positions.png`. Left keys: 0–6, 14–20, 28–34, 46–51, 60–64; right keys: 7–13, 21–27, 39–45, 54–59, 71–75; thumbs split across both sides.

## Important Config Notes

- **F13–F24 with NKRO**: Requires `CONFIG_ZMK_HID_KEYBOARD_EXTENDED_REPORT=y` in both defconfig files
- **Battery reporting**: Disabled on the Advantage (`CONFIG_BT_BAS=n`) to prevent wake-from-sleep issues; Glove80 retains MoErgo's board defaults
- **Flashing**: Advantage bootloaders are Meta+Volume Up (left) and Meta+Next Track (right). Those media keys move to the Glove80 top row; use the corresponding Glove80 files or its combined UF2 on both halves. See README.md and the manufacturer instructions.
- **Version macro** (Meta + D-position key): Types the UTC date, branch prefix, short commit, and variant — generated at build time into `config/version.dtsi`
