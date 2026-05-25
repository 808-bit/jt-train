# JT.TRAIN — Google Sheets Schema

Spreadsheet ID stored as `SHEETS_ID` in Cloudflare Worker environment.

---

## JT_Sessions

One row per session (logged on start, updated with RPE/notes on finish).

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| `session_id` | string | `2026-05-25-A` | Date + suffix |
| `date` | date | `2026-05-25` | ISO format |
| `week_type` | string | `training` | training / deload / test |
| `phase` | string | `Lean Bulk Q2 2026` | Current training phase |
| `session_type` | string | `Full Body A` | Must match pill options in app |
| `location` | string | `Home` | Home / Travel / Gym |
| `rpe_session` | number | `8` | 1–10, captured post-session |
| `notes` | string | `Shoulder felt good` | Post-session notes |
| `ai_plan_used` | boolean | `TRUE` | Whether AI generated the plan |

---

## JT_Sets

One row per set logged during a session.

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| `session_id` | string | `2026-05-25-A` | FK → JT_Sessions |
| `exercise_id` | string | `kb-goblet-squat` | FK → JT_Exercises |
| `set_num` | number | `2` | Set number within exercise |
| `reps` | number | `10` | Reps completed |
| `weight_kg` | number | `32` | Load in kg (0 for bodyweight) |
| `rir` | number | `1` | Reps in reserve |
| `tempo` | string | `3-0-1-0` | Eccentric-pause-concentric-pause |
| `notes` | string | `Felt heavy` | Set-level notes |

---

## JT_Exercises

Exercise library. Filtered at plan generation time.

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| `exercise_id` | string | `kb-goblet-squat` | Unique slug, used as FK |
| `display_name` | string | `KB Goblet Squat` | Shown in UI and chat |
| `category` | string | `Lower` | Upper / Lower / Core / Full Body |
| `equipment` | string | `KB` | KB / Rings / BW / Parallettes / Bands |
| `session_type` | string | `Full Body A;Lower Body` | Semicolon-separated list |
| `home_available` | boolean | `TRUE` | Available in home gym |
| `shoulder_safe` | boolean | `TRUE` | Safe with right shoulder impingement |
| `notes` | string | `Keep chest up` | Coaching cues shown in plan |

---

## JT_Injuries

Active injury flags. Drives exercise filtering.

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| `body_part` | string | `Right shoulder` | Displayed in injury banner |
| `restrictions` | string | `No overhead pressing` | Passed to AI system prompt |
| `active` | boolean | `TRUE` | Only TRUE rows are loaded |
| `date_logged` | date | `2026-03-10` | When injury was flagged |
| `notes` | string | `Impingement, physio confirmed` | Background info |

---

## Notes

- All boolean columns use `TRUE` / `FALSE` (Google Sheets default)
- `session_type` in `JT_Exercises` is semicolon-delimited to support multiple session types per exercise
- Worker reads row 1 as headers — column order doesn't matter as long as headers match exactly
