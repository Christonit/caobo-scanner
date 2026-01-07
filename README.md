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

## Notes

- Currently using dummy data for Gemini processing
- Excel template population is implemented with stubs
- Duplicate detection via MD5 hashing is implemented

