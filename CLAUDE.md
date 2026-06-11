# JT.TRAIN — Claude Code Project Context

## Stack

| Layer | Detail |
|---|---|
| Frontend | `jt_train.html` — single-file shell + modular vanilla JS/CSS, dark theme |
| Hosting | GitHub Pages (`808-bit/jt-train`) |
| Backend | Cloudflare Worker (`jt-workout-worke.james-thornton88.workers.dev`) |
| Database | Cloudflare D1 (`jt-train-db`, ID `bc3254ce-c147-4bbd-a452-acecb770e9f0`) |
| AI | Claude Sonnet for all AI calls (plan gen, debrief, review, recommendation, mid-workout coach) |
| Local | `/Users/jamesthornton/Projects/jt-train/` |

## Deploy

**Frontend and worker deploy by different mechanisms — don't conflate them:**

| Change | How it goes live |
|---|---|
| Frontend (`jt_train.html`, `js/**`, `sw.js`, `manifest.json`) | **`git push`** → GitHub Pages auto-publishes. `wrangler deploy` does NOT touch the frontend. |
| Worker (`worker.js`, `wrangler.toml`) | **`wrangler deploy`**. A `git push` alone does NOT update the live API. |

```bash
# Frontend change → push only
cd ~/Projects/jt-train && git add . && git commit -m "msg" && git push

# Worker change → deploy (commit too, for history)
git add . && git commit -m "msg" && git push && wrangler deploy

# D1 migration
wrangler d1 execute jt-train-db --file=path/to/migration.sql --remote

# Tail worker logs
wrangler tail jt-workout-worke --format=pretty
```

**⚠ When you change any cached JS/HTML, bump the service-worker cache** (`sw.js`: `const CACHE = 'jt-train-vN'` → `vN+1`). The SW cache-firsts the `js/**` files listed in its `STATIC` array, so installed PWAs keep serving the OLD code after a push until the cache version changes. Forgetting this makes a correct push look like it "didn't work." `public/index.html` is a stale legacy bundle — not served; ignore it.

## File Structure

```
jt-train/
├── jt_train.html        # Frontend shell — HTML, CSS, <script src> tags only (~500 lines)
├── worker.js            # Cloudflare Worker (API proxy + D1 ops)
├── wrangler.toml        # Cloudflare config
├── manifest.json        # PWA manifest
├── sw.js                # Service worker (cache version: jt-train-v6)
├── icon-192.png         # PWA icon
├── icon-512.png         # PWA icon
├── migrations/          # SQL migration files
└── js/
    ├── api.js           # api(), apiPost(), claude() helpers
    ├── app.js           # Globals, goScreen(), selS(), selL(), init(), timers
    ├── equipment.js     # filterExercises(), filterByEquipmentOnly(), buildKitString(), equipment config UI
    ├── set_logger.js    # Set logging UI, endSession modal, discardAndDelete()
    └── screens/
        ├── coach.js     # Idle screen: autoRecommend(), generatePlan(), generateCoachesWorkout()
        ├── session.js   # Active session: startSession(), getCoachReply(), generateDebrief()
        ├── progress.js  # Progress tabs: loadExerciseProgress(), generateCoachReview()
        ├── history.js   # Session history screen
        └── injuries.js  # Injury management
```

**IMPORTANT:** JS files use plain `<script src="">` tags, NOT ES modules. All functions are global scope — required for `onclick` handlers in HTML strings.

## Worker Actions

### GET actions (query params)
- `getExercises` — all exercises
- `getMovementPatterns` — patterns + progressions
- `getProgressionTree` — progression rules (optional `?exercise_id=`)
- `getProgressionData` — set history for one exercise (`?exercise_id=&limit=`)
- `getAllProgressionData` — all sets (`?limit=`)
- `getSessionHistory` — sessions + sets (`?session_type=&limit=`) — omit session_type for cross-type
- `getSessions` — sessions only (`?limit=&offset=`) — excludes `-H` (CSV import) sessions
- `getRecentDebriefs` — debriefs (`?limit=&session_type=`)
- `getBenchmarks` — normative benchmarks (`?exercise_id=`)
- `getEquipmentConfig` — equipment config per location
- `getActiveInjuries` — active injuries

### POST actions (JSON body with `action` field)
- `appendSession` — create/update session (uses `ON CONFLICT(id) DO UPDATE SET rpe, notes`)
- `appendSet` — log a set
- `updateSet` — edit a set (`set_id, reps, weight_kg, rir, notes`)
- `deleteSet` — delete a set (`set_id`)
- `saveDebrief` — save post-session debrief
- `updateSession` — update session fields
- `deleteSession` — delete session + all sets + debriefs (cascade)
- `saveEquipmentConfig` — save equipment config
- `addInjury` / `updateInjury` — injury management
- `claude` — proxy to Anthropic API (`model, messages, system`)

## DB Schema (key tables)

```sql
sessions (id, phase_id, date, session_type, location, rpe, notes, ai_plan_used, pre_sleep, pre_energy, pre_soreness)
sets (id, session_id, exercise_id, set_num, reps, weight_kg, rir, tempo, notes, logged_at DEFAULT CURRENT_TIMESTAMP, tut_seconds, rest_seconds)
exercises (id, display_name, category, equipment, movement_pattern, bilateral, home_available, shoulder_safe, matrix_level, modality)
debriefs (session_id, date, session_type, total_volume_kg, total_sets, performance_signal, outcome, shoulder_flag, exercises_flagged, recommendation, raw_json)
benchmarks (exercise_id, level, metric_type, metric_value, reps, rir_target, notes, source)
progression_rules (exercise_id, rep_target, rir_target, sessions_to_confirm, intensity_levers, next_exercise_id, next_exercise_alt, next_requires, notes)
movement_patterns (id, name, description, focus, display_order)
pattern_progressions (pattern_id, level, exercise_id, exercise_name, type, duration_target, rep_target, rir_target, notes, equipment)
injuries (id, body_part, restrictions, active, date_start, date_end, notes)
location_config (location, config JSON)
```

## Key JS Globals (js/app.js)

```javascript
let sType = "Coach's Workout", loc = 'Home';  // Default session type
let preSleep = 3, preEnergy = 3, preSoreness = 3;
let pendingProgressions = [];  // localStorage persisted
let appliedProgressions = new Set();  // localStorage persisted
let plan = [];                 // current session plan
let loggedSets = [];           // sets logged in current session
let sessionId;                 // set by pickSessionId() — e.g. '2026-06-09-A'
let injuries = [], exercises = [], history = { sessions: [], sets: [] };
const SONNET = 'claude-sonnet-4-6';  // Used for ALL AI calls — Haiku no longer used anywhere
```

```javascript
// js/screens/coach.js module-level
let recommendedType = null;  // session type recommended by autoRecommend
let cachedDebriefs = null;   // populated by autoRecommend, reused by generatePlan (avoids double-fetch)
```

## Critical Patterns

### Session IDs
Always use `pickSessionId()` — never hardcode `-A`:
```javascript
// In session.js — picks next available letter for today (A, B, C...)
async function pickSessionId() {
  const date = new Date().toLocaleDateString('en-CA');
  const res = await api('getSessions', { limit: 10 });
  const todayIds = new Set((res.sessions || []).filter(s => s.date === date).map(s => s.id));
  for (const letter of 'ABCDEFGHIJ') {
    const candidate = date + '-' + letter;
    if (!todayIds.has(candidate)) return candidate;
  }
  return date + '-A';
}
```
Never use `toISOString()` — UTC date is wrong for AEST evenings. Always use `toLocaleDateString('en-CA')`.

### Shared debrief cache (coach.js)
`autoRecommend` fetches 20 debriefs and stores them in `cachedDebriefs`. When `generatePlan` runs:
```javascript
const ssoPromise = cachedDebriefs !== null
  ? Promise.resolve(formatSSOContext(cachedDebriefs, sType, 6))
  : fetchSSOContext(6, sType);
```
`formatSSOContext(debriefs, sTypeFilter, limit)` filters + formats client-side — no extra API call on the warm path.

### filterExercises vs filterByEquipmentOnly
Two distinct filters — use the right one:

- **`filterExercises(exList, loc, sType)`** — canonical session filter: equipment + active injuries (`shoulder_safe`) + session-type tag. Use for validating Claude's output (stripping exercise IDs not in the allowed set).
- **`filterByEquipmentOnly(exList, loc)`** — kit-only filter: no injury or session-type filtering. Use when building the exercise library handed to Claude for plan gen or substitutions — gives Claude the full equipment-matched menu and lets it select by movement pattern, level, and context.

`analyseExerciseTrends` swap candidates: always use `filterByEquipmentOnly` (field `e.session_types` does not exist).

### Debrief volume/sets are computed, not LLM-generated
In `generateDebrief` (session.js), `total_volume_kg` and `total_sets` are **overridden in code** from `loggedSets` (`sso.total_volume_kg = Math.round(totalVol)`) immediately after parsing the model's JSON. The LLM only produces the qualitative fields (`performance_signal`, `outcome`, `recommendation`, flags). Do NOT ask the model to emit the numeric totals — it previously echoed the prompt's placeholder (`320kg`), saving garbage volumes. Never trust an LLM for arithmetic; compute totals from the source data.

### buildSessionContext() — pre-computed progression signals
`session.js` helper. Called before every `getCoachReply` (mid-workout) and `generateDebrief` call. Maps each plan exercise to a readable line with prescribed vs actual and a signal:

```javascript
// → PROGRESS (beat target with margin)   when reps >= prescribed AND RIR >= 2
// → HOLD (met target, close to failure)  when reps >= prescribed AND RIR <= 1
// → REGRESS weight (missed reps)         when reps < prescribed AND RIR <= 1
// → SWAP EXERCISE (far below target)     when reps < 50% of prescribed
// → HOLD                                 otherwise
```

This replaces raw `JSON.stringify(loggedSets)` / `JSON.stringify(plannedVsActual)` blobs. Claude receives pre-evaluated signals and acts on them directly.

### Worker patching (macOS sed workaround)
Use Python for multiline replacements:
```bash
python3 << 'EOF'
with open('/Users/jamesthornton/Projects/jt-train/worker.js', 'r') as f:
    content = f.read()
content = content.replace('old string', 'new string')
with open('/Users/jamesthornton/Projects/jt-train/worker.js', 'w') as f:
    f.write(content)
EOF
```

### INSERT column counts
All three core INSERTs must have matching columns/values/placeholders:
- `sessions`: 11 columns (includes pre_sleep, pre_energy, pre_soreness)
- `sets`: 10 columns (includes tut_seconds, rest_seconds) — logged_at uses DEFAULT
- `debriefs`: 11 columns (includes outcome)

### Exercise IDs
Claude returns hyphenated IDs (`double-kb-deadlift`) — always normalise:
```javascript
const exId = (ex.exercise_id || ex.id || '').replace(/-/g, '_');
```

### Double KB exercises
Store total weight in `weight_kg`, individual bells in `notes` (e.g. `"20+32kg"`).
AI must only reference combos explicitly listed in `buildKitString(loc)` output — never invent a bell size.

### Inline HTML strings
Avoid for dynamic content with `onclick` handlers.
Always use DOM `createElement` to prevent quote-escaping JS syntax errors.

### Apostrophes in JS strings
`"Coach's Workout"` must use double quotes. In HTML `onclick` attributes: `&quot;Coach&#39;s Workout&quot;`.

### JS syntax check before deploy
```bash
python3 -c "
import re
content = open('jt_train.html').read()
scripts = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
open('/tmp/test.js', 'w').write('\n'.join(scripts))
" && node --check /tmp/test.js && node --check js/screens/coach.js && node --check js/screens/session.js
```

## AI Model Usage

| Use case | Model |
|---|---|
| Plan generation (all paths) | Sonnet |
| Session debrief | Sonnet |
| Coach review (6-week) | Sonnet |
| Session recommendation (autoRecommend) | Sonnet |
| Mid-workout coach | Sonnet |
| Exercise trend analysis | Sonnet |

**All Claude calls go through the Worker's `claude` action — never call Anthropic API directly from the frontend.**

## Equipment Config

```javascript
// Defaults (js/equipment.js)
Home:   { rings:true, pull_up_bar:true, parallettes_high:false, parallettes_low:false, bands:true, kb_weights:[16,20,24,32], kb_pairs:false }
Travel: { rings:false, pull_up_bar:false, parallettes_high:false, parallettes_low:false, bands:true, kb_weights:[] }
Gym:    { rings:false, pull_up_bar:true, parallettes_high:false, parallettes_low:false, bands:true, kb_weights:[8,12,16,20,24,28,32,36,40,44,48], kb_pairs:true, barbell:true }
```

## Progress Screen Tabs

1. **EXERCISE** — exercise picker (default: Has Data filter) → PB card, strength curve, tier card, benchmark bar, session history
2. **OVERVIEW** — this week, PBs this month, accomplished/this close/building tiers, weekly volume, movement balance, recent sessions, all-time bests
3. **TREE** — 8 movement patterns, activity heatmap per pattern, vertical progression chains
4. **REVIEW** — 6-week Coach Review (Sonnet, on-demand)

## Idle Screen Flow

1. **COACH card** auto-loads with Sonnet recommendation (`autoRecommend`) — re-triggers on location change or signal change (800ms debounce)
2. **Quick-action chips** under coach card: "Sounds good — let's go →" (green), "Push it harder", "Dial it back" — all call `generatePlan()`
3. **Override ↓** reveals override panel containing:
   - LOCATION pills
   - READINESS signals (Sleep/Energy/Soreness)
   - SESSION TYPE pills ("Coach's Workout" is default/selected)
   - Generate button (visible for named session types)
4. Tapping any chip or the Generate button calls `generatePlan()`

**No standalone Generate button on the main idle screen — chips are the primary CTA.**

## autoRecommend Data

- Fetches: `getSessions` (limit 10) + `getRecentDebriefs` (limit 20)
- Model: Sonnet
- Caches raw debriefs in `cachedDebriefs` for reuse by `generatePlan`
- Does NOT set `sType` — coach recommendation is advisory only
- Output: headline, brief, 3-4 cues (10-15 words each, must cite actual data), reason
- KB weights in cues must come exactly from `buildKitString(loc)` — no invented bell sizes

## Plan Gen Flow

### Coach's Workout path (`sType === "Coach's Workout"`)
`generateCoachesWorkout()` — fully autonomous, cross-type:
1. Parallel fetch: `getSessionHistory` (limit 20), `fetchSSOContext(10, null)`, `getProgressionTree`, `getMovementPatterns`
2. Formats pattern chains + 20-session cross-type history with session_type per set
3. Hypertrophy principles: 6-12 reps, RIR 0-2, 3-5 sets per pattern
4. Readiness gates exercise count: low=3-4, moderate=4-5, high=5-7
5. No `coachBrief` injection — plan has more context than the brief

### Named session type path
`generatePlan()` (non-Coach's Workout):
1. `ssoContext` — from `cachedDebriefs` if warm (client-side `formatSSOContext`), else `fetchSSOContext(6, sType)`
2. Parallel fetch: `getProgressionTree`, `getSessionHistory` (limit 15, cross-type), `getMovementPatterns`
3. Injects `coachBrief` from `autoRecommend` into system prompt
4. Exercise library for AI uses `filterByEquipmentOnly(exercises, loc)` — equipment-matched only, no session-type tag filtering; Claude selects by movement pattern balance and judgement
5. Rules line explicitly tells Claude: do not rigidly filter by session type tag, use full equipment-matched library

## End Session Modal (3 buttons)

- **"Finish & debrief →"** (green) — calls `closeEndModal(); quickMsg('done')` → triggers `generateDebrief()`
- **"Discard — delete all data"** — two-tap confirm: first tap dims button + changes label, second tap within 3s calls `deleteSession` (cascade deletes sets + debriefs), resets to idle
- **"Keep going"** — closes modal, resumes session

"Save partial session" was removed. Use "Finish & debrief" for partial sessions — debrief handles `outcome: 'incomplete'` automatically.

`discardAndDelete()` and `_resetDiscardBtn()` live in `js/set_logger.js`.

## Debrief JSON Schema

```json
{
  "total_volume_kg": 320,
  "total_sets": 12,
  "performance_signal": "stable",
  "outcome": "maintained",
  "shoulder_flag": false,
  "exercises_flagged": [],
  "headline": "One plain-English sentence.",
  "recommendation": "One plain-English sentence."
}
```

## Typography

- `var(--font-display)`: Bebas Neue — numbers, big stats
- `var(--font-ui)`: Syne — labels, buttons, UI
- `var(--font)`: DM Mono — body text, coach responses
- DM Mono reserved exclusively for data display and coach text

## Colour Tokens

```css
--bg: #0a0a0a      /* page background */
--bg2: #111        /* card background */
--bg3: #1a1a1a     /* inner card */
--text: #f5f0e8    /* primary text */
--text2: #b8b0a0   /* secondary text — use this, not text3, for readable content */
--text3: #666      /* decorative labels only (8-9px letter-spaced headers) */
--green: #22c55e
--amber: #f59e0b
--border: #222
--border2: #333
```

**Rule:** `text3` is for decorative labels only. All readable content (10px+) uses `text2` or `text`.

History screen uses aliased vars: `--s1=--bg2`, `--b1=--border`, `--b2=--border2`, `--t1=--text`, `--t2=--text2`, `--t3=--text3`, `--mono=--font`, `--warn=--amber`, `--danger=--red`, `--accent=--green`.

## Known Issues / Watch Points

- Service worker caches aggressively — hard refresh (Cmd+Shift+R) needed after deploys
- `toISOString()` gives UTC date — always use `toLocaleDateString('en-CA')` for AEST
- Same-day sessions: `appendSession` uses `ON CONFLICT(id) DO UPDATE` — always call `pickSessionId()` so a second session that day gets `-B` not `-A`
- `appendSet` and `appendSession` both show toast on network failure
- `pendingProgressions` + `appliedProgressions` persist to localStorage, cleared selectively after plan gen
- Historical sets imported Jan-May 2026 from CSV (session IDs end in `-H`) — excluded from history screen via `WHERE id NOT LIKE '%-H'`
- Worker: duplicate `getMovementPatterns` action was removed — don't re-add
- `filterExercises` vs `filterByEquipmentOnly` — see Critical Patterns above. Wrong choice causes either over-filtering (session-type tag blocks valid substitutions) or under-filtering (injury-unsafe exercises reach Claude)
- `analyseExerciseTrends` swap candidates: field `e.session_types` does not exist — use `filterByEquipmentOnly(exercises, loc)` to get candidates
- `buildSessionContext()` must be called fresh each time (reads current `plan` + `loggedSets`) — do not cache its output across messages
- `history` global (`{ sessions: [], sets: [] }`) is populated at init and available in `generateDebrief` — no extra fetch needed for historical comparison
- Session screen chat input ID is `#msg-input` (not `#chat-input`)

## User Context

James Thornton, Sydney AEST (UTC+11). Solo personal use app.
Equipment: Rings, KB (16/20/24/32kg singles), parallettes (high + low), pull-up bar, bands.
Training focus: Lean bulk / hypertrophy, calisthenics + KB. Right shoulder impingement history.
Goal: Build data moat for potential fine-tuning on calisthenics/KB domain.
