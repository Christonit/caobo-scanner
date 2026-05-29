#!/usr/bin/env node
// Seed the Supabase project with demo users + an organization.
//
// Usage:
//   SUPABASE_URL=...  SUPABASE_SECRET_KEY=sb_secret_... \
//   node scripts/seed.mjs
//
// What this does (idempotent):
//   1. Creates two auth users (admin@example.com, member@example.com)
//      with email_confirm = true so they can log in immediately.
//   2. Ensures an organization "Demo Co" exists.
//   3. Attaches each user to that org via public.user_profiles, with
//      one as 'admin' and the other as 'member'.
//
// Note: under the live schema, public.user_profiles.id is the primary
// key (one user = one org). If a seed user is already attached to a
// different org, their existing membership will be re-pointed to
// "Demo Co" by this script.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotenv(file) {
  try {
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const [, k, raw] = m;
      if (process.env[k] !== undefined) continue;
      process.env[k] = raw.replace(/^['"]|['"]$/g, "");
    }
  } catch { }
}
loadDotenv(resolve(__dirname, "..", ".env"));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL and/or SUPABASE_SECRET_KEY (a.k.a. sb_secret_... key)."
  );
  console.error("Add them to .env or pass them inline:");
  console.error(
    "  SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/seed.mjs"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_USERS = [
  {
    email: "admin@example.com",
    password: "password123!",
    full_name: "Demo Admin",
    role: "admin",
  },
  {
    email: "member@example.com",
    password: "password123!",
    full_name: "Demo Member",
    role: "member",
  },
];

const ORG = { name: "Demo Co", slug: "demo-co" };

async function findUserByEmail(email) {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function createOrFetchUser(spec) {
  const existing = await findUserByEmail(spec.email);
  if (existing) {
    console.log(`  · user exists: ${spec.email} (${existing.id})`);
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    user_metadata: { full_name: spec.full_name },
  });
  if (error) throw error;
  console.log(`  · created user: ${spec.email} (${data.user.id})`);
  return data.user;
}

async function ensureOrg() {
  const { data: existing, error: findErr } = await admin
    .from("organizations")
    .select("*")
    .eq("slug", ORG.slug)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) {
    console.log(`  · org exists: ${existing.name} (${existing.id})`);
    return existing;
  }
  const { data, error } = await admin
    .from("organizations")
    .insert({ name: ORG.name, slug: ORG.slug })
    .select()
    .single();
  if (error) throw error;
  console.log(`  · created org: ${data.name} (${data.id})`);
  return data;
}

async function ensureMembership(orgId, user, role, full_name) {
  const { error } = await admin
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        organization_id: orgId,
        role,
        full_name,
      },
      { onConflict: "id" }
    );
  if (error) throw error;
  console.log(`  · ${user.email} -> ${role}`);
}

async function main() {
  console.log("Seeding Supabase project...");

  console.log("[1/3] Users");
  const users = [];
  for (const spec of SEED_USERS) {
    users.push({ spec, user: await createOrFetchUser(spec) });
  }

  console.log("[2/3] Organization");
  const org = await ensureOrg();

  console.log("[3/3] Memberships");
  for (const { spec, user } of users) {
    await ensureMembership(org.id, user, spec.role, spec.full_name);
  }

  console.log("\nDone.\n");
  console.log("Sign in at http://localhost:3000/login with either:");
  for (const u of SEED_USERS) {
    console.log(`  ${u.role.padEnd(7)} ${u.email}  /  ${u.password}`);
  }
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
