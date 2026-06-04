# Surface — Gender research app

*Screen UI · Decision inventory + spec hooks for implementation. No built UI yet (Part 2).*

**Locked from product owner (this session)**

| Decision | Choice |
|----------|--------|
| After **Save entry** | **Stay** on Entry workspace (Saved) |
| **Lexicon** | **Explicit Save** (not auto-save) |
| **Recompute entry** | **Visible button** on Saved workspace (always available; emphasized when stale) |
| **Corpus search** | **Yes** in v1 |
| **Captured date** | **Yes** — default today, editable |

---

## Frame

| | |
|--|--|
| **Medium** | Web app, single user, desktop-first; responsive single column on narrow viewports |
| **Emotional job** | Feel **capable and systematic** — serious personal research, not a toy or enterprise HR tool |
| **Social job** | Tool feels **personal and trustworthy** (her lab notebook, not “software”) |
| **Below layers** | [`conceptual-model.md`](conceptual-model.md) · [`interaction-flow.md`](interaction-flow.md) |

---

## Visual direction (style tile summary)

**Tone:** Calm editorial — warm paper background, crisp type, generous whitespace. “Beautiful and easy” = low chrome, one obvious primary action per zone.

| Token | Direction |
|-------|-----------|
| **Background** | Warm off-white (`#FAF8F5` range) |
| **Text** | Near-black body; muted secondary for metadata |
| **Primary action** | Deep ink / plum accent (not corporate blue) |
| **Masculine highlight** | Muted steel blue background + darker blue text (avoid “boys = blue” cartoon; keep scholarly) |
| **Feminine highlight** | Muted terracotta / rose background + readable contrast (avoid hot pink) |
| **Stale / warning** | Soft amber banner, not red alarm |
| **Destructive** | Red text button, confirm modal |
| **Type** | Serif for headings (character); sans for UI and JD body (readability at length) |
| **Radius** | Soft 8–12px cards; full-width paste area |

---

## Vocabulary on surface (must match model)

| UI label | Use | Avoid |
|----------|-----|-------|
| **Entries** | Corpus page title | Logs, Scans |
| **New entry** | Primary CTA | Add, Create |
| **Analyze** | Preview primary | Scan, Run |
| **Save entry** | Preview commit | Submit, Log |
| **Recompute entry** | Saved refresh | Refresh, Re-analyze |
| **Word list** | Nav to Lexicon | Lexicon (in nav only OK as subtitle) |
| **Masculine %** / **Feminine %** | Score strip | M/F, Male % |
| **Attach file** | PDF upload | Upload PDF only in helper |
| **Download attachment** | File row | Open |
| **Archive entry** / **Delete entry** | Destructive menu | Remove, Trash |
| **Discard** | Leave Preview | Cancel (ambiguous with undo) |

---

## Per-place hierarchy & layout

### Corpus

**Primary:** **New entry** (top-right or FAB on mobile)  
**Secondary:** Search field (v1), **Word list** nav  
**Tertiary:** Show archived toggle  

**Content**
- Search: filters list by title, company, notes, body snippet (client-side)
- Row: title (or truncated first line) · company · captured date · **Masculine %** · **Feminine %** in tabular nums
- Optional dot/badge if entry stale vs word list
- Sort: captured date descending (default)
- Empty: short line + **New entry**

### Entry workspace — Preview

**Primary:** **Analyze** (sticky footer or below paste on wide screens)  
**Secondary:** **Save entry** (enabled only after successful analyze)  
**Tertiary:** metadata fields, **Attach file**  
**Escape:** **Discard** / Back  

**Zones (top → bottom)**
1. Score strip (hidden until first analyze; then sticky subheader with % + counts + legend)
2. Paste area (large min-height)
3. Highlighted body (appears after analyze; scrollable)
4. Metadata card
5. Attachment card
6. Action bar: Analyze | Save entry

**Helper (paste area):**  
*“Paste the job description here. Analysis uses pasted text only. You can attach a PDF later as a saved copy of the page.”*

### Entry workspace — Saved

**Primary when stale:** **Recompute entry** (filled button in amber banner)  
**Primary when fresh:** highlighted body + scores (read mode)  
**Always visible:** **Recompute entry** in action bar (secondary outline when not stale; primary in banner when stale)  

**Secondary:** **Update metadata** (inline fields; auto-save on blur — see below)  
**Tertiary:** **Attach file**, **Download attachment**  
**Menu:** Archive entry, Delete entry  

**Post-save feedback:** Inline success *“Entry saved”* (2–3s) — user **stays** on this screen.

### Lexicon (Word list)

**Primary:** **Save word list** (explicit; disabled until dirty)  
**Secondary:** Add row per column, Back  
**Tertiary:** Reset lexicon (destructive, buried + confirm)  

**On leave with dirty:** *“Save changes to your word list?”* — Save / Discard changes / Stay  

**After Save:** Toast *“Word list saved. Recompute entries to update scores.”* (no auto bulk recompute in v1)

---

## Object representation (anti shapeshifter)

| Object | Consistent surface form |
|--------|-------------------------|
| **Entry** | Always a **card** in Corpus; always **workspace** layout when open (Preview badge vs Saved none) |
| **Scores** | Same **score strip** component Preview + Saved |
| **Highlights** | Same **highlighted body** component; legend always adjacent to strip |
| **Attachment** | **File row**: icon + name + date + Download + Remove |
| **Word list** | Two-column table, masculine left, feminine right |

---

## Feedback & errors (Phase 6)

| Action | In progress | Success | Failure |
|--------|-------------|---------|---------|
| **Analyze** | Button spinner “Analyzing…” | Scores + highlights animate in | *“Analysis failed. Check the text and try again.”* + **Analyze** |
| **Save entry** | “Saving…” | *“Entry saved”* · stay on Saved | *“Couldn’t save this entry. Try again.”* |
| **Recompute entry** | “Recomputing…” | Banner clears; scores update | *“Recompute failed. Try again.”* |
| **Attach file** | Progress bar on row | File row appears | *“Upload failed. Check the file and try again.”* |
| **Save word list** | Button spinner | Toast per above | *“Couldn’t save word list. Try again.”* |
| **Download attachment** | — | OS download | *“File missing. Upload the PDF again.”* |
| Empty paste + Analyze | — | — | Inline: *“Paste job description text first.”* |
| Save without analyze | — | — | Disabled **Save entry** + tooltip |

All failures: **diagnose + recover** (retry affordance named).

---

## Stale state (surface)

**Banner (Saved, stale):**  
*“Scores may be outdated.”* · **Recompute entry** (primary in banner)

**Triggers:** body edited since analyze; word list saved after entry’s `last_analyzed_at`

**Corpus row:** small amber dot + `aria-label` “Scores outdated” (optional but recommended)

---

## Accessibility (Phase 8)

| Area | Decision |
|------|----------|
| **Highlight colors** | Meet contrast for text on highlight bg; offer high-contrast mode later |
| **Legend** | Text labels “Masculine” / “Feminine”, not color alone |
| **Buttons** | Min 44px touch target on mobile |
| **Focus** | Trap in confirm modals; return focus on close |
| **Search** | `<label>` “Search entries”, `role="search"` |
| **Paste area** | `label` “Job description text” |
| **Score strip** | `aria-live="polite"` on analyze/recompute complete |
| **Table (Word list)** | Keyboard navigable rows; announce Save success |
| **PDF row** | `aria-label` includes file name |

---

## Consistency (Phase 9)

| Pattern | Rule |
|---------|------|
| Primary button | One per viewport zone (Analyze OR Save OR Recompute in banner) |
| Destructive | Text button or menu only + confirm modal |
| Loading | Replace button label, disable duplicate submit |
| Dates | Locale-aware display; date input for captured date |
| % display | One decimal place max; tabular figures |

---

## Completeness vs breadboard

| Breadboard affordance | Surface |
|----------------------|---------|
| Corpus search | ✅ Search field |
| Recompute entry | ✅ Always on Saved action bar + banner when stale |
| Stay after save | ✅ No redirect |
| Lexicon explicit save | ✅ **Save word list** |
| Recompute all | ❌ v1.1 (toast hints manual recompute) |
| Export / compare | ❌ Not v1 |

---

## Open surface decisions (remaining)

| # | Decision | Options |
|---|----------|---------|
| 1 | Metadata on Saved: auto-save on blur vs **Save metadata** button | Recommend **auto-save on blur** (only Lexicon needs explicit save) |
| 2 | Unsaved Preview → Word list | Confirm modal — recommend **yes** |
| 3 | Font families (exact) | Pick at implementation (e.g. Fraunces + Source Sans 3) |
| 4 | Dark mode | Defer v1 |
| 5 | Bulk **Recompute all entries** after word list save | v1.1 |

---

## Cross-layer issues

None blocking surface — model and flow aligned.

---

## What's already working (decisions to preserve)

- Single **Entry workspace** pattern (no shapeshifter screens)
- Paste vs PDF messaging separated in copy
- Masculine/feminine vocabulary consistent with research framing
- Stale → **Recompute entry** (not silent refresh)

---

## Implementation note

Prefer **building surface in code** (React + Tailwind or similar) over static mocks so highlight rendering and long JD scroll feel real early.
