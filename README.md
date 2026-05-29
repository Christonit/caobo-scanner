# Caobo Recibos

A web application that automates the extraction of data from scanned receipts and invoices using Gemini AI.

## Architecture

- **Frontend:** Nuxt 3 (Vue 3 + Tailwind CSS + Pinia)
- **Auth + DB:** Supabase (Postgres, Auth, RLS)
- **Backend:** Python FastAPI (Gemini AI + openpyxl)

The two services run independently and communicate over HTTP. The frontend reads the backend URL from `NUXT_PUBLIC_API_BASE` (defaults to `http://localhost:8000`).

## Project Structure

```
.
├── app.vue
├── composables/        # useOrganization, etc.
├── layouts/            # default layout w/ header
├── middleware/         # require-org.global.ts
├── pages/              # login, signup, onboarding, team, index (receipts)
├── server/api/         # /api/invitations.post.ts
├── scripts/seed.mjs    # idempotent user/org seeder
├── supabase/
│   ├── config.toml
│   └── migrations/     # SQL schema + RLS
├── python_backend/     # FastAPI server
├── nuxt.config.ts
└── package.json
```

## Auth model

- **Users** authenticate via Supabase Auth (email + password by default).
- **Organizations** are tenants (the company a user works for). They own clients and members.
- **Roles** (`admin` or `collaborator`) are assigned per-organization through the `organization_members` join table — a user can belong to many orgs with different roles.
- **Admins** can invite collaborators by email. New users land directly inside the org via a database trigger; existing users are attached server-side after a check.
- **Clients** belong to a single organization and inherit its access policies.

All multi-tenant access is enforced in Postgres via RLS policies (see `supabase/migrations/20260528000000_init_auth_schema.sql`).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

Copy `.env.example` to `.env` and fill in the values from your Supabase project (Dashboard → Project Settings → API Keys):

```env
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_KEY=sb_publishable_...
NUXT_SUPABASE_SECRET_KEY=sb_secret_...   # server-only
```

### 3. Apply the database schema

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (one-time):

```bash
brew install supabase/tap/supabase   # macOS
# or: npm install -g supabase
supabase --version
```

Link the local project to your remote project and push the migration:

```bash
supabase login                                # opens a browser
supabase link --project-ref kdoqnborquynhhwvhtaj
supabase db push                              # applies supabase/migrations/*
```

> Project ref is the bit before `.supabase.co` in your URL.

After pushing, regenerate the typed schema for the frontend:

```bash
npm run supabase:types
```

### 4. Seed an admin user

Supabase's CLI does not have a first-class "create user" command — the supported workflows are the dashboard, the JS Admin API, or `seed.sql` against a *local* `supabase start` instance. The provided seeder uses the JS Admin API and is safe to run against your remote project:

```bash
npm run seed
```

What it does (idempotent):

- Creates `admin@example.com` (password `password123!`) with `email_confirmed = true`
- Creates `collab@example.com` (password `password123!`)
- Creates an organization `Demo Co`
- Adds the admin as `admin` and the collaborator as `collaborator`

You can sign in immediately at `http://localhost:3000/login`.

### Other ways to create users via the CLI

| Goal | Command |
| --- | --- |
| Create one user against the **remote** project (no script) | Use the dashboard: Authentication → Users → "Add user". |
| Create users against a **local** Supabase stack (`supabase start`) | Add `INSERT INTO auth.users (...)` rows to `supabase/seed.sql` and run `supabase db reset --local`. |
| Create or invite users from any shell | Use the JS admin API like `scripts/seed.mjs`, or call the REST endpoint `POST {SUPABASE_URL}/auth/v1/admin/users` with the `Authorization: Bearer $NUXT_SUPABASE_SECRET_KEY` header. |
| Send a magic-link invitation by email | The "Team" page in the app, which calls `/api/invitations` (admin-only). |

## Development

Run the frontend, backend, and (optionally) a local Supabase stack in separate terminals.

**Terminal 1 — FastAPI:**

```bash
cd python_backend
source venv/bin/activate
python server.py
```

**Terminal 2 — Nuxt:**

```bash
npm run dev
```

The frontend is served at `http://localhost:3000`. Visit `/signup` to create an account, or `/login` if you've seeded users already. New users are sent to `/onboarding` until they belong to at least one organization.

## Inviting collaborators

1. Sign in as an org admin and visit `/team`.
2. Enter the collaborator's email + role.
3. Supabase emails them a sign-up link. When they finish creating their account, the `handle_invitations_on_signup` trigger automatically attaches them to your organization with the role you chose.
4. If the email already belongs to a Supabase user, the server endpoint attaches them directly using the secret key.

## Schema migrations

Initial schema lives at `supabase/migrations/20260528000000_init_auth_schema.sql`. To make changes:

1. Iterate freely against the database with `supabase db query "<SQL>"` or the Studio SQL editor.
2. When happy, run `supabase db diff <name> --linked` to capture the diff into a new migration file.
3. Commit and `supabase db push`.

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

- `GET /` — health check (FastAPI)
- `POST /upload` — upload and process a receipt (PDF, PNG, JPG, JPEG)
- `POST /download` — regenerate and download the Excel file from edited data
- `GET /download` — download the most recently generated Excel file
- `POST /api/invitations` — Nuxt server route, admin-only, sends an email invite

## Notes

- Duplicate detection uses MD5 hashing in `python_backend/history.json`.
- The Excel template lives at `python_backend/template.xls`; a converted `.xlsx` copy is generated on first run.
- In production, restrict CORS by setting `ALLOWED_ORIGINS` on the backend.
- All RLS helpers live in the `private` schema and are not exposed via the API.
