/* ════════════════════════════════════════════════════════════
   HELIX 001
   A wind-tunnel study that assembles itself as you scroll.
   No libraries. Canvas 2D + CSS + a little maths.
   ════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const pad3 = n => String(Math.max(0, Math.round(n))).padStart(3, '0');

  function hex(h) {
    const n = parseInt(h.replace('#', ''), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
  }

  function sampleKey(keys, p) {
    if (p <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (p <= b[0]) return lerp(a[1], b[1], smooth( clamp((p - a[0]) / (b[0] - a[0] || 1)) ));
    }
    return keys[keys.length - 1][1];
  }

  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const debugP = params.has('p') ? clamp(parseFloat(params.get('p')) || 0) : null;
  const fastLoad = params.has('fast');

  /* ──────────────────────────────────────────────────────────
     GEOMETRY — the car, in a 1000 × 264 unit space, y up.
     ────────────────────────────────────────────────────────── */

  const REST = [
    [   0,  84], // 0  front splitter
    [  14, 128], // 1  front face
    [  58, 166], // 2  nose top
    [ 132, 186], // 3  hood front
    [ 258, 197], // 4  hood rear
    [ 322, 205], // 5  cowl
    [ 378, 244], // 6  windshield top
    [ 438, 260], // 7  roof front
    [ 528, 264], // 8  roof peak
    [ 612, 256], // 9  roof rear
    [ 692, 234], // 10 rear glass
    [ 788, 214], // 11 deck
    [ 878, 206], // 12 tail top
    [ 962, 195], // 13 tail tip
    [ 996, 167], // 14 rear face top
    [1000, 127], // 15 rear face bottom
    [ 958,  92], // 16 diffuser
    [ 872, 104], // 17 underbody rear
    [ 620, 110], // 18 rocker rear
    [ 372, 110], // 19 rocker mid
    [ 148, 104], // 20 underbody front
    [  56,  90], // 21 front lip
  ];

  // how the body deforms at terminal speed
  const DELTA = {
    0:  [-3,  -7], 1:  [ 2,  -4], 2:  [ 12, -12], 3:  [ 18,  -9],
    4:  [ 12,  -4], 5:  [ -4,  -1], 6:  [ 26,  -7], 7:  [ 16, -15],
    8:  [  6, -19], 9:  [  2, -17], 10: [ -6, -10], 11: [  2,  -3],
    12: [ 10,   7], 13: [ 26,   8], 14: [ 20,   2], 15: [ 20,   6],
    16: [ 12,   1], 17: [  6,  -7], 18: [  0,  -7], 19: [ -2,  -7],
    20: [ -4,  -5], 21: [ -6,  -5],
  };

  const FAST = REST.map((p, i) => {
    const d = DELTA[i] || [0, 0];
    return [p[0] + d[0], p[1] + d[1]];
  });

  const WHEELS = [
    { x: 212, y: 78, r: 78 },
    { x: 798, y: 78, r: 78 },
  ];
  const ARCH = 90;

  /* ──────────────────────────────────────────────────────────
     SCENE
     ────────────────────────────────────────────────────────── */

  class Scene {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.carCanvas = document.createElement('canvas');
      this.carCtx = this.carCanvas.getContext('2d');
      this.reflCanvas = document.createElement('canvas');
      this.reflCtx = this.reflCanvas.getContext('2d');

      this.w = 0; this.h = 0; this.dpr = 1;
      this.pts = REST.map(p => p.slice());
      this.wheelAngle = 0;
      this.parts = [];
      this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      this.resize();
    }

    resize() {
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      [this.canvas, this.carCanvas, this.reflCanvas].forEach(c => {
        c.width = Math.round(this.w * this.dpr);
        c.height = Math.round(this.h * this.dpr);
      });
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';

      const base = this.w < 620 ? Math.min(this.w * 1.62, 640) : Math.min(this.w * 0.94, 1380);
      this.baseScale = base / 1000;

      this.buildParticles();
    }

    buildParticles() {
      const n = Math.round(clamp(this.w / 5.6, 90, 260));
      this.parts = Array.from({ length: n }, () => ({
        x: lerp(-160, 1120, Math.random()),
        y: lerp(50, 430, Math.random()),
        sp: lerp(0.55, 1.5, Math.random()),
        a: lerp(0.03, 0.16, Math.random()),
        w: Math.random() < 0.14 ? 1.4 : 0.8,
        warm: Math.random() < 0.18,
        wob: Math.random() * TAU,
      }));
    }

    project(pts, scale, ox, groundY) {
      return pts.map(([x, y]) => [ox + x * scale, groundY - y * scale]);
    }

    /* ---------- path helpers ---------- */

    trace(g, P, closed = true) {
      const n = P.length;
      g.beginPath();
      if (closed) {
        g.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
        for (let i = 0; i < n; i++) {
          const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
          g.bezierCurveTo(
            p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
            p2[0], p2[1]
          );
        }
        g.closePath();
      } else {
        g.moveTo(P[0][0], P[0][1]);
        for (let i = 0; i < n - 1; i++) {
          const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
          g.bezierCurveTo(
            p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
            p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
            p2[0], p2[1]
          );
        }
      }
    }

    /* ---------- render ---------- */

    render(now, p, m) {
      const { w, h, dpr, ctx } = this;
      const t = now * 0.001;

      const cam = this.camAt(p);
      const scale = this.baseScale * cam.s;
      const ox = w / 2 - 500 * scale + this.pointer.x * 10;
      const groundY = h * cam.g + this.pointer.y * 6;

      // morph points
      const f = smooth(clamp(m * 0.94 + Math.sin(t * 1.4) * 0.006 * m));
      for (let i = 0; i < REST.length; i++) {
        this.pts[i][0] = lerp(REST[i][0], FAST[i][0], f);
        this.pts[i][1] = lerp(REST[i][1], FAST[i][1], f);
      }

      const pts = this.pts;
      const P = this.project(pts, scale, ox, groundY);

      const topW = pts.slice(0, 15);
      const botW = [pts[0], pts[21], pts[20], pts[19], pts[18], pts[17], pts[16], pts[15]];

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      this.paintBackground(ctx, m, groundY, t, ox, scale);
      this.paintFloor(ctx, m, groundY, ox, scale);
      this.paintStreamlines(ctx, topW, botW, m, t, ox, scale, groundY);

      // wheels rotate with speed
      this.wheelAngle += (0.02 + m * 0.55) * 0.9;

      this.paintShadow(ctx, m, ox, scale, groundY);
      this.paintReflection(ctx, m, groundY);
      this.paintCarLayer(P, m, t, scale, groundY);
      ctx.drawImage(this.carCanvas, 0, 0, w, h);
      this.paintParticles(ctx, m, t, ox, scale, groundY);
      this.paintAnnotations(ctx, m, P, scale, groundY, ox);

      if (m > 0.35) this.paintBeam(ctx, m, ox, scale, groundY, t);
    }

    camAt(p) {
      if (!phasePts.length) return { s: 0.94, g: 0.93 };
      const mobileG = this.w < 700 ? 0.885 : 0;
      for (let i = 0; i < phasePts.length - 1; i++) {
        const a = phasePts[i], b = phasePts[i + 1];
        if (p <= b.p) {
          const k = smoothstep(a.p, b.p, p);
          const ca = PHASE_CAM[a.id] || PHASE_CAM.hero;
          const cb = PHASE_CAM[b.id] || PHASE_CAM.hero;
          const gv = Math.min(lerp(ca[1], cb[1], k), mobileG || 1);
          return { s: lerp(ca[0], cb[0], k), g: gv };
        }
      }
      const last = PHASE_CAM[phasePts[phasePts.length - 1].id] || PHASE_CAM.foot;
      return { s: last[0], g: Math.min(last[1], mobileG || 1) };
    }

    paintBackground(g, m, groundY, t, ox, scale) {
      const { w, h } = this;
      const top = mix('#05060a', '#0c0406', m);
      const mid = mix('#08090d', '#180a06', m * 0.9);
      const bot = mix('#0a0b0f', '#070405', m);

      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, top);
      bg.addColorStop(0.55, mid);
      bg.addColorStop(1, bot);
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      // studio key light behind the car — a wide band, not a blob
      const cx = ox + 500 * scale;
      g.save();
      g.translate(cx, groundY - 235 * scale);
      g.scale(1, 250 / 760);
      const spot = g.createRadialGradient(0, 0, 0, 0, 0, 760 * scale);
      spot.addColorStop(0, `rgba(176,188,210,${0.17 + m * 0.05})`);
      spot.addColorStop(0.5, 'rgba(150,162,185,.07)');
      spot.addColorStop(1, 'rgba(120,132,155,0)');
      g.fillStyle = spot;
      const rr = 760 * scale;
      g.fillRect(-rr, -rr, rr * 2, rr * 2);
      g.restore();

      // warm bloom behind the car
      const glow = g.createRadialGradient(w * 0.5, groundY - h * 0.16, 0, w * 0.5, groundY - h * 0.12, w * 0.6);
      glow.addColorStop(0, `rgba(255,86,26,${0.02 + m * 0.20})`);
      glow.addColorStop(0.42, `rgba(255,70,20,${0.01 + m * 0.06})`);
      glow.addColorStop(1, 'rgba(255,60,10,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);

      // a cold rim of studio light from above
      const halo = g.createRadialGradient(w * 0.5, -h * 0.35, 0, w * 0.5, -h * 0.1, h);
      halo.addColorStop(0, 'rgba(150,170,210,.07)');
      halo.addColorStop(1, 'rgba(150,170,210,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, w, h);
    }

    paintFloor(g, m, groundY, ox, scale) {
      const { w, h } = this;
      const floor = g.createLinearGradient(0, groundY, 0, h);
      floor.addColorStop(0, 'rgba(255,255,255,.022)');
      floor.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = floor;
      g.fillRect(0, groundY, w, h - groundY);

      // horizon line
      const x0 = ox - 140 * scale, x1 = ox + 1140 * scale;
      const lg = g.createLinearGradient(x0, 0, x1, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.18, 'rgba(255,255,255,.10)');
      lg.addColorStop(0.82, 'rgba(255,255,255,.10)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = lg;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0, groundY + .5); g.lineTo(x1, groundY + .5); g.stroke();

      // measuring ticks on the floor
      g.save();
      g.strokeStyle = `rgba(255,255,255,${0.10 + m * 0.08})`;
      g.lineWidth = 1;
      for (let i = 0; i <= 20; i++) {
        const x = ox + (i * 50) * scale;
        if (x < ox - 20 || x > ox + 1020 * scale) continue;
        const len = i % 4 === 0 ? 7 : 3;
        g.globalAlpha = i % 4 === 0 ? 0.55 : 0.28;
        g.beginPath(); g.moveTo(x, groundY + 2); g.lineTo(x, groundY + 2 + len); g.stroke();
      }
      g.restore();
    }

    paintShadow(g, m, ox, scale, groundY) {
      const cx = ox + 500 * scale;
      g.save();
      g.translate(cx, groundY + 1);
      g.scale(1, 0.055);

      const rad = g.createRadialGradient(0, 0, 0, 0, 0, 500 * scale);
      rad.addColorStop(0, 'rgba(0,0,0,.85)');
      rad.addColorStop(0.55, 'rgba(0,0,0,.45)');
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rad;
      g.beginPath(); g.arc(0, 0, 500 * scale, 0, TAU); g.fill();

      const warm = g.createRadialGradient(0, 0, 0, 0, 0, 560 * scale);
      warm.addColorStop(0, `rgba(255,110,50,${0.10 * m})`);
      warm.addColorStop(0.6, `rgba(255,80,30,${0.03 * m})`);
      warm.addColorStop(1, 'rgba(255,60,20,0)');
      g.fillStyle = warm;
      g.beginPath(); g.arc(0, 0, 560 * scale, 0, TAU); g.fill();
      g.restore();
    }

    paintReflection(g, m, groundY) {
      const { w, h, dpr } = this;
      const r = this.reflCtx;
      r.setTransform(1, 0, 0, 1, 0, 0);
      r.clearRect(0, 0, this.reflCanvas.width, this.reflCanvas.height);

      r.save();
      r.translate(0, groundY * 2 * dpr);
      r.scale(1, -1);
      r.globalAlpha = 0.20 + m * 0.05;
      r.drawImage(this.carCanvas, 0, 0);
      r.restore();

      r.globalCompositeOperation = 'destination-in';
      const fade = r.createLinearGradient(0, groundY * dpr, 0, (groundY + h * 0.20) * dpr);
      fade.addColorStop(0, 'rgba(255,255,255,.55)');
      fade.addColorStop(0.35, 'rgba(255,255,255,.18)');
      fade.addColorStop(1, 'rgba(255,255,255,0)');
      r.fillStyle = fade;
      r.fillRect(0, 0, this.reflCanvas.width, this.reflCanvas.height);
      r.globalCompositeOperation = 'source-over';

      g.save();
      g.globalCompositeOperation = 'lighter';
      g.drawImage(this.reflCanvas, 0, 0, w, h);
      g.restore();
    }

    paintStreamlines(g, top, bot, m, t, ox, scale, groundY) {
      const x0 = -280, x1 = 1280, step = 8;
      const count = 7;

      g.save();
      g.lineCap = 'round';

      const grad = g.createLinearGradient(ox, 0, ox + 1000 * scale, 0);
      grad.addColorStop(0, 'rgba(255,255,255,.55)');
      grad.addColorStop(0.45, 'rgba(255,255,255,.95)');
      grad.addColorStop(0.86, 'rgba(255,190,150,.9)');
      grad.addColorStop(1, 'rgba(255,120,70,.5)');

      const drawLine = (offset, under) => {
        const raw = [];
        for (let x = x0; x <= x1; x += step) {
          const cx = clamp(x, 0, 1000);
          const base = under ? botY(bot, cx) - offset : topY(top, cx) + offset;
          raw.push(base);
        }
        // soften corners
        const sm = [];
        const r = 3;
        for (let i = 0; i < raw.length; i++) {
          let s = 0, n = 0;
          for (let k = -r; k <= r; k++) {
            const j = i + k;
            if (j >= 0 && j < raw.length) { s += raw[j]; n++; }
          }
          sm.push(s / n);
        }
        // never let a line enter the body
        for (let i = 0; i < sm.length; i++) {
          const x = x0 + i * step;
          const cx = clamp(x, 0, 1000);
          const surf = under ? botY(bot, cx) - offset : topY(top, cx) + offset;
          sm[i] = under ? Math.min(sm[i], surf) : Math.max(sm[i], surf);
        }
        // turbulence in the wake
        const pts = sm.map((y, i) => {
          const x = x0 + i * step;
          const wake = x > 1000 ? (x - 1000) / 280 : 0;
          const wob = Math.sin(x * 0.045 + t * 1.8 + offset * 0.2) * wake * (6 + m * 22);
          return [ox + x * scale, groundY - (y + wob) * scale];
        });
        return pts;
      };

      for (let i = 0; i < count; i++) {
        const off = 6 + i * 17 + i * i * 1.6;
        const pts = drawLine(off, false);
        g.globalAlpha = (0.14 - i * 0.012) * (0.30 + m * 0.85);
        g.strokeStyle = grad;
        g.lineWidth = i === 0 ? 1.15 : 0.8;
        g.beginPath();
        pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y));
        g.stroke();
      }

      for (let i = 0; i < 3; i++) {
        const off = 7 + i * 15;
        const pts = drawLine(off, true);
        g.globalAlpha = (0.09 - i * 0.02) * (0.3 + m * 0.8);
        g.strokeStyle = grad;
        g.lineWidth = 0.8;
        g.beginPath();
        pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y));
        g.stroke();
      }
      g.restore();
    }

    paintParticles(g, m, t, ox, scale, groundY) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';

      const speed = 1.1 + m * 26;
      for (const p of this.parts) {
        p.x += speed * p.sp * 0.42;
        if (p.x > 1140) { p.x = -170; p.y = lerp(40, 430, Math.random()); }

        let y = p.y + Math.sin(p.x * 0.02 + t * 1.2 + p.wob) * 2.5;
        const ty = this.topAt(p.x);
        const by = this.botAt(p.x);

        if (y > by && y < ty + 2) y = (y - by < ty - y) ? by - 3 : ty + 3;
        if (y > ty && y < ty + 55) y = lerp(y, ty + 5, 0.35 * (1 - (y - ty) / 55));

        const len = (6 + m * 90) * p.sp;
        const sy = groundY - y * scale;
        const sx = ox + p.x * scale;

        g.globalAlpha = p.a * (0.25 + m * 1.1);
        g.strokeStyle = p.warm ? `rgba(255,${140 - m * 40},90,1)` : 'rgba(255,255,255,1)';
        g.lineWidth = p.w;
        g.beginPath();
        g.moveTo(sx - len * scale, sy);
        g.lineTo(sx, sy);
        g.stroke();
      }
      g.restore();
    }

    topAt(x) {
      const cx = clamp(x, 0, 1000);
      const P = this.pts;
      for (let i = 0; i < 14; i++) {
        const a = P[i], b = P[i + 1];
        if (cx >= a[0] && cx <= b[0]) return lerp(a[1], b[1], (cx - a[0]) / (b[0] - a[0] || 1));
      }
      return P[14][1];
    }

    botAt(x) {
      const cx = clamp(x, 0, 1000);
      const order = [0, 21, 20, 19, 18, 17, 16, 15];
      for (let i = 0; i < order.length - 1; i++) {
        const a = this.pts[order[i]], b = this.pts[order[i + 1]];
        if (cx >= a[0] && cx <= b[0]) return lerp(a[1], b[1], (cx - a[0]) / (b[0] - a[0] || 1));
      }
      return this.pts[15][1];
    }

    /* ---------- the car ---------- */

    paintCarLayer(P, m, t, scale, groundY) {
      const g = this.carCtx;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, this.w, this.h);

      const topPx = P[8][1];
      const botPx = groundY;

      // ── main body ──────────────────────────────────────────
      this.trace(g, P, true);
      const bodyGrad = g.createLinearGradient(0, topPx, 0, botPx);
      bodyGrad.addColorStop(0, '#7d8592');
      bodyGrad.addColorStop(0.045, '#5a616d');
      bodyGrad.addColorStop(0.15, '#2e343d');
      bodyGrad.addColorStop(0.40, '#191c22');
      bodyGrad.addColorStop(0.74, '#0b0c10');
      bodyGrad.addColorStop(0.93, '#07080a');
      bodyGrad.addColorStop(1, '#14161a');
      g.fillStyle = bodyGrad;
      g.fill();

      g.save();
      this.trace(g, P, true);
      g.clip();

      // long specular sheen
      const sheen = g.createLinearGradient(P[0][0], topPx, P[14][0], botPx);
      sheen.addColorStop(0, 'rgba(255,255,255,.10)');
      sheen.addColorStop(0.28, 'rgba(255,255,255,.02)');
      sheen.addColorStop(0.62, 'rgba(255,255,255,.07)');
      sheen.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = sheen;
      g.fillRect(0, 0, this.w, this.h);

      // cool studio strip along the shoulder
      const strip = g.createLinearGradient(0, groundY - 215 * scale, 0, groundY - 120 * scale);
      strip.addColorStop(0, 'rgba(205,222,248,0)');
      strip.addColorStop(0.42, 'rgba(205,222,248,.15)');
      strip.addColorStop(0.72, 'rgba(205,222,248,.05)');
      strip.addColorStop(1, 'rgba(205,222,248,0)');
      g.fillStyle = strip;
      g.fillRect(0, 0, this.w, this.h);

      // warm bounce from the floor
      const bounce = g.createLinearGradient(0, groundY, 0, groundY - 90 * scale);
      bounce.addColorStop(0, `rgba(255,90,40,${0.10 + m * 0.16})`);
      bounce.addColorStop(1, 'rgba(255,90,40,0)');
      g.fillStyle = bounce;
      g.fillRect(P[0][0], groundY - 100 * scale, this.w, 100 * scale);

      // a slow studio light travelling along the flank
      const span = P[15][0] - P[0][0];
      const phase = (t * 0.055) % 1.7 - 0.35;
      const sx = P[0][0] + phase * span;
      const sweep = g.createLinearGradient(sx - 150 * scale, 0, sx + 150 * scale, 0);
      sweep.addColorStop(0, 'rgba(255,255,255,0)');
      sweep.addColorStop(0.46, 'rgba(255,255,255,.085)');
      sweep.addColorStop(0.54, 'rgba(255,255,255,.085)');
      sweep.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sweep;
      g.fillRect(P[0][0], 0, span, this.h);

      // greenhouse glass
      const win = [];
      for (const i of [6, 7, 8, 9, 10]) win.push([P[i][0] + 7 * scale, P[i][1] + 9 * scale]);
      win.push([P[10][0] - 20 * scale, groundY - 214 * scale]);
      win.push([P[9][0] - 70 * scale, groundY - 222 * scale]);
      win.push([P[8][0] - 20 * scale, groundY - 226 * scale]);
      win.push([P[7][0] - 60 * scale, groundY - 224 * scale]);
      win.push([P[6][0] + 4 * scale, groundY - 216 * scale]);
      this.trace(g, win, true);
      const glass = g.createLinearGradient(0, P[8][1], 0, groundY - 200 * scale);
      glass.addColorStop(0, 'rgba(20,28,38,.95)');
      glass.addColorStop(0.5, 'rgba(9,12,17,.98)');
      glass.addColorStop(1, 'rgba(16,20,26,.95)');
      g.fillStyle = glass;
      g.fill();
      g.strokeStyle = 'rgba(190,210,235,.16)';
      g.lineWidth = 1;
      g.stroke();

      // glass reflection
      g.save();
      this.trace(g, win, true);
      g.clip();
      const refl = g.createLinearGradient(P[6][0], P[6][1], P[8][0], groundY - 210 * scale);
      refl.addColorStop(0, 'rgba(170,200,240,.14)');
      refl.addColorStop(0.4, 'rgba(170,200,240,0)');
      g.fillStyle = refl;
      g.fillRect(P[6][0], P[6][1], 340 * scale, 120 * scale);
      g.restore();

      // shoulder line
      g.beginPath();
      g.moveTo(P[2][0], groundY - 150 * scale);
      g.bezierCurveTo(P[5][0], groundY - 158 * scale, P[9][0], groundY - 160 * scale, P[13][0], groundY - 148 * scale);
      g.strokeStyle = 'rgba(255,255,255,.10)';
      g.lineWidth = 1;
      g.stroke();

      // door cut
      g.beginPath();
      g.moveTo(P[6][0] - 6 * scale, groundY - 212 * scale);
      g.bezierCurveTo(P[7][0] + 30 * scale, groundY - 180 * scale, P[8][0] + 40 * scale, groundY - 140 * scale, P[9][0] + 22 * scale, groundY - 108 * scale);
      g.strokeStyle = 'rgba(255,255,255,.055)';
      g.lineWidth = 1;
      g.stroke();

      // rocker accent
      g.beginPath();
      g.moveTo(P[20][0], groundY - 104 * scale);
      g.lineTo(P[17][0], groundY - 104 * scale);
      g.strokeStyle = `rgba(255,120,70,${0.05 + m * 0.22})`;
      g.lineWidth = 1.4;
      g.stroke();

      g.restore(); // clip

      // ── wheel arches: punch through the body ───────────────
      g.globalCompositeOperation = 'destination-out';
      for (const wl of WHEELS) {
        const cx = P[0][0] + wl.x * scale;
        const cy = groundY - wl.y * scale;
        g.beginPath(); g.arc(cx, cy, ARCH * scale, 0, TAU); g.fill();
      }
      g.globalCompositeOperation = 'source-over';

      // ── wheels ─────────────────────────────────────────────
      for (const wl of WHEELS) {
        const cx = P[0][0] + wl.x * scale;
        const cy = groundY - wl.y * scale;
        this.paintWheel(g, cx, cy, wl.r * scale, m);
      }

      // ── active rear wing ───────────────────────────────────
      this.paintWing(g, P, m, scale, groundY, t);

      // ── lighting signature ─────────────────────────────────
      const noseX = P[1][0] + 1 * scale;
      const rearX = P[14][0] - 2 * scale;

      g.save();
      g.globalCompositeOperation = 'lighter';
      // front blade
      const fl = g.createLinearGradient(0, groundY - 168 * scale, 0, groundY - 118 * scale);
      fl.addColorStop(0, 'rgba(255,235,225,0)');
      fl.addColorStop(0.5, 'rgba(255,240,235,.9)');
      fl.addColorStop(1, 'rgba(255,235,225,0)');
      g.strokeStyle = fl;
      g.lineWidth = 2;
      g.shadowColor = 'rgba(255,240,235,.9)';
      g.shadowBlur = 14;
      g.beginPath();
      g.moveTo(noseX, groundY - 160 * scale);
      g.lineTo(noseX, groundY - 124 * scale);
      g.stroke();
      // rear blade
      const rl = g.createLinearGradient(0, groundY - 172 * scale, 0, groundY - 128 * scale);
      rl.addColorStop(0, 'rgba(255,80,30,0)');
      rl.addColorStop(0.5, 'rgba(255,88,36,1)');
      rl.addColorStop(1, 'rgba(255,80,30,0)');
      g.strokeStyle = rl;
      g.shadowColor = 'rgba(255,70,20,.95)';
      g.shadowBlur = 18;
      g.beginPath();
      g.moveTo(rearX, groundY - 172 * scale);
      g.lineTo(rearX, groundY - 130 * scale);
      g.stroke();
      g.restore();

      // ── rim light along the roofline ───────────────────────
      g.save();
      this.trace(g, P.slice(0, 15), false);
      const rim = g.createLinearGradient(P[0][0], 0, P[14][0], 0);
      rim.addColorStop(0, 'rgba(255,255,255,0)');
      rim.addColorStop(0.08, `rgba(255,255,255,${0.35 + m * 0.2})`);
      rim.addColorStop(0.55, `rgba(255,255,255,${0.55 + m * 0.15})`);
      rim.addColorStop(0.92, `rgba(255,${190 - m * 60},${150 - m * 60},.55)`);
      rim.addColorStop(1, 'rgba(255,120,70,0)');
      g.strokeStyle = 'rgba(4,5,7,.72)';
      g.lineWidth = 3;
      g.shadowBlur = 0;
      g.stroke();
      g.strokeStyle = rim;
      g.lineWidth = 2;
      g.shadowColor = `rgba(255,${210 - m * 80},${180 - m * 70},${0.5 + m * 0.25})`;
      g.shadowBlur = 16;
      g.stroke();
      g.restore();
    }

    paintWheel(g, cx, cy, r, m) {
      // tyre
      g.beginPath(); g.arc(cx, cy, r, 0, TAU);
      g.fillStyle = '#070809';
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(255,255,255,.14)';
      g.stroke();

      // sidewall highlight
      g.beginPath(); g.arc(cx, cy, r * 0.92, 0, TAU);
      g.strokeStyle = 'rgba(255,255,255,.045)';
      g.lineWidth = r * 0.05;
      g.stroke();

      // lit crown of the tyre
      g.beginPath(); g.arc(cx, cy, r * 0.965, Math.PI * 1.14, Math.PI * 1.86);
      g.strokeStyle = 'rgba(255,255,255,.26)';
      g.lineWidth = r * 0.05;
      g.stroke();

      // rim
      const rimR = r * 0.70;
      const rimGrad = g.createLinearGradient(cx - rimR, cy - rimR, cx + rimR, cy + rimR);
      rimGrad.addColorStop(0, '#3b4048');
      rimGrad.addColorStop(0.45, '#181b20');
      rimGrad.addColorStop(1, '#0d0f12');
      g.beginPath(); g.arc(cx, cy, rimR, 0, TAU);
      g.fillStyle = rimGrad;
      g.fill();

      // brake disc
      g.beginPath(); g.arc(cx, cy, rimR * 0.78, 0, TAU);
      g.fillStyle = '#101216';
      g.fill();

      // spokes
      g.save();
      g.translate(cx, cy);
      g.rotate(this.wheelAngle);
      const spokes = 5;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * TAU;
        g.save();
        g.rotate(a);
        g.beginPath();
        g.moveTo(-r * 0.055, -r * 0.18);
        g.lineTo(-r * 0.085, -rimR * 0.94);
        g.lineTo(r * 0.085, -rimR * 0.94);
        g.lineTo(r * 0.055, -r * 0.18);
        g.closePath();
        g.fillStyle = i % 2 ? '#22262c' : '#2a2f36';
        g.fill();
        g.restore();
      }
      g.beginPath(); g.arc(0, 0, r * 0.17, 0, TAU);
      g.fillStyle = '#30353c';
      g.fill();
      g.beginPath(); g.arc(0, 0, r * 0.08, 0, TAU);
      g.fillStyle = '#0a0b0d';
      g.fill();
      g.restore();

      // caliper
      g.beginPath();
      g.arc(cx, cy, rimR * 0.74, -0.55, 0.35);
      g.strokeStyle = `rgba(255,77,23,${0.55 + m * 0.35})`;
      g.lineWidth = Math.max(2, r * 0.075);
      g.lineCap = 'round';
      g.stroke();

      // rim lip
      g.beginPath(); g.arc(cx, cy, rimR, 0, TAU);
      g.strokeStyle = 'rgba(255,255,255,.16)';
      g.lineWidth = 1;
      g.stroke();
    }

    paintWing(g, P, m, scale, groundY, t) {
      const a = smoothstep(0.04, 0.45, m);
      if (a <= 0.01) return;
      const flutter = Math.sin(t * 9) * m * 0.8;

      const x0 = P[12][0] - 26 * scale;
      const x1 = P[14][0] + 4 * scale;
      const yBase = groundY - 214 * scale;
      const lift = (14 + 58 * m) * scale;
      const y0 = yBase - lift + flutter;

      g.save();
      g.globalAlpha = a;

      // struts
      g.strokeStyle = 'rgba(160,168,180,.35)';
      g.lineWidth = Math.max(1, 3 * scale);
      [0.3, 0.72].forEach(k => {
        const x = lerp(x0, x1, k);
        g.beginPath();
        g.moveTo(x, yBase);
        g.lineTo(x + 4 * scale, y0 + 3 * scale);
        g.stroke();
      });

      // blade
      const y1 = y0 - 7 * scale;
      g.beginPath();
      g.moveTo(x0, y1 + 2 * scale);
      g.quadraticCurveTo((x0 + x1) / 2, y1 - 6 * scale, x1, y1 + 2.5 * scale);
      g.lineTo(x1, y1 + 10 * scale);
      g.quadraticCurveTo((x0 + x1) / 2, y1 + 2 * scale, x0, y1 + 9 * scale);
      g.closePath();
      const wg = g.createLinearGradient(0, y1 - 6 * scale, 0, y1 + 10 * scale);
      wg.addColorStop(0, '#4a5058');
      wg.addColorStop(0.35, '#1b1f24');
      wg.addColorStop(1, '#0a0b0d');
      g.fillStyle = wg;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,.28)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, y1 + 2 * scale);
      g.quadraticCurveTo((x0 + x1) / 2, y1 - 6 * scale, x1, y1 + 2.5 * scale);
      g.stroke();

      g.restore();
    }

    paintAnnotations(g, m, P, scale, groundY, ox) {
      const a = clamp(1 - m * 4) * 0.55;
      if (a < 0.02) return;
      const x0 = P[0][0], x1 = P[15][0];
      const y = groundY + 34;

      g.save();
      g.globalAlpha = a;
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.fillStyle = 'rgba(255,255,255,.6)';
      g.lineWidth = 1;
      g.font = '9px ui-monospace, Menlo, monospace';

      // horizontal
      g.beginPath();
      g.moveTo(x0, y); g.lineTo(x1, y);
      g.moveTo(x0, y - 4); g.lineTo(x0, y + 4);
      g.moveTo(x1, y - 4); g.lineTo(x1, y + 4);
      g.stroke();
      g.textAlign = 'center';
      g.fillText('4 912 MM', (x0 + x1) / 2, y - 9);

      // vertical
      const vx = x0 - 26;
      const top = P[8][1];
      g.beginPath();
      g.moveTo(vx, groundY); g.lineTo(vx, top);
      g.moveTo(vx - 4, groundY); g.lineTo(vx + 4, groundY);
      g.moveTo(vx - 4, top); g.lineTo(vx + 4, top);
      g.stroke();
      g.save();
      g.translate(vx - 9, (groundY + top) / 2);
      g.rotate(-Math.PI / 2);
      g.textAlign = 'center';
      g.fillText('1 124 MM', 0, 0);
      g.restore();
      g.restore();
    }

    paintBeam(g, m, ox, scale, groundY, t) {
      // long horizontal speed smear behind the car at terminal velocity
      const y = groundY - 128 * scale;
      const x = ox + 500 * scale;
      const grad = g.createLinearGradient(x - 900 * scale, 0, x + 500 * scale, 0);
      grad.addColorStop(0, 'rgba(255,90,30,0)');
      grad.addColorStop(0.55, `rgba(255,110,50,${0.028 * m})`);
      grad.addColorStop(0.9, `rgba(255,170,120,${0.055 * m})`);
      grad.addColorStop(1, 'rgba(255,200,160,0)');
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = grad;
      g.fillRect(x - 900 * scale, y - 30 * scale, 1400 * scale, 60 * scale);
      g.restore();
    }
  }

  /* ──────────────────────────────────────────────────────────
     helpers over the projected car
     ────────────────────────────────────────────────────────── */

  function topY(list, x) {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (x >= a[0] && x <= b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1));
    }
    return list[list.length - 1][1];
  }
  function botY(list, x) {
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (x >= a[0] && x <= b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1));
    }
    return list[list.length - 1][1];
  }

  /* ──────────────────────────────────────────────────────────
     STATE + LOOP
     ────────────────────────────────────────────────────────── */

  const state = {
    target: 0,
    current: 0,
    progress: 0,
    speed: 0,
    ready: false,
  };

  const scene = new Scene($('#scene'));

  const PHASE_SPEED = { hero: 0, still: 0, awake: 0.26, shape: 0.62, edge: 1.00, return: 0.02, foot: 0 };
  const PHASE_CAM = {
    hero:   [0.94, 0.930],
    still:  [0.76, 0.990],
    awake:  [0.78, 0.990],
    shape:  [0.84, 0.990],
    edge:   [0.96, 0.930],
    return: [0.82, 0.962],
    foot:   [0.78, 1.020],
  };

  let phasePts = [];

  function buildPhases() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const els = $$('[data-phase]');
    phasePts = els.map(el => ({
      id: el.dataset.phase,
      p: clamp((el.offsetTop + window.innerHeight * 0.10) / max),
    }));
    if (phasePts.length) phasePts[0].p = 0;
    for (let i = 1; i < phasePts.length; i++) {
      phasePts[i].p = Math.max(phasePts[i].p, phasePts[i - 1].p + 0.002);
    }
  }

  function speedAt(p) {
    for (let i = 0; i < phasePts.length - 1; i++) {
      const a = phasePts[i], b = phasePts[i + 1];
      if (p <= b.p) {
        const t = smoothstep(a.p, b.p, p);
        return lerp(PHASE_SPEED[a.id] ?? 0, PHASE_SPEED[b.id] ?? 0, t);
      }
    }
    return PHASE_SPEED[phasePts[phasePts.length - 1]?.id] ?? 0;
  }

  function maxScroll() {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }
  function readScroll() {
    state.target = clamp(window.scrollY / maxScroll());
  }

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', () => {
    scene.resize();
    buildPhases();
    readScroll();
  });

  window.addEventListener('pointermove', e => {
    scene.pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    scene.pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(48, now - last);
    last = now;

    const k = prefersReduced ? 1 : 0.085;
    state.current += (state.target - state.current) * k;
    if (Math.abs(state.target - state.current) < 0.00002) state.current = state.target;
    state.progress = state.current;

    scene.pointer.x += (scene.pointer.tx - scene.pointer.x) * 0.05;
    scene.pointer.y += (scene.pointer.ty - scene.pointer.y) * 0.05;

    const m = speedAt(state.current);
    state.speed = m;

    scene.render(now, state.current, m);
    updateHUD(m, state.current);

    requestAnimationFrame(frame);
  }

  /* ──────────────────────────────────────────────────────────
     HUD
     ────────────────────────────────────────────────────────── */

  const telemetry = document.querySelector('.telemetry');
  const speedNum = $('#speedNum');
  const telCd = $('#telCd');
  const telDf = $('#telDf');
  const telRide = $('#telRide');
  const edgeNum = $('#edgeNum');
  const progressBar = $('#progressBar');
  const nav = $('#nav');

  let lastSpeedTxt = '';

  function updateHUD(m, p) {
    const v = Math.round(m * 400);
    const txt = pad3(v);
    if (txt !== lastSpeedTxt) {
      speedNum.textContent = txt;
      lastSpeedTxt = txt;
    }
    telCd.textContent = (0.21 - 0.10 * m).toFixed(3);
    telDf.innerHTML = `${Math.round(40 + 760 * m * m)}<em>KG</em>`;
    telRide.innerHTML = `${Math.round(118 - 38 * m)}<em>MM</em>`;
    edgeNum.textContent = pad3(v).replace(/^0/, '');

    progressBar.style.width = (p * 100).toFixed(2) + '%';

    // the footer legal line sits bottom-right: let the HUD step aside early
    const tp = clamp((0.92 - state.target) / 0.07);
    telemetry.style.opacity = tp;
    telemetry.style.visibility = tp < 0.02 ? 'hidden' : 'visible';

    if (window.scrollY > 24) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
  }

  /* ──────────────────────────────────────────────────────────
     TEXT REVEALS
     ────────────────────────────────────────────────────────── */

  $$('[data-split]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map((w, i) => `<span class="w"><i style="--wi:${(i * 0.05).toFixed(3)}s">${w}</i></span>`)
      .join(' ');
  });

  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      revealIO.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

  $$('[data-reveal]').forEach(el => {
    const siblings = Array.from(el.parentElement.children).filter(n => n.hasAttribute('data-reveal'));
    el.style.setProperty('--rd', (Math.max(0, siblings.indexOf(el)) * 0.09).toFixed(2) + 's');
    revealIO.observe(el);
  });

  // kinetic lines
  const kinetic = $('.kinetic__type');
  if (kinetic) {
    $$('.kl', kinetic).forEach((l, i) => l.style.setProperty('--kd', (i * 0.12).toFixed(2) + 's'));
    revealIO.observe(kinetic);
  }

  // hero letter index
  $$('.ch').forEach((ch, i) => ch.style.setProperty('--i', i));

  // rail sync
  const railLinks = $$('.rail a');
  const phaseSections = $$('[data-phase]');
  const railIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const key = e.target.getAttribute('data-phase');
      railLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('data-rail') === key));
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  phaseSections.forEach(s => railIO.observe(s));

  // magnetic button
  $$('[data-magnet]').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      btn.style.transform = `translate(${x * 7}px, ${y * 5}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });

  /* ──────────────────────────────────────────────────────────
     WIND AUDIO
     ────────────────────────────────────────────────────────── */

  const wind = {
    ctx: null, on: false, master: null, filter: null,
    init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const size = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastV = 0;
      for (let i = 0; i < size; i++) {
        const white = Math.random() * 2 - 1;
        lastV = (lastV + 0.02 * white) / 1.02;
        data[i] = lastV * 3.2;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'bandpass';
      this.filter.frequency.value = 380;
      this.filter.Q.value = 0.65;

      this.master = this.ctx.createGain();
      this.master.gain.value = 0;

      src.connect(this.filter).connect(this.master).connect(this.ctx.destination);
      src.start();
    },
    toggle() {
      if (!this.ctx) this.init();
      if (!this.ctx) return false;
      this.on = !this.on;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(this.on ? 0.12 : 0, t + 0.7);
      return this.on;
    },
    set(m) {
      if (!this.ctx || !this.on) return;
      const t = this.ctx.currentTime;
      this.filter.frequency.setTargetAtTime(320 + m * 2400, t, 0.1);
      this.master.gain.setTargetAtTime(0.03 + m * 0.09, t, 0.15);
    },
  };

  const soundBtn = $('#soundBtn');
  soundBtn.addEventListener('click', () => {
    const on = wind.toggle();
    soundBtn.classList.toggle('is-on', on);
    soundBtn.setAttribute('aria-pressed', String(on));
    $('.sound__label', soundBtn).textContent = on ? 'SOUND ON' : 'SOUND OFF';
  });

  setInterval(() => wind.set(state.speed), 90);

  /* ──────────────────────────────────────────────────────────
     LOADER
     ────────────────────────────────────────────────────────── */

  const loader = $('#loader');
  const loadPct = $('#loadPct');
  const loadBar = $('#loadBar');

  let loadStart = performance.now();
  let finished = false;

  function finishLoad() {
    if (finished) return;
    finished = true;
    loadPct.textContent = '100';
    loadBar.style.width = '100%';
    setTimeout(() => {
      loader.classList.add('is-done');
      document.body.classList.remove('is-locked');
      document.body.classList.add('is-ready');
      state.ready = true;

      buildPhases();
      if (debugP !== null) {
        window.scrollTo(0, debugP * maxScroll());
        state.target = debugP;
        state.current = debugP;
      }
    }, fastLoad ? 30 : 320);
  }

  function loadTick(now) {
    const dur = fastLoad ? 120 : 1250;
    const t = clamp((now - loadStart) / dur);
    const v = Math.round(easeOut(t) * 100);
    loadPct.textContent = String(v).padStart(2, '0');
    loadBar.style.width = v + '%';
    if (t < 1) requestAnimationFrame(loadTick);
    else finishLoad();
  }

  document.body.classList.add('is-locked');
  buildPhases();
  readScroll();
  requestAnimationFrame(loadTick);

  // start after fonts settle, but never wait forever
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(() => {
      loadStart = Math.min(loadStart, performance.now() - 300);
    });
  }

  requestAnimationFrame(frame);

  // pause the loop when the tab is hidden, resume cleanly
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now();
  });
})();
