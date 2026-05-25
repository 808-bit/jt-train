# JT.TRAIN

Personal AI workout coach — standalone HTML frontend backed by a Cloudflare Worker and Google Sheets.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Standalone HTML/CSS/JS — no build step, open directly in browser |
| Backend | Cloudflare Worker (`jt-workout-worke.james-thornton88.workers.dev`) |
| AI | Claude Haiku via Worker proxy |
| Data | Google Sheets (4 tabs) |

## Google Sheets Schema

| Tab | Key columns |
|-----|-------------|
| `JT_Sessions` | session_id, date, session_type, location, rpe_session, notes |
| `JT_Sets` | session_id, exercise_id, set_num, reps, weight_kg, rir, tempo, notes |
| `JT_Exercises` | exercise_id, display_name, category, equipment, session_type, home_available, shoulder_safe, notes |
| `JT_Injuries` | body_part, restrictions, active |

## Features

- Session type selector: Full Body A/B, Upper, Lower, Rings Only, KB Only
- Location-aware equipment filtering: Home / Travel / Gym
- Injury flag system — active injuries auto-filter exercise pool
- AI plan generation with history-aware loading/volume
- In-session chat coach — log sets, get cues, swap exercises
- Plan iteration before starting (adjust via natural language)
- Post-session debrief + RPE capture → saved to Sheets

## Usage

1. Open `jt_train.html` in any browser
2. Worker must be deployed and live
3. Google Sheets must be connected to Worker

## Phase

Lean Bulk Q2 2026 — hypertrophy focus. Right shoulder impingement active.
