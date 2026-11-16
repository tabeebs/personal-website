// Ground: the bottom of the screen. The sky's tiles come back here as pale green ground, deepening downward,
// and the crayon meadow grows along its top edge (see meadow.js): sky at the top, ground at the bottom. It sits
// over the bottom of the sky canvas and is see-through above the grass, so the sky's rain is seen falling all
// the way down to the flowers it waters.
import * as THREE from 'three';
import { GLYPHS, PAL, BOIL_MS } from './crayon.js';
import { buildAtlas, gg } from './atlas.js';
import { createMeadow, MROWS } from './meadow.js';

const CW = 8, CH = 12;          // the sky's glyph cell
const SOIL = 6;                 // ground-tile rows under the grass row; the meadow and its clouds fill the rows above

const palGlsl = `const vec3 PAL[${PAL.length}] = vec3[${PAL.length}](${PAL.map((h) => `vec3(${[1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)).join(',')})`).join(',')});`;

const frag = /* glsl */`
precision highp float;
uniform sampler2D uAtlas, uMeadow; uniform vec2 uView, uCell, uGrid; uniform float uN, uTime; uniform vec4 uMeadowInfo;
in vec2 vUv; out vec4 outColor;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ return vn(p)*.55 + vn(p*2.1+5.2)*.3 + vn(p*4.3+9.1)*.15; }
${palGlsl}
const vec3 BG      = vec3(249.)/255.;
const vec3 SOIL_HI = vec3(226.,240.,218.)/255.;   // pale green, just under the grass
const vec3 SOIL_LO = vec3(178.,216.,168.)/255.;   // deeper toward the bottom
const vec3 DOT_L   = vec3(122.,168.,122.)/255.;
const vec3 DOT_D   = vec3(50.,112.,70.)/255.;
// one glyph from the atlas, drawn into a cell (gv is the position inside the cell, 0..1)
float glyph(float gl, vec2 gv, vec2 dx, vec2 dy, float small){
  vec2 gs = (gv-.5)/small+.5;
  float inside = step(0.,gs.x)*step(gs.x,1.)*step(0.,gs.y)*step(gs.y,1.);
  return inside*smoothstep(.05,.95,textureGrad(uAtlas,vec2((gl+clamp(gs.x,0.,1.))/uN,clamp(gs.y,0.,1.)),dx/(uN*small),dy/small).r);
}
void main(){
  vec2 px = vec2(vUv.x, 1.-vUv.y)*uView;                // css px, y down
  vec2 g = px/uCell, cell = floor(g), gv = g-cell;
  vec2 gdx = dFdx(g), gdy = dFdy(g);
  float h = h21(cell);
  // the canvas is see-through where nothing is drawn: c is premultiplied colour, a its coverage
  vec3 c = vec3(0.); float al = 0.;
  #define OVER(col, k) { float k_ = clamp(k, 0., 1.); c = c*(1.-k_) + (col)*k_; al = al*(1.-k_) + k_; }

  // the ground: tiles like the sky's, in pale greens, deeper toward the bottom with big soft patches drifting
  // through; its top edge rolls gently, like a low hill
  float below = cell.y - uMeadowInfo.x;
  float into = below + (fbm(vec2(cell.x*.045, 2.7)) - .5)*1.8;
  if(into > -.6){
    float pn = fbm(cell*vec2(.05,.12) + vec2(uTime*.015, 0.));
    float depth = clamp(below/6.*.8 + (pn-.45)*1.5, 0., 1.);
    vec3 tile = mix(SOIL_HI, SOIL_LO, depth) * (1. + (h-.5)*.035);
    float a = smoothstep(-.6, 1.4, into);
    OVER(tile, a);
    bool deep = depth > .62;
    vec2 q = abs(gv*uCell - uCell*.5 + vec2(.5,0.));
    float hs = deep ? 1.3 : .8;
    float dotM = 1. - smoothstep(hs-.5, hs+.5, max(q.x,q.y));
    OVER(deep ? DOT_D : DOT_L, dotM*(deep ? .8 : .6)*a);
    vec2 cp = gv*uCell;
    OVER(vec3(1.), max(step(uCell.x-1., cp.x), step(uCell.y-1., cp.y))*.8*a);   // thin white seams
  }

  // the meadow. Its colour layer is printed a little out of register with its line layer, and both redraw on
  // twos, like the crayon drawings it is modelled on.
  float mk = uMeadowInfo.x - cell.y;
  if(mk >= -1. && mk < uMeadowInfo.y + 1.){
    float boil = uMeadowInfo.z;
    vec2 off = vec2(1.8, 1.3) + (vec2(h21(vec2(boil,3.1)), h21(vec2(boil,9.7))) - .5)*1.3;
    vec2 pf = px - off, cf = floor(pf/uCell);
    float kf = uMeadowInfo.x - cf.y;
    if(kf >= 0. && kf < uMeadowInfo.y && cf.x >= 0. && cf.x < uGrid.x){
      ivec2 ci = ivec2(int(cf.x), int(kf));
      vec4 mf = texelFetch(uMeadow, ci, 0);
      float fi = floor(mf.b*255.+.5);
      if(fi > .5){
        // round the fill into a blob: corners facing open air are cut back along a wobbly curve
        float nl = cf.x > .5 ? texelFetch(uMeadow, ci+ivec2(-1,0), 0).b : 0., nr = cf.x < uGrid.x-1.5 ? texelFetch(uMeadow, ci+ivec2(1,0), 0).b : 0.;
        float nu = kf < uMeadowInfo.y-1.5 ? texelFetch(uMeadow, ci+ivec2(0,1), 0).b : 0., nd = kf > .5 ? texelFetch(uMeadow, ci+ivec2(0,-1), 0).b : 1.;
        vec2 q = pf/uCell - cf;                                    // 0..1 inside the cell, y down
        vec2 e = vec2(q.x < .5 ? (nl > 0. ? 0. : .5-q.x) : (nr > 0. ? 0. : q.x-.5),
                      q.y < .5 ? (nu > 0. ? 0. : .5-q.y) : (nd > 0. ? 0. : q.y-.5)) * 2.;
        float wob = (h21(floor(pf/2.) + boil*.53) - .5)*.22;
        float blobM = 1. - smoothstep(.86, 1.02, length(e) + wob);
        // waxy vertical streaks, with paper showing through between them
        float sx = floor(pf.x/1.6);
        float st = h21(vec2(sx, floor((pf.y + h21(vec2(sx, boil))*14.)/4.5)) + boil*.29);
        float wax = mix(.5, 1., smoothstep(.18, .42, st));
        OVER(PAL[int(fi)], mf.a*.95*blobM*wax);
      }
    }
    if(mk >= 0. && mk < uMeadowInfo.y){
      vec4 m = texelFetch(uMeadow, ivec2(int(cell.x), int(mk)), 0);
      if(m.a > .01){
        float code = floor(m.r*255.+.5), hb = h21(cell + boil*1.731);
        // hatch cells pick a fresh crayon stroke every drawing
        float mg = code > 254.5 ? (hb<.4?${gg('|')}:hb<.65?${gg('!')}:hb<.82?${gg(':')}:hb<.93?${gg(';')}:${gg("'")}) : code;
        vec2 jg = gv + (vec2(h21(cell+boil*.91), h21(cell.yx+boil*1.37))-.5)*vec2(.18,.1);
        OVER(PAL[int(floor(m.g*255.+.5))], glyph(mg, jg, gdx, gdy, 1.)*m.a);
      }
    }
  }
  outColor = vec4(c, al);
}`;

export function createGround(canvas, { reduced = false, debug = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: debug });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const meadow = createMeadow({ CW, CH, reduced });

  const vtx = `in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`;
  const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vtx, fragmentShader: frag, depthTest: false, depthWrite: false,
    transparent: true, blending: THREE.NoBlending,
    uniforms: { uAtlas: { value: buildAtlas() }, uMeadow: { value: null }, uView: { value: new THREE.Vector2(1, 1) },
      uCell: { value: new THREE.Vector2(CW, CH) }, uGrid: { value: new THREE.Vector2(1, 1) }, uN: { value: GLYPHS.length }, uTime: { value: 0 },
      uMeadowInfo: { value: new THREE.Vector4(0, MROWS, 0, 1) } } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad); const cam = new THREE.Camera();

  let W = 1, H = 1, cols = 1, rows = 1, meadowTex = null;
  function resize() {
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
    renderer.setSize(W, H, false);
    const c = Math.ceil(W / CW), r = Math.ceil(H / CH);
    mat.uniforms.uView.value.set(W, H); mat.uniforms.uGrid.value.set(c, r);
    if (c !== cols || r !== rows) {
      cols = c; rows = r;
      meadow.resize(c, r);
      meadowTex?.dispose();
      meadowTex = new THREE.DataTexture(meadow.cells, c, MROWS, THREE.RGBAFormat);
      mat.uniforms.uMeadow.value = meadowTex;
    }
    // the meadow runs the full width, a little past each edge so it never tapers on screen
    // the grass row sits SOIL rows from the bottom, whatever height the page gives the ground
    const base = Math.max(MROWS + 1, rows - SOIL);
    mat.uniforms.uMeadowInfo.value.x = base;
    meadow.setGround(base, -48, W + 48);
  }
  resize();
  new ResizeObserver(() => resize()).observe(canvas);

  // only draw while the ground is on screen; the flowers keep living either way
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  // pointer, in this canvas's px: brushing through the meadow
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  addEventListener('pointermove', (e) => { const [x, y] = local(e); meadow.move(x, y); }, { passive: true });
  addEventListener('blur', () => meadow.leave());
  document.addEventListener('mouseleave', () => meadow.leave());

  function frame(dt) {
    const t = performance.now() / 1000;
    meadow.update(t, dt);
    if (!visible) return;
    mat.uniforms.uTime.value = reduced ? 0 : t;
    mat.uniforms.uMeadowInfo.value.z = reduced ? 0 : Math.floor(performance.now() / BOIL_MS) % 997;
    meadowTex.needsUpdate = true;
    renderer.render(scene, cam);
  }

  // where the grass is, in viewport px, so rain from the sky knows where to stop
  const grassY = () => canvas.getBoundingClientRect().top + meadow.base * CH;
  // a raindrop from the sky landing on the meadow; x is in viewport px
  const land = (x) => meadow.land(x - canvas.getBoundingClientRect().left, performance.now() / 1000);

  return { frame, land, grassY, meadow, renderer };
}
