#!/usr/bin/env bash
# Usage: bash bin/local_build.sh [adv360|glove80] [left]
set -euo pipefail
cd "$(dirname "$0")/.."

KEYBOARD=adv360
BUILD_RIGHT=true
for arg in "$@"; do
    case "$arg" in
        adv360|glove80) KEYBOARD="$arg" ;;
        left) BUILD_RIGHT=false ;;
        *) echo "Usage: bash bin/local_build.sh [adv360|glove80] [left]" >&2; exit 2 ;;
    esac
done

DOCKER=$(command -v podman || command -v docker)
HOST_PWD=$(pwd -W 2>/dev/null || pwd)
FIRMWARE_OPTIONS=""
CONFIG_OPTIONS=":ro"
if command -v selinuxenabled > /dev/null && selinuxenabled; then
    FIRMWARE_OPTIONS=":z"
    CONFIG_OPTIONS=":ro,z"
fi
MANIFEST=config/west.yml
IMAGE=zmk
if [ "$KEYBOARD" = glove80 ]; then
    node bin/sync_glove80.mjs
    MANIFEST=config/glove80/west.yml
    IMAGE=zmk-glove80
fi

mkdir -p firmware .build
VERSION_BACKUP=$(mktemp .build/version.XXXXXX)
cp -p config/version.dtsi "$VERSION_BACKUP"
trap 'cp -p "$VERSION_BACKUP" config/version.dtsi; rm -f "$VERSION_BACKUP"' EXIT
bash bin/get_version_local.sh clique > /dev/null

"$DOCKER" build --tag "$IMAGE" --build-arg "ZMK_MANIFEST=$MANIFEST" --file Dockerfile .
MSYS_NO_PATHCONV=1 "$DOCKER" run --rm \
    -v "$HOST_PWD/firmware:/app/firmware$FIRMWARE_OPTIONS" \
    -v "$HOST_PWD/config:/app/config$CONFIG_OPTIONS" \
    -e TIMESTAMP="$(date -u +"%Y%m%d%H%M")" \
    -e COMMIT="$(git rev-parse --short HEAD)" \
    -e KEYBOARD="$KEYBOARD" \
    -e BUILD_RIGHT="$BUILD_RIGHT" \
    "$IMAGE"
