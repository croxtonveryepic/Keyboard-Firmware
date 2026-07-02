# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZMK firmware configuration for the Kinesis Advantage 360 Pro split ergonomic keyboard. Uses a customized ZMK fork ([ReFil/zmk](https://github.com/ReFil/zmk), branch `adv360-z3.5-2`) managed via West (`config/west.yml`). The keyboard runs on Nordic nRF52840 SoCs with a 5×20 key matrix split across two halves.

## Build Commands

**Local build (requires Docker or Podman):**

```
make          # Build both halves (left + right)
make left     # Build left half only
make clean    # Remove Docker image and firmware
make clean_firmware  # Remove compiled firmware only
```

`make` is not installed on this Windows machine (neither PowerShell nor Git Bash) — run `bin/local_build.sh [left]` from Git Bash instead; it mirrors the Makefile. (`bin/build.sh` is the container-side script, not the one to run on the host.)

Output goes to `firmware/` as `.uf2` files. Every build clears old `.uf2` files first, so `firmware/` only ever contains the latest build.

**Change workflow:** After any config change, build locally to validate (`bin/local_build.sh`, or `make` where available). The user then flashes and tests on the keyboard (see Flashing note below) — do not commit until the change has been tested on the board.

**CI:** Push to GitHub triggers `.github/workflows/build.yml`, which builds two variants: legacy (no Clique studio) and Clique (with ZMK Studio support via `-S studio-rpc-usb-uart`). Artifacts are timestamped UF2 files.

There are no tests or linters — validation happens at build time (ZMK/Zephyr compilation).

## Architecture

### Key Configuration Files

- **`config/adv360.keymap`** — Main keymap (all layers, behaviors, home row mods). Both `adv360_left.keymap` and `adv360_right.keymap` are stubs that `#include` this file.
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
- **4–7**: Reserved (empty `extra` layers for ZMK Studio)

Home row mod timing is tuned per finger with `HOMEY_HOLDING_TIME` (270ms), `INDEX_HOLDING_TIME` (170ms), and `HOMEY_STREAK_DECAY` (250ms). The `DIFFICULTY_LEVEL` define (1–5) gates which advanced features are active.

### Key Position Reference

Key position numbers for use in `hold-trigger-key-positions` and combos are documented in `assets/key-positions.md` and `assets/key-positions.png`. Left keys: 0–6, 14–20, 28–34, 46–51, 60–64; right keys: 7–13, 21–27, 39–45, 54–59, 71–75; thumbs split across both sides.

## Important Config Notes

- **F13–F24 with NKRO**: Requires `CONFIG_ZMK_HID_KEYBOARD_EXTENDED_REPORT=y` in both defconfig files
- **Battery reporting**: Disabled by default (`CONFIG_BT_BAS=n`) to prevent wake-from-sleep issues
- **Flashing**: Enter bootloader via Mod+macro1 (left) or Mod+macro3 (right), then copy the `.uf2` file to the mounted USB drive
- **Version macro** (Mod+V): Types `YYYYMMDD-XXXX-YYYYYY` (date, branch, commit) — generated at build time into `config/version.dtsi`
