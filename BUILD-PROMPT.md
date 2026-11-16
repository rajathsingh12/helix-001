# BUILD-PROMPT — One sentence in, a finished scroll-story site out

Generated per the `prompt-generator-by-raj` doctrine (contract-first, evidence loop
before product, orchestrator/worker fan-out, separate critic, anchored rubric,
blind final gate, loop-until-pass). Companion to `META-PROMPT.md` — same playbook,
machine-enforced. To use: paste the sentence you want built into the `IDEA:` slot
inside the code block, then hand the whole block to one build agent.

````markdown
IDEA: <paste exactly ONE sentence naming the topic; if this slot is left empty, use: "A landing page for a near-future car concept.">

# Goal
Build a finished, award-level single-page scroll-story landing page for the IDEA above, in plain static web (HTML5 + CSS3 + JavaScript ES2020 in one non-module `<script>` tag — it must load from file://), from this empty folder. Allowed rendering tech: Canvas 2D (or hand-rolled SVG+JS) only. Zero libraries, zero frameworks, zero downloaded images, zero video; at most 2 Google Fonts with system fallbacks; WebAudio-synthesized sound optional and OFF by default. The bar is Apple's AirPods Pro / Mac Pro product pages: (1) scrolling top-to-bottom plays ONE continuous animation through 4–7 named beats, each beat at a deterministic scroll position; (2) the subject reads unmistakably as the subject on 390×844 mobile; (3) ≥55fps median at 1440×900 DPR 2 with zero console errors; (4) the climax is a physical morph of the subject's geometry that lands exactly with its section at all three viewports; (5) every captured frame passes vision review with no accidental text–subject collision and no emptiness flag. Never "Template Scroll Site" — the AI-default failure mode: hero headline + three feature cards + fade-in sections, parallax blocks, placeholder copy, opacity-only reveals.

# How to work
1. Architecture first. From the IDEA, commit to ONE concept where the page itself is the metaphor (e.g. "a car that changes shape at speed" → the page is the wind tunnel). Write `docs/ARCHITECTURE.md` (the concept + beat map table: name, copy, 1–3 spec numbers, exact subject state per beat — the page's source of truth), `docs/CONTRACTS.md` (public scene API, beat timing rules, measurement params), and `docs/STATUS.json` (scores/open issues per module) before any feature code. These design constants are pinned — do not redesign them: palette `#07080a` bg / `#f1efe9` ink / `#8b8f97` muted / one accent `#ff4d17` used sparingly / hairlines `rgba(255,255,255,.09)`; grotesk display 400–500 weight, −0.04em tracking, hero wordmark 18–20vw; mono labels 9–10px uppercase +0.16em; ONE easing `cubic-bezier(.16,1,.3,1)` for 0.8–1.3s reveals; smooth-scroll lerp factor 0.085 on top of native scroll (never hijack); loader <1.6s and skippable; HUD chrome = phase rail (left) + live telemetry counting with scroll (right) + 1px progress bar + 3.5% film grain + corner-only vignette; fictional products must state "design fiction" on the page.
2. Build the verification loop before the product. `tools/shoot.mjs` (Node ≥18 + headless Chrome over CDP): loads `index.html?p=<fraction>&fast=1`, waits for the loader to finish, writes `evidence/frames/<beat>.png` for hero, every beat anchor, footer, and 390×844 mobile; captures console errors to `evidence/errors.json`; writes `evidence/layout.json` = DOM text rects tested against the live subject bbox at every anchor (must be empty). `tools/drive.mjs`: dispatches REAL `Input.dispatchMouseEvent` wheel events top→bottom, samples the HUD readout each step into `evidence/drive.json` (must show a continuous 000→peak→000 sweep, not two states). `tools/stats.py`: pixel-luminance stats per frame. The page MUST expose `window.__scene = {resize, render(now,p,m), bboxAt(p), speedAt(p)}` — this is a documented part of the contract (not a debug leftover); `?p=`/`?fast=` are documented in the README. Prohibition: no agent may claim anything it has not seen in real output — "done" means opened the PNGs and the JSONs and both are clean.
3. Fan out. Wave 1 — the integrator scaffolds `index.html`, `docs/`, `tools/`, and `src/core/main.js` (scroll state machine, rAF loop, lerp, beat timing computed from REAL `section.offsetTop / maxScroll`, re-computed on resize and after fonts load), and stubs the scene/UI APIs. Wave 2 — ONE builder owns `src/scene/` (subject geometry + physical morph between a REST and a FAST state, streamlines that sample and clamp to the body surface, ≤260 particles, lighting, offscreen reflection/arch compositing, ≤2 offscreen canvases, DPR cap 2, particle count scaled by viewport width). Wave 3 — ONE builder owns `src/ui/` (beat sections/copy from the beat map, nav, rail, telemetry, loader, `styles.css`, word-mask text reveals, reduced-motion behavior, ghost section numerals as outlined plates). Wave 4 — integrator seams, full verification, README. The integrator is the ONLY role allowed to touch `src/core`, `index.html`, `docs/`, or change the public API; builders never edit another module's folder.
4. Gauntlet every module. The critic is a brutal senior art director + senior engineer, strictly separate from the builders (no shared context, writes no code). It takes its own evidence: screenshots at every anchor + mobile + footer, console log, frame timings, layout.json. It checks contract conformance, zero errors, fps budget, text–subject intersections, subject readability, honesty clause, and one-continuous-animation feel. It scores 0–10 with named anchors: 10 = indistinguishable from the reference; 8.5 = reference-class with minor nits (PASS); 7 = good but flat; 5 = the named failure mode, Template Scroll Site. It returns a ranked issue list with file references to the owning builder. Bounded: 4 rounds per module.
5. Final gate. Whole-page critic at 1440×900, 768×1024, and 390×844. Then blind A/B judging: the finished site vs reference frames the agent assembles into `ref/` (hero + climax + mobile, captured from Apple's AirPods Pro page; plus the bundled HELIX 001 frames in `ref/helix/` — if the network is unavailable, state in STATUS.json that A/B used `ref/helix/` only). Labels hidden, order shuffled, and every verdict must name the winning frame and give one sentence of reason.
6. /loop until every critic passes. Persist scores and open issues to `docs/STATUS.json` after every round; each iteration resumes from the weakest module's ranked list — never from scratch. Termination = every module ≥8.5, A/B ≥ 2-of-3 wins, `errors.json` empty, `drive.json` shows a continuous sweep, `layout.json` empty at all anchors.

# Rules
- Never inflate scores. Report real numbers, failed rounds, and what is still missing.
- Never edit another module's folder; core/API changes go through the integrator.
- Keep `index.html` loadable over file:// and `tools/` runnable with only Node ≥18 + Chrome present at all times; other agents depend on this staying green.
- Do not ask me questions. Make routine decisions yourself, state assumptions in `docs/ASSUMPTIONS.md`, keep going.
- Never let section text intersect the subject at any beat anchor (camera moves first; copy is never shoved to "make it fit").
- Never present a fictional product as real; every invented claim is declared design fiction.
- Never add undocumented debug globals; the only global is the contractual `window.__scene`.
- Never animate anything narrative off wall-clock time alone — scroll progress is the master clock; idle micro-life (glints, grain) is the only exception and must be subtle.
- Never ship a frame the critic hasn't seen.

Start now.
````

## Assumptions and doctrine notes

- **Harness:** assumes the executing environment can fan out real worker agents
  (Claude Code / Codex-class CLI). If a harness has no sub-agents, run waves 1–4
  sequentially in one context and state that in `STATUS.json` — principle 5
  (true fan-out) is weakened, everything else holds.
- **Reference assembly:** the agent is expected to capture its own Apple
  reference frames. No network → fall back to the bundled `ref/helix/` benchmark
  and record the fallback. Blind A/B requires a comparing model; if none
  available, the critic downgrades to the numeric evidence and says so.
- **Design constants** are pinned from the HELIX build because they were
  empirically verified there; a different topic may re-argue the accent colour
  in `ARCHITECTURE.md` against the pinned tokens, never silently.
- **Determinism policy** (principle 1): the scene must be a pure function of
  (scroll progress, viewport, input) for anything narrative; time is allowed
  only for non-narrative idle effects and must not shift beat positions.
- **Asset/licensing policy:** procedural-only (no image downloads, no
  third-party assets except ≤2 fonts), which doubles as the licensing policy —
  everything in the folder is self-authored.
- **Input contract:** the sentence in the `IDEA:` slot is the only accepted
  input; an empty slot deliberately falls back to the near-future car example
  so the prompt stays a zero-question handoff.