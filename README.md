# website v1

Personal website. Plain HTML and CSS, plus one bundled script for the sky.

## Sky

The header is a light ASCII sky: pale blue tiles with thin white seams, a small dot in each tile of open sky, clouds drawn as grey glyphs on white, a soft white panel behind the content, and a fade into the page.

The clouds are rendered the way the Seed Data landing diorama renders its scene (`SeedData/app/landing/main.js`):

1. **Scene:** a Three.js sky dome, plus cumulus clouds built as clusters of lit puffs. They are lit by a warm sun and a hemisphere light, with soft self-shadows and fog toward the horizon, and they drift east. The scene renders at about 3.2 px per glyph cell into a half-float target, and alpha stores each pixel's material class.
2. **Glyph pass:** each 8×12px tile reads its averaged colour and class, as on the diorama. The tile takes the scene colour. Open sky gets a dot, and cloud gets `. : ~ o O` by how shaded it is, with `| \ - /` along strong edges, inked in a darker shade of the tile's own colour.
3. **Pointer wind:** moving the cursor leaves a short trail of `- \ | /` strokes in the direction of travel.

Slow devices lower the scene resolution once. Reduced-motion visitors get a still sky, and the pointer trail still works for them.

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
