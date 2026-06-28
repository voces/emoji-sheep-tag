#!/usr/bin/env bash
set -euo pipefail

echo "=== Tauri v2 Setup ==="

# Check Ubuntu version (Tauri v2 requires libwebkit2gtk-4.1-dev, available 22.10+)
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [ "$ID" = "ubuntu" ]; then
    major=$(echo "$VERSION_ID" | cut -d. -f1)
    minor=$(echo "$VERSION_ID" | cut -d. -f2)
    if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 10 ]; }; then
      echo "Error: Tauri v2 requires Ubuntu 22.10+ (you have $VERSION_ID)."
      echo "Upgrade with: sudo do-release-upgrade"
      exit 1
    fi
  fi
fi

# Install Rust if not present
if ! command -v rustc &>/dev/null; then
  echo "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
else
  echo "Rust already installed: $(rustc --version)"
fi

# Install Linux system dependencies
if command -v apt-get &>/dev/null; then
  echo "Installing system dependencies..."
  sudo apt-get update
  sudo apt-get install -y \
    build-essential \
    pkg-config \
    libgtk-3-dev \
    libgdk-pixbuf-2.0-dev \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    libssl-dev \
    patchelf
else
  echo "Warning: apt-get not found. Install these packages manually:"
  echo "  libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf"
fi

# Ensure system pkg-config path is visible (Linuxbrew can shadow it)
SYS_PKG="/usr/lib/x86_64-linux-gnu/pkgconfig"
if [ -d "$SYS_PKG" ] && ! pkg-config --variable pc_path pkg-config 2>/dev/null | grep -q "$SYS_PKG"; then
  SHELL_RC="$HOME/.zshrc"
  [ -f "$SHELL_RC" ] || SHELL_RC="$HOME/.bashrc"
  if ! grep -q "$SYS_PKG" "$SHELL_RC" 2>/dev/null; then
    echo "export PKG_CONFIG_PATH=\"$SYS_PKG:\$PKG_CONFIG_PATH\"" >> "$SHELL_RC"
    echo "Added $SYS_PKG to PKG_CONFIG_PATH in $SHELL_RC"
    export PKG_CONFIG_PATH="$SYS_PKG:${PKG_CONFIG_PATH:-}"
  fi
fi

# Install Tauri CLI
if ! cargo tauri --version &>/dev/null 2>&1; then
  echo "Installing Tauri CLI..."
  cargo install tauri-cli@^2
else
  echo "Tauri CLI already installed: $(cargo tauri --version)"
fi

echo "=== Setup complete ==="
