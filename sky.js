// ASCII blue sky.
//
// Same approach as the Seed Data diorama: render a real, lit scene first, then
// turn it into ASCII in a second pass. Pass 1 draws a sky with volumetric-looking
// cumulus clouds (domain-warped fbm, light marched toward the sun, so tops are
// bright and undersides fall into blue-grey shadow). Pass 2 samples that image
// once per character cell, picks a glyph from the cell's brightness and edges,
// and inks it in a darker shade of the cell's own colour. A cursor "wind" trail
// is stamped on top as / - | \ characters.
(() => {
  const canvas = document.getElementById('sky');
  const content = document.getElementById('content');
  if (!canvas) return;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) { canvas.style.display = 'none'; return; }

  const CW = 8, CH = 12;          // character cell, css px
  const SCENE_SCALE = 2;          // scene texels per cell (each axis)
  const CARD_PAD_X = 64, CARD_PAD_TOP = 56;
  const DEBUG_SCENE = location.search.includes('scene');  // ?scene shows the lit sky before ASCII
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- glyph atlas ----------------------------------------------------------
  const GLYPHS = " .'`,:;-~=+*oO08@/\\|_—";
  const gi = (ch) => GLYPHS.indexOf(ch).toFixed(1);
  function makeAtlas() {
    const c = document.createElement('canvas');
    c.width = 64 * GLYPHS.length; c.height = 120;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '100px Menlo, Monaco, Consolas, "Cascadia Mono", "DejaVu Sans Mono", monospace';
    [...GLYPHS].forEach((ch, i) => {
      if (ch === '—') x.fillRect(i * 64, 120 * 0.45, 64, 120 * 0.1);
      else x.fillText(ch, (i + 0.5) * 64, 120 * 0.52);
    });
    return c;
  }

  // ---- shaders --------------------------------------------------------------
  const VERT = `#version 300 es
  in vec2 aPos; void main(){ gl_Position = vec4(aPos,0.,1.); }`;

  const NOISE = `
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  const mat2 ROT = mat2(1.6,1.2,-1.2,1.6);
  float fbm4(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p=ROT*p; a*=.5; } return s/.9375; }
  float fbm6(vec2 p){ float a=.5,s=0.; for(int i=0;i<6;i++){ s+=a*noise(p); p=ROT*p; a*=.5; } return s/.984; }`;

  // Pass 1: the actual sky, one texel = half a character cell.
  const SCENE = `#version 300 es
  precision highp float;
  uniform vec2 uRes;    // scene texture size
  uniform vec2 uView;   // css px
  uniform float uTime;
  out vec4 outColor;
  ${NOISE}
  const vec2 SUN = normalize(vec2(-.35,-1.));   // up and a little left (y points down)

  // One cumulus layer. Returns lit colour + coverage.
  vec4 layer(vec2 p, float scale, float speed, float cov, float seed, vec3 sky){
    vec2 q = p/scale; q.y *= 1.75; q.x -= uTime*speed; q += seed;
    vec2 w = vec2(fbm4(q*.45 + vec2(0., uTime*.012)), fbm4(q*.45 + vec2(5.2,1.3) - uTime*.01));
    q += (w-.5)*1.35;
    float thr = 1. - cov;
    float d = fbm6(q) - thr;
    if(d < -.03) return vec4(sky, 0.);
    float alpha = smoothstep(-.01, .05, d);
    // march toward the sun: the more cloud in the way, the darker this point
    float acc = 0.;
    for(int i=1;i<=5;i++){ acc += max(fbm4(q + SUN*float(i)*.075) - thr, 0.); }
    float T = exp(-acc*2.3);
    vec3 lit = vec3(1., .995, .985);
    vec3 shade = mix(vec3(.74,.79,.87), sky, .22);
    vec3 c = mix(shade, lit, T);
    c = mix(c, lit, (1.-smoothstep(0., .1, d))*.55*T);   // bright, thin rims
    c *= 1. - smoothstep(.15, .4, d)*.05;                  // dense cores a touch greyer
    return vec4(c, alpha);
  }

  void main(){
    vec2 p = gl_FragCoord.xy / uRes * uView;  // css px, y down (texel row 0 is the top of the page)
    float vy = p.y / uView.y;
    vec3 zen = vec3(.30,.62,.88), hor = vec3(.80,.91,.97);
    vec3 sky = mix(zen, hor, pow(clamp(vy*1.05,0.,1.), .85));
    sky *= 1. + (fbm4(p/420. + vec2(-uTime*.008, 0.)) - .5)*.10;

    float fewer = 1. - smoothstep(.1, .8, vy)*.55;   // clouds thin out toward the page
    vec4 far  = layer(p, 300., .045, .44*fewer, 17.3, sky);
    vec4 near = layer(p, 170., .12, .47*fewer, 3.1, sky);
    vec3 col = mix(sky, mix(far.rgb, vec3(1.), .35), far.a*.6);
    col = mix(col, near.rgb, near.a);
    float a = max(near.a, far.a*.6);
    outColor = vec4(col, a);
  }`;

  // Pass 2: ASCII.
  const ASCII = `#version 300 es
  precision highp float;
  uniform sampler2D uScene, uAtlas, uWind;
  uniform vec2 uRes, uView, uCell, uGrid;
  uniform float uDpr, uN, uTime, uDebug;
  uniform vec3 uCard;   // left, top, right in css px (top < 0 disables)
  out vec4 outColor;
  ${NOISE}
  float lum(vec3 c){ return dot(c, vec3(.25,.6,.15)); }
  const vec3 BG = vec3(249./255.);
  void main(){
    vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
    vec2 g = px / uCell, cell = floor(g), gv = g - cell;
    vec2 cuv = (cell + .5) / uGrid;
    vec4 sc = texture(uScene, cuv);
    vec3 col = sc.rgb; float a = sc.a, L = lum(col);
    vec2 e = 1. / uGrid;
    vec4 x0 = texture(uScene, cuv - vec2(e.x,0)), x1 = texture(uScene, cuv + vec2(e.x,0));
    vec4 y0 = texture(uScene, cuv - vec2(0,e.y)), y1 = texture(uScene, cuv + vec2(0,e.y));
    vec2 grad = vec2(lum(x1.rgb)-lum(x0.rgb), (lum(y1.rgb)-lum(y0.rgb))*.66);
    float mag = length(grad);
    float aMag = length(vec2(x1.a-x0.a, y1.a-y0.a));
    float a4 = mod(atan(grad.y, grad.x) + .3927, 3.14159) / .7854;
    float edgeG = a4<1. ? ${gi('|')} : a4<2. ? ${gi('\\')} : a4<3. ? ${gi('-')} : ${gi('/')};

    float glyph; float strength; vec3 ink;
    if(a < .06){                       // open sky
      float depth = 1. - L;
      glyph = depth < .44 ? ${gi('.')} : ${gi(':')};
      ink = col*.55; strength = .75;
    } else if(a < .45){                // wispy edges
      glyph = a < .2 ? ${gi('.')} : a < .32 ? ${gi("'")} : ${gi(':')};
      if(aMag > .55) glyph = edgeG;
      ink = col*.66; strength = .65;
    } else {                           // cloud body, glyph follows the shading
      float s = 1. - L;
      glyph = s < .06 ? ${gi(' ')} : s < .12 ? ${gi('.')} : s < .18 ? ${gi(':')} : s < .24 ? ${gi('~')}
            : s < .3 ? ${gi('o')} : ${gi('O')};
      if(mag > .16 && s > .1) glyph = edgeG;
      ink = col*.72; strength = .6;
    }

    // cursor wind
    vec2 wnd = texture(uWind, cuv).rg;
    if(wnd.r > .08){
      float d = floor(wnd.g*4. + .5);
      glyph = d < .5 ? ${gi('-')} : d < 1.5 ? ${gi('\\')} : d < 2.5 ? ${gi('|')} : ${gi('/')};
      ink = vec3(.17,.38,.70); strength = min(1., wnd.r*1.15);
      col = mix(col, col*.86, wnd.r*.5);
    }

    vec2 dx = dFdx(g), dy = dFdy(g);
    float m = smoothstep(.05, .95, textureGrad(uAtlas, vec2((glyph + gv.x)/uN, gv.y), dx/uN, dy/vec2(uN,1.)).r);
    vec3 bg = mix(col, vec3(1.), .1);
    vec3 c = mix(bg, ink, m*strength);

    // thin white seams between cells
    vec2 cp = gv * uCell;
    float seam = max(step(uCell.x - 1., cp.x), step(uCell.y - 1., cp.y));
    c = mix(c, vec3(1.), seam*.78);

    // melt into the page toward the bottom
    float vy = px.y / uView.y;
    c = mix(c, BG, smoothstep(.5, .9, vy));

    // soft panel behind the content, top edge wavering like a cloud bank
    if(uCard.y > -9000.){
      float wob = (fbm4(vec2(px.x/70. - uTime*.05, 3.3)) - .5)*18. + (noise(vec2(px.x/16. + uTime*.1, 8.1)) - .5)*6.;
      float dX = max(uCard.x - px.x, px.x - uCard.z);
      float dY = (uCard.y + wob) - px.y;
      float d = max(dX, dY);
      c = mix(c, BG, smoothstep(14., -12., d));
    }
    if(uDebug > .5) c = texture(uScene, px/uView).rgb;
    outColor = vec4(c, 1.);
  }`;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  let scene, ascii;
  try { scene = program(SCENE); ascii = program(ASCII); }
  catch (err) { console.error(err); canvas.style.display = 'none'; return; }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function texture(filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  const atlasTex = texture(gl.LINEAR_MIPMAP_LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeAtlas());
  gl.generateMipmap(gl.TEXTURE_2D);

  const sceneTex = texture(gl.LINEAR);
  const fbo = gl.createFramebuffer();
  const windTex = texture(gl.NEAREST);

  // ---- sizing -----------------------------------------------------------------
  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, sw = 0, sh = 0;
  let wind, windDir, windBytes;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
    sw = cols * SCENE_SCALE; sh = rows * SCENE_SCALE;
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    wind = new Float32Array(cols * rows);
    windDir = new Uint8Array(cols * rows);
    windBytes = new Uint8Array(cols * rows * 2);
  }

  // ---- cursor wind trail ------------------------------------------------------
  let last = null;
  function stamp(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 2) return;
    let ang = Math.atan2(dy, dx); if (ang < 0) ang += Math.PI;
    const dir = Math.round(ang / (Math.PI / 4)) % 4;     // 0 '-', 1 '\', 2 '|', 3 '/'
    const r = 20, strength = Math.min(1, 0.35 + len / 40), steps = Math.ceil(len / 4);
    for (let s = 0; s <= steps; s++) {
      const px = x0 + (dx * s) / steps, py = y0 + (dy * s) / steps;
      const c0 = Math.max(0, Math.floor((px - r) / CW)), c1 = Math.min(cols - 1, Math.floor((px + r) / CW));
      const r0 = Math.max(0, Math.floor((py - r) / CH)), r1 = Math.min(rows - 1, Math.floor((py + r) / CH));
      for (let ry = r0; ry <= r1; ry++) for (let cx = c0; cx <= c1; cx++) {
        const d = Math.hypot(cx * CW + CW / 2 - px, ry * CH + CH / 2 - py);
        if (d > r) continue;
        const v = strength * (1 - (d / r) * 0.45), i = ry * cols + cx;
        if (v > wind[i]) { wind[i] = v; windDir[i] = dir; }
      }
    }
    kick();
  }
  addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (last && wind) stamp(last.x, last.y, x, y);
    last = { x, y };
  }, { passive: true });
  document.addEventListener('mouseleave', () => { last = null; });

  // ---- frame ------------------------------------------------------------------
  let running = false, t0 = performance.now();
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function frame(now) {
    const t = reduceMotion ? 0 : (now - t0) / 1000;
    let active = false;
    for (let i = 0; i < wind.length; i++) {
      const w = wind[i];
      windBytes[i * 2] = Math.min(255, w * 255);
      windBytes[i * 2 + 1] = windDir[i] * 64;
      if (w > 0.01) { wind[i] = w * 0.935; active = true; } else wind[i] = 0;
    }

    // pass 1: scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(scene.p);
    gl.uniform2f(scene.u.uRes, sw, sh);
    gl.uniform2f(scene.u.uView, W, H);
    gl.uniform1f(scene.u.uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // pass 2: ascii
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(ascii.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, windTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, cols, rows, 0, gl.RG, gl.UNSIGNED_BYTE, windBytes);
    gl.uniform1i(ascii.u.uScene, 0); gl.uniform1i(ascii.u.uAtlas, 1); gl.uniform1i(ascii.u.uWind, 2);
    gl.uniform2f(ascii.u.uRes, canvas.width, canvas.height);
    gl.uniform2f(ascii.u.uView, W, H);
    gl.uniform2f(ascii.u.uCell, CW, CH);
    gl.uniform2f(ascii.u.uGrid, cols, rows);
    gl.uniform1f(ascii.u.uDpr, dpr);
    gl.uniform1f(ascii.u.uN, GLYPHS.length);
    gl.uniform1f(ascii.u.uTime, t);
    gl.uniform1f(ascii.u.uDebug, DEBUG_SCENE ? 1 : 0);
    let card = [0, -10000, 0];
    if (content) {
      const sr = canvas.getBoundingClientRect();
      const inner = (content.firstElementChild || content).getBoundingClientRect();
      card = [inner.left - sr.left - CARD_PAD_X, inner.top - sr.top - CARD_PAD_TOP, inner.right - sr.left + CARD_PAD_X];
    }
    gl.uniform3f(ascii.u.uCard, card[0], card[1], card[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!reduceMotion || active) requestAnimationFrame(frame);
    else running = false;
  }

  resize();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); kick(); }, 100); });
  kick();
})();
