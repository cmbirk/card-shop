---
name: verify-app
description: Visually verify a change to the GEM 3D card shop by driving it headlessly and screenshotting, then reading the images and console output. Use whenever confirming a scene/UI/interaction change actually works (not just that it compiles) — placement, materials, camera nav, pickup/flip/basket, characters, the sign-in/checkout overlays.
---

# Verifying the GEM shop visually

`tsc` and vitest don't catch what the shop *looks like* or whether an interaction works. This skill
drives the running app in headless Chromium, screenshots it, and captures console errors — the loop
used constantly during development.

## Steps

1. **Ensure the dev server is up** on port 5199:
   ```
   npm run dev   # run in background; it dev-mounts /api too
   ```
   (First time on a machine: `npx playwright install chromium`.)

2. **Drive + screenshot** with the committed helper. It takes a URL, an output PNG, and a
   semicolon-separated action script:
   ```
   node scripts/verify.mjs http://localhost:5199 out.png "goto,shelf-baseball;wait,600;shot,shelf.png"
   ```
   Actions: `goto,<station>` (nav via dev hook, polls for arrival), `wait,<ms>`, `click,<x>,<y>`,
   `dblclick`, `move`, `key,<Key>`, `clickText,<text>` (DOM overlay), `basket,<id>[,<id>]`,
   `pickup,<id>` (grab a card by id — avoids pixel-aiming), `ask,<id>` (pick up + Ask Chris), `tilt,<yaw>,<pitch>` (pose the held card), `riffle,<binId>,<n>` / `wheel,<dy>` (bin riffle), `admin` / `adminFlag` (fake admin; open panel /
   just set the flag), `state` (print nav/inspect/basket/adminOpen),
   `shot,<path>`. It always prints `CONSOLE ISSUES` or `NO CONSOLE ERRORS`.

3. **Read the screenshot(s)** with the Read tool and check the change looks right. Read the console
   output for errors/warnings.

## Notes that save time

- **Dev hooks (`window.__nav / __inspect / __basket / __ui / __auth / __inventory / __events`) exist only in `dev`.**
  `__inventory` is the live `inventoryById` map — `eval,[...window.__inventory.keys()][0]` finds a real card id (bundled ids may
  not exist in Supabase). `__events` is the list of analytics events fired so far (`src/systems/analytics.ts`) — dump it
  with `eval,JSON.stringify(window.__events)` to assert a flow was tracked. `eval` expressions can't contain `;` (the action separator). `admin` opens the
  back-office panel as a fake admin; `adminFlag` only sets `isAdmin` (e.g. to click the STAFF ONLY door). Prefer
  `goto,<station>` and `pickup,<id>` over pixel clicks — headless SwiftShader renders at ~5-10fps, so
  camera glides are slow (the script polls ~13s for arrival) and precise clicks during transit are
  ignored by design.
- **Stations** (from `shared/data/shopLayout.ts`): `outside`, `entry`, `center`, `counter`, `case`,
  `bins`, `shelf-baseball|basketball|football|hockey|tcg`.
- **The inspected card flies to the camera regardless of position** — you can `pickup,<id>` from any
  station to see a card up close.
- **Cropping/zoom:** `sips` on macOS crops with `-c HEIGHT WIDTH` order and offsets are finicky —
  prefer reading the full frame, or bump the viewport, over fighting crop coords.
- **`goto` may stall on a fresh load** (camera still settling); call `state` to confirm the station
  before asserting, and give generous `wait`s.

## What to actually check
Per the change: does the geometry/material look right, do clicks/hover land on the intended object
(remember transparent decor needs `raycast={()=>null}`), does the interaction complete (watch `state`
transitions), and are there zero console errors? For production checks (Vercel functions), curl the
domain instead — the dev mount masks serverless-only failures.
