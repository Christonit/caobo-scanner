# Caobo Recibos

A web application that automates the extraction of data from scanned receipts and invoices using Gemini AI.

## Architecture

- **Frontend:** Nuxt 3 (Vue 3 + Tailwind CSS + Pinia)
- **Backend:** Python FastAPI (Gemini AI + openpyxl)

The two services run independently and communicate over HTTP. The frontend reads the backend URL from `NUXT_PUBLIC_API_BASE` (defaults to `http://localhost:8000`).

## Project Structure

```
.
├── app.vue
├── pages/             # Nuxt pages
├── python_backend/    # FastAPI server
├── nuxt.config.ts
└── package.json
```

## Setup

### 1. Install Node.js Dependencies

```bash
npm install
```

### 2. Set Up the Python Backend

```bash
cd python_backend
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `python_backend/.env` with your Gemini API key:

```
GEMINI_API_KEY=your_key_here
# Optional: comma-separated origins allowed by CORS in production
# ALLOWED_ORIGINS=https://recibos.example.com
```

## Development

Run the backend and frontend in two terminals.

**Terminal 1 – FastAPI:**

```bash
cd python_backend
source venv/bin/activate
python server.py
```

The API listens on `http://127.0.0.1:8000` by default. Override with `HOST` / `PORT` env vars.

**Terminal 2 – Nuxt:**

```bash
npm run dev
```

The frontend is served at `http://localhost:3000` and talks to the FastAPI backend.

## Production Build

```bash
# Server-rendered Nuxt build (recommended)
npm run build
npm run start

# Or fully static export
npm run generate
```

Deploy the Python backend separately (e.g. with `uvicorn server:app --host 0.0.0.0 --port 8000`, behind a reverse proxy), and point the frontend at it via:

```
NUXT_PUBLIC_API_BASE=https://api.your-domain.com
```

## API Endpoints

- `GET /` – health check
- `POST /upload` – upload and process a receipt (PDF, PNG, JPG, JPEG)
- `POST /download` – regenerate and download the Excel file from edited data
- `GET /download` – download the most recently generated Excel file

## Notes

- Duplicate detection uses MD5 hashing in `python_backend/history.json`.
- The Excel template lives at `python_backend/template.xls`; a converted `.xlsx` copy is generated on first run.
- In production, restrict CORS by setting `ALLOWED_ORIGINS` on the backend.
