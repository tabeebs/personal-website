// Sky header: a live Three.js sky with lit cumulus clouds, drawn as an ASCII tile grid.
// The rendering follows the Seed Data landing diorama (SeedData/app/landing/main.js): a real lit scene renders
// at a few pixels per glyph cell into a half-float target with each pixel's material class in alpha, and a glyph
// pass reads it one cell at a time. The look is the original light sky: pale blue tiles with white seams, small
// dots in open sky, grey glyphs on white cloud, a soft panel behind the content and a fade into the page.
// Source for build/sky.js: rebuild with `npm run build` after editing.
import * as THREE from 'three';

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
  const N = COARSE ? 30 : 48;
  for (let i = 0; i < N; i++) {
    // spread the clouds by angle above the horizon, so the whole sky has some; nearer ones are smaller
    const el = THREE.MathUtils.degToRad(3 + Math.pow(rnd(), .9) * 46), d = 170 + rnd() * 560;
    const z = -d * Math.cos(el), lim = Math.abs(z) * .95 + 90;
    const w = (22 + rnd() * 40) * Math.pow(d / 420, .6), base = d * Math.sin(el);
    const c = { x: (rnd() * 2 - 1) * lim, y: base, z, lim, first: puffs.length, n: Math.round(16 + w * .9) };
    for (let p = 0; p < c.n; p++) {
      const u = rnd() * 2 - 1, prof = 1 - u * u;
      const r = (2.4 + rnd() * 3.4) * (.5 + .7 * prof) * Math.sqrt(w / 26);
      puffs.push({ c: field.length, dx: u * w * .5, dy: r * .5 + rnd() * prof * w * .32, dz: (rnd() * 2 - 1) * w * .24 * prof, r });
    }
    field.push(c);
  }
  const mat = tag(new THREE.MeshLambertMaterial({ color: '#ffffff' }), CLS.cloud);
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 3), mat, puffs.length);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  scene.add(mesh);
  return { field, puffs, mesh };
}

// ---------- glyph pass ----------
// The Seed Data diorama's per-cell sampling (scene at a few pixels per cell, averaged with mip LOD, material
// class in alpha, brightness and edge gradient from the neighbours), composited in the original light style:
// pale blue tiles with white seams, small dots in open sky, grey glyphs on white cloud, melting into the page.
const GLYPHS = " .'`,:;-~=+*oOsS$%&8#@/\\|_^v\u2014\"Y";
const GI = Object.fromEntries([...GLYPHS].map((c, i) => [c, i]));
const gg = (c) => GI[c].toFixed(1);
function buildAtlas() {
  const tw = 64, th = 120, c = document.createElement('canvas');
  c.width = tw * GLYPHS.length; c.height = th;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '100px Menlo, Monaco, Consolas, "Cascadia Mono", "DejaVu Sans Mono", "Liberation Mono", monospace';
  [...GLYPHS].forEach((ch, i) => { if (ch === '\u2014') x.fillRect(i * tw, th * .45, tw, th * .1); else x.fillText(ch, (i + .5) * tw, th * .52); });
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.flipY = false;
  return t;
}
const CW = 8, CH = 12;                       // glyph cell in css px, as in the original sky
const CARD_PAD_X = 64, CARD_PAD_TOP = 56;    // the soft white panel reaches this far past the text column
const asciiFrag = /* glsl */`
precision highp float;
uniform sampler2D uScene, uAtlas, uWind; uniform vec2 uView, uCell, uGrid; uniform float uTime, uN; uniform vec3 uCard;
in vec2 vUv; out vec4 outColor;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ return vn(p)*.55 + vn(p*2.1+5.2)*.3 + vn(p*4.3+9.1)*.15; }
float lum(vec3 c){ return dot(c,vec3(.25,.6,.15)); }
vec3 tone(vec3 c){
  if(any(isnan(c)) || any(isinf(c))) c = vec3(0.);
  return pow(clamp(c,0.,1.), vec3(1./2.2));
}
const vec3 BG = vec3(249./255.);
void main(){
  vec2 px = vec2(vUv.x, 1.-vUv.y)*uView;                // css px, y down
  vec2 g = px/uCell, cell = floor(g), gv = g-cell;
  vec2 cuv = vec2((cell.x+.5)*uCell.x/uView.x, 1.-(cell.y+.5)*uCell.y/uView.y);
  ivec2 sz = textureSize(uScene,0);
  float lodC = log2(float(sz.x)/uGrid.x)+.05;
  vec3 col = tone(textureLod(uScene,cuv,lodC).rgb);
  float cls = floor(texelFetch(uScene,ivec2(cuv*vec2(sz)),0).a*16.+.5);
  float L = lum(col);
  vec2 e = uCell/uView;
  float lx0=lum(tone(textureLod(uScene,cuv-vec2(e.x,0),lodC).rgb)), lx1=lum(tone(textureLod(uScene,cuv+vec2(e.x,0),lodC).rgb));
  float ly0=lum(tone(textureLod(uScene,cuv+vec2(0,e.y),lodC).rgb)), ly1=lum(tone(textureLod(uScene,cuv-vec2(0,e.y),lodC).rgb));
  vec2 grad = vec2(lx1-lx0,(ly1-ly0)*.66); float mag = length(grad);
  float a4 = mod(atan(-grad.y,grad.x)+.3927,3.14159)/.7854;
  float edgeG = a4<1.?${gg('|')}:a4<2.?${gg('\\')}:a4<3.?${gg('-')}:${gg('/')};

  float gl; float strength; vec3 ink;
  if(cls<1.5){        // open sky: a small dot per tile, a heavier one where the blue runs deep
    gl = L<.5?${gg(':')}:${gg('.')};
    ink = col*.55; strength = .75;
  } else {            // cloud: bright tops stay clean, the shaded body fills in with heavier glyphs
    float s = 1.-L;
    gl = s<.05?${gg(' ')}:s<.11?${gg('.')}:s<.17?${gg(':')}:s<.23?${gg('~')}:s<.3?${gg('o')}:${gg('O')};
    if(mag>.12 && s>.08) gl = edgeG;
    ink = col*.7; strength = .65;
  }
  // pointer wind: a short trail of strokes in the direction of travel
  vec4 wn = texelFetch(uWind, ivec2(cell), 0);
  if(wn.r > .08){
    float d = floor(wn.g*4.+.5);
    gl = d<.5?${gg('-')}:d<1.5?${gg('\\')}:d<2.5?${gg('|')}:${gg('/')};
    ink = vec3(.17,.38,.70); strength = min(1., wn.r*1.15);
    col = mix(col, col*.86, wn.r*.5);
  }
  vec2 dx = dFdx(g), dy = dFdy(g);
  float m = smoothstep(.05,.95,textureGrad(uAtlas,vec2((gl+gv.x)/uN,gv.y),dx/uN,dy).r);
  vec3 c = mix(mix(col, vec3(1.), .1), ink, m*strength);

  // thin white seams between tiles
  vec2 cp = gv*uCell;
  c = mix(c, vec3(1.), max(step(uCell.x-1., cp.x), step(uCell.y-1., cp.y))*.78);

  // melt into the page toward the bottom
  c = mix(c, BG, smoothstep(.5, .9, px.y/uView.y));

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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#cce8f7', 300, 950);   // far clouds fade into the haze at the horizon
  const sunTarget = new THREE.Vector3(0, 52, -380);
  const sun = new THREE.DirectionalLight('#fff4e6', 2.8);
  sun.position.copy(sunTarget).addScaledVector(SUN_DIR, 700); sun.target.position.copy(sunTarget);
  sun.castShadow = true; sun.shadow.mapSize.set(COARSE ? 1024 : 2048, COARSE ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -760, right: 760, top: 520, bottom: -520, near: 200, far: 1300 });
  sun.shadow.intensity = .28; sun.shadow.bias = -.0005; sun.shadow.normalBias = .6; sun.shadow.autoUpdate = false;
  scene.add(sun, sun.target, new THREE.HemisphereLight('#e4f0ff', '#c6d3e4', 1.9));
  scene.add(buildDome());
  const clouds = buildClouds(scene);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 1500);
  let pitch = 0;
  function placeCamera(t) {
    // a slow look left and back again, eased so the loop never jumps
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
  function setGrid(c, r) {
    cols = c; rows = r; wind = new Float32Array(c * r); windDir = new Uint8Array(c * r);
    windTex.dispose();
    windTex = new THREE.DataTexture(new Uint8Array(c * r * 4), c, r, THREE.RGBAFormat); windTex.needsUpdate = true;
    ascii.uniforms.uWind.value = windTex;
  }

  let qScale = 1, W = 1, H = 1;
  function resize() {
    W = Math.max(1, canvas.clientWidth || innerWidth); H = Math.max(1, canvas.clientHeight || innerHeight);
    const aspect = W / H, c = Math.ceil(W / CW), r = Math.ceil(H / CH);
    renderer.setSize(W, H, false);
    ascii.uniforms.uView.value.set(W, H); ascii.uniforms.uGrid.value.set(c, r);
    if (c !== cols || r !== rows) setGrid(c, r);
    // the scene is only ever read one cell at a time, so it renders at a few pixels per cell (as on the diorama)
    const S = (COARSE ? 2.6 : 3.2) * Math.sqrt(qScale);
    rt.setSize(Math.round(c * S), Math.round(r * S * CH / CW));
    const hfov = THREE.MathUtils.degToRad(74), vfov = clamp(2 * Math.atan(Math.tan(hfov / 2) / aspect), THREE.MathUtils.degToRad(22), THREE.MathUtils.degToRad(64));
    camera.aspect = aspect; camera.fov = THREE.MathUtils.radToDeg(vfov); camera.updateProjectionMatrix();
    pitch = vfov / 2 + THREE.MathUtils.degToRad(1.5);
  }
  resize();
  let rsz = 0; new ResizeObserver(() => { clearTimeout(rsz); rsz = setTimeout(() => resize(), 120); }).observe(canvas);

  let lastP = null;
  addEventListener('pointermove', (e) => {
    const b = canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    if (lastP) {
      const dx = x - lastP.x, dy = y - lastP.y, len = Math.hypot(dx, dy);
      if (len >= 2) {
        let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI;
        const dir = Math.round(a / (Math.PI / 4)) % 4;     // 0 '-', 1 '\', 2 '|', 3 '/'
        const rad = 20, strength = Math.min(1, .35 + len / 40), steps = Math.ceil(len / 4);
        for (let s = 0; s <= steps; s++) {
          const px = lastP.x + dx * s / steps, py = lastP.y + dy * s / steps;
          const c0 = Math.max(0, Math.floor((px - rad) / CW)), c1 = Math.min(cols - 1, Math.floor((px + rad) / CW));
          const r0 = Math.max(0, Math.floor((py - rad) / CH)), r1 = Math.min(rows - 1, Math.floor((py + rad) / CH));
          for (let ry = r0; ry <= r1; ry++) for (let cx = c0; cx <= c1; cx++) {
            const d = Math.hypot(cx * CW + CW / 2 - px, ry * CH + CH / 2 - py);
            if (d > rad) continue;
            const v = strength * (1 - (d / rad) * .45), i = ry * cols + cx;
            if (v > wind[i]) { wind[i] = v; windDir[i] = dir; }
          }
        }
      }
    }
    lastP = { x, y };
  }, { passive: true });
  document.addEventListener('mouseleave', () => { lastP = null; });

  const dummy = new THREE.Object3D(); let shadowTick = 0, lastT = 0;
  function drawFrame(t) {
    time.value = t; placeCamera(t);
    const dt = Math.max(0, t - lastT); lastT = t;
    // clouds drift east and wrap round out of sight
    for (const c of clouds.field) { c.x += dt * 3.2; if (c.x > c.lim) c.x -= 2 * c.lim; }
    clouds.puffs.forEach((p, i) => {
      const c = clouds.field[p.c];
      dummy.position.set(c.x + p.dx, c.y + p.dy, c.z + p.dz);
      dummy.scale.set(p.r, p.r * .82, p.r); dummy.updateMatrix(); clouds.mesh.setMatrixAt(i, dummy.matrix);
    });
    clouds.mesh.instanceMatrix.needsUpdate = true;

    const data = windTex.image.data;
    for (let i = 0; i < wind.length; i++) {
      const v = wind[i]; data[i * 4] = Math.min(255, v * 255); data[i * 4 + 1] = windDir[i] * 64;
      wind[i] = v > .01 ? v * .935 : 0;
    }
    windTex.needsUpdate = true;

    if (content) {
      const sr = canvas.getBoundingClientRect(), inner = (content.firstElementChild || content).getBoundingClientRect();
      ascii.uniforms.uCard.value.set(inner.left - sr.left - CARD_PAD_X, inner.top - sr.top - CARD_PAD_TOP, inner.right - sr.left + CARD_PAD_X);
    }

    if (shadowTick++ % 3 === 0) sun.shadow.needsUpdate = true;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x4d9ee0, 0); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(post, postCam);
  }

  placeCamera(0);
  try { await renderer.compileAsync(scene, camera); } catch { /* older browsers compile on first draw */ }

  // Live loop. Slow machines drop the scene resolution once; reduced-motion visitors get a still sky
  // (the pointer trail still answers them).
  let clock = 0, last = performance.now(), frames = 0, decided = false, tSum = 0, tN = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = (now) => {
    if (now - last < 14) { requestAnimationFrame(loop); return; }
    const dt = (now - last) / 1000; last = now;
    if (!still) clock += Math.min(.1, dt);
    drawFrame(clock);
    if (++frames > 30 && !decided && !still && dt < .25) {
      tSum += dt; tN++;
      if (tN === 90) { decided = true; const avg = tSum / tN; if (avg > .022) { qScale = avg > .04 ? .45 : .7; resize(); } }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  if (location.search.includes('debug')) window.__sky = { renderer, scene, sun, camera, resize, rt, ascii, clouds };
}
main().catch((e) => { console.error(e); document.getElementById('sky')?.style.setProperty('display', 'none'); });
