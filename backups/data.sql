SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict w6I733AWbDJhPKUYoyauhGcg7aS2MeePBMKln5iIKw0LYTuL8xBDgbbPSZhR3R5

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."custom_oauth_providers" ("id", "provider_type", "identifier", "name", "client_id", "client_secret", "acceptable_client_ids", "scopes", "pkce_enabled", "attribute_mapping", "authorization_params", "enabled", "email_optional", "issuer", "discovery_url", "skip_nonce_check", "cached_discovery", "discovery_cached_at", "authorization_url", "token_url", "userinfo_url", "jwks_uri", "created_at", "updated_at", "custom_claims_allowlist") FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") FROM stdin;
00000000-0000-0000-0000-000000000000	b017ee01-afb7-4de5-afc9-1499a14e6b1c	authenticated	authenticated	collab@example.com	$2a$10$FxKy51CzzVefQX4UuDRBQOpTj4KZ8RHqtke3WgwFtQgdqtp.MO/Je	2026-05-28 22:42:04.101552+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Demo Collaborator", "email_verified": true}	\N	2026-05-28 22:42:04.097259+00	2026-05-28 22:42:04.102266+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	d638efbe-7398-4544-83ec-74d74983d44c	authenticated	authenticated	admin@example.com	$2a$10$kuba/btoXULPJOjuCExSxOZh9KY49WbkXJI4Xh4ZODhPAVD57udAm	2026-05-28 22:42:03.939715+00	\N		\N		\N			\N	2026-07-17 02:28:04.934977+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Demo Admin", "email_verified": true}	\N	2026-05-28 22:42:03.930841+00	2026-07-17 02:28:04.956216+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") FROM stdin;
d638efbe-7398-4544-83ec-74d74983d44c	d638efbe-7398-4544-83ec-74d74983d44c	{"sub": "d638efbe-7398-4544-83ec-74d74983d44c", "email": "admin@example.com", "email_verified": false, "phone_verified": false}	email	2026-05-28 22:42:03.937882+00	2026-05-28 22:42:03.937977+00	2026-05-28 22:42:03.937977+00	755babd1-dead-426d-b56b-44ea23965ea6
b017ee01-afb7-4de5-afc9-1499a14e6b1c	b017ee01-afb7-4de5-afc9-1499a14e6b1c	{"sub": "b017ee01-afb7-4de5-afc9-1499a14e6b1c", "email": "collab@example.com", "email_verified": false, "phone_verified": false}	email	2026-05-28 22:42:04.10011+00	2026-05-28 22:42:04.100157+00	2026-05-28 22:42:04.100157+00	7ace52ea-129a-4965-a85c-73dc66e865d9
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_clients" ("id", "client_secret_hash", "registration_type", "redirect_uris", "grant_types", "client_name", "client_uri", "logo_uri", "created_at", "updated_at", "deleted_at", "client_type", "token_endpoint_auth_method") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") FROM stdin;
63e4ddaa-9737-463f-9eb6-d20a29d1d323	d638efbe-7398-4544-83ec-74d74983d44c	2026-05-29 04:34:30.431375+00	2026-05-29 04:34:30.431375+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	68.129.242.142	\N	\N	\N	\N	\N
811ed9cc-92dd-4478-8451-1efca82c9e48	d638efbe-7398-4544-83ec-74d74983d44c	2026-05-29 04:30:10.614234+00	2026-07-13 20:33:26.898742+00	\N	aal1	\N	2026-07-13 20:33:26.898625	node	200.88.25.208	\N	\N	\N	\N	\N
31b1b909-53bb-41f0-849a-f53e89cfae58	d638efbe-7398-4544-83ec-74d74983d44c	2026-05-29 03:21:18.102698+00	2026-05-29 19:11:16.111858+00	\N	aal1	\N	2026-05-29 19:11:16.111551	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	68.129.242.142	\N	\N	\N	\N	\N
9511c42b-38c5-4340-a049-15985ea3eb77	d638efbe-7398-4544-83ec-74d74983d44c	2026-05-31 17:31:55.354863+00	2026-07-14 22:04:53.31446+00	\N	aal1	\N	2026-07-14 22:04:53.314359	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/3.11.13 Chrome/144.0.7559.236 Electron/40.10.3 Safari/537.36	190.167.134.73	\N	\N	\N	\N	\N
b8aa0029-e1d1-4866-934b-297a1751557f	d638efbe-7398-4544-83ec-74d74983d44c	2026-07-14 00:40:14.196114+00	2026-07-14 00:40:14.196114+00	\N	aal1	\N	\N	node	190.167.134.73	\N	\N	\N	\N	\N
f3221862-5330-49e9-95f5-4a9e2b1cfe72	d638efbe-7398-4544-83ec-74d74983d44c	2026-07-16 20:17:00.771856+00	2026-07-17 00:56:27.892265+00	\N	aal1	\N	2026-07-17 00:56:27.892134	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15	190.167.134.73	\N	\N	\N	\N	\N
ab3ab9fa-436f-418a-8d35-bacab7414394	d638efbe-7398-4544-83ec-74d74983d44c	2026-05-31 17:21:50.140966+00	2026-05-31 17:21:50.140966+00	\N	aal1	\N	\N	curl/8.7.1	68.129.242.142	\N	\N	\N	\N	\N
327e1a6c-1b5f-4f49-acab-362a3b25c12c	d638efbe-7398-4544-83ec-74d74983d44c	2026-05-31 17:24:19.86095+00	2026-05-31 17:24:19.86095+00	\N	aal1	\N	\N	curl/8.7.1	68.129.242.142	\N	\N	\N	\N	\N
38af1d2f-868f-4f66-a0d7-93e7458fd134	d638efbe-7398-4544-83ec-74d74983d44c	2026-05-31 17:26:16.098414+00	2026-05-31 17:26:16.098414+00	\N	aal1	\N	\N	curl/8.7.1	68.129.242.142	\N	\N	\N	\N	\N
f87af1a0-a1a4-4c6a-a1c8-084453da1af9	d638efbe-7398-4544-83ec-74d74983d44c	2026-05-31 02:17:14.864547+00	2026-07-17 01:32:37.997641+00	\N	aal1	\N	2026-07-17 01:32:37.997528	node	190.167.134.73	\N	\N	\N	\N	\N
45372bd6-9046-41e8-88d9-cf5dae096e1b	d638efbe-7398-4544-83ec-74d74983d44c	2026-07-17 02:28:04.935086+00	2026-07-17 02:28:04.935086+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	190.167.134.73	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") FROM stdin;
31b1b909-53bb-41f0-849a-f53e89cfae58	2026-05-29 03:21:18.143168+00	2026-05-29 03:21:18.143168+00	password	af7840dc-3bcc-4632-949b-397b78abbc32
811ed9cc-92dd-4478-8451-1efca82c9e48	2026-05-29 04:30:10.636301+00	2026-05-29 04:30:10.636301+00	password	19d0537f-ca1c-4603-bf98-38737077090c
63e4ddaa-9737-463f-9eb6-d20a29d1d323	2026-05-29 04:34:30.457908+00	2026-05-29 04:34:30.457908+00	password	0c71e5bf-4c5b-44d3-b82e-a1cd27e09be6
f87af1a0-a1a4-4c6a-a1c8-084453da1af9	2026-05-31 02:17:14.910541+00	2026-05-31 02:17:14.910541+00	password	b684de57-01c6-4736-97a8-174ca4f7c10e
ab3ab9fa-436f-418a-8d35-bacab7414394	2026-05-31 17:21:50.173451+00	2026-05-31 17:21:50.173451+00	password	be00c164-7b29-405d-a05c-97b21b5a2b36
327e1a6c-1b5f-4f49-acab-362a3b25c12c	2026-05-31 17:24:19.87472+00	2026-05-31 17:24:19.87472+00	password	2613dec3-52d8-4e33-9ee3-dd5f392e9dc2
38af1d2f-868f-4f66-a0d7-93e7458fd134	2026-05-31 17:26:16.106311+00	2026-05-31 17:26:16.106311+00	password	fa3e99c6-5ba8-4dc3-ab94-8f0e4a7b27b1
9511c42b-38c5-4340-a049-15985ea3eb77	2026-05-31 17:31:55.39665+00	2026-05-31 17:31:55.39665+00	password	658aaa89-f874-4287-8339-891bf0067eb3
b8aa0029-e1d1-4866-934b-297a1751557f	2026-07-14 00:40:14.222042+00	2026-07-14 00:40:14.222042+00	password	5127c531-23ad-45c5-a1a6-f74ef0f3e5c1
f3221862-5330-49e9-95f5-4a9e2b1cfe72	2026-07-16 20:17:00.815028+00	2026-07-16 20:17:00.815028+00	password	7216d2cd-d24f-40bd-87f5-a4e0d29f3948
45372bd6-9046-41e8-88d9-cf5dae096e1b	2026-07-17 02:28:04.961594+00	2026-07-17 02:28:04.961594+00	password	bcef9589-f13d-4874-a2f2-29a2a849509a
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_factors" ("id", "user_id", "friendly_name", "factor_type", "status", "created_at", "updated_at", "secret", "phone", "last_challenged_at", "web_authn_credential", "web_authn_aaguid", "last_webauthn_challenge_data") FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_challenges" ("id", "factor_id", "created_at", "verified_at", "ip_address", "otp_code", "web_authn_session_data") FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_authorizations" ("id", "authorization_id", "client_id", "user_id", "redirect_uri", "scope", "state", "resource", "code_challenge", "code_challenge_method", "response_type", "status", "authorization_code", "created_at", "expires_at", "approved_at", "nonce") FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_client_states" ("id", "provider_type", "code_verifier", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_consents" ("id", "user_id", "client_id", "scopes", "granted_at", "revoked_at") FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") FROM stdin;
00000000-0000-0000-0000-000000000000	1	n7vpt2undxq4	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-29 03:21:18.126856+00	2026-05-29 04:19:05.450434+00	\N	31b1b909-53bb-41f0-849a-f53e89cfae58
00000000-0000-0000-0000-000000000000	5	mq2jpl6i7ivl	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-05-29 04:34:30.446671+00	2026-05-29 04:34:30.446671+00	\N	63e4ddaa-9737-463f-9eb6-d20a29d1d323
00000000-0000-0000-0000-000000000000	3	emqxawjnsh2r	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-29 04:19:05.459302+00	2026-05-29 05:23:53.000226+00	n7vpt2undxq4	31b1b909-53bb-41f0-849a-f53e89cfae58
00000000-0000-0000-0000-000000000000	6	xsjiimzvdoj3	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-29 05:23:53.017935+00	2026-05-29 14:20:10.393461+00	emqxawjnsh2r	31b1b909-53bb-41f0-849a-f53e89cfae58
00000000-0000-0000-0000-000000000000	4	hnjqrdwggrqe	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-29 04:30:10.632191+00	2026-05-29 14:48:16.698517+00	\N	811ed9cc-92dd-4478-8451-1efca82c9e48
00000000-0000-0000-0000-000000000000	7	e4rgoqliexnt	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-29 14:20:10.411034+00	2026-05-29 18:08:21.166871+00	xsjiimzvdoj3	31b1b909-53bb-41f0-849a-f53e89cfae58
00000000-0000-0000-0000-000000000000	9	zrg3ascutjvb	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-29 18:08:21.177885+00	2026-05-29 19:11:16.013402+00	e4rgoqliexnt	31b1b909-53bb-41f0-849a-f53e89cfae58
00000000-0000-0000-0000-000000000000	10	kwtuwy2fva6f	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-05-29 19:11:16.028428+00	2026-05-29 19:11:16.028428+00	zrg3ascutjvb	31b1b909-53bb-41f0-849a-f53e89cfae58
00000000-0000-0000-0000-000000000000	11	rhrytuhtw36f	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 02:17:14.89039+00	2026-05-31 03:15:19.191523+00	\N	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	12	z7ixfat5kh7d	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 03:15:19.20669+00	2026-05-31 04:13:18.948246+00	rhrytuhtw36f	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	13	ykkolo4basmu	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 04:13:18.955703+00	2026-05-31 05:11:18.914874+00	z7ixfat5kh7d	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	14	cqhc56r265yk	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 05:11:18.920454+00	2026-05-31 06:23:29.75492+00	ykkolo4basmu	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	15	e6r6apq5od4u	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 06:23:29.761039+00	2026-05-31 07:21:34.34821+00	cqhc56r265yk	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	16	avtismxbujcn	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 07:21:34.353668+00	2026-05-31 08:26:32.044961+00	e6r6apq5od4u	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	17	2noxxunb5aui	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 08:26:32.05145+00	2026-05-31 09:24:23.508557+00	avtismxbujcn	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	18	r6ftjt2onsmo	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 09:24:23.513949+00	2026-05-31 10:22:23.563188+00	2noxxunb5aui	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	19	e4eqb57stnye	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 10:22:23.569521+00	2026-05-31 11:20:38.262024+00	r6ftjt2onsmo	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	20	l6xtrygrpsns	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 11:20:38.270311+00	2026-05-31 12:18:38.178161+00	e4eqb57stnye	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	21	feu2vuwa2zib	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 12:18:38.18526+00	2026-05-31 13:16:27.62168+00	l6xtrygrpsns	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	22	ptmw65zg7sgv	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 13:16:27.626536+00	2026-05-31 14:20:54.131959+00	feu2vuwa2zib	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	23	lg6xltoj57vy	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 14:20:54.136679+00	2026-05-31 15:18:55.988162+00	ptmw65zg7sgv	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	24	7x2jnygc7r7x	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 15:18:55.994549+00	2026-05-31 16:16:54.510722+00	lg6xltoj57vy	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	25	lvkv44g6hfsv	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 16:16:54.516999+00	2026-05-31 17:14:47.912876+00	7x2jnygc7r7x	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	27	vc4e2nfsbtkd	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-05-31 17:21:50.160369+00	2026-05-31 17:21:50.160369+00	\N	ab3ab9fa-436f-418a-8d35-bacab7414394
00000000-0000-0000-0000-000000000000	28	zv7gg56y2krg	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-05-31 17:24:19.867204+00	2026-05-31 17:24:19.867204+00	\N	327e1a6c-1b5f-4f49-acab-362a3b25c12c
00000000-0000-0000-0000-000000000000	29	nuukpyq7hnru	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-05-31 17:26:16.10291+00	2026-05-31 17:26:16.10291+00	\N	38af1d2f-868f-4f66-a0d7-93e7458fd134
00000000-0000-0000-0000-000000000000	26	pxokua5tahu5	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 17:14:47.921321+00	2026-05-31 18:12:40.388572+00	lvkv44g6hfsv	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	30	gfhopgj6kntm	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 17:31:55.383519+00	2026-05-31 18:30:11.622826+00	\N	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	31	w7a27sxhxdpi	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 18:12:40.397591+00	2026-05-31 19:10:52.245059+00	pxokua5tahu5	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	32	gtlx57avnele	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 18:30:11.630041+00	2026-05-31 19:28:26.625166+00	gfhopgj6kntm	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	33	a5a5ofbdxty4	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 19:10:52.254445+00	2026-05-31 20:08:52.344538+00	w7a27sxhxdpi	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	34	6aj45facfkur	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 19:28:26.63331+00	2026-05-31 20:33:55.926202+00	gtlx57avnele	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	35	fudlb3hvabpg	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 20:08:52.351774+00	2026-07-13 19:06:38.449775+00	a5a5ofbdxty4	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	37	xhen3goesrob	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-13 19:06:38.464305+00	2026-07-13 20:06:52.858707+00	fudlb3hvabpg	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	8	yjajjtqz4zy3	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-29 14:48:16.707824+00	2026-07-13 20:33:26.846402+00	hnjqrdwggrqe	811ed9cc-92dd-4478-8451-1efca82c9e48
00000000-0000-0000-0000-000000000000	39	m44cwfuolgxk	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-07-13 20:33:26.854173+00	2026-07-13 20:33:26.854173+00	yjajjtqz4zy3	811ed9cc-92dd-4478-8451-1efca82c9e48
00000000-0000-0000-0000-000000000000	36	c7dxslzsqywz	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-05-31 20:33:55.933773+00	2026-07-13 20:35:23.926104+00	6aj45facfkur	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	38	c3qb3rciymcu	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-13 20:06:52.872912+00	2026-07-13 21:05:57.024517+00	xhen3goesrob	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	40	kz7opgyuoiw6	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-13 20:35:23.937412+00	2026-07-13 21:33:20.984588+00	c7dxslzsqywz	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	42	gtlfxq6uf5k4	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-13 21:33:20.994634+00	2026-07-13 22:31:13.806185+00	kz7opgyuoiw6	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	43	ys5caczwyrjs	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-13 22:31:13.816619+00	2026-07-13 23:29:13.894767+00	gtlfxq6uf5k4	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	41	bcq7cyeocld3	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-13 21:05:57.03449+00	2026-07-13 23:44:45.607183+00	c3qb3rciymcu	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	44	gj35vzlxhcxl	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-13 23:29:13.907885+00	2026-07-14 00:27:08.410067+00	ys5caczwyrjs	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	47	ij34ipgwruqg	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-07-14 00:40:14.211593+00	2026-07-14 00:40:14.211593+00	\N	b8aa0029-e1d1-4866-934b-297a1751557f
00000000-0000-0000-0000-000000000000	45	2k3yvwzmlaob	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-13 23:44:45.613948+00	2026-07-14 00:45:01.833103+00	bcq7cyeocld3	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	46	2hirb53vauik	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 00:27:08.418486+00	2026-07-14 01:25:48.691355+00	gj35vzlxhcxl	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	48	bso5hfxrwnf2	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 00:45:01.843834+00	2026-07-14 01:42:56.498218+00	2k3yvwzmlaob	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	49	uagdjwigumk5	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 01:25:48.700131+00	2026-07-14 02:23:55.27883+00	2hirb53vauik	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	50	ahkccq7uvk5a	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 01:42:56.507109+00	2026-07-14 03:05:03.620222+00	bso5hfxrwnf2	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	51	kvsxgpkhax5m	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 02:23:55.287102+00	2026-07-14 03:22:01.347031+00	uagdjwigumk5	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	73	d5t5xvaifddc	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 19:10:52.648101+00	2026-07-14 20:08:47.007108+00	gyghw6zmxef7	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	72	dgskmphjwlmo	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 19:10:51.507363+00	2026-07-14 20:20:46.614769+00	k5s7c66m4iqz	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	53	524lkpfmraqb	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 03:22:01.35423+00	2026-07-14 04:20:01.16989+00	kvsxgpkhax5m	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	54	3xzklxck6v74	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 04:20:01.176232+00	2026-07-14 05:17:48.765061+00	524lkpfmraqb	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	74	6q3qq6matqsq	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 20:08:47.020268+00	2026-07-14 21:06:42.34773+00	d5t5xvaifddc	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	55	l5o6wo4nbyu7	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 05:17:48.77118+00	2026-07-14 06:16:20.286149+00	3xzklxck6v74	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	56	47uwhfdrlzgo	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 06:16:20.292474+00	2026-07-14 07:33:18.94048+00	l5o6wo4nbyu7	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	75	doadpakmme66	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 20:20:46.621986+00	2026-07-14 21:18:38.104023+00	dgskmphjwlmo	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	57	53kh6qakqzz6	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 07:33:18.949379+00	2026-07-14 08:31:20.836854+00	47uwhfdrlzgo	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	58	6fgzu6lizgve	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 08:31:20.84471+00	2026-07-14 09:29:20.689216+00	53kh6qakqzz6	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	76	56f3zo25hpmv	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 21:06:42.356011+00	2026-07-14 22:04:53.272126+00	6q3qq6matqsq	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	59	qptdczf5btcx	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 09:29:20.696879+00	2026-07-14 10:27:20.658538+00	6fgzu6lizgve	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	78	vojyn3ajhlfp	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-07-14 22:04:53.283209+00	2026-07-14 22:04:53.283209+00	56f3zo25hpmv	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	60	53z5ae2bcekm	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 10:27:20.665526+00	2026-07-14 11:25:20.721219+00	qptdczf5btcx	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	77	pal45fhykksr	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 21:18:38.107443+00	2026-07-14 22:16:41.723352+00	doadpakmme66	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	61	o6oxmjsbvg6b	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 11:25:20.726938+00	2026-07-14 12:23:50.170927+00	53z5ae2bcekm	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	62	tuujrp2ehphb	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 12:23:50.176712+00	2026-07-14 13:22:31.373333+00	o6oxmjsbvg6b	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	79	mwyxnsip2qpo	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 22:16:41.730649+00	2026-07-14 23:14:44.864822+00	pal45fhykksr	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	63	dj5ek2dotkz2	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 13:22:31.381407+00	2026-07-14 14:20:49.272336+00	tuujrp2ehphb	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	52	7caqqqgnlpoh	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 03:05:03.627369+00	2026-07-14 14:26:59.815692+00	ahkccq7uvk5a	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	80	3juxpcehsq6f	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 23:14:44.881458+00	2026-07-15 01:37:00.607622+00	mwyxnsip2qpo	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	64	ecqzqpqfnjk6	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 14:20:49.27905+00	2026-07-14 15:18:58.741395+00	dj5ek2dotkz2	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	65	rgjf7dz3slab	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 14:26:59.822225+00	2026-07-14 15:25:04.052729+00	7caqqqgnlpoh	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	81	lgwngecrqswp	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-15 01:37:00.618754+00	2026-07-15 02:35:14.861299+00	3juxpcehsq6f	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	66	pkvszxat73i2	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 15:18:58.753302+00	2026-07-14 16:16:45.305955+00	ecqzqpqfnjk6	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	67	5djmojiiwrqt	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 15:25:04.059116+00	2026-07-14 16:23:19.587338+00	rgjf7dz3slab	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	82	nk6qocdjj2yl	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-15 02:35:14.868716+00	2026-07-15 04:20:20.551237+00	lgwngecrqswp	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	68	pie72km4acvd	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 16:16:45.314266+00	2026-07-14 17:14:44.745624+00	pkvszxat73i2	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	70	ogdtug3rb24n	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 17:14:44.761543+00	2026-07-14 18:12:48.825573+00	pie72km4acvd	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	83	2wc73qsiyhee	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-15 04:20:20.562311+00	2026-07-15 05:18:31.281466+00	nk6qocdjj2yl	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	69	k5s7c66m4iqz	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 16:23:19.594549+00	2026-07-14 19:10:51.497925+00	5djmojiiwrqt	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	71	gyghw6zmxef7	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-14 18:12:48.832314+00	2026-07-14 19:10:52.647709+00	ogdtug3rb24n	9511c42b-38c5-4340-a049-15985ea3eb77
00000000-0000-0000-0000-000000000000	84	7jbxbxg7djoe	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-15 05:18:31.286781+00	2026-07-15 19:39:51.690835+00	2wc73qsiyhee	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	85	t5vs5o7ifzal	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-15 19:39:51.706667+00	2026-07-15 20:38:31.615476+00	7jbxbxg7djoe	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	86	ij4aupklerb6	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-15 20:38:31.632816+00	2026-07-16 01:03:18.264299+00	t5vs5o7ifzal	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	87	5zuh5sc6apf3	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 01:03:18.275271+00	2026-07-16 03:00:52.863697+00	ij4aupklerb6	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	88	drojn6el4npm	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 03:00:52.873103+00	2026-07-16 03:58:50.035854+00	5zuh5sc6apf3	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	89	fbzchz4q7jod	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 03:58:50.045861+00	2026-07-16 05:00:27.866373+00	drojn6el4npm	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	90	valdmwc6wukn	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 05:00:27.876514+00	2026-07-16 05:58:18.101438+00	fbzchz4q7jod	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	91	3z2ktjtk7ctr	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 05:58:18.108157+00	2026-07-16 06:56:35.210707+00	valdmwc6wukn	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	92	rxnxocsxbjnk	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 06:56:35.227979+00	2026-07-16 07:54:35.233716+00	3z2ktjtk7ctr	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	93	nstols6buts6	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 07:54:35.24193+00	2026-07-16 08:52:35.315645+00	rxnxocsxbjnk	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	94	kpxlknrx464e	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 08:52:35.326069+00	2026-07-16 09:50:31.230512+00	nstols6buts6	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	95	rovawplqipl2	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 09:50:31.236201+00	2026-07-16 10:48:31.71811+00	kpxlknrx464e	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	96	qmby2iw4svbf	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 10:48:31.722701+00	2026-07-16 11:46:31.776383+00	rovawplqipl2	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	97	cydfl722jlhx	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 11:46:31.781094+00	2026-07-16 12:44:31.753651+00	qmby2iw4svbf	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	98	dkpaoytsqw52	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 12:44:31.762513+00	2026-07-16 13:42:34.851654+00	cydfl722jlhx	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	99	urycs545kies	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 13:42:34.858719+00	2026-07-16 14:40:35.009135+00	dkpaoytsqw52	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	100	a535xwb5ckhq	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 14:40:35.01589+00	2026-07-16 15:39:50.767385+00	urycs545kies	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	101	ocuwhwmy37vq	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 15:39:50.779466+00	2026-07-16 16:37:57.73591+00	a535xwb5ckhq	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	102	cjf6rotadhgs	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 16:37:57.740998+00	2026-07-16 17:35:47.306377+00	ocuwhwmy37vq	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	104	np3ixodhrs7p	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 20:17:00.791479+00	2026-07-16 21:22:29.495299+00	\N	f3221862-5330-49e9-95f5-4a9e2b1cfe72
00000000-0000-0000-0000-000000000000	105	oixgbbrlih6i	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 21:22:29.503923+00	2026-07-16 22:31:01.116613+00	np3ixodhrs7p	f3221862-5330-49e9-95f5-4a9e2b1cfe72
00000000-0000-0000-0000-000000000000	106	etv7aovozcof	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 22:31:01.122366+00	2026-07-16 23:29:02.590172+00	oixgbbrlih6i	f3221862-5330-49e9-95f5-4a9e2b1cfe72
00000000-0000-0000-0000-000000000000	107	vzzh5levxnaa	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 23:29:02.599487+00	2026-07-17 00:56:27.873316+00	etv7aovozcof	f3221862-5330-49e9-95f5-4a9e2b1cfe72
00000000-0000-0000-0000-000000000000	108	g2hhr6prkqe2	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-07-17 00:56:27.877593+00	2026-07-17 00:56:27.877593+00	vzzh5levxnaa	f3221862-5330-49e9-95f5-4a9e2b1cfe72
00000000-0000-0000-0000-000000000000	103	oov6maeexkii	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-16 17:35:47.320234+00	2026-07-17 01:32:37.95025+00	cjf6rotadhgs	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	109	6pdfh3vtmyh2	d638efbe-7398-4544-83ec-74d74983d44c	t	2026-07-17 01:32:37.958649+00	2026-07-17 02:24:22.461802+00	oov6maeexkii	f87af1a0-a1a4-4c6a-a1c8-084453da1af9
00000000-0000-0000-0000-000000000000	110	tgx2fij4mif6	d638efbe-7398-4544-83ec-74d74983d44c	f	2026-07-17 02:28:04.952457+00	2026-07-17 02:28:04.952457+00	\N	45372bd6-9046-41e8-88d9-cf5dae096e1b
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_providers" ("id", "resource_id", "created_at", "updated_at", "disabled") FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_providers" ("id", "sso_provider_id", "entity_id", "metadata_xml", "metadata_url", "attribute_mapping", "created_at", "updated_at", "name_id_format") FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_relay_states" ("id", "sso_provider_id", "request_id", "for_email", "redirect_to", "created_at", "updated_at", "flow_state_id") FROM stdin;
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_domains" ("id", "sso_provider_id", "domain", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_challenges" ("id", "user_id", "challenge_type", "session_data", "created_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_credentials" ("id", "user_id", "credential_id", "public_key", "attestation_type", "aaguid", "sign_count", "transports", "backup_eligible", "backed_up", "friendly_name", "created_at", "updated_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."organizations" ("id", "name", "created_at", "updated_at", "deleted_at", "slug") FROM stdin;
b509b8b1-586e-4eac-bbb3-4fee4456b4cb	Demo Co	2026-05-28 22:42:04.242172+00	2026-05-28 22:42:04.242172+00	\N	demo-co
74b5295a-3ec0-4e8c-b318-93980be8af05	Carsant	2026-07-13 20:40:53.70464+00	2026-07-13 20:40:53.70464+00	\N	carsant
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."activity_logs" ("id", "organization_id", "performed_by", "entity_type", "entity_id", "action", "diff", "note", "created_at") FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."clients" ("id", "organization_id", "created_by", "name", "tax_payer_id", "email", "notes", "created_at", "updated_at", "deleted_at") FROM stdin;
a9245f91-2aa9-454a-b847-f9c096fdaae7	74b5295a-3ec0-4e8c-b318-93980be8af05	d638efbe-7398-4544-83ec-74d74983d44c	Eureka	131872816	\N	\N	2026-07-14 00:45:13.307667+00	2026-07-14 00:45:13.307667+00	\N
\.


--
-- Data for Name: client_business_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."client_business_rules" ("id", "client_id", "rule_name", "created_at", "updated_at") FROM stdin;
3be77616-e592-40dd-9e18-1469a03e43ce	a9245f91-2aa9-454a-b847-f9c096fdaae7	Uso de Impuestos	2026-07-14 20:49:15.099377+00	2026-07-14 20:49:15.099377+00
7d0d6dcf-da7a-4934-a10a-388953a05115	a9245f91-2aa9-454a-b847-f9c096fdaae7	Factura a nombre de la misma empresa.	2026-07-16 17:17:24.416288+00	2026-07-16 17:17:24.416288+00
6f5e8283-daca-4870-9850-da13ed0b7a35	a9245f91-2aa9-454a-b847-f9c096fdaae7	Tipos de Pago	2026-07-16 17:19:45.680685+00	2026-07-16 17:19:45.680685+00
\.


--
-- Data for Name: business_rule_attributes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."business_rule_attributes" ("id", "client_business_rule_id", "rule_type", "rule_value", "description", "created_at") FROM stdin;
1	3be77616-e592-40dd-9e18-1469a03e43ce	Retention ITBIS	\N	Retention ITBIS este valor aparece mencionado en la factura, analizar el documento para identificar donde se realiza la retención, si se debe retener.	2026-07-14 20:49:15.316785+00
2	7d0d6dcf-da7a-4934-a10a-388953a05115	Factura a nombre de la misma empresa.	\N	El sistema debe contemplar que el cliente (Eureka) no puede emitirse una factura a sí misma.\n\nSi se detecta el RNC de Eureka en la factura, el sistema debe buscar automáticamente un segundo RNC válido para identificar correctamente a la contraparte de la transacción. Puede encontrase como CIF/NIF	2026-07-16 17:17:24.6953+00
3	6f5e8283-daca-4870-9850-da13ed0b7a35	Pago en Dolares	Pago en Dolares	El "tipo de pago" es "4" , cuando los pagos son en Dolares	2026-07-16 17:19:45.808216+00
\.


--
-- Data for Name: client_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."client_documents" ("id", "client_id", "document_name", "created_at", "updated_at") FROM stdin;
2d96b00f-5d56-4302-90ea-32a9bfe670b3	a9245f91-2aa9-454a-b847-f9c096fdaae7	Concepto	2026-07-14 01:42:24.102271+00	2026-07-14 01:42:24.102271+00
138fbf07-cf5c-4e3c-81f2-e170a47a3e56	a9245f91-2aa9-454a-b847-f9c096fdaae7	Tipo de Pago	2026-07-14 01:44:08.33814+00	2026-07-14 01:44:08.33814+00
76f770eb-a2a4-4f52-9cfb-099dc033c64c	a9245f91-2aa9-454a-b847-f9c096fdaae7	Tipo de Gasto	2026-07-14 19:18:09.079222+00	2026-07-14 19:18:09.079222+00
\.


--
-- Data for Name: client_suplidores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."client_suplidores" ("id", "client_id", "nombre", "documento", "tipo_de_factura", "registered_on_platform", "created_at", "updated_at") FROM stdin;
207e3d27-0bde-4fe9-b1e6-aff68cccbef7	a9245f91-2aa9-454a-b847-f9c096fdaae7	VITASALUD. S.R.L.	101150612	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:47.344+00
bdbd34b8-ea8f-4632-891b-41fb834722da	a9245f91-2aa9-454a-b847-f9c096fdaae7	Victoria Yeb, S.A.	130053911	Gasto Formal	t	2026-07-15 19:50:34.577167+00	2026-07-16 14:49:48.228+00
56921159-c509-479b-b3ac-9fb79679b4ed	a9245f91-2aa9-454a-b847-f9c096fdaae7	Union Comercial Consolidada, S. A.	101702176	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:48.866+00
84db9497-e177-4329-9ccf-d0578cd6aa36	a9245f91-2aa9-454a-b847-f9c096fdaae7	TOKY TOKY MEDICAL, SRL	131373526	Formal	t	2026-07-15 20:34:54.428592+00	2026-07-16 14:49:49.595+00
e971370f-21bc-4f26-a958-3542f416a4cf	a9245f91-2aa9-454a-b847-f9c096fdaae7	TIENDAS CORRIPIO	100369	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:51.64+00
9efe0feb-f086-4b09-8f46-ff59fbcfb2ab	a9245f91-2aa9-454a-b847-f9c096fdaae7	Saldent Internacional Division Farmacia S R L	130660395	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:52.423+00
29545cf3-3c04-4b7b-8625-4b4eb047ac66	a9245f91-2aa9-454a-b847-f9c096fdaae7	RAAHMEDIC SRL	131092578	Formal	t	2026-07-15 20:34:54.428592+00	2026-07-16 14:49:53.574+00
a289fa61-2fff-4508-87d3-ea354258acfc	a9245f91-2aa9-454a-b847-f9c096fdaae7	Quisqueya Comercial	101007631	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:54.14+00
ecfbc448-7fd3-49c8-a56b-3ffd73d5be09	a9245f91-2aa9-454a-b847-f9c096fdaae7	Óscar A. Renta Negron, S.A.	101011612	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:54.742+00
c5682522-4c07-4eba-a3d8-de0183757d43	a9245f91-2aa9-454a-b847-f9c096fdaae7	LUIS E. BETANCES R. & CO. S.A.S.	101006145	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:55.8+00
d8a1e1a3-3184-4f4b-949e-22f109745c7a	a9245f91-2aa9-454a-b847-f9c096fdaae7	INMENOL Industrial Laboratorios, S.R.L.	101107146	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:56.228+00
c2fa70c2-9d3e-4e99-9828-74c8e20b26fc	a9245f91-2aa9-454a-b847-f9c096fdaae7	Ibero Farmacos, S.R.L.	102318532	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:57.181+00
13503c2d-1c26-4798-a958-278631110880	a9245f91-2aa9-454a-b847-f9c096fdaae7	FARMACOS DEL NORTE, S.R.L.	102005941	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:58.212+00
6347b4e4-1f92-43eb-9263-13469a3af859	a9245f91-2aa9-454a-b847-f9c096fdaae7	DISTRIBUIDORA CORRIPIO, S.A.S.	101003693	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:58.66+00
1bcac94c-c8c6-4692-a78a-159cd7c76b52	a9245f91-2aa9-454a-b847-f9c096fdaae7	Disfarmaco, SRL	122029818	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:49:59.689+00
b084dfa5-620a-4d7a-af8d-4ded13bdd7d6	a9245f91-2aa9-454a-b847-f9c096fdaae7	Daniel Espinal, S.A.S.	102000476	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:50:00.093+00
f065bd42-61c0-447a-8395-5f3f5ab7c445	a9245f91-2aa9-454a-b847-f9c096fdaae7	Caribbean Souvenirs	130724492	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:50:01.161+00
02701851-3d06-4075-85e9-bf17bc911561	a9245f91-2aa9-454a-b847-f9c096fdaae7	Carabela	101033681	Gasto Formal	t	2026-07-15 19:59:01.954922+00	2026-07-16 14:50:01.545+00
75b9bb3b-5a6b-45fd-91e0-fd6d98137c63	a9245f91-2aa9-454a-b847-f9c096fdaae7	ALMACENES EL FRUTAL, SRL.	101708506	Formal	t	2026-07-16 15:47:02.37043+00	2026-07-16 15:49:27.563+00
b245f9e2-4090-4450-b6ee-fcddf4dbf32a	a9245f91-2aa9-454a-b847-f9c096fdaae7	COMPAÑIA DE ELECTRICIDAD DE BAYAHIBE, S.A.(CEB)	101839155	Formal	t	2026-07-16 15:47:02.37043+00	2026-07-16 15:49:28.884+00
c041709e-6374-40cb-9035-558831d0dc64	a9245f91-2aa9-454a-b847-f9c096fdaae7	VIVA WYNDHAM DOMINICUS	101167203	Formal	t	2026-07-16 15:47:02.37043+00	2026-07-16 15:49:32.792+00
c2aad982-f76a-478e-a384-8f6677fdd4ed	a9245f91-2aa9-454a-b847-f9c096fdaae7	EUREKA ANDREA EIRL "FARMACIA"	131872816	Gasto Formal	f	2026-07-16 15:54:21.963079+00	2026-07-16 15:54:21.963079+00
\.


--
-- Data for Name: client_tax_column_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."client_tax_column_mappings" ("id", "client_id", "itbis_column", "selectivo_column", "descuento_column", "propina_column", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: document_attributes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."document_attributes" ("id", "client_document_id", "document_type", "document_id", "description", "created_at") FROM stdin;
1	2d96b00f-5d56-4302-90ea-32a9bfe670b3	CARGOS BANCARIOS	7	\N	2026-07-14 01:42:24.289519+00
2	2d96b00f-5d56-4302-90ea-32a9bfe670b3	COSTOS DE VENTAS	6	\N	2026-07-14 01:42:24.289519+00
3	2d96b00f-5d56-4302-90ea-32a9bfe670b3	OTROS GASTOS	5	\N	2026-07-14 01:42:24.289519+00
4	2d96b00f-5d56-4302-90ea-32a9bfe670b3	Pago de Nomina	4	\N	2026-07-14 01:42:24.289519+00
5	2d96b00f-5d56-4302-90ea-32a9bfe670b3	Pago de Honorarios P/Servs Profesionales P/Fisicas	3	\N	2026-07-14 01:42:24.289519+00
6	2d96b00f-5d56-4302-90ea-32a9bfe670b3	Pago de Teléfono	2	\N	2026-07-14 01:42:24.289519+00
7	2d96b00f-5d56-4302-90ea-32a9bfe670b3	Pago de Combustibles	1	\N	2026-07-14 01:42:24.289519+00
8	138fbf07-cf5c-4e3c-81f2-e170a47a3e56	Cuenta por Pagar Accionistas US	4	\N	2026-07-14 01:44:08.533033+00
9	138fbf07-cf5c-4e3c-81f2-e170a47a3e56	Cuenta por Pagar Accionistas	3	\N	2026-07-14 01:44:08.533033+00
10	138fbf07-cf5c-4e3c-81f2-e170a47a3e56	Tarjeta Crédito	2	\N	2026-07-14 01:44:08.533033+00
11	138fbf07-cf5c-4e3c-81f2-e170a47a3e56	Caja Chica	1	\N	2026-07-14 01:44:08.533033+00
12	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Gasto de personal	1	\N	2026-07-14 19:18:09.299877+00
14	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Arrendamientos	3	\N	2026-07-14 19:18:09.299877+00
15	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Gastos de activo fijo	4	\N	2026-07-14 19:18:09.299877+00
16	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Gastos de representación	5	\N	2026-07-14 19:18:09.299877+00
17	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Otras deducciones administrativas	6	\N	2026-07-14 19:18:09.299877+00
18	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Gastos financieros	7	\N	2026-07-14 19:18:09.299877+00
19	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Gastos extraordinarios	8	\N	2026-07-14 19:18:09.299877+00
21	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Adquisicion de activos	10	\N	2026-07-14 19:18:09.299877+00
22	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Gastos de seguros	11	\N	2026-07-14 19:18:09.299877+00
20	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Compras y gastos que forman gastos de la venta	9	Para Eureka estas compras de este suplidor pertenecen al tipo de gasto 09- Compras y gastos que forman gastos de venta, en vista que es una farmacia su actividad es la venta de estos productos. Aquí dependerá del tipo suplidor para poder determinar el tipo de gasto.	2026-07-14 19:18:09.299877+00
13	76f770eb-a2a4-4f52-9cfb-099dc033c64c	Gastos por trabajos, servicios y suministros	2	Esta categoría esta reservada para procesos relacionados con intervenciones en edificaciones y activos fijos.\n\nPor ejemplo, una Factura de Electricidad debe clasificarse obligatoriamente bajo el Gasto 2	2026-07-14 19:18:09.299877+00
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."reports" ("id", "organization_id", "client_id", "created_by", "name", "export_file_url", "created_at", "updated_at", "deleted_at") FROM stdin;
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."templates" ("id", "organization_id", "created_by", "name", "description", "is_system", "document_type", "fields", "ai_instructions", "ai_model", "reference_file_url", "created_at", "updated_at", "deleted_at") FROM stdin;
5f485168-d7ec-42be-a9cd-6cabe7b3ad5b	\N	\N	Facturas Citrus	Esta plantilla de Citrus CRM es un documento de carga masiva diseñado para que las empresas de la República Dominicana registren y suban en lote sus transacciones de compras y costos. El archivo se estructura bajo la normativa fiscal de la DGII, permitiendo desglosar los montos entre servicios y bienes, e incluir datos críticos como el Número de Comprobante Fiscal (NCF), las retenciones de ITBIS e ISR, y la forma de pago utilizada. Su propósito principal es automatizar la contabilidad en la plataforma, evitando el registro manual uno a uno.\n\nPara facilitar el llenado correcto, el archivo incluye una hoja de trabajo principal y una pestaña de validación llamada "Nomencladores". Esta última contiene los códigos y clasificaciones oficiales listos para usar, tales como los tipos de gastos (personal, arrendamientos, activos fijos) y los porcentajes específicos de retención según la ley. Además, la plantilla advierte al usuario revisar las instrucciones ocultas en las cabeceras de cada columna antes de introducir la información para garantizar que el sistema Citrus CRM pueda procesar los datos sin errores.	f	invoice	[{"name": "Documento", "description": "Identificación del documento o factura del suplidor."}, {"name": "Tipo de Suplidor", "description": "Clasificación del suplidor según los nomencladores (ej. Gasto Formal, Gasto Informal)."}, {"name": "Tipo de Gasto", "description": "Categoría contable del gasto según el catálogo de la DGII (ej. 01-Gasto de personal)."}, {"name": "Decripcion", "description": "Detalle breve sobre el concepto de la compra o gasto."}, {"name": "Fecha", "description": "Fecha de emisión de la factura en formato DD/MM/AAAA."}, {"name": "Monto en Servicios", "description": "Valor monetario del gasto correspondiente a servicios."}, {"name": "Monto en Bienes", "description": "Valor monetario del gasto correspondiente a bienes adquiridos."}, {"name": "Impuesto 1 a Impuesto 5", "description": "Campos para desglosar impuestos adicionales aplicables a la transacción."}, {"name": "Moneda", "description": "Tipo de moneda en la que se realizó la transacción (ej. DOP, USD)."}, {"name": "Forma de Pago", "description": "Método utilizado para liquidar la factura (ej. EFECTIVO, CHEQUES/TRANSFERENCIAS)."}, {"name": "Concepto Id", "description": "Identificador numérico del concepto de gasto según la normativa."}, {"name": "Tipo de Pago Id", "description": "Código identificador del tipo de pago realizado."}, {"name": "NCF", "description": "Número de Comprobante Fiscal emitido por el suplidor."}, {"name": "NCF Afectado", "description": "NCF original en caso de notas de crédito o débito."}, {"name": "Retencion ITBIS", "description": "Porcentaje o monto de ITBIS retenido según la normativa vigente."}, {"name": "Retencion ISR", "description": "Porcentaje o monto de ISR retenido según el código de retención aplicable."}, {"name": "Llevar ITBIS al Costo", "description": "Indicador booleano (Si/No) para determinar si el ITBIS se suma al costo del bien o servicio."}, {"name": "Aplica Proporcionalidad del ITBIS", "description": "Indicador booleano (Si/No) para aplicar la proporcionalidad del ITBIS según la ley."}]	Antes de comenzar, revise los comentarios ocultos en cada encabezado de columna pasando el cursor sobre ellos para entender el formato requerido.\n\nUtilice exclusivamente los valores definidos en la hoja 'Nomencladores' para las columnas de Tipo de Suplidor, Tipo de Gasto, Forma de Pago y Retenciones.\n\nAsegúrese de que los montos en 'Servicios' y 'Bienes' estén correctamente desglosados para cumplir con los reportes de la DGII.\n\nValide que el NCF sea correcto y cumpla con la estructura fiscal dominicana antes de cargar el archivo.\n\nNo modifique la estructura de las columnas ni elimine las pestañas de referencia para evitar errores en la importación a Citrus CRM.\n\nSi la factura tiene RNC en cualquier en cualquier lugar, ese valor corresponde a la columna NCF\n\nTodo lo que tenga que ver con ITBIS(que es el impuesto del 18%) va en la columna Retencion ITBIS	\N	85dd847e-8f76-40b8-bc32-7b1a20bdbe79.xls	2026-05-31 19:05:32.721695+00	2026-05-31 19:05:32.721695+00	\N
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."documents" ("id", "organization_id", "client_id", "template_id", "report_id", "created_by", "source_file_url", "source_file_name", "source_file_type", "source_file_size", "data", "created_at", "updated_at", "deleted_at") FROM stdin;
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."user_profiles" ("id", "organization_id", "role", "created_at", "updated_at", "full_name", "avatar_url") FROM stdin;
d638efbe-7398-4544-83ec-74d74983d44c	74b5295a-3ec0-4e8c-b318-93980be8af05	admin	2026-07-13 20:40:53.70464+00	2026-07-13 20:40:53.70464+00	Demo Admin	\N
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") FROM stdin;
caobo-template-references	caobo-template-references	\N	2026-05-31 17:11:57.719931+00	2026-05-31 17:11:57.719931+00	f	f	10485760	\N	\N	STANDARD
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_analytics" ("name", "type", "format", "created_at", "updated_at", "id", "deleted_at") FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") FROM stdin;
87d586e9-244b-427a-8489-256a3d1fe4c9	caobo-template-references	e6aa3ca8-e4b3-4e91-87e7-11f9f1ade2a9.xls	\N	2026-05-31 18:02:32.050372+00	2026-05-31 18:02:32.050372+00	2026-05-31 18:02:32.050372+00	{"eTag": "\\"a144d4a7f80f76526b5dc3a2f426dad3\\"", "size": 48640, "mimetype": "application/vnd.ms-excel", "cacheControl": "max-age=3600", "lastModified": "2026-05-31T18:02:32.000Z", "contentLength": 48640, "httpStatusCode": 200}	41eb99a9-c1f1-40ce-a79e-c4e345df1f9c	\N	{}
d7c2d961-be38-4d7c-9e48-b20e3a8afb15	caobo-template-references	85dd847e-8f76-40b8-bc32-7b1a20bdbe79.xls	\N	2026-05-31 18:42:37.224781+00	2026-05-31 18:42:37.224781+00	2026-05-31 18:42:37.224781+00	{"eTag": "\\"a144d4a7f80f76526b5dc3a2f426dad3\\"", "size": 48640, "mimetype": "application/vnd.ms-excel", "cacheControl": "max-age=3600", "lastModified": "2026-05-31T18:42:38.000Z", "contentLength": 48640, "httpStatusCode": 200}	0177fe1e-6394-4f2c-8b5f-9c4179d8a49b	\N	{}
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads" ("id", "in_progress_size", "upload_signature", "bucket_id", "key", "version", "owner_id", "created_at", "user_metadata", "metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads_parts" ("id", "upload_id", "size", "part_number", "bucket_id", "key", "etag", "owner_id", "version", "created_at") FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 110, true);


--
-- Name: business_rule_attributes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."business_rule_attributes_id_seq"', 3, true);


--
-- Name: document_attributes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."document_attributes_id_seq"', 22, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict w6I733AWbDJhPKUYoyauhGcg7aS2MeePBMKln5iIKw0LYTuL8xBDgbbPSZhR3R5

RESET ALL;
