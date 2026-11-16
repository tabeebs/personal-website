# website v1

Personal website. Plain HTML and CSS, plus one bundled script for the sky.

## Sky

The header is a live Three.js sky drawn as coloured monospace glyphs. It uses the same pipeline as the Seed Data landing diorama (`SeedData/app/landing/main.js`):

1. **Scene:** a sky dome, plus cumulus clouds built as clusters of lit puffs. They are lit by a warm sun and a hemisphere light, with soft self-shadows and fog toward the horizon, and they drift east. The scene renders at about 3.2 px per glyph cell into a half-float target, and the alpha channel stores each pixel's material class.
2. **Glyph pass:** each cell reads its averaged colour and class. Open sky gets `. : + *` by brightness, and clouds use the diorama's smoke and dust ramp `. : o O`. Each glyph is inked at `col*1.24` over a dimmed blur of the scene, which is exactly what the diorama does.
3. **Tilt shift:** the diorama's blur pass softens the top and bottom of the frame.
4. **Pointer wind:** moving the cursor leaves a short trail of `— / | \` strokes in the direction of travel.

The paper panel uses the diorama page's torn-edge SVG filter. Slow devices lower the scene resolution once. Reduced-motion visitors get a still sky, and the pointer trail still works for them. Without WebGL 2 the header falls back to a plain sky gradient.

## Change it

```bash
npm install
npm run build
```

Edit `src/sky.js`, then run the build. `build/sky.js` is committed, because the site itself has no build step. Add `?debug` to the URL to expose the renderer on `window.__sky`.

## Run locally

```bash
npm start
```

Then open http://localhost:5173.
