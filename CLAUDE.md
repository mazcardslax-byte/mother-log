## Project

React 18 + Vite + Tailwind PWA for tracking cannabis mother plants and harvests. Single user, mobile-first dark theme. Deployed on Vercel (push to `main` = auto-deploy). Backed by Supabase key-value store in `app_data` table.

## Code patterns

- `src/shared.jsx` — all shared constants, utilities, and UI primitives (Badge, Modal, StatBox, etc.). **Always import from here. Never redefine in component files.**
- Tab components (`ClonesTab.jsx`, `DryRoomTab.jsx`, etc.) are self-contained — each owns its own Supabase load/save/subscribe logic.
- `subscribeToKey()` returns `{ unsubscribe }` — cleanup must be `return () => unsub.unsubscribe()`, NOT `return unsub`.
- `saveToDB(key, value, updatedAt)` — always pass a timestamp as the 3rd arg for echo-filter dedup.
- Supabase save on mothers is debounced 600ms — rapid mutations collapse into one write.
- Tests use Vitest: `npm test`. Pure logic lives in `*-utils.js` files with matching `*.test.js` files.

## Data relationships

- `clone_trays_v1` — authoritative source for clone survival rates. Only `Done` trays with `count` + `survived` count in stats. Active/in-progress trays are excluded.
- `clone_plants_v1` — per-plant records with tray assignment.
- `mothers[].cloneLog` — old clone tracking. Stats no longer uses this for survival rates.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`mazcardslax-byte/mother-log`). See `docs/agents/issue-tracker.md`.

### Triage labels

Using default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
