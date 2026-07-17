# Tool vs Manual Effectiveness Test

Plan to measure the effectiveness of Caobo Recibos (AI scan + edit + export) versus scanning and typing manually, over **2 weeks (10 business days)**, with a **team of 4**.

---

## Goals

- Quantify whether the tool is **faster**, **more accurate**, and/or **usable in real client work** compared to manual entry.
- Produce numbers a stakeholder can trust (throughput, error rate, correction load, adoption).
- Optionally feed findings into the [scan logging & analytics plan](./scan-logging-and-analytics-plan.md) (retries, field edits, determinism).

---

## 3 ideas (what to measure)

### Idea 1 — Time & throughput A/B (speed)

Same batch of receipts, two methods: **manual type-into-Excel/ERP** vs **tool (scan + edit + export)**.

| Primary metrics | Secondary |
|-----------------|-----------|
| Minutes per document | Error rate on a fixed checklist (NCF, RNC, totals, ITBIS) |
| Docs per hour | Retries (tool only) |

**Best if the pitch is:** “we finish the same work faster.”

### Idea 2 — Accuracy / correction load (quality)

Everyone focuses on the tool; measure **how much the AI got right before humans touch it** vs a **manual gold standard**.

| Primary metrics | Secondary |
|-----------------|-----------|
| % fields correct on first AI pass | Edits per doc by field (NCF, monto, concepto, …) |
| % of docs that needed edits | Time to correct vs time to type from scratch |

**Best if the pitch is:** “AI is reliable enough; humans only fix edge cases.”

### Idea 3 — Real workflow pilot (adoption + end-to-end value)

Split the week’s real client work: half with the tool, half manually (or alternate days).

| Primary metrics | Secondary |
|-----------------|-----------|
| Cycle time: receipt → export-ready | Rework / retries |
| Daily frustration / adoption score (1–5) | ERP reject rate after carga (optional) |

**Best if the pitch is:** “this works in real life with our clients, not just a lab test.”

---

## Team of 4 (shared conventions)

Use short labels in sheets and standups:

| Label | Typical duty |
|-------|----------------|
| **P1** | Test lead — corpus, protocol, daily standup, final readout |
| **P2** | Operator A (manual lane or gold-standard entry) |
| **P3** | Operator B (tool lane or gold-standard entry) |
| **P4** | QA / floating — blind scoring, or live support |

**Daily standup (10 min):** yesterday’s numbers, blockers (model/server/UI), pack assignment for today.

**Shared scorecard columns (minimum):**

| date | pack_id | method (`manual` \| `tool`) | operator | pages | start | end | minutes | docs_done | retries | critical_errors | notes |

---

## Plan A — Controlled A/B (Idea 1: speed)

**Goal:** Prove the tool is faster than typing, with comparable quality.

### Roles

| Person | Role |
|--------|------|
| P1 | Test lead — builds corpus, scoresheets, daily standup |
| P2 | Manual operator |
| P3 | Tool operator |
| P4 | Blind QA — grades outputs without knowing method |

### Corpus (Day 0 / Monday morning)

- ~**100–150 pages**, mixed difficulty: clear scans, blurry, multi-page PDF, odd NCFs.
- Split into **10 daily packs of ~10–15 docs**.
- Same pack content for both operators when possible (or mirrored packs matched by difficulty).

### Daily protocol (Days 1–8)

1. P2 and P3 each receive the day’s pack.
2. Timer starts at “first file open / first keystroke” and ends at “Excel ready for carga.”
3. Log: start/end, docs completed, retries (tool), interruptions.
4. P4 grades both outputs against the same field checklist.

### Days 9–10

- Aggregate: median min/doc, docs/hour, error rate by method.
- **Cross-over:** P2 uses the tool, P3 does manual (controls for individual typing/scan speed).
- Final readout deck / one-pager.

### Metrics

- Time per doc / docs per hour
- Field error rate (critical vs non-critical)
- Tool-only: retries per pack

### Success bar (example)

- Tool ≥ **40% faster**
- Error rate ≤ **manual + 2%**

---

## Plan B — AI-first accuracy study (Idea 2: quality)

**Goal:** Measure how useful/deterministic extraction is before export (pairs well with future `scan_attempts` logging).

### Roles

| Person | Role |
|--------|------|
| P1 | Lead + resolves gold-label disagreements |
| P2 + P3 | Independently create gold standard (double-entry) for ~80 docs |
| P4 | Runs tool only; does not see gold until scoring |

### Days 1–3 — Gold standard

- P2 and P3 manually extract the same set into a shared template.
- Disagreements resolved by P1 → that sheet is **truth**.

### Days 4–7 — Tool runs

- P4 processes the same set with the tool.
- Prefer: **save AI output before edits**, then edit to match gold.
- Record:
  - AI output before edits
  - Fields changed
  - Time to correct to gold
- Optional: re-run the same pack **2–3 times** (same files) to estimate variance (copy JSON / export each run even before DB logging exists).

### Days 8–9 — Analysis

- Per-field accuracy vs gold
- % docs needing ≥1 edit
- Time-to-correct vs time-to-type-from-scratch (use a small manual subsample from Day 3)

### Day 10 — Readout

- Top 5 failing fields
- Recommended prompt/catalog fixes
- “Safe for autopilot” vs “always review” field list

### Metrics

- Field-level precision vs gold
- % docs zero-edit
- Minutes to correct vs minutes to type full row

### Success bar (example)

- ≥ **70%** of docs need ≤ **2** field edits
- Critical fields (NCF, RNC, total) ≥ **90%** correct on first pass

---

## Plan C — Live split pilot (Idea 3: real work)

**Goal:** See if the tool holds up on real volume, messiness, and client variety.

### Roles

| Person | Role |
|--------|------|
| P1 | Ops lead — assigns work, protects the protocol |
| P2 | Tool lane (real client batches) |
| P3 | Manual lane (matched client/volume when possible) |
| P4 | Floating — helps whichever lane is blocked; afternoon QA sample |

### Structure

| Days | Focus |
|------|--------|
| **1–2** | Soft launch — small batches; fix process friction only |
| **3–8** | Full split — comparable daily assignments (client type / page count). If volume is uneven: alternate tool-heavy / manual-heavy days, keep daily logs |
| **9–10** | Catch-up + comparison workshop |

### Daily log (5 minutes, shared sheet)

- Client, method, pages, start/end
- Retries, blocked-by (`model` \| `server` \| `UI` \| `other`)
- QA sample errors
- 1–5 score: “Would I use this tomorrow?”

### Metrics

- Cycle time: receipt → export
- Throughput under real conditions
- Rework / ERP reject (if you load to ERP)
- Subjective adoption score

### Success bar (example)

- Tool lane completes **≥ same volume** as manual
- QA defects **≤ manual**
- Team score ≥ **4/5** by day 8

---

## How to choose (team of 4)

| If you need… | Choose |
|--------------|--------|
| A clean number for stakeholders (“X% faster”) | **Plan A** |
| Product/AI improvement roadmap | **Plan B** |
| Proof it survives real clients | **Plan C** |

### Practical combo for 10 days

- **Plan A (Days 1–5)** controlled packs + **Plan C (Days 6–10)** live work  
  **or**
- **Plan B alone** if accuracy is the open question before investing in scan logging.

---

## Field checklist (suggested for QA)

Mark each critical field correct / incorrect / N/A:

| Field | Critical? |
|-------|-----------|
| RNC / cédula suplidor | Yes |
| Nombre suplidor | Yes |
| NCF | Yes |
| Fecha | Yes |
| Monto total | Yes |
| ITBIS / impuestos | Yes |
| Concepto / tipo documento | Often |
| Tipo de pago | Often |
| Other mapped tax columns | Per client |

---

## Deliverables at end of Day 10

1. One-pager: method comparison (speed, accuracy, adoption).
2. Raw scorecard CSV/Sheet (all daily rows).
3. Top failure modes (fields, document types, clients).
4. Go / no-go recommendation for wider rollout.
5. (Optional) Backlog items for prompts, catalogs, and [scan logging](./scan-logging-and-analytics-plan.md).

---

## Non-goals

- Building full `scan_tasks` / `scan_attempts` instrumentation before the test (helpful later; not required to start).
- Changing ERP carga process mid-test (keep export format constant).
- Perfect statistical significance — with 4 people and 10 days, aim for **directional, defensible** evidence, not a published RCT.

---

*Related: [scan-logging-and-analytics-plan.md](./scan-logging-and-analytics-plan.md), `pages/index.vue`, `python_backend/server.py`.*
