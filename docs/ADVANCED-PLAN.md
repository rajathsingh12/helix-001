# HELIX 002 — Plan: from hand-rolled Canvas 2D to a Vite + shadcn + WebGL pipeline

This is the working plan for evolving HELIX 001 (what's in this repo today) into a
more advanced version: developed inside a Vite project, UI chrome from shadcn/ui,
shaders and 3D assets pulled from established online libraries instead of being
drawn by hand. It is written to be executed in phases — each phase leaves a
working, demoable site.

---

## 0. What we have today (and must not lose)

Before upgrading, note what is *already* better than most award-site entries.
These are invariants for HELIX 002:

| Property | Where it lives today | Why we keep it |
|---|---|---|
| One continuous scroll-driven animation, 5 named beats at deterministic positions | `main.js` `buildPhases()` — phase timing computed from real `offsetTop` | This is the core of the concept; nothing may "snap" between sections |
| Subject morph at the climax (REST → FAST body) | 22-point Catmull-Rom spline, `REST`/`DELTA`/`FAST` in `main.js` | The morph becomes morph-targets / a vertex-shader morph in 3D |
| Wind as two systems (surface-clamped streamlines + deflecting particles) | `main.js` wind + particle systems | Becomes a GPU curl-noise flow field + instanced lines |
| Smooth-scroll lerp as the master clock (0.085) | `main.js` `readScroll()`/`frame()` | Becomes Lenis (or keep the hand-rolled lerp — it's fine) |
| Contract: `window.__scene = {resize, render, bboxAt, speedAt}` + `?p=` / `?fast=` | `main.js`, `README.md` | Keeps the screenshot/verification loop possible |
| Verification loop: headless-Chrome frames + console-error capture + text-vs-subject bbox checks | described in `BUILD-PROMPT.md` (`tools/`) | Port to Playwright in Phase 1; never ship frames a critic hasn't seen |
| Design system: `#07080a` / `#f1efe9` / `#8b8f97` / accent `#ff4d17`, Inter Tight + Instrument Serif + mono | `styles.css` `:root` | Becomes Tailwind tokens (shadcn theme variables) |
| Honesty: "design fiction" stated on the page; audio OFF by default | `index.html` | Keep verbatim |
| `prefers-reduced-motion` + mobile composition | `styles.css`/`main.js` | Keep, and extend to 3D (fewer particles, no camera drift) |

Everything below is about raising the ceiling on **rendering quality**, **code
maintainability**, and **reuse of proven libraries** — not about changing the
concept.

---

## 1. Target stack (recommended)

**Track A — recommended: React + Vite + shadcn/ui + react-three-fiber.**
This is the track this plan details. It matches "development in shadcn or vite"
directly, gives us a real component system for the chrome (nav, rail, telemetry,
loader, debug panel), and lets the 3D scene live in the same app as the UI with
one shared scroll state.

| Concern | Tool | Why |
|---|---|---|
| Build / dev | **Vite 5+** (`npm create vite@latest -- --template react-ts`) | Instant HMR; static build to `dist/` so the page still deploys as static files |
| Language | **TypeScript** (strict) | The scene API (`__scene`) becomes a typed contract instead of a convention |
| Styling | **Tailwind CSS v4** + **shadcn/ui** | Copy of components in-repo (not a dependency) — matches the current hand-owned CSS ethos; tokens map 1:1 to `:root` variables |
| 3D / WebGL | **three** + **@react-three/fiber** + **@react-three/drei** | Industry standard; `ScrollControls`/custom scroll wiring, `Environment`, `useGLTF`, `MeshTransmissionMaterial` etc. |
| Post-processing | **@react-three/postprocessing** (pmndrs `postprocessing`) | Grain, vignette, bloom, chromatic aberration, depth-of-field — replaces the CSS `.grain`/`.vignette` layers with real shaders |
| Scroll | **Lenis** (studio-freight) or keep the hand-rolled lerp | Lenis is the de-facto standard on award sites; plugs into R3F's `useFrame` |
| Motion / UI reveals | **GSAP + ScrollTrigger** (or **framer-motion** for UI only) | Text reveals, word masks; scroll progress remains the master clock |
| Shaders | **GLSL via `glslify`/vite-plugin-glsl**, seeded from online sources (see §3) | Custom wind-tunnel shaders + vetted noise/utility snippets |
| Assets | glTF 2.0 models + HDRIs + PBR textures from CC0/CC-BY libraries (see §4) | Replaces the hand-drawn spline body with a real lit model |
| Verification | **Playwright** (replaces `tools/shoot.mjs` CDP scripts) | Same evidence contract: frames, console errors, bbox JSON, drive sweep |
| Audio | WebAudio, unchanged (it's already good) | Keep `SOUND OFF` default |

**Track B — lighter alternative** if React is not wanted: Vite + vanilla TS +
three.js directly + a small `Lit`/custom-element layer for the chrome. Roughly
60% of Track A's benefit at lower complexity, but no shadcn. Only choose this if
you explicitly want to stay framework-free.

Decision rule: choose Track A unless "no framework" is a hard requirement.
shadcn/ui is React-only (it's copy-paste components, not a package), so "shadcn"
effectively decides the framework.

---

## 2. Project layout (Track A)

```
helix-002/
├─ index.html
├─ vite.config.ts            # react + glsl plugins, base:'./' for static hosting
├─ tailwind.config.ts        # tokens from styles.css :root → CSS variables
├─ components.json           # shadcn config
├─ public/
│  ├─ models/                # car.glb (+ draco/meshopt compressed)
│  ├─ hdr/                   # studio_*.hdr (Poly Haven, CC0)
│  └─ attributions.json      # machine-readable credits (§5)
├─ src/
│  ├─ main.tsx
│  ├─ app.tsx                # sections, chrome, providers
│  ├─ contracts/
│  │  └─ scene-api.ts        # the typed window.__scene contract
│  ├─ core/
│  │  ├─ scroll-state.ts     # lerp/Lenis → single {p, speed} store (zustand or plain)
│  │  ├─ phases.ts           # port of buildPhases(): real offsetTop timing
│  │  └─ telemetry.ts        # port of speedAt() + Cd/downforce/ride curves
│  ├─ scene/
│  │  ├─ canvas.tsx          # <Canvas> + DPR cap + reduced-motion gate
│  │  ├─ car.tsx             # model + morph/morph-targets + paint material
│  │  ├─ wind-field.tsx      # GPU streamline/particle systems
│  │  ├─ tunnel.tsx          # floor, reflection, beams, dimension lines
│  │  └─ shaders/            # *.vert / *.frag (glsl imports)
│  ├─ ui/                    # shadcn components + site chrome
│  │  ├─ nav.tsx  rail.tsx  telemetry.tsx  loader.tsx  footer.tsx
│  │  └─ debug-panel.tsx     # replaces ?p= URL param with a slider (keeps param too)
│  └─ styles/globals.css
├─ tools/
│  ├─ shoot.ts               # Playwright: frames → evidence/frames/*.png
│  ├─ drive.ts               # real wheel events → evidence/drive.json
│  └─ stats.py               # unchanged
└─ evidence/                 # gitignored or committed as the critic's record
```

The module boundaries intentionally mirror the current `main.js` responsibilities
so each port has a clear 1:1 source (`REST/FAST` → `car.tsx`, wind →
`wind-field.tsx`, HUD → `ui/`, timing → `core/phases.ts`).

---

## 3. Shader strategy — what to take from where

Rule of thumb: **utility code (noise, easing, SDFs) is imported from vetted
public sources; look-defining shaders (paint, wind, light streaks) are written
here** using those utilities. Never paste a full Shadertoy effect blindly —
they rarely match a scroll-driven scene and often wreck the frame budget.

### 3.1 Building blocks to import (all well-known, permissive)

| What | Source | Used for |
|---|---|---|
| Simplex/gradient noise 3D | `ashima/webgl-noise` (MIT, `snoise3`) — via `glsl-noise` npm or vendored | Wind turbulence, paint flake, grain |
| Curl noise | iq / `pmndrs` recipes (public domain write-ups oniquilez.com) | Particle deflection around the car — this is exactly the 2D deflection in `main.js`, generalized |
| Rounded-box / segment SDFs | Inigo Quilez's articles (free to use with credit) | Dimension lines, floor decals, soft shadow blob |
| `easing.glsl` | `glsl-easings` (MIT) or transpiled `cubic-bezier(.16,1,.3,1)` | Matches the pinned UI easing inside shaders |
| Bloom/DOF/grain/vignette/CA | `pmndrs/postprocessing` effects (MIT) | Replaces `.grain` + `.vignette`, adds DoF + subtle CA at speed |
| Fresnel + clearcoat paint | three.js `MeshPhysicalMaterial` first; custom `onBeforeCompile` injection only if needed | Car body; env-map driven, no custom BRDF unless necessary |
| Flow-map / scroll-driven distortion | `gl-transitions` (MIT) set — the `glTransition` shader family | Section text wipes and hero mask reveals |
| Light streak / anamorphic beam | write our own from `snoise3` + a stretched SDF | PHASE 04 "beams" |

### 3.2 Site-defining shaders we write (HELIX 002's signature)

1. **Wind tunnel flow field** — a vertex shader over an `InstancedMesh` of
   line-segments / GPU points: each particle advances through a curl-noise
   velocity field, clamped to the car's analytic silhouette (reproject to the
   hull) — the direct descendant of today's streamlines. Uniforms: `uSpeed`,
   `uMorph`, `uTime` (time only for non-narrative drift; narrative state still
   comes from scroll progress `p`).
2. **Air-shader on the body** — fresnel rim + velocity-scaled "air streaks"
   crawling along the surface (triplanar noise in object space), intensity
   keyed to `speedAt(p)`.
3. **Floor** — real reflection via `drei`'s `MeshReflectorMaterial` (or a
   hand-rolled planar reflection pass), blurred, masked to a studio pool of
   light; replaces today's offscreen masked reflection.
4. **Post chain** — ordered: `DepthOfField` (subtle) → `Bloom` (threshold
   high, only the accent + speculars) → `ChromaticAberration` (0→max with
   speed) → `Noise` (grain 3.5%) → `Vignette` (corner-only). This one chain
   does more for "award-level" than any single model swap.

### 3.3 Shader workflow

- `vite-plugin-glsl` (or `?raw` imports) so `.vert`/`.frag` files stay editable
  in an editor with highlighting, plus `glslify` for `#pragma glslify: noise = ...`
- A `uDebug` uniform + the existing `?p=` param means any frame is reproducible
  in the screenshot harness — critical for the critic loop.
- Keep every narrative shader parameterized by `p` (scroll progress), never by
  wall-clock, per the determinism policy.

---

## 4. Asset strategy — where the models/HDRIs/textures come from

The current site's "no images" rule was a constraint of the original build
prompt, not the concept. HELIX 002 drops it — but keeps **clean provenance**.

| Asset | Library | License | Notes |
|---|---|---|---|
| **Car model** (hero subject) | **Sketchfab** CC-BY concept/hyper cars (filter "Downloadable" + CC-BY), or **Clara.io**, or Free3D | CC-BY (credit in `attributions.json` + footer "credits" dialog) | Target <150k tris after `gltf-transform` optimization; ask for a clean topology model since we morph it |
| Low-poly fallback car | **Kenney "Car Kit"** / **Quaternius Vehicles** | **CC0** | Great for mobile LOD or the pre-loader silhouette |
| **HDRIs** (env lighting) | **Poly Haven HDRIs** — dark studio / photo studio 01–05 | **CC0** | A dark studio HDRI gives the exact near-black look of the current palette |
| **PBR textures** (floor, carbon, paint flake) | **Poly Haven textures**, **ambientCG** | **CC0** | carbon_fiber, brushed_metal, rubber for the floor pool |
| Fonts | Google Fonts — Inter Tight, Instrument Serif (+ JetBrains Mono) | OFL | Same as today |
| Reference shader snippets | `ashima/webgl-noise`, `gl-transitions`, `pmndrs/postprocessing`, iq's articles | MIT / free-with-credit | Vendored with header comments naming source |
| Sound | Keep the synthesized WebAudio wind | self-authored | Optionally layer one CC0 wind loop from **Freesound** (CC0 filter) at very low gain |

**Provenance policy (hard rule):** every downloaded asset is recorded in
`public/attributions.json` (`name, source URL, license, author, sha256`) and
surfaced in a small "credits" dialog in the footer. No asset enters the repo
without a license line. This keeps the site shippable commercially and keeps
the design-fiction honesty clause intact.

**Pipeline for assets:**
1. `npx @gltf-transform/cli optimize car.glb car.optimized.glb --compress draco`
2. `npx @gltf-transform/cli inspect` → record tris/draw-calls into the perf budget
3. `useGLTF.preload()` + drei `useProgress` feeds the existing loader UI (the
   loader now shows *real* progress instead of a simulated tick).
4. Optional: `npx gltfjsx car.optimized.glb` → typed JSX component we can rig.

---

## 5. Migration map (current code → new home)

| Current (`main.js` / `styles.css`) | New | Notes |
|---|---|---|
| `REST`/`DELTA`/`FAST` spline + `project()` | `scene/car.tsx`: glTF body + **morph targets** (`REST`/`FAST` blend shapes baked with `gltf-transform` or Blender) or a vertex-shader lerp of two baked position buffers | The 22 control points become the source of the two baked shapes — the morph concept survives exactly |
| Wheel-arch punching + offscreen wheel layer | Real wheel meshes; arches are geometry | Removes the whole offscreen-canvas dance |
| Streamlines (`topY`/`botY` surface clamp) | `scene/wind-field.tsx` instanced lines with curl noise + hull clamp | Same look, 100× particle budget |
| Particles (90–260, 2D deflection) | GPU points, 5k–20k, deflection in the vertex shader | Count scales with viewport as today |
| Offscreen floor reflection | `MeshReflectorMaterial` / planar pass | Free blur + roughness |
| `.grain` + `.vignette` (CSS) | `Noise` + `Vignette` post effects | Real per-pixel, survives GPU scaling |
| `buildPhases()` from `offsetTop` | `core/phases.ts`, unchanged logic, now also drives R3F via the scroll store | Keep the runtime re-measure on resize + font load |
| `updateHUD()` DOM writes | shadcn `<Rail>`, `<Telemetry>` bound to the same store | Numbers keep counting with the smoothed `p` |
| Loader (`loadTick` simulation) | drei `useProgress` + the same visual style | Honest progress |
| `?p=` / `&fast=` | kept, plus a shadcn `<Slider>` debug panel behind `?debug=1` | Screenshot harness depends on `?p=` |
| `window.__scene` | `src/contracts/scene-api.ts`, still exposed on `window` | Playwright tools read `bboxAt(p)` exactly as before |
| WebAudio wind | `core/audio.ts`, unchanged | Keep OFF default |
| `prefers-reduced-motion` | `useReducedMotion()` gate: static frames per beat, no particles | Stricter than today |

---

## 6. Roadmap (each phase ends demoable + tested)

### Phase 0 — Scaffold (0.5–1 day)
- `npm create vite@latest` (react-ts), Tailwind v4, shadcn init; port the
  `:root` tokens into the Tailwind theme; get the current *static* page content
  rendering as React components with zero animation.
- Port `tools/` to Playwright; wire `npm run evidence` → `evidence/`.
- **Gate:** `npm run build` green, Playwright produces frames + empty
  `errors.json`, tokens visually identical to `styles.css`.

### Phase 1 — Scene skeleton + contract (1–2 days)
- `<Canvas>` with DPR cap 2, ACES tone mapping, the scroll store wired to Lenis
  (or the ported lerp), `core/phases.ts` ported 1:1 and proven against the same
  `?p=` anchors.
- Placeholder subject: a simple extrusion of the current 22-point spline (this
  is cheap to generate from the existing data and keeps beat framing identical).
- Implement `window.__scene` from the day the canvas exists.
- **Gate:** `?p=0.42` frame ≈ current site's frame at `?p=0.42`; drive sweep
  continuous.

### Phase 2 — Shaders: wind + floor + post (2–3 days)
- Curl-noise wind field, air-on-body shader, reflective floor, full post chain.
- Import noise/easing utilities per §3.1 with source headers.
- **Gate:** ≥55fps median at 1440×900 DPR 2 with 5k particles; reduced-motion
  path renders beats statically; frame budget recorded in `docs/STATUS.json`.

### Phase 3 — Assets: real car + HDRI + PBR (2–3 days)
- Source + optimize the car model (§4), bake REST/FAST morph targets, swap in
  the studio HDRI + floor texture; build the `attributions.json` + credits UI.
- **Gate:** `gltf-transform inspect` within budget (≤150k tris, ≤30 draw calls);
  every asset has a license line; hero readable at 390×844.

### Phase 4 — UI system + polish (1–2 days)
- shadcn-ify chrome: nav, CTA, rail, telemetry, loader, debug slider, credits
  dialog; word-mask reveals via GSAP/framer-motion; mobile composition pass.
- **Gate:** whole-page critic pass at 1440×900 / 768×1024 / 390×844; no
  text–subject collisions (`layout.json` empty); zero console errors.

### Phase 5 — The gauntlet (1–2 days)
- Port the BUILD-PROMPT verification loop faithfully: screenshot critic rounds,
  blind A/B vs the original HELIX 001 (which is now our `ref/helix/` baseline —
  conveniently bundled), loop until pass.
- **Gate:** A/B ≥2-of-3 wins for the new version, `drive.json` continuous,
  `errors.json` empty.

Total: ~2 weeks of focused work, or ~4–5 focused weekends.

---

## 7. Performance budget (non-negotiable)

- 60fps target, **≥55fps median** at 1440×900 DPR 2; DPR capped at 2 (1.5 on mobile).
- ≤150k tris, ≤30 draw calls after optimization; particles 5k desktop / ≤1.2k mobile.
- Post chain ≤ 2 fullscreen passes with meaningful cost (bloom + DoF can blow
  the budget on integrated GPUs — measure on one).
- WebGL context loss handler → graceful static fallback (a pre-rendered frame
  per beat), since the old site worked with no GPU at all.
- First meaningful paint < 1.6s on broadband: model + HDRI progressive
  (`draco` + `KTX2`/`meshopt`), loader skippable as today.
- Lighthouse ≥ 90 performance on the static build; fonts preloaded; `?fast=1`
  skips intro for the harness.

## 8. Risks and how to defuse them

| Risk | Defuse |
|---|---|
| React re-renders stutter the scroll | All scene state lives in `useFrame`/refs and a plain mutable store; React renders chrome only |
| Morph targets from a third-party model look broken | Choose a model with clean, even topology; fall back to the spline extrusion from Phase 1 (it already looks good) |
| Shader compilation jank on first scroll | Compile all materials at load (`gl.compile` warm-up pass behind the loader) |
| License mistake with downloaded assets | `attributions.json` is checked in review; nothing merges without a license field |
| Scope creep: "more advanced" ≠ "more stuff" | The concept stays one car, one morph, one wind tunnel. Advanced = rendering quality + code quality, not more sections |

## 9. Quick wins to do first (before the full migration)

If the full migration is a later project, these improve the current repo within
hours and carry over 1:1 into the new stack:

1. Extract `main.js`'s phases/telemetry constants into a documented
   `docs/ARCHITECTURE.md` (beat map table) — the source of truth for the port.
2. Add `tools/shoot.mjs` as described in `BUILD-PROMPT.md` so we have a
   before/after evidence baseline (this becomes our `ref/helix/`).
3. Record a 30-second scroll-through capture of the current site as the A/B
   reference.
4. Vendor `snoise3` + a `cubic-bezier(.16,1,.3,1)` GLSL easing now — they're
   plain text files and will be the first shaders used in Phase 2.

---

*Design fiction, stated on the page: the car does not exist. That does not
change with a bigger stack — the shader is still the car.*
