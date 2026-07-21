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
//   3. Attaches each user to that org via public.user_profiles (active org)
//      and public.organization_members when the multi-org migration exists.
//
// Note: seeding re-points each seed user's *active* user_profiles row to
// "Demo Co". Extra rows in organization_members are left alone.

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
    role: "collaborator",
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
    // Always sync the password so the seed is truly idempotent even when the
    // account was first created via invite (which leaves no password set).
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      existing.id,
      { password: spec.password, email_confirm: true }
    );
    if (updateErr) throw updateErr;
    console.log(`  · user exists, password synced: ${spec.email} (${existing.id})`);
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

  // Best-effort: keep organization_members in sync when the multi-org
  // migration has been applied. Ignore "relation does not exist".
  const { error: memberErr } = await admin
    .from("organization_members")
    .upsert(
      {
        user_id: user.id,
        organization_id: orgId,
        role,
      },
      { onConflict: "user_id,organization_id" }
    );
  if (
    memberErr &&
    memberErr.code !== "PGRST205" &&
    memberErr.code !== "42P01" &&
    !/does not exist|Could not find the table/i.test(memberErr.message || "")
  ) {
    throw memberErr;
  }

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
