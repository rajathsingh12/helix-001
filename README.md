# HELIX 001

A single-page, scroll-driven concept-car launch site. The page is a wind-tunnel
study: as you scroll, the car assembles itself, accelerates through five phases
and returns to stillness. Everything is drawn live — no images, no video, no
libraries.

- **PHASE 01 / STILL** — the car at rest, dimension lines, quiet air
- **PHASE 02 / AWAKE** — 120 km/h, the first streamlines appear
- **PHASE 03 / SHAPE** — 280 km/h, the body morphs: roof down, tail out, wing up
- **PHASE 04 / EDGE** — 400 km/h, the body at full deformation, beams and turbulence
- **PHASE 05 / RETURN** — back to zero, then the invitation

Design fiction, stated on the page: the car does not exist.

## Run

```bash
python3 -m http.server 4300
# → http://localhost:4300
```

Just opening `index.html` from disk also works (plain scripts, no fetch or
modules). The only network dependency is Google Fonts; offline it degrades to
the system font stack.

## Stack & mechanics

- `index.html` — semantic sections, HUD, rail, telemetry, footer
- `styles.css` — the design system (near-black studio, ignition orange, Inter
  Tight + Instrument Serif + system mono)
- `main.js` — everything behavioural, ~1,100 lines, zero dependencies:
  - The car is a closed Catmull-Rom spline through 22 control points, morphed
    between `REST` and `FAST` shapes by scroll; wheel arches are punched out of
    the body and wheels drawn back in on an offscreen layer, so the floor
    reflection (masked, offscreen) is free
  - Wind is two systems: deterministic streamlines that sample the body surface
    and clamp to it, plus 90–260 particles deflected around the silhouette
  - Phase timing is computed at runtime from real section offsets, so "edge"
    always lines up with the PHASE 04 section at any viewport size
  - WebAudio synthesized wind (noise → bandpass), off by default — the
    "SOUND" toggle in the nav
  - A user-space smooth-scroll lerp drives the whole scene; the HUD, numbers
    and morph all read the smoothed value, so nothing snaps

## Controls & details

- `SOUND OFF/ON` — synthesized wind that rises with speed
- Phase rail (left) and telemetry (right) — speed, Cd, downforce, ride height
- `?p=0.42` — debug param: jump to a scroll fraction; `&fast=1` skips the loader

Respects `prefers-reduced-motion`. Mobile composes with the car rising from the
lower edge and a larger edge numeral.

## Where this goes next

A full plan for evolving HELIX 001 into an advanced, shader- and asset-powered
version (Vite + TypeScript + shadcn/ui + react-three-fiber, GLSL from vetted
open-source libraries, CC0/CC-BY models & HDRIs) lives in
[`docs/ADVANCED-PLAN.md`](docs/ADVANCED-PLAN.md). It covers the target stack,
a migration map from every part of `main.js`, shader and asset sourcing with
licenses, a phased roadmap with acceptance gates, and the performance budget.