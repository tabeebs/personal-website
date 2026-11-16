// The glyph atlas shared by the sky and the ground: every glyph in GLYPHS drawn white on black in one strip.
import * as THREE from 'three';
import { GLYPHS, GI } from './crayon.js';

// a glyph's atlas index as a GLSL float literal
export const gg = (c) => GI[c].toFixed(1);

export function buildAtlas() {
  const tw = 64, th = 120, c = document.createElement('canvas');
  c.width = tw * GLYPHS.length; c.height = th;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '100px Menlo, Monaco, Consolas, "Cascadia Mono", "DejaVu Sans Mono", "Liberation Mono", monospace';
  [...GLYPHS].forEach((ch, i) => x.fillText(ch, (i + .5) * tw, th * .5));
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.flipY = false;
  return t;
}
