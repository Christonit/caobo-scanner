# Smart Accounting Desktop Agent

A desktop application that automates the extraction of data from scanned receipts/invoices using Gemini AI.

## Architecture

- **Frontend:** Nuxt.js (SPA mode)
- **Backend:** Python FastAPI
- **Desktop:** Electron

## Setup Instructions

### 1. Install Node.js Dependencies

```bash
npm install
```

### 2. Set Up Python Backend

```bash
cd python_backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Development Mode

**Terminal 1 - Start Python Backend:**
```bash
cd python_backend
source venv/bin/activate
python server.py
```

**Terminal 2 - Start Nuxt Dev Server:**
```bash
npm run dev
```

**Terminal 3 - Start Electron:**
```bash
npm run electron
```

Or use the combined command:
```bash
npm run electron:dev
```

## Project Structure

```
.
├── electron/          # Electron main process
├── python_backend/    # FastAPI server
├── pages/            # Nuxt pages
├── components/       # Vue components
└── template.xls      # Excel template
```

## API Endpoints (Stubs)

- `POST /upload` - Upload and process a receipt file
- `GET /download` - Download the processed Excel file

## Building for Production

The app bundles both the Nuxt frontend and Python backend into a standalone desktop application that doesn't require users to have Python or Node.js installed.

### Prerequisites

1. **Install PyInstaller** in your Python environment:
   ```bash
   cd python_backend
   source venv/bin/activate
   pip install pyinstaller
   ```

2. **Ensure all dependencies are installed:**
   ```bash
   npm install
   pip install -r python_backend/requirements.txt
   ```

### Build Commands

```bash
# Build for your current platform (macOS, Windows, or Linux)
npm run electron:build

# Or build for a specific platform:
npm run electron:build:mac     # macOS (.dmg, .zip)
npm run electron:build:win     # Windows (NSIS installer, portable .exe)
npm run electron:build:linux   # Linux (.AppImage, .deb)
```

### Build Process Overview

The build process consists of three stages:

1. **Nuxt Generate** (`npm run generate`)
   - Compiles the Vue/Nuxt frontend into static HTML/JS/CSS files
   - Output: `.output/public/`

2. **Python Backend Bundling** (`npm run python:build`)
   - Uses PyInstaller to compile the FastAPI server into a standalone executable
   - Configuration: `python_backend/backend.spec`
   - Output: `python_backend/dist/backend`

3. **Electron Packaging** (electron-builder)
   - Bundles everything into a distributable desktop app
   - Configuration: `build` section in `package.json`
   - Output: `dist-electron/`

### Build Output

After a successful build, find your distributable app in `dist-electron/`:

| Platform | Files |
|----------|-------|
| macOS    | `Caobo Recibos-x.x.x.dmg`, `Caobo Recibos-x.x.x-mac.zip` |
| Windows  | `Caobo Recibos Setup x.x.x.exe`, `Caobo Recibos x.x.x.exe` (portable) |
| Linux    | `Caobo Recibos-x.x.x.AppImage`, `caobo-recibos_x.x.x_amd64.deb` |

### Helper Scripts

For more control, use the shell scripts in `scripts/`:

```bash
# Build only the Python backend
./scripts/build-backend.sh

# Complete build (frontend + backend + Electron)
./scripts/build-all.sh
```

### Configuration

- **Electron Builder**: `build` section in `package.json`
- **PyInstaller**: `python_backend/backend.spec`
- **App Icons**: Place icons in `build/` directory
  - `icon.icns` (macOS)
  - `icon.ico` (Windows)
  - `icon.png` (Linux)

## Notes

- Currently using dummy data for Gemini processing
- Excel template population is implemented with stubs
- Duplicate detection via MD5 hashing is implemented

