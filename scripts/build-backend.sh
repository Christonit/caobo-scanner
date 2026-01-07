#!/bin/bash
# Build script for Python backend

set -e

echo "🐍 Building Python backend..."

cd "$(dirname "$0")/../python_backend"

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
fi

# Install pyinstaller if not present
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    echo "📥 Installing PyInstaller..."
    pip install pyinstaller
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf build dist __pycache__

# Build with spec file
echo "🔨 Running PyInstaller..."
python3 -m PyInstaller backend.spec --clean

echo "✅ Backend build complete!"
echo "📁 Output: python_backend/dist/backend"

# Verify the build
if [ -f "dist/backend" ] || [ -f "dist/backend.exe" ]; then
    echo "✅ Backend executable created successfully!"
    ls -la dist/
else
    echo "❌ Backend build failed!"
    exit 1
fi

