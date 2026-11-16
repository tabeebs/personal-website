// ASCII blue sky: a grid of tinted cells with drifting glyph clouds and a
// cursor "wind" trail drawn in slash characters.
(() => {
  const canvas = document.getElementById('sky');
  const content = document.getElementById('content');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ---- look -------------------------------------------------------------
  const CW = 8;            // cell width  (css px)
  const CH = 12;           // cell height (css px)
  const BG = [249, 249, 249];
  const SKY_PALE = [222, 238, 246];
  const SKY_MID = [178, 224, 242];
  const SKY_DEEP = [124, 202, 234];
  const CLOUD = [252, 252, 253];
  const DOT_LIGHT = 'rgba(120, 150, 172, 0.75)';
  const DOT_DEEP = 'rgba(62, 130, 172, 0.85)';
  const GLYPH = 'rgb(108, 118, 132)';
  const WIND = [44, 98, 178];
  const WIND_SPEED = 2.6;  // cells per second, clouds drift to the right
  const CARD_PAD_X = 64;   // how far the white panel extends past the text column
  const CARD_PAD_TOP = 56;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 3D simplex noise (Gustavson) -------------------------------------
  const grad3 = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
  const perm = new Uint8Array(512);
  {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = 1337;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  }
  const F3 = 1 / 3, G3 = 1 / 6;
  function noise3(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
      else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
      else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
      else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt, g;
    tt = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (tt > 0) { g = (perm[ii + perm[jj + perm[kk]]] % 12) * 3; tt *= tt; n += tt * tt * (grad3[g]*x0 + grad3[g+1]*y0 + grad3[g+2]*z0); }
    tt = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (tt > 0) { g = (perm[ii+i1 + perm[jj+j1 + perm[kk+k1]]] % 12) * 3; tt *= tt; n += tt * tt * (grad3[g]*x1 + grad3[g+1]*y1 + grad3[g+2]*z1); }
    tt = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (tt > 0) { g = (perm[ii+i2 + perm[jj+j2 + perm[kk+k2]]] % 12) * 3; tt *= tt; n += tt * tt * (grad3[g]*x2 + grad3[g+1]*y2 + grad3[g+2]*z2); }
    tt = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (tt > 0) { g = (perm[ii+1 + perm[jj+1 + perm[kk+1]]] % 12) * 3; tt *= tt; n += tt * tt * (grad3[g]*x3 + grad3[g+1]*y3 + grad3[g+2]*z3); }
    return 32 * n; // roughly -1..1
  }
  function fbm(x, y, z) {
    return noise3(x, y, z) * 0.6 + noise3(x * 2.03, y * 2.03, z * 1.7) * 0.28 + noise3(x * 4.1, y * 4.1, z * 2.3) * 0.12;
  }
  // clouds: smoother than the sky, with a little crisp detail on the edges
  function cloudNoise(x, y, z) {
    return noise3(x, y, z) * 0.72 + noise3(x * 2.1, y * 2.1, z * 1.6) * 0.22 + noise3(x * 5.3, y * 5.3, z * 2.2) * 0.06;
  }
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ---- glyph ramps for cloud edges (thin -> dense) ----------------------
  const RAMP = [
    [".", "'", "`", ",", "."],
    [":", ";", "~", "-", ":", "_"],
    ["(", ")", ";", ":", "o", "~"],
    ["o", "o", "8", ";", "o", "0"],
  ];
  const BASE = ["o", "8", "o", "0", "8", ")", "("]; // the heavier underside of a cloud

  // ---- sizing -----------------------------------------------------------
  let W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
  let cellCanvas, cellCtx, cellImg, gridPattern;
  let wind, windDir;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / CW) + 1;
    rows = Math.ceil(H / CH) + 1;

    cellCanvas = document.createElement('canvas');
    cellCanvas.width = cols;
    cellCanvas.height = rows;
    cellCtx = cellCanvas.getContext('2d');
    cellImg = cellCtx.createImageData(cols, rows);

    // 1px white seams between cells
    const tile = document.createElement('canvas');
    tile.width = Math.round(CW * dpr);
    tile.height = Math.round(CH * dpr);
    const tctx = tile.getContext('2d');
    tctx.fillStyle = 'rgba(255,255,255,0.9)';
    tctx.fillRect(tile.width - Math.max(1, Math.round(dpr)), 0, Math.max(1, Math.round(dpr)), tile.height);
    tctx.fillRect(0, tile.height - Math.max(1, Math.round(dpr)), tile.width, Math.max(1, Math.round(dpr)));
    gridPattern = ctx.createPattern(tile, 'repeat');

    wind = new Float32Array(cols * rows);
    windDir = new Uint8Array(cols * rows);
  }

  // ---- cursor wind trail --------------------------------------------------
  const WIND_GLYPHS = ['-', '\\', '|', '/'];
  let last = null;
  function stamp(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    // orientation of the motion as a screen glyph
    let a = Math.atan2(dy, dx);
    if (a < 0) a += Math.PI;                        // fold to 0..PI
    const dir = Math.round(a / (Math.PI / 4)) % 4;  // 0 '-', 1 '\', 2 '|', 3 '/'
    const r = 20;
    const strength = Math.min(1, 0.35 + len / 40);
    const steps = Math.ceil(len / 4);
    for (let s = 0; s <= steps; s++) {
      const px = x0 + (dx * s) / steps, py = y0 + (dy * s) / steps;
      const c0 = Math.max(0, Math.floor((px - r) / CW)), c1 = Math.min(cols - 1, Math.floor((px + r) / CW));
      const r0 = Math.max(0, Math.floor((py - r) / CH)), r1 = Math.min(rows - 1, Math.floor((py + r) / CH));
      for (let ry = r0; ry <= r1; ry++) {
        for (let cx = c0; cx <= c1; cx++) {
          const ex = cx * CW + CW / 2 - px, ey = ry * CH + CH / 2 - py;
          const d = Math.hypot(ex, ey);
          if (d > r) continue;
          const v = strength * (1 - (d / r) * 0.45);
          const idx = ry * cols + cx;
          if (v > wind[idx]) { wind[idx] = v; windDir[idx] = dir; }
        }
      }
    }
  }
  window.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (last && wind) stamp(last.x, last.y, x, y);
    last = { x, y };
  }, { passive: true });
  window.addEventListener('pointerleave', () => { last = null; });
  document.addEventListener('mouseleave', () => { last = null; });

  // ---- frame ------------------------------------------------------------
  const lightDots = [], deepDots = [];
  function frame(now) {
    const t = reduceMotion ? 0 : now / 1000;
    const data = cellImg.data;
    lightDots.length = 0; deepDots.length = 0;
    const glyphs = [];

    const drift = t * WIND_SPEED;
    for (let ry = 0; ry < rows; ry++) {
      const vy = ry / rows;                               // 0 top .. 1 bottom
      const skyBias = (1 - vy) * 0.3;                    // deeper blue toward the top
      const cloudBias = 0.02 - vy * 0.34;                 // more clouds up high
      for (let cx = 0; cx < cols; cx++) {
        // sky tint: big soft patches drifting slower than the clouds
        const sn = fbm((cx - drift * 0.45) / 30, ry / 14, t * 0.02 + 10);
        const s = Math.min(1, Math.max(0, sn * 0.8 + 0.22 + skyBias));
        // cloud density
        const nx = (cx - drift) / 38, ny = ry / 14;
        const cn = cloudNoise(nx, ny, t * 0.035) + cloudBias;
        const c = smooth(0.24, 0.56, cn);

        let r, g, b;
        if (s < 0.5) { const k = s / 0.5; r = SKY_PALE[0] + (SKY_MID[0] - SKY_PALE[0]) * k; g = SKY_PALE[1] + (SKY_MID[1] - SKY_PALE[1]) * k; b = SKY_PALE[2] + (SKY_MID[2] - SKY_PALE[2]) * k; }
        else { const k = (s - 0.5) / 0.5; r = SKY_MID[0] + (SKY_DEEP[0] - SKY_MID[0]) * k; g = SKY_MID[1] + (SKY_DEEP[1] - SKY_MID[1]) * k; b = SKY_MID[2] + (SKY_DEEP[2] - SKY_MID[2]) * k; }
        r += (CLOUD[0] - r) * c; g += (CLOUD[1] - g) * c; b += (CLOUD[2] - b) * c;

        const idx = ry * cols + cx;
        const w = wind[idx];
        if (w > 0.02) {
          r += (SKY_DEEP[0] - r) * w * 0.25; g += (SKY_DEEP[1] - g) * w * 0.25; b += (SKY_DEEP[2] - b) * w * 0.25;
          wind[idx] = w * (reduceMotion ? 0.8 : 0.935);
        } else if (w) wind[idx] = 0;

        const o = idx * 4;
        data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;

        const px = cx * CW, py = ry * CH;
        if (w > 0.08) {
          glyphs.push(px, py, -1 - windDir[idx], w);
        } else if (c < 0.06) {
          (s > 0.74 ? deepDots : lightDots).push(px, py);
        } else if (c < 0.93) {
          const h = hash(cx, ry);
          let band = c < 0.3 ? 0 : c < 0.55 ? 1 : c < 0.78 ? 2 : 3;
          let ch;
          if (band >= 2) {
            // underside of the cloud reads heavier, like it is shaded
            const below = cloudNoise(nx, (ry + 2) / 14, t * 0.035) + cloudBias;
            if (below < cn - 0.06) ch = BASE[(h * BASE.length) | 0];
            else if (band === 3 && h < 0.55) ch = null;
          }
          if (ch === undefined) { const set = RAMP[band]; ch = set[(h * set.length) | 0]; }
          if (ch) glyphs.push(px, py, ch, 1);
        } else if (hash(cx + 7, ry) < 0.04) {
          glyphs.push(px, py, '.', 1); // a few specks inside the cloud body
        }
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // 1. cell colours
    cellCtx.putImageData(cellImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cellCanvas, 0, 0, cols * CW, rows * CH);

    // 2. white seams
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = gridPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // 3. sky dots
    ctx.fillStyle = DOT_LIGHT;
    ctx.beginPath();
    for (let i = 0; i < lightDots.length; i += 2) ctx.rect(lightDots[i] + CW / 2 - 1, lightDots[i + 1] + CH / 2 - 0.5, 1.5, 1.5);
    ctx.fill();
    ctx.fillStyle = DOT_DEEP;
    ctx.beginPath();
    for (let i = 0; i < deepDots.length; i += 2) ctx.rect(deepDots[i] + CW / 2 - 1.5, deepDots[i + 1] + CH / 2 - 1, 2.5, 2.5);
    ctx.fill();

    // 4. cloud + wind glyphs
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = GLYPH;
    for (let i = 0; i < glyphs.length; i += 4) {
      const ch = glyphs[i + 2];
      if (typeof ch === 'string') ctx.fillText(ch, glyphs[i] + CW / 2, glyphs[i + 1] + CH / 2);
    }
    for (let i = 0; i < glyphs.length; i += 4) {
      const ch = glyphs[i + 2];
      if (typeof ch !== 'number') continue;
      const a = Math.min(1, glyphs[i + 3] * 1.15);
      ctx.fillStyle = `rgba(${WIND[0]},${WIND[1]},${WIND[2]},${a})`;
      ctx.fillText(WIND_GLYPHS[-1 - ch], glyphs[i] + CW / 2, glyphs[i + 1] + CH / 2);
    }

    // 5. sky melts into the page toward the bottom
    const fade = ctx.createLinearGradient(0, H * 0.48, 0, H * 0.88);
    fade.addColorStop(0, `rgba(${BG},0)`);
    fade.addColorStop(0.55, `rgba(${BG},0.7)`);
    fade.addColorStop(1, `rgba(${BG},1)`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, H * 0.48, W, H * 0.52 + 2);

    // 6. soft white panel behind the content with a fluffy, wavering top edge
    if (content) {
      const cr = content.getBoundingClientRect();
      const sr = canvas.getBoundingClientRect();
      const inner = content.firstElementChild ? content.firstElementChild.getBoundingClientRect() : cr;
      const left = inner.left - sr.left - CARD_PAD_X;
      const right = inner.right - sr.left + CARD_PAD_X;
      const top = inner.top - sr.top - CARD_PAD_TOP;
      if (top < H) {
        ctx.save();
        ctx.fillStyle = `rgb(${BG})`;
        ctx.shadowColor = `rgb(${BG})`;
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.moveTo(left, H + 40);
        ctx.lineTo(left, top + 14);
        for (let x = left; x <= right; x += 6) {
          const wob = fbm(x / 70 - t * 0.05, 3.3, t * 0.04) * 9 + noise3(x / 16, 8.1, t * 0.1) * 3;
          ctx.lineTo(x, top + wob);
        }
        ctx.lineTo(right, top + 14);
        ctx.lineTo(right, H + 40);
        ctx.closePath();
        ctx.fill();
        ctx.fill(); // second pass thickens the glow at the edges
        ctx.restore();
      }
    }

    if (!reduceMotion || hasWind()) requestAnimationFrame(frame);
    else running = false;
  }
  let running = true;
  function hasWind() { for (let i = 0; i < wind.length; i++) if (wind[i] > 0) return true; return false; }

  resize();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  });
  if (reduceMotion) {
    window.addEventListener('pointermove', () => {
      if (!running) { running = true; requestAnimationFrame(frame); }
    }, { passive: true });
  }
  requestAnimationFrame(frame);
})();
