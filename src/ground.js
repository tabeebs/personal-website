// Ground: the bottom of the page. The sky's tiles come back here as pale green ground, deepening downward, and
// the crayon meadow grows along its top edge (see meadow.js). It is the page's floor: sky at the top, ground at
// the bottom. Rain from the sky soaks down to it, so the flowers here bloom where it rained up there.
import * as THREE from 'three';
import { GLYPHS, PAL, BOIL_MS } from './crayon.js';
import { buildAtlas, gg } from './atlas.js';
import { createMeadow, MROWS } from './meadow.js';

const CW = 8, CH = 12;          // the sky's glyph cell
const BASE = 19;                // the grass row; flowers grow in the rows above it, ground tiles fill those below
const NCLOUD = 3;               // rain clouds over the meadow at once

const palGlsl = `const vec3 PAL[${PAL.length}] = vec3[${PAL.length}](${PAL.map((h) => `vec3(${[1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)).join(',')})`).join(',')});`;

const frag = /* glsl */`
precision highp float;
uniform sampler2D uAtlas, uMeadow, uRain; uniform vec2 uView, uCell, uGrid; uniform float uN, uTime; uniform vec4 uMeadowInfo;
uniform vec4 uClouds[${NCLOUD}];   // x, y, width, opacity
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
// the sky's own colours, for the little rain clouds and the patch of sky they bring
const vec3 SKY     = vec3(184.,222.,242.)/255.;
const vec3 SKY_DOT = vec3(120.,150.,172.)/255.;
const vec3 CLOUD   = vec3(252.,252.,253.)/255.;
const vec3 SHADE   = vec3(214.,224.,236.)/255.;
const vec3 OUTLINE = vec3(146.,156.,170.)/255.;
// signed distance to a cloud: three puffs over a flat base (negative inside)
float cloudSD(vec2 p, vec4 k){
  float w = k.z; vec2 c = k.xy;
  float d = min(min(length(p - c - vec2(-.27,.02)*w) - .2*w, length(p - c - vec2(0.,-.06)*w) - .25*w), length(p - c - vec2(.25,.03)*w) - .19*w);
  return max(d, p.y - (c.y + .12*w));
}
// nearest cloud at p: its distance and opacity
vec2 clouds(vec2 p){
  vec2 best = vec2(1e4, 0.);
  for(int i = 0; i < ${NCLOUD}; i++){
    if(uClouds[i].w < .01) continue;
    float d = cloudSD(p, uClouds[i]);
    if(d < best.x) best = vec2(d, uClouds[i].w);
  }
  return best;
}
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
  vec3 c = BG;

  // the ground: tiles like the sky's, in pale greens, deeper toward the bottom with big soft patches drifting
  // through; its top edge rolls gently, like a low hill
  float below = cell.y - uMeadowInfo.x;
  float into = below + (fbm(vec2(cell.x*.045, 2.7)) - .5)*1.8;
  if(into > -.6){
    float pn = fbm(cell*vec2(.05,.12) + vec2(uTime*.015, 0.));
    float depth = clamp(below/6.*.8 + (pn-.45)*1.5, 0., 1.);
    vec3 tile = mix(SOIL_HI, SOIL_LO, depth) * (1. + (h-.5)*.035);
    float a = smoothstep(-.6, 1.4, into);
    c = mix(BG, tile, a);
    bool deep = depth > .62;
    vec2 q = abs(gv*uCell - uCell*.5 + vec2(.5,0.));
    float hs = deep ? 1.3 : .8;
    float dotM = 1. - smoothstep(hs-.5, hs+.5, max(q.x,q.y));
    c = mix(c, deep ? DOT_D : DOT_L, dotM*(deep ? .8 : .6)*a);
    vec2 cp = gv*uCell;
    c = mix(c, vec3(1.), max(step(uCell.x-1., cp.x), step(uCell.y-1., cp.y))*.8*a);   // thin white seams
  }

  // rain clouds: white tiles outlined in small grey glyphs, as in the sky, with a patch of sky around them
  vec2 pc = (cell + .5)*uCell;
  vec2 cl = clouds(pc);
  if(cl.y > .01){
    float sky = smoothstep(20., 4., cl.x) * cl.y;   // a soft patch of sky around the cloud
    if(sky > .01 && cl.x > 0.){
      c = mix(c, SKY*(1. + (h-.5)*.03), sky*.9);
      vec2 q = abs(gv*uCell - uCell*.5 + vec2(.5,0.));
      c = mix(c, SKY_DOT, (1. - smoothstep(.3, 1.3, max(q.x,q.y)))*.7*sky);
    }
    if(cl.x < 0.){
      c = mix(c, CLOUD, cl.y);
      // underside shading: cells near the flat base take the sky's blue-grey
      float base = clouds(pc + vec2(0., uCell.y)).x;
      if(base > -2.) c = mix(c, SHADE, .55*cl.y);
      // the outline ring: one layer of small light glyphs where the cloud meets open air
      float dl = clouds(pc - vec2(uCell.x,0.)).x, dr = clouds(pc + vec2(uCell.x,0.)).x;
      float du = clouds(pc - vec2(0.,uCell.y)).x, dd = base;
      if(max(max(dl,dr),max(du,dd)) > 0.){
        float gsel = dl > 0. ? (h<.8?${gg('(')}:${gg(':')}) : dr > 0. ? (h<.8?${gg(')')}:${gg(':')}) : dd > 0. ? (h<.5?${gg('~')}:h<.8?${gg('_')}:${gg('-')}) : (h<.55?${gg('.')}:h<.85?${gg("'")}:${gg('`')});
        c = mix(c, OUTLINE, glyph(gsel, gv, gdx, gdy, .8)*.75*cl.y);
      }
    }
    vec2 cp = gv*uCell;
    c = mix(c, vec3(1.), max(step(uCell.x-1., cp.x), step(uCell.y-1., cp.y))*.8*smoothstep(20., 4., cl.x)*cl.y);
  }

  // rain: a short streak per drop
  vec4 rn = texelFetch(uRain, ivec2(cell), 0);
  if(rn.r > .03){
    c = mix(c, SKY, rn.r*.35);                                   // the tile it falls through takes a little blue
    c = mix(c, PAL[12], glyph(floor(rn.g*255.+.5), gv, gdx, gdy, 1.)*min(1., rn.r*1.15));
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
        c = mix(c, PAL[int(fi)], mf.a*.95*blobM*wax);
      }
    }
    if(mk >= 0. && mk < uMeadowInfo.y){
      vec4 m = texelFetch(uMeadow, ivec2(int(cell.x), int(mk)), 0);
      if(m.a > .01){
        float code = floor(m.r*255.+.5), hb = h21(cell + boil*1.731);
        // hatch cells pick a fresh crayon stroke every drawing
        float mg = code > 254.5 ? (hb<.4?${gg('|')}:hb<.65?${gg('!')}:hb<.82?${gg(':')}:hb<.93?${gg(';')}:${gg("'")}) : code;
        vec2 jg = gv + (vec2(h21(cell+boil*.91), h21(cell.yx+boil*1.37))-.5)*vec2(.18,.1);
        c = mix(c, PAL[int(floor(m.g*255.+.5))], glyph(mg, jg, gdx, gdy, 1.)*m.a);
      }
    }
  }
  outColor = vec4(c,1.);
}`;

export function createGround(canvas, { reduced = false, debug = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: debug });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const meadow = createMeadow({ CW, CH, reduced });

  const vtx = `in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`;
  const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vtx, fragmentShader: frag, depthTest: false, depthWrite: false,
    uniforms: { uAtlas: { value: buildAtlas() }, uMeadow: { value: null }, uRain: { value: null }, uView: { value: new THREE.Vector2(1, 1) },
      uCell: { value: new THREE.Vector2(CW, CH) }, uGrid: { value: new THREE.Vector2(1, 1) }, uN: { value: GLYPHS.length }, uTime: { value: 0 },
      uMeadowInfo: { value: new THREE.Vector4(BASE, MROWS, 0, 1) },
      uClouds: { value: Array.from({ length: NCLOUD }, () => new THREE.Vector4(0, 0, 1, 0)) } } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad); const cam = new THREE.Camera();

  let W = 1, H = 1, cols = 1, rows = 1, meadowTex = null, rainTex = null;
  function resize() {
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
    renderer.setSize(W, H, false);
    const c = Math.ceil(W / CW), r = Math.ceil(H / CH);
    mat.uniforms.uView.value.set(W, H); mat.uniforms.uGrid.value.set(c, r);
    if (c !== cols || r !== rows) {
      cols = c; rows = r;
      meadow.resize(c, r);
      meadowTex?.dispose(); rainTex?.dispose();
      meadowTex = new THREE.DataTexture(meadow.cells, c, MROWS, THREE.RGBAFormat);
      rainTex = new THREE.DataTexture(new Uint8Array(c * r * 4), c, r, THREE.RGBAFormat);
      mat.uniforms.uMeadow.value = meadowTex; mat.uniforms.uRain.value = rainTex;
    }
    // the meadow runs the full width, a little past each edge so it never tapers on screen
    meadow.setGround(BASE, -48, W + 48);
  }
  resize();
  new ResizeObserver(() => resize()).observe(canvas);

  // only draw while the ground is on screen; the flowers keep living either way
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  // pointer, in this canvas's px
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; };
  addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('a, button')) return;
    const [x, y, r] = local(e);
    if (x >= 0 && x <= r.width && y >= 0 && y <= r.height) meadow.down(x, y);
  });
  addEventListener('pointermove', (e) => { const [x, y] = local(e); meadow.move(x, y); }, { passive: true });
  addEventListener('pointerup', () => meadow.up());
  addEventListener('pointercancel', () => meadow.up());
  addEventListener('blur', () => meadow.leave());
  document.addEventListener('mouseleave', () => meadow.leave());

  function frame(dt) {
    const t = performance.now() / 1000;
    meadow.update(t, dt);
    if (!visible) return;
    mat.uniforms.uTime.value = reduced ? 0 : t;
    mat.uniforms.uMeadowInfo.value.z = reduced ? 0 : Math.floor(performance.now() / BOIL_MS) % 997;
    meadowTex.needsUpdate = true;
    const cs = meadow.clouds;
    mat.uniforms.uClouds.value.forEach((v, i) => { const c = cs[i]; if (c) v.set(c.x, meadow.CLOUD_Y, c.w, c.a); else v.w = 0; });
    const data = rainTex.image.data, rain = meadow.rain, rg = meadow.rainG;
    for (let i = 0; i < rain.length; i++) { data[i * 4] = Math.min(255, rain[i] * 255); data[i * 4 + 1] = rg[i]; }
    rainTex.needsUpdate = true;
    renderer.render(scene, cam);
  }

  // rain from the sky reaching the ground; x is in viewport px, which this full-width canvas shares
  const soakFrom = (x) => meadow.soakFrom(x - canvas.getBoundingClientRect().left, performance.now() / 1000);

  return { frame, soakFrom, meadow, renderer };
}
