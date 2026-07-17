#!/usr/bin/env node
// Creates (or promotes) the superadmin account.
//
// Usage:
//   SUPABASE_URL=...  SUPABASE_SECRET_KEY=sb_secret_... \
//   node scripts/create-superadmin.mjs [email] [password]
//
// If no email/password are given, defaults to the project's designated
// superadmin (chris.super.admin) and generates a random password, printed
// once to stdout.
//
// Requires the `superadmins` table from
// supabase/migrations/20260716000001_roles_and_superadmin.sql to already
// exist in the target database.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
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
  } catch {}
}
loadDotenv(resolve(__dirname, "..", ".env"));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.NUXT_SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL and/or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const DEFAULT_EMAIL = "christopher.alesan@gmail.com";
const DEFAULT_FULL_NAME = "Chris (Super Admin)";

const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
const generatedPassword = randomBytes(12).toString("base64url");
const password = process.argv[3] || generatedPassword;
const usedGeneratedPassword = !process.argv[3];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === targetEmail.toLowerCase()
    );
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  console.log(`Creating/promoting superadmin: ${email}`);

  let user = await findUserByEmail(email);
  if (user) {
    console.log(`  · user already exists (${user.id}) — leaving password unchanged`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: DEFAULT_FULL_NAME },
    });
    if (error) throw error;
    user = data.user;
    console.log(`  · created user (${user.id})`);
  }

  // A superadmin must NOT also have a user_profiles row — it's what makes
  // them org-less. Remove one if it exists (e.g. was previously seeded).
  const { error: deleteProfileError } = await admin
    .from("user_profiles")
    .delete()
    .eq("id", user.id);
  if (deleteProfileError) throw deleteProfileError;

  const { error: superadminError } = await admin
    .from("superadmins")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (superadminError) throw superadminError;

  console.log("  · marked as superadmin");
  console.log("\nDone.\n");
  console.log(`Sign in at http://localhost:3000/login with:`);
  console.log(`  email:    ${email}`);
  if (usedGeneratedPassword) {
    console.log(`  password: ${password}  (generated — change it after first login)`);
  } else {
    console.log(`  password: (as provided)`);
  }
}

main().catch((err) => {
  console.error("\nFailed:", err);
  process.exit(1);
});
