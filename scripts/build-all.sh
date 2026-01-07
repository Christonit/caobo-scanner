#!/bin/bash
# Complete build script for Caobo Recibos

set -e

SCRIPT_DIR="$(dirname "$0")"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Building Caobo Recibos..."
echo "📁 Project directory: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Step 1: Build Nuxt frontend
echo ""
echo "📦 Step 1: Building Nuxt frontend..."
npm run generate

# Step 2: Build Python backend
echo ""
echo "🐍 Step 2: Building Python backend..."
bash "$SCRIPT_DIR/build-backend.sh"

# Step 3: Build Electron app
echo ""
echo "⚡ Step 3: Building Electron app..."

# Detect platform and build accordingly
case "$(uname -s)" in
    Darwin*)
        echo "🍎 Building for macOS..."
        npx electron-builder --mac
        ;;
    Linux*)
        echo "🐧 Building for Linux..."
        npx electron-builder --linux
        ;;
    MINGW*|MSYS*|CYGWIN*)
        echo "🪟 Building for Windows..."
        npx electron-builder --win
        ;;
    *)
        echo "⚠️ Unknown platform, building for current platform..."
        npx electron-builder
        ;;
esac

echo ""
echo "✅ Build complete!"
echo "📁 Output directory: dist-electron/"
ls -la dist-electron/ 2>/dev/null || echo "Check dist-electron/ for your built app"

