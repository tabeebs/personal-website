// Shared crayon language for the meadow (drawn inside the sky's glyph pass) and the collection doodles.
// The look follows risograph crayon drawings: fills are short vertical waxy strokes, the colour layer sits a
// little out of register with the line layer, the palette is small and bold, and everything redraws a few
// times a second ("boils"), the way hand-drawn animation does on twos.

// Glyphs in the sky's atlas. The sky's own glyphs come first and keep their indices; the rest are for the meadow.
export const GLYPHS = " .'`,:;-~_()o8O/\\|+*!\"^vY@";
export const GI = Object.fromEntries([...GLYPHS].map((c, i) => [c, i]));
export const HATCH = 255;          // meadow code: let the shader pick a hatch stroke per cell and boil frame

// Palette, by index. Pairs are ink (deep) and fill (pastel).
export const PAL = [
  '#000000', // 0 none
  '#2d3a68', // 1 navy
  '#dc9f22', // 2 mustard
  '#25a088', // 3 teal
  '#7f71d4', // 4 lilac
  '#dc4c36', // 5 tomato
  '#3f8f54', // 6 grass
  '#f4d27c', // 7 mustard pastel
  '#9fdccb', // 8 teal pastel
  '#cbc3f3', // 9 lilac pastel
  '#f4ab9b', // 10 tomato pastel
  '#b9dfb0', // 11 grass pastel
  '#3c7fd0', // 12 rain
  '#d8689c', // 13 pink
  '#f6bfd6', // 14 pink pastel
];
export const C = { navy: 1, mustard: 2, teal: 3, lilac: 4, tomato: 5, grass: 6, mustardP: 7, tealP: 8, lilacP: 9, tomatoP: 10, grassP: 11, rain: 12, pink: 13, pinkP: 14 };

// Hand-drawn animation runs on twos: about 8 drawings a second.
export const BOIL_MS = 125;

export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
