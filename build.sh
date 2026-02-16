#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$PROJECT_DIR/build/bin"
DIST_DIR="$PROJECT_DIR/dist"
PATH="$HOME/go/bin:$PATH"

VERSION=$(grep '^version:' "$PROJECT_DIR/nfpm.yaml" | sed 's/version: *"\(.*\)"/\1/')

echo "========================================="
echo " Carmelia Build Script v${VERSION}"
echo "========================================="

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# ─── Windows (amd64) ─────────────────────────
echo ""
echo "[1/5] Building Windows portable (.exe)..."
CGO_ENABLED=1 \
  CC=x86_64-w64-mingw32-gcc \
  GOOS=windows \
  GOARCH=amd64 \
  wails build

cp "$BIN_DIR/carmelia.exe" "$DIST_DIR/carmelia-${VERSION}-windows-amd64-portable.exe"
echo "  -> dist/carmelia-${VERSION}-windows-amd64-portable.exe"

# ─── Windows Installer (NSIS) ────────────────
echo ""
echo "[2/5] Building Windows installer (NSIS)..."
CGO_ENABLED=1 \
  CC=x86_64-w64-mingw32-gcc \
  GOOS=windows \
  GOARCH=amd64 \
  wails build -nsis

cp "$BIN_DIR/carmelia-amd64-installer.exe" "$DIST_DIR/carmelia-${VERSION}-windows-amd64-installer.exe"
echo "  -> dist/carmelia-${VERSION}-windows-amd64-installer.exe"

# ─── Linux (amd64) ───────────────────────────
echo ""
echo "[3/5] Building Linux binary..."
wails build -tags webkit2_41

# ─── Linux .deb (amd64) ──────────────────────
echo ""
echo "[4/5] Packaging Linux .deb..."
nfpm package -p deb -f "$PROJECT_DIR/nfpm.yaml" -t "$DIST_DIR/carmelia-${VERSION}-linux-amd64.deb"
echo "  -> dist/carmelia-${VERSION}-linux-amd64.deb"

# ─── Linux .pkg.tar.zst (Arch) ───────────────
echo ""
echo "[5/5] Packaging Linux .pkg.tar.zst (Arch)..."
nfpm package -p archlinux -f "$PROJECT_DIR/nfpm.yaml" -t "$DIST_DIR/carmelia-${VERSION}-linux-amd64.pkg.tar.zst"
echo "  -> dist/carmelia-${VERSION}-linux-amd64.pkg.tar.zst"

# ─── Summary ─────────────────────────────────
echo ""
echo "========================================="
echo " Build complete! Artifacts in dist/"
echo "========================================="
ls -lh "$DIST_DIR"
