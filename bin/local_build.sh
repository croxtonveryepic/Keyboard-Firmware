#!/usr/bin/env bash
# Host-side build for machines without make (e.g. Windows Git Bash).
# Mirrors the Makefile: clean old firmware, stamp version, docker build + run.
# (bin/build.sh is the container-side script — do not confuse the two.)
# Usage: bin/local_build.sh [left]    (default: both halves)
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD_RIGHT=true
[ "${1:-}" = "left" ] && BUILD_RIGHT=false

DOCKER=$(command -v podman || command -v docker)
HOST_PWD=$(pwd -W 2>/dev/null || pwd)  # Windows-style path for Docker Desktop

rm -f firmware/*.uf2

bin/get_version_local.sh clique > /dev/null
trap 'git checkout config/version.dtsi' EXIT

"$DOCKER" build --tag zmk --file Dockerfile .
MSYS_NO_PATHCONV=1 "$DOCKER" run --rm --name zmk \
    -v "$HOST_PWD/firmware:/app/firmware" \
    -v "$HOST_PWD/config:/app/config:ro" \
    -e TIMESTAMP="$(date -u +"%Y%m%d%H%M")" \
    -e COMMIT="$(git rev-parse --short HEAD)" \
    -e BUILD_RIGHT=$BUILD_RIGHT \
    zmk
