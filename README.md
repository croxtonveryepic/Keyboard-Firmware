# Advantage 360 Pro and Glove80 ZMK Config

This repository builds matching layouts for the Kinesis Advantage 360 Pro and MoErgo Glove80. Edit `config/adv360.keymap` as the source of truth, then run `node bin/sync_glove80.mjs` to update `config/glove80/glove80.keymap`. Timing, macros, and caps-snake behavior are shared through `config/keyboard-behaviors.dtsi`, `config/hrm_behaviors.dtsi`, and the custom module in `config/`. GitHub Actions checks that the generated Glove80 layout is current before building either keyboard.

The Advantage is the primary keyboard and the Glove80 is the backup. Both use the same seven layers, with physical placement and hardware controls adapted for each board. The Glove80 firmware was successfully flashed and tested on the keyboard on October 13, 2026.

## Quick comparison

Open [docs/keyboard-layout-comparison.html](docs/keyboard-layout-comparison.html) directly in a browser for the saved interactive comparison. This single file contains the keymap data, styling, and scripts and works offline without a server or sign-in. GitHub displays its source; download the raw file to open it locally. The [hosted comparison](https://advantage-glove80-layout.jccroxton.chatgpt.site) currently uses ChatGPT sign-in for private access. The repository copy can be served from another static host.

Select a layer or a key to see matching positions, moved media keys, changed thumb placement, the four extra Glove80 keys, and adapted status controls. After changing the keymap, regenerate both saved layouts:

```sh
node bin/sync_glove80.mjs
node visualizer/build-comparison.mjs
```

Regeneration updates the repository copy; the hosted site requires a separate deployment. CI checks both the generated Glove80 keymap and comparison snapshot for stale content.

## Repository layout

| Path | Purpose |
| --- | --- |
| `config/adv360.keymap` | Canonical bindings and layer order for both keyboards |
| `config/glove80/glove80.keymap` | Generated Glove80 bindings; regenerate rather than editing directly |
| `bin/glove80-layout.mjs` | Physical position mapping, extra keys, and hardware substitutions |
| `config/keyboard-behaviors.dtsi`, `config/hrm_behaviors.dtsi`, `config/macros.dtsi` | Shared behaviors, timing, and macros |
| `config/src/`, `config/dts/`, `config/zephyr/` | Shared custom caps-snake ZMK module |
| `config/west.yml`, `config/boards/arm/adv360/` | Advantage firmware fork and board definitions |
| `config/glove80/west.yml`, `config/glove80/glove80.conf` | Pinned MoErgo firmware fork and Glove80 configuration |
| `bin/build.sh`, `bin/local_build.sh`, `Dockerfile` | Shared container and local build pipeline |
| `.github/workflows/build.yml` | Builds both models and publishes firmware artifacts |
| `visualizer/` | Live Advantage preview and comparison source/generator |
| `docs/keyboard-layout-comparison.html` | Generated portable comparison page |
| `firmware/` | Ignored local build outputs |

The two manufacturer forks have different board support and dependencies, so each model uses its own West manifest and dependency cache. They share the configuration module, build script, and GitHub Actions workflow.

## Glove80 layout mapping

The Glove80 configuration replaces the old layout from [croxtonveryepic/glove80-zmk-config](https://github.com/croxtonveryepic/glove80-zmk-config). All 76 Advantage positions are retained exactly once across each of the seven active layers. Letter rows, home-row modifiers, navigation keys, and corner layer switches stay in their corresponding positions. Layer numbers remain Base 0, Function 1, Mouse 2, Meta 3, Plain 4, Digits 5, and Caps Snake 6; layer 7 is reserved for Studio.

The Glove80 has six columns in each main keywell instead of the Advantage's seven in its upper rows. The six inner media keys move to the Glove80's extra top row. Four additional top-row keys provide F11–F14 on Base, Plain, and Digits, remain transparent on Function, Mouse, and Caps Snake, and are disabled on Meta. The physical mapping is defined in `bin/glove80-layout.mjs`.

```text
Glove80 base (left to right on each half; / separates keywell from thumbs):

Mute Vol+ Vol- F11 F12                         F13 F14 Prev Next Play
Base 1 2 3 4 5                                6 7 8 9 0 Mouse
Meta Pause P L K Q                            G F A U ScrollLock F24
X S/GUI N/Alt R/Ctrl T/Shift M                  Y C/Shift O/Ctrl I/Alt E/GUI J
Snake Z B H D V / Slash [ Minus                Equal ] Grave / Quote W Period Comma Semicolon Backslash
Plain Home End Left Right / Tab/Fn Space/Mouse Esc   Del Backspace Enter / Up Down PgUp PgDn Function
```

The upper thumb rows hold Slash, Left Bracket, Minus on the left and Equal, Right Bracket, Grave on the right. The lower thumb rows hold Tab/Function, Space/Mouse, Escape on the left and Delete, Backspace, Enter on the right. Plain mode uses the same Digit-layer hold key as the Advantage. Home-row hold triggers use Glove80 key positions, including all twelve thumb keys.

## Glove80 hardware adaptations

Both keyboards build in the same workflow and container tooling, with separate manufacturer forks: the Advantage keeps `config/west.yml`, and the Glove80 uses the pinned MoErgo revision in `config/glove80/west.yml`. The Glove80 build explicitly loads the shared `config/` ZMK module so custom caps-snake behavior works on both keyboards.

Glove80 battery/status keys use MoErgo's native `RGB_STATUS` display, which shows status temporarily for about ten seconds instead of the Advantage's hold-to-display battery behavior. Advantage backlight toggle/brightness controls become Glove80 RGB toggle/brightness controls; the small Glove80 power LED retains its board defaults. On Meta, the top-row Volume Up key enters the left bootloader, Next Track enters the right bootloader, and Previous Track shows status. The key in the G position unlocks Studio over the left half's USB connection. Bluetooth selection and clearing, all function keys, scrolling, macros, and caps-snake tap/double-tap behavior are preserved.

## Glove80 firmware artifacts

GitHub Actions produces `firmware-no-clique` and `firmware-clique` for the Advantage, plus `firmware-glove80` with Studio support for the Glove80. Filenames include the timestamp, commit, keyboard, side, and variant. The Glove80 artifact includes separate left/right UF2s and a combined UF2 containing both halves' firmware with their distinct UF2 family IDs, following [MoErgo's combined firmware builder](https://github.com/moergo-sc/zmk/blob/ce69e85f585c724142aae37ddf8a7e019ff19e93/default.nix).

Copy the Glove80 combined UF2 to each half in bootloader mode, or copy the corresponding left/right file separately. Follow [MoErgo's firmware-loading instructions](https://docs.moergo.com/glove80-user-guide/customizing-key-layout/#loading-new-zmk-firmware-onto-your-glove80). Flash both halves and test the layout on the keyboard before relying on it as a backup.

## Modifying the keymap

[The ZMK documentation](https://zmk.dev/docs) covers both basic and advanced functionality and has a table of OS compatibility for keycodes. Please note that the RGB Underglow, Backlight and Power Management sections are not relevant to the Advantage 360 Pro's custom ZMK fork. For more information see [this note](#note)

There is a web based GUI available for editing the keymap. It is available at https://kinesiscorporation.github.io/Adv360-Pro-GUI. This repository is also compatible with certain other web based ZMK keymap editors however they may have keycodes or behaviours that are not implemented on the 360 Pro and could cause unusual behaviour or build failures. Furthermore changes made on other keymap editors may not be compatible if one goes back to using the Kinesis GUI.

Certain ZMK features (e.g. combos) require knowing the exact key positions in the matrix. They can be found in both image and text format [here](assets/key-positions.md)

## Visualizing the keymap

The dependency-free [keymap visualizer](visualizer/README.md) renders `config/adv360.keymap` on the physical Advantage360 Pro layout and updates automatically whenever the file is saved.

```shell
cd visualizer
npm start
```

Open <http://127.0.0.1:3036> after the server starts. Layers with too few or too many bindings remain visible and are annotated with warnings, empty physical slots, or overflow bindings.

## Building the Firmware with GitHub Actions

### Setup

1. Fork this repo.
2. Enable GitHub Actions on your fork.

### Build firmware

1. Push a commit, open a pull request, or manually run the **Build** workflow in GitHub Actions.
2. Wait for all three matrix jobs to complete, then download the artifact for your keyboard.

| Artifact | Keyboard | Variant |
| --- | --- | --- |
| `firmware-no-clique` | Advantage 360 Pro | Without Studio |
| `firmware-clique` | Advantage 360 Pro | Studio over left-half USB |
| `firmware-glove80` | Glove80 | Studio over left-half USB; includes combined UF2 |

The `clique` suffix is the build tooling's name for the Studio variant. Local builds use this variant for both models. Filenames follow `<UTC timestamp>-<commit>-<keyboard>-<left|right|combined>-<variant>.uf2`; choose files from the same build when flashing a split keyboard.

## Building the Firmware in a local container

### Setup

#### Software

- Either Podman or Docker is required, Podman is chosen if both are installed.
- Make is also required

#### Windows specific

- If compiling on Windows use WSL2 and Docker [Docker Setup Guide](https://docs.docker.com/desktop/windows/wsl/).
- Install make using `sudo apt-get install make` inside the WSL2 instance.
- The repository can be cloned directly into the WSL2 instance or accessed through the C: mount point WSL provides by default (`/mnt/c/path-to-repo`).

#### macOS specific

On macOS [brew](https://brew.sh) can be used to install the required components.

- docker
- [colima](https://github.com/abiosoft/colima) can be used as the docker engine

```shell
brew install docker colima
colima start
```

> Note: On Apple Silicon (ARM based) systems you need to make sure to start colima with the correct architecture for the container being used.
>
> ```
> colima start --arch x86_64
> ```

#### Ubuntu/Debian specific

```shell
sudo apt-get install docker make
```

### Building the firmware

1. Execute `make` for the Advantage, `make glove80` for the Glove80, or `make keyboards` for both models. `make left` and `make glove80-left` build only the corresponding left half.
2. On Windows Git Bash, use `bash bin/local_build.sh`, `bash bin/local_build.sh glove80`, or add `left` for a single half. Glove80 generation also requires Node.js 20 or newer.
3. Check `firmware/` for timestamped UF2s. Builds retain previous firmware for both models; use `make clean_firmware` when you want to remove it. Local builds restore the previous version macro without changing Git staging.

### Cleanup

The built docker container and compiled firmware files can be deleted with `make clean`. This might be necessary if you updated your fork from V2.0 to V3.0 and are encountering build failures.

Creating the docker container takes some time. Therefore `make clean_firmware` can be used to only clean firmware without removing the docker container. Similarly `make clean_image` can be used to remove the docker container without removing compiled firmware files.

## Flashing firmware

Keep a working keyboard available while flashing. Use the firmware for the correct model and update both halves.

### Glove80

Use the combined Glove80 UF2 on both halves, or use the matching `glove80-right` and `glove80-left` files separately. The power-up method works independently of the installed keymap. The combinations below refer to physical positions, with factory keycap labels given as a reference; use [MoErgo's position diagram](https://docs.moergo.com/glove80-user-guide/images/bootloader-power-up-method.png) if your keycaps have moved.

1. Switch the right half off and connect it to your computer with a USB data cable.
2. Hold physical keys **C6R6 + C3R3** (factory **PgDn + I**) and switch the right half on while holding them.
3. Copy the combined UF2, or the right-half UF2, onto the **GLV80RHBOOT** drive. The drive disappears after flashing.
4. Switch the left half off and move the USB cable to it.
5. Hold physical keys **C6R6 + C3R3** (factory **Magic + E**) and switch the left half on while holding them.
6. Copy the same combined UF2, or the left-half UF2, onto **GLV80LHBOOT**.
7. Turn both halves on and connect USB to the left half to test the layout.

Once this keymap is installed, hold Meta and press the top-row Volume Up key for the left bootloader, or Next Track for the right bootloader, with USB connected to the target half. [Official flashing instructions](https://docs.moergo.com/glove80-user-guide/customizing-key-layout/#loading-new-zmk-firmware-onto-your-glove80)

MoErgo recommends a [configuration reset and re-pairing of the halves](https://docs.moergo.com/glove80-user-guide/troubleshooting/#configuration-factory-reset-and-re-pairing-left-and-right-halves) after changing firmware versions or advanced configuration. Reset both halves; this retains the flashed keymap but clears Bluetooth pairings and saved settings.

### Advantage 360 Pro

These combinations refer to this repository's custom keymap. See the [Kinesis Quick Start Guide](https://kinesis-ergo.com/wp-content/uploads/Advantage360-Professional-QSG-v8-25-22.pdf) for the hardware programming procedure.

1. Extract the firmwares from the archive downloaded from the GitHub build job (If using the cloud builder) or the firmware folder (If building locally).
1. Connect the left side keyboard to USB.
1. Hold Meta and press Volume Up to put the left side into bootloader mode; it should attach to your computer as a USB drive.
1. Copy the `adv360-left` UF2 to the USB drive and it will disconnect.
1. Power off both keyboards (by unplugging them and making sure the switches are off).
1. Turn on the left side keyboard with the switch.
1. Connect the right side keyboard to USB to power it on.
1. Hold Meta and press Next Track to put the right side into bootloader mode to attach it as a USB drive.
1. Copy the `adv360-right` UF2 to the mounted drive.
1. Unplug the right side keyboard and turn it back on.
1. Enjoy!

> Note: There are also physical reset buttons on both keyboards which can be used to enter and exit the bootloader mode. Their location is described in section 2.7 on page 9 in the [User Manual](https://kinesis-ergo.com/wp-content/uploads/Advantage360-ZMK-KB360-PRO-Users-Manual-v3-10-23.pdf) and use is described in section 5.9 on page 14.

> Note: Some operating systems wont always treat the drive as ejected after the settings-reset file is flashed or may throw a spurious error, this doesn't mean that the flashing process has failed.

### Upgrading from V2 to V3

If you encounter a git conflict when updating your repository to V3.0 please follow the instructions on how to resolve it [here](UPGRADE.md).

Updating from V2.0 based firmwares to V3.0 based firmwares can be a rather complex process. There are reset files for every major firmware revision as well as documentation on the update process available [here](https://kinesis-ergo.com/support/kb360pro/#firmware-updates).

## Validation

Run these checks from the repository root after editing the configuration or comparison:

```sh
node bin/sync_glove80.mjs --check
node visualizer/build-comparison.mjs --check
node --test bin/test/*.test.mjs visualizer/test/*.test.mjs
```

The checks verify layer sizes, one-to-one retention of all 76 source positions, physical hand groups, hardware substitutions, and the saved comparison. Build the affected firmware and test it on the keyboard before committing changes to behavior. Both Advantage variants and the Glove80 Studio variant have been compiled locally with this monorepo configuration.

## Versioning

Both builds generate a shared version macro from the UTC date, first four characters of the branch, short commit hash, and variant. In this custom layout, hold Meta and press the D-position key to type it. Local builds restore the previous `config/version.dtsi` after compilation; CI generates it inside the build checkout. Firmware filenames also record the timestamp, commit, model, side, and variant.

## Advantage 360 Pro board reference

The settings and LED color tables below apply to the Advantage board definitions. Glove80 hardware behavior comes from the pinned MoErgo fork and `config/glove80/glove80.conf`.

### N-Key Rollover

The current Advantage configuration disables NKRO; the Glove80 explicitly uses HKRO. If enabling NKRO on the Advantage, enable extended reports for F13–F24 or INTL1–9 support with `CONFIG_ZMK_HID_KEYBOARD_EXTENDED_REPORT=y` in [adv360_left_defconfig](config/boards/arm/adv360/adv360_left_defconfig).

### Battery reporting

By default reporting the battery level over BLE is disabled as this can cause some computers to spontaneously wake up repeatedly. If you'd like to enable this functionality change `CONFIG_BT_BAS=n` to `CONFIG_BT_BAS=y` in [adv360_left_defconfig](/config/boards/arm/adv360/adv360_left_defconfig#L58).

### Modifier indicator color

The color of the CAPS/NUM/SCROLL LOCK indicator LEDs may be configured by specifying a hexadecimal RGB color code. For example, `CONFIG_ZMK_RGB_UNDERGLOW_MOD_COLOR=0xFF0000` would give red indicator colors. In order to set the indicator color on both modules, ensure that both [adv360_left_defconfig](/config/boards/arm/adv360/adv360_left_defconfig) and [adv360_right_defconfig](/config/boards/arm/adv360/adv360_right_defconfig) have been updated.

### Layer colors

A total of 32 layers are supported by ZMK, with the highest currently active layer displayed using the layer LEDs on each of the left and right modules. All possible colors are listed below; for the first 8 layers the same color is displayed on both modules. After that, only the right module color will cycle through until "rolling over", which will cause the left module color to change as well (and this then repeats). To avoid confusion, the black/off LED color is only used for layer 0.

| Layer # |                                                       L/R                                                       | Layer # |                                                       L/R                                                       | Layer # |                                                       L/R                                                       | Layer # |                                                       L/R                                                       |
| ------: | :-------------------------------------------------------------------------------------------------------------: | ------: | :-------------------------------------------------------------------------------------------------------------: | ------: | :-------------------------------------------------------------------------------------------------------------: | ------: | :-------------------------------------------------------------------------------------------------------------: |
|       0 | <img valign='middle' src='assets/swatches/000000.svg'/> <img valign='middle' src='assets/swatches/000000.svg'/> |       8 | <img valign='middle' src='assets/swatches/FFFFFF.svg'/> <img valign='middle' src='assets/swatches/0000FF.svg'/> |      16 | <img valign='middle' src='assets/swatches/0000FF.svg'/> <img valign='middle' src='assets/swatches/FF0000.svg'/> |      24 | <img valign='middle' src='assets/swatches/00FF00.svg'/> <img valign='middle' src='assets/swatches/00FFFF.svg'/> |
|       1 | <img valign='middle' src='assets/swatches/FFFFFF.svg'/> <img valign='middle' src='assets/swatches/FFFFFF.svg'/> |       9 | <img valign='middle' src='assets/swatches/FFFFFF.svg'/> <img valign='middle' src='assets/swatches/00FF00.svg'/> |      17 | <img valign='middle' src='assets/swatches/0000FF.svg'/> <img valign='middle' src='assets/swatches/FF00FF.svg'/> |      25 | <img valign='middle' src='assets/swatches/00FF00.svg'/> <img valign='middle' src='assets/swatches/FFFF00.svg'/> |
|       2 | <img valign='middle' src='assets/swatches/0000FF.svg'/> <img valign='middle' src='assets/swatches/0000FF.svg'/> |      10 | <img valign='middle' src='assets/swatches/FFFFFF.svg'/> <img valign='middle' src='assets/swatches/FF0000.svg'/> |      18 | <img valign='middle' src='assets/swatches/0000FF.svg'/> <img valign='middle' src='assets/swatches/00FFFF.svg'/> |      26 | <img valign='middle' src='assets/swatches/FF0000.svg'/> <img valign='middle' src='assets/swatches/FFFFFF.svg'/> |
|       3 | <img valign='middle' src='assets/swatches/00FF00.svg'/> <img valign='middle' src='assets/swatches/00FF00.svg'/> |      11 | <img valign='middle' src='assets/swatches/FFFFFF.svg'/> <img valign='middle' src='assets/swatches/FF00FF.svg'/> |      19 | <img valign='middle' src='assets/swatches/0000FF.svg'/> <img valign='middle' src='assets/swatches/FFFF00.svg'/> |      27 | <img valign='middle' src='assets/swatches/FF0000.svg'/> <img valign='middle' src='assets/swatches/0000FF.svg'/> |
|       4 | <img valign='middle' src='assets/swatches/FF0000.svg'/> <img valign='middle' src='assets/swatches/FF0000.svg'/> |      12 | <img valign='middle' src='assets/swatches/FFFFFF.svg'/> <img valign='middle' src='assets/swatches/00FFFF.svg'/> |      20 | <img valign='middle' src='assets/swatches/00FF00.svg'/> <img valign='middle' src='assets/swatches/FFFFFF.svg'/> |      28 | <img valign='middle' src='assets/swatches/FF0000.svg'/> <img valign='middle' src='assets/swatches/00FF00.svg'/> |
|       5 | <img valign='middle' src='assets/swatches/FF00FF.svg'/> <img valign='middle' src='assets/swatches/FF00FF.svg'/> |      13 | <img valign='middle' src='assets/swatches/FFFFFF.svg'/> <img valign='middle' src='assets/swatches/FFFF00.svg'/> |      21 | <img valign='middle' src='assets/swatches/00FF00.svg'/> <img valign='middle' src='assets/swatches/0000FF.svg'/> |      29 | <img valign='middle' src='assets/swatches/FF0000.svg'/> <img valign='middle' src='assets/swatches/FF00FF.svg'/> |
|       6 | <img valign='middle' src='assets/swatches/00FFFF.svg'/> <img valign='middle' src='assets/swatches/00FFFF.svg'/> |      14 | <img valign='middle' src='assets/swatches/0000FF.svg'/> <img valign='middle' src='assets/swatches/FFFFFF.svg'/> |      22 | <img valign='middle' src='assets/swatches/00FF00.svg'/> <img valign='middle' src='assets/swatches/FF0000.svg'/> |      30 | <img valign='middle' src='assets/swatches/FF0000.svg'/> <img valign='middle' src='assets/swatches/00FFFF.svg'/> |
|       7 | <img valign='middle' src='assets/swatches/FFFF00.svg'/> <img valign='middle' src='assets/swatches/FFFF00.svg'/> |      15 | <img valign='middle' src='assets/swatches/0000FF.svg'/> <img valign='middle' src='assets/swatches/00FF00.svg'/> |      23 | <img valign='middle' src='assets/swatches/00FF00.svg'/> <img valign='middle' src='assets/swatches/FF00FF.svg'/> |      31 | <img valign='middle' src='assets/swatches/FF0000.svg'/> <img valign='middle' src='assets/swatches/FFFF00.svg'/> |

## Changelog

[CHANGELOG.md](CHANGELOG.md) contains the inherited Advantage firmware history. Consult the fork revisions in the two West manifests for the firmware used by each keyboard.

## Beta testing

To evaluate a different firmware revision, update `revision` in the affected keyboard's West manifest: [Advantage](config/west.yml) or [Glove80](config/glove80/west.yml). Preserve the other model's manifest, build both halves of the changed model, and verify its layout and hardware behavior before adopting the revision. See [ZMK's beta-testing guide](https://zmk.dev/docs/features/beta-testing#testing-features) for background.

Feedback on beta branches should be submitted as a GitHub issue on the base ZMK repository as opposed to this config repository.

In the event of a major update the beta branch may not be compatible with the current mainline version of the config repository. If this is the case it will be detailed here along with instructions on how to update.

## Note

The Advantage manifest references [ReFil's customised ZMK fork](https://github.com/ReFil/zmk/tree/adv360-z3.5-2), while the Glove80 manifest pins [MoErgo's fork](https://github.com/moergo-sc/zmk/tree/ce69e85f585c724142aae37ddf8a7e019ff19e93). Each provides hardware-specific functionality and may differ from [base ZMK](https://github.com/zmkfirmware/zmk). Check the appropriate manifest and fork when evaluating new upstream features.

Whilst the Advantage 360 Pro is compatible with base ZMK (The pull request to merge it can be seen [here](https://github.com/zmkfirmware/zmk/pull/1454) if you want to see how to implement it) some of the more advanced features (the indicator RGB leds) will not work, and Kinesis cannot provide customer service for usage of base ZMK. Likewise the ZMK community cannot provide support for either the Kinesis keymap editor, nor any usage of the Kinesis custom fork.

## Other support

Further support resources can be found on Kinesis.com:

- https://kinesis-ergo.com/support/kb360pro/#firmware-updates
- https://kinesis-ergo.com/support/kb360pro/#manuals

In the event of a hardware issue it may be necessary to open a support ticket directly with Kinesis as opposed to a GitHub issue in this repository.

- https://kinesis-ergo.com/support/kb360pro/#ticket
