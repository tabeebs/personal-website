// Sky header: a live Three.js sky with lit cumulus clouds, drawn as an ASCII tile grid.
// The rendering follows the Seed Data landing diorama (SeedData/app/landing/main.js): a real lit scene renders
// at a few pixels per glyph cell into a half-float target with each pixel's material class in alpha, and a glyph
// pass reads it one cell at a time. The look is the original light sky: pale blue tiles with white seams, small
// dots in open sky, grey glyphs on white cloud, a soft panel behind the content and a fade into the page.
// Source for build/sky.js: rebuild with `npm run build` after editing.
import * as THREE from 'three';
import { GLYPHS, PAL } from './crayon.js';
import { buildAtlas, gg } from './atlas.js';
import { createRain } from './meadow.js';
import { createGround } from './ground.js';

const ROW_PX = 9;                          // one glyph row is about 9 css px, as on the diorama
const COARSE = matchMedia('(pointer: coarse)').matches;
const time = { value: 0 };
const CLS = { sky: 1, cloud: 15 };         // 15 is the diorama's smoke/dust class
function tag(mat, cls) {
  mat.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n gl_FragColor.a = ${(cls / 16).toFixed(4)};`);
  };
  mat.customProgramCacheKey = () => `c${cls}`;
  return mat;
}
// small seeded random, so the sky is the same on every visit
let seed = 20261116;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ---------- sky ----------
const SUN_DIR = new THREE.Vector3(-.35, .78, .52).normalize(); // high, behind the viewer's left shoulder
function buildDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uZen: { value: new THREE.Color('#4d9ee0') }, uHor: { value: new THREE.Color('#cce8f7') }, uSun: { value: SUN_DIR } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uZen, uHor, uSun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = clamp(d.y, 0., 1.);
        vec3 c = mix(uHor, uZen, pow(h + 1e-4, .5));
        c += vec3(1., .94, .82) * pow(max(dot(d, uSun), 0.), 18.) * .22;
        gl_FragColor = vec4(c, ${(CLS.sky / 16).toFixed(4)});
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
  m.frustumCulled = false;
  return m;
}

// ---------- clouds ----------
// Each cumulus is a cluster of squashed spheres: a flat-ish base, a domed top, the biggest puffs in the middle.
function buildClouds(scene) {
  const field = [], puffs = [];
  const N = COARSE ? 26 : 42;
  for (let i = 0; i < N; i++) {
    // spread the clouds by angle above the horizon, so the whole sky has some; nearer ones are smaller
    // weighted toward high in the sky, where the page shows the most of it (the top of the view sits 50-65 deg up)
    const el = THREE.MathUtils.degToRad(4 + (1 - Math.pow(rnd(), 1.5)) * 64), d = 190 + rnd() * 520;
    const z = -d * Math.cos(el), lim = d * 1.05 + 90;
    const w = (34 + rnd() * 62) * Math.pow(d / 420, .6), base = d * Math.sin(el);
    const c = { x: (rnd() * 2 - 1) * lim, y: base, y0: base, z, lim, hx: 0, ox: 0, oy: 0, tx: 0, ty: 0, first: puffs.length, n: Math.round(16 + w * .9) };
    for (let p = 0; p < c.n; p++) {
      const u = rnd() * 2 - 1, prof = 1 - u * u;
      const r = (2.4 + rnd() * 3.4) * (.5 + .7 * prof) * Math.sqrt(w / 26);
      puffs.push({ c: field.length, dx: u * w * .5, dy: r * .5 + rnd() * prof * w * .32, dz: (rnd() * 2 - 1) * w * .24 * prof, r });
    }
    c.hx = c.x;
    field.push(c);
  }
  const mat = tag(new THREE.MeshLambertMaterial({ color: '#ffffff' }), CLS.cloud);
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), mat, puffs.length);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  scene.add(mesh);
  return { field, puffs, mesh };
}

// ---------- glyph pass ----------
// Reads the lit scene one cell at a time, as on the Seed Data diorama (mip-averaged colour, material class in
// alpha, so a cell knows how much of it is cloud and how its neighbours look). The look matches the reference:
// cyan tiles with white seams, drifting patches of deeper blue, a small dot per tile (a heavier square in the
// deep patches), and clouds as clean white tiles outlined in ( ) ; : ~ glyphs, heavier o 8 in their shaded undersides.
const CW = 8, CH = 12;                       // glyph cell in css px, as in the reference
const CARD_PAD_X = 64, CARD_PAD_TOP = 56;    // the soft white panel reaches this far past the text column
const palGlsl = `const vec3 PAL[${PAL.length}] = vec3[${PAL.length}](${PAL.map((h) => `vec3(${[1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)).join(',')})`).join(',')});`;
const asciiFrag = /* glsl */`
precision highp float;
uniform sampler2D uScene, uAtlas, uWind; uniform vec2 uView, uCell, uGrid; uniform float uTime, uN; uniform vec3 uCard;
in vec2 vUv; out vec4 outColor;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ return vn(p)*.55 + vn(p*2.1+5.2)*.3 + vn(p*4.3+9.1)*.15; }
float lum(vec3 c){ return dot(c,vec3(.25,.6,.15)); }
vec3 tone(vec3 c){ if(any(isnan(c)) || any(isinf(c))) c = vec3(0.); return pow(clamp(c,0.,1.), vec3(1./2.2)); }
// palette sampled from the reference video
const vec3 BG    = vec3(249.)/255.;
const vec3 TOP   = vec3(160.,212.,238.)/255.;   // typical tile up high
const vec3 DEEP  = vec3(103.,179.,215.)/255.;   // the deep patches
const vec3 LOW   = vec3(228.,240.,246.)/255.;   // pale, lower down
const vec3 CLOUD = vec3(252.,252.,253.)/255.;
const vec3 INK   = vec3(108.,118.,132.)/255.;
const vec3 OUTLINE = vec3(146.,156.,170.)/255.; // the fine grey cloud outline
const vec3 SHADE = vec3(214.,224.,236.)/255.;   // shaded cloud underside
const vec3 DOT_L = vec3(120.,150.,172.)/255.;
const vec3 DOT_D = vec3(41.,100.,144.)/255.;
const vec3 WINDC = vec3(44.,98.,178.)/255.;
${palGlsl}
float cover(vec2 uv, float lod){ return clamp((textureLod(uScene,uv,lod).a*16.-1.)/14.,0.,1.); }
void main(){
  vec2 px = vec2(vUv.x, 1.-vUv.y)*uView;                // css px, y down
  vec2 g = px/uCell, cell = floor(g), gv = g-cell;
  vec2 cuv = vec2((cell.x+.5)*uCell.x/uView.x, 1.-(cell.y+.5)*uCell.y/uView.y);
  ivec2 sz = textureSize(uScene,0);
  float lodC = log2(float(sz.x)/uGrid.x)+.05;
  vec4 sc = textureLod(uScene,cuv,lodC);
  float cov = clamp((sc.a*16.-1.)/14.,0.,1.);           // how much of this cell is cloud
  vec2 e = uCell/uView;
  float cl = cover(cuv-vec2(e.x,0),lodC), cr = cover(cuv+vec2(e.x,0),lodC);
  float cu = cover(cuv+vec2(0,e.y),lodC), cd = cover(cuv-vec2(0,e.y),lodC);
  float vy = px.y/uView.y, h = h21(cell);

  // sky tiles: deeper toward the top, with big soft patches of deeper blue drifting with the wind
  float pn = fbm(cell*vec2(.032,.07) + vec2(-uTime*.09, uTime*.012));
  float depth = clamp((pn-.42)*2.3 + (1.-smoothstep(0.,.42,vy))*.55 - .12, 0., 1.);
  vec3 sky = mix(mix(LOW, TOP, smoothstep(.42,.06,vy)), DEEP, smoothstep(.45,1.,depth));
  sky *= 1. + (h-.5)*.035;                               // a little tile-to-tile grain
  vec3 bg = mix(sky, CLOUD, smoothstep(.08,.55,cov));

  float gl = -1.; vec3 ink = INK; float strength = .9; float small = 1.;
  float dotM = 0.; vec3 dotC = DOT_L;
  if(cov < .1){
    // the dot: tiny and pale in light tiles, a heavier dark square in the deep patches
    bool deep = depth > .62;
    vec2 q = abs(gv*uCell - uCell*.5 + vec2(.5,0.));
    float hs = deep ? 1.3 : .8;
    dotM = 1. - smoothstep(hs-.5, hs+.5, max(q.x,q.y));
    dotC = deep ? DOT_D : DOT_L; strength = deep ? .85 : .7;
  } else {
    // shading lives in the tile colour: sunlit tops stay white, undersides take a soft blue-grey
    float shade = clamp((1.-lum(tone(sc.rgb)))*1.5, 0., 1.);
    bg = mix(bg, SHADE, smoothstep(.12,.75,shade)*.6*smoothstep(.25,.8,cov));
    // a fine grey outline: one ring of small, light glyphs where the cloud meets open sky
    float open = min(min(cl,cr),min(cu,cd));
    if(open < .3 || cov < .5){
      vec2 gc = vec2(cr-cl, cu-cd);                       // points into the cloud
      if(cov < .28) gl = h<.5?${gg('.')}:h<.8?${gg("'")}:${gg('`')};
      else if(abs(gc.x)*1.5 > abs(gc.y)) gl = gc.x>0. ? (h<.8?${gg('(')}:${gg(':')}) : (h<.8?${gg(')')}:${gg(':')});
      else if(gc.y > 0.) gl = h<.5?${gg('~')}:h<.8?${gg('_')}:${gg('-')};   // underside
      else gl = h<.55?${gg('.')}:h<.85?${gg("'")}:${gg('`')};              // top
      ink = OUTLINE; strength = .75; small = .8;
    }
  }
  // pointer wind: a short trail of strokes in the direction of travel, deepening the tiles it crosses
  vec4 wn = texelFetch(uWind, ivec2(cell), 0);
  if(wn.r > .08){
    float d = floor(wn.g*4.+.5);
    gl = d<.5?${gg('-')}:d<1.5?${gg('\\')}:d<2.5?${gg('|')}:${gg('/')};
    ink = WINDC; strength = min(1., wn.r*1.2); dotM = 0.;
    bg = mix(bg, DEEP, wn.r*.35*(1.-cov*.6));
  }
  // rain (see meadow.js): a short streak per drop, over sky and cloud alike
  if(wn.b > .03){ gl = floor(wn.a*255.+.5); ink = PAL[12]; strength = min(1., wn.b*1.15); dotM = 0.; small = 1.; bg = mix(bg, DEEP, wn.b*.22); }
  vec3 c = bg;
  if(gl >= 0.){
    vec2 dx = dFdx(g), dy = dFdy(g);
    vec2 gs = (gv-.5)/small+.5;                             // outline glyphs are drawn a size smaller
    float inside = step(0.,gs.x)*step(gs.x,1.)*step(0.,gs.y)*step(gs.y,1.);
    float m = inside*smoothstep(.05,.95,textureGrad(uAtlas,vec2((gl+clamp(gs.x,0.,1.))/uN,clamp(gs.y,0.,1.)),dx/(uN*small),dy/small).r);
    c = mix(bg, ink, m*strength);
  }
  c = mix(c, dotC, dotM*strength);

  // thin white seams between tiles
  vec2 cp = gv*uCell;
  c = mix(c, vec3(1.), max(step(uCell.x-1., cp.x), step(uCell.y-1., cp.y))*.8);

  // melt into the page toward the bottom
  c = mix(c, BG, smoothstep(.36, .8, vy));

  // soft panel behind the content, its top edge wavering like a cloud bank
  if(uCard.y > -9000.){
    float wob = (fbm(vec2(px.x/70. - uTime*.05, 3.3)) - .5)*18. + (vn(vec2(px.x/16. + uTime*.1, 8.1)) - .5)*6.;
    float d = max(max(uCard.x - px.x, px.x - uCard.z), (uCard.y + wob) - px.y);
    c = mix(c, BG, smoothstep(14., -12., d));
  }

  outColor = vec4(c,1.);
}`;

async function main() {
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const canvas = document.getElementById('sky');
  const content = document.getElementById('content');
  if (!canvas) return;
  const DEBUG = /[?&]debug/.test(location.search);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#e4f0f6', 320, 980);
  const sunTarget = new THREE.Vector3(0, 160, -300);
  const sun = new THREE.DirectionalLight('#fff4e6', 2.8);
  sun.position.copy(sunTarget).addScaledVector(SUN_DIR, 900); sun.target.position.copy(sunTarget);
  sun.castShadow = true; sun.shadow.mapSize.set(COARSE ? 1024 : 2048, COARSE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 700, bottom: -700, near: 100, far: 1900 });
  sun.shadow.intensity = .35; sun.shadow.bias = -.0005; sun.shadow.normalBias = .8; sun.shadow.autoUpdate = false;
  scene.add(sun, sun.target, new THREE.HemisphereLight('#e4f0ff', '#b4c3d6', 1.7));
  scene.add(buildDome());
  const clouds = buildClouds(scene);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 1500);
  let pitch = 0;
  function placeCamera(t) {
    const k = .5 - .5 * Math.cos(Math.PI * t / 60), yaw = THREE.MathUtils.degToRad(-2.5 + 5 * k);
    camera.position.set(0, 0, 0);
    camera.rotation.set(pitch, yaw, 0, 'YXZ'); camera.updateMatrixWorld();
  }

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  let windTex = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat); windTex.needsUpdate = true;
  const vtx = `in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`;
  const ascii = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vtx, fragmentShader: asciiFrag, depthTest: false, depthWrite: false,
    uniforms: { uScene: { value: rt.texture }, uAtlas: { value: buildAtlas() }, uWind: { value: windTex }, uView: { value: new THREE.Vector2(1, 1) },
      uCell: { value: new THREE.Vector2(CW, CH) }, uGrid: { value: new THREE.Vector2(1, 1) }, uTime: time, uN: { value: GLYPHS.length }, uCard: { value: new THREE.Vector3(0, -10000, 0) } } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ascii); quad.frustumCulled = false;
  const post = new THREE.Scene(); post.add(quad); const postCam = new THREE.Camera();

  // pointer wind, one texel per glyph cell (row 0 is the top row)
  let cols = 1, rows = 1, wind = new Float32Array(1), windDir = new Uint8Array(1);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the ground at the bottom of the page; rain that falls here soaks down to its meadow
  const groundEl = document.getElementById('ground');
  let ground = null;
  try { if (groundEl) ground = createGround(groundEl, { reduced: still, debug: DEBUG }); }
  catch (e) { console.error(e); groundEl.style.display = 'none'; }
  // rain falls from where the sky is clicked (hold to keep it raining, drag to move it) and melts into the page
  const rain = createRain({ CW, CH, stopAt: () => H * (.4 + Math.random() * .14), onLand: (x) => ground?.soakFrom(x + canvas.getBoundingClientRect().left) });
  const press = { down: false, x: 0, y: 0, acc: 0 };
  function setGrid(c, r) {
    cols = c; rows = r; wind = new Float32Array(c * r); windDir = new Uint8Array(c * r);
    windTex.dispose();
    windTex = new THREE.DataTexture(new Uint8Array(c * r * 4), c, r, THREE.RGBAFormat); windTex.needsUpdate = true;
    ascii.uniforms.uWind.value = windTex;
    rain.resize(c, r);
  }

  let qScale = 1, W = 1, H = 1;
  function resize() {
    W = Math.max(1, canvas.clientWidth || innerWidth); H = Math.max(1, canvas.clientHeight || innerHeight);
    const aspect = W / H, c = Math.ceil(W / CW), r = Math.ceil(H / CH);
    renderer.setSize(W, H, false);
    ascii.uniforms.uView.value.set(W, H); ascii.uniforms.uGrid.value.set(c, r);
    if (c !== cols || r !== rows) setGrid(c, r);
    const S = (COARSE ? 2.6 : 3.2) * Math.sqrt(qScale);
    rt.setSize(Math.round(c * S), Math.round(r * S * CH / CW));
    const hfov = THREE.MathUtils.degToRad(74), vfov = clamp(2 * Math.atan(Math.tan(hfov / 2) / aspect), THREE.MathUtils.degToRad(22), THREE.MathUtils.degToRad(64));
    camera.aspect = aspect; camera.fov = THREE.MathUtils.radToDeg(vfov); camera.updateProjectionMatrix();
    pitch = vfov / 2 + THREE.MathUtils.degToRad(1.5);
  }
  resize();
  let rsz = 0; new ResizeObserver(() => { clearTimeout(rsz); rsz = setTimeout(() => resize(), 120); }).observe(canvas);

  // ---- pointer: a wind trail, clouds nudged by it, and a gust on click ----
  const stroke = (px, py, dir, strength, rad) => {
    const c0 = Math.max(0, Math.floor((px - rad) / CW)), c1 = Math.min(cols - 1, Math.floor((px + rad) / CW));
    const r0 = Math.max(0, Math.floor((py - rad) / CH)), r1 = Math.min(rows - 1, Math.floor((py + rad) / CH));
    for (let ry = r0; ry <= r1; ry++) for (let cx = c0; cx <= c1; cx++) {
      const d = Math.hypot(cx * CW + CW / 2 - px, ry * CH + CH / 2 - py);
      if (d > rad) continue;
      const v = strength * (1 - (d / rad) * .45), i = ry * cols + cx;
      if (v > wind[i]) { wind[i] = v; windDir[i] = dir; }
    }
  };
  const dirOf = (dx, dy) => { let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI; return Math.round(a / (Math.PI / 4)) % 4; }; // 0 '-', 1 '\', 2 '|', 3 '/'
  const pushes = [];   // recent pointer motion, applied to clouds in screen space
  let lastP = null;
  addEventListener('pointermove', (e) => {
    const b = canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    if (lastP && y < b.height) {
      const dx = x - lastP.x, dy = y - lastP.y, len = Math.hypot(dx, dy);
      if (len >= 2) {
        const dir = dirOf(dx, dy), strength = Math.min(1, .35 + len / 40), steps = Math.ceil(len / 4);
        for (let s = 0; s <= steps; s++) stroke(lastP.x + dx * s / steps, lastP.y + dy * s / steps, dir, strength, 20);
        pushes.push({ x, y, dx, dy, r: 150 });
      }
    }
    lastP = { x, y };
    if (press.down) { press.x = x; press.y = Math.min(y, H * .3); }
  }, { passive: true });
  document.addEventListener('mouseleave', () => { lastP = null; press.down = false; });
  addEventListener('pointerup', () => { press.down = false; });
  addEventListener('pointercancel', () => { press.down = false; });
  addEventListener('blur', () => { press.down = false; });
  addEventListener('pointerdown', (e) => {
    const b = canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    if (y > b.height || e.target.closest('a, button')) return;
    if (y < H * .38) {   // rain falls from where the sky was clicked
      if (still) ground?.soakFrom(e.clientX);
      else { rain.burst(x, y, performance.now() / 1000); Object.assign(press, { down: true, x, y, acc: 0 }); }
    }
    // a gust: strokes fanning out from the click, clouds blown back
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), dir = dirOf(ca, sa);
      for (let r = 14; r < 110; r += 6) stroke(x + ca * r, y + sa * r, dir, 1 - r / 150, 7);
    }
    pushes.push({ x, y, gust: true, r: 320 });
  });

  const dummy = new THREE.Object3D(), v3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const fw = new THREE.Vector3(), rt3 = new THREE.Vector3(), up3 = new THREE.Vector3();
  let shadowTick = 0, lastT = 0;
  function drawFrame(t, realDt) {
    time.value = t; placeCamera(t);
    const dt = Math.max(0, t - lastT); lastT = t;
    // pointer pushes: find each cloud on screen and nudge the ones the wind passed near
    if (pushes.length) {
      for (const c of clouds.field) {
        v3.set(c.x, c.y + 6, c.z).project(camera);
        if (v3.z > 1) continue;
        const sx = (v3.x * .5 + .5) * W, sy = (.5 - v3.y * .5) * H, scale = Math.abs(c.z) / 300;
        for (const p of pushes) {
          const ddx = sx - p.x, ddy = sy - p.y, d = Math.hypot(ddx, ddy);
          if (d > p.r) continue;
          const f = 1 - d / p.r;
          // pushes set where a cloud wants to be, not how fast it goes; it eases there and back
          if (p.gust) { c.tx += ddx / (d + 1) * 9 * f * scale; c.ty -= ddy / (d + 1) * 4 * f * scale; }
          else { c.tx += p.dx * .06 * f * scale; c.ty -= p.dy * .03 * f * scale; }
          c.tx = clamp(c.tx, -16 * scale, 16 * scale); c.ty = clamp(c.ty, -6 * scale, 6 * scale);
        }
      }
      pushes.length = 0;
    }
    // clouds drift east and wrap round out of sight; a nudge moves a cloud a short way off its path,
    // smoothly, and it drifts back over a few seconds, so the sky can never be swept clear
    const settle = Math.exp(-dt * .45), ease = 1 - Math.exp(-dt * 1.4);
    for (const c of clouds.field) {
      c.hx += 3.2 * dt;
      if (c.hx > c.lim) c.hx -= 2 * c.lim;
      c.tx *= settle; c.ty *= settle;
      c.ox += (c.tx - c.ox) * ease; c.oy += (c.ty - c.oy) * ease;
      c.x = c.hx + c.ox; c.y = c.y0 + c.oy;
    }
    // each cloud turns its side profile to the viewer, so clouds high overhead still read as fluffy cumulus
    // rather than flat bases seen from below
    let cur = -1;
    clouds.puffs.forEach((p, i) => {
      const c = clouds.field[p.c], br = 1 + .06 * Math.sin(t * .35 + i * 1.7);   // puffs swell and settle slowly
      if (p.c !== cur) {
        cur = p.c; fw.set(c.x, c.y, c.z).normalize(); rt3.crossVectors(fw, UP).normalize(); up3.crossVectors(rt3, fw);
      }
      dummy.position.set(c.x, c.y, c.z).addScaledVector(rt3, p.dx).addScaledVector(up3, p.dy).addScaledVector(fw, p.dz);
      dummy.scale.set(p.r * br, p.r * .82 * br, p.r * br); dummy.updateMatrix(); clouds.mesh.setMatrixAt(i, dummy.matrix);
    });
    clouds.mesh.instanceMatrix.needsUpdate = true;

    // the trail fades over about half a second, whatever the display's refresh rate
    const data = windTex.image.data, fade = Math.exp(-(realDt || .016) * 4.2);
    if (content) {
      const sr = canvas.getBoundingClientRect(), inner = (content.firstElementChild || content).getBoundingClientRect();
      ascii.uniforms.uCard.value.set(inner.left - sr.left - CARD_PAD_X, inner.top - sr.top - CARD_PAD_TOP, inner.right - sr.left + CARD_PAD_X);
    }
    const now = performance.now() / 1000, rdt = realDt || .016;
    if (press.down) { press.acc += rdt * 26; while (press.acc >= 1) { press.acc -= 1; rain.drop(press.x + (Math.random() * 2 - 1) * 26, press.y + Math.random() * 10, now); } }
    rain.update(now, rdt);
    const rainV = rain.rain, rainG = rain.glyph;
    for (let i = 0; i < wind.length; i++) {
      const v = wind[i]; data[i * 4] = Math.min(255, v * 255); data[i * 4 + 1] = windDir[i] * 64;
      data[i * 4 + 2] = Math.min(255, (rainV[i] || 0) * 255); data[i * 4 + 3] = rainG[i] || 0;
      wind[i] = v > .01 ? v * fade : 0;
    }
    windTex.needsUpdate = true;

    if (shadowTick++ % 3 === 0) sun.shadow.needsUpdate = true;
    renderer.setRenderTarget(rt); renderer.setClearColor(0xa0d4ee, 0); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(post, postCam);
    ground?.frame(rdt);
  }

  placeCamera(0);
  try { await renderer.compileAsync(scene, camera); } catch { /* older browsers compile on first draw */ }

  // Live loop. Slow machines drop the scene resolution once; reduced-motion visitors get a still sky
  // (the pointer trail still answers them).
  let clock = 0, last = performance.now(), frames = 0, decided = false, tSum = 0, tN = 0;
  const loop = (now) => {
    if (now - last < 14) { requestAnimationFrame(loop); return; }
    const dt = (now - last) / 1000; last = now;
    if (!still) clock += Math.min(.1, dt);
    drawFrame(clock, Math.min(.1, dt));
    if (++frames > 30 && !decided && !still && dt < .25) {
      tSum += dt; tN++;
      if (tN === 90) { decided = true; const avg = tSum / tN; if (avg > .022) { qScale = avg > .04 ? .45 : .7; resize(); } }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // ?debug: expose the renderer, and step(n, dt) to run frames by hand (handy where animation frames are paused)
  if (DEBUG) window.__sky = { renderer, scene, sun, camera, resize, rt, ascii, clouds, rain, ground, step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) { clock += dt; drawFrame(clock, dt); } } };
}
main().catch((e) => { console.error(e); document.getElementById('sky')?.style.setProperty('display', 'none'); });
