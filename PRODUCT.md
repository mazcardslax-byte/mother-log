# Product

## Register

product

## Users

Small internal grow team (4–6 people) at Stacks Family Farms. Used in the grow room — hands dirty, phone in one hand, quick glances between tasks. Single-session, high-trust: no login friction, no onboarding, no hand-holding. Users know the operation; the app just needs to keep up.

## Product Purpose

Internal PWA for tracking the full cannabis cultivation cycle: mother plants (health, location, clone history), grow room layouts (beds, strains, pot types), dry room batches, and clone trays. Success looks like: any team member can log a watering, check a strain, or update a bed in under 10 seconds without squinting.

## Brand Personality

Precise · Professional · Clean. Operates like a well-maintained field instrument — no fuss, no ornamentation, trustworthy at a glance.

## Anti-references

- **Generic SaaS dashboards** (Notion, Linear, startup-blue-on-white): no sidebar nav, no card-grid scaffolding, no hero metrics.
- **Dispensary POS / retail apps**: not customer-facing; no product tiles, pricing UI, or inventory-storefront patterns.
- **Consumer wellness apps** (Headspace, calm-pastel aesthetic): no soft gradients, rounded blobs, or approachable warmth as a default register.

## Design Principles

1. **Precision over decoration** — every element communicates data or enables an action. If it doesn't do either, cut it.
2. **Thumbs first** — primary actions within single-thumb reach; all tap targets ≥ 44 px; bottom-sheet modals not top-of-screen dialogs.
3. **State is always visible** — health level, room location, strain, timing must be scannable without tapping. The grid IS the status board.
4. **Fast over clever** — no transitions that delay tasks; no animations that feel "app-like" at the cost of latency. Motion is feedback, not decoration.
5. **Dark-native, not dark-mode** — the color system is designed from black up (iOS dark idiom), not a light UI inverted. Surfaces are layered: #000 → #1c1c1e → #2c2c2e. Semantic color (green/yellow/red) carries health meaning system-wide.

## Accessibility & Inclusion

Internal tool with no formal WCAG requirement, but: ≥ 4.5:1 contrast on all body text, ≥ 3:1 on large/bold text, `prefers-reduced-motion` respected on any transitions. Color is never the only signal (health dots + background tint together, not color alone).
