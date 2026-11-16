# website v1

Personal website. Plain HTML and CSS, plus one bundled script for the sky.

## Sky

The header is an ASCII sky that matches the reference video. Its palette was sampled from the video's frames:

- **Tiles:** 8×12px cyan tiles with thin white seams. They are deeper toward the top, with big soft patches of deeper blue drifting through.
- **Dots:** each tile of open sky has a small dot, a pale one in light tiles and a heavier dark square in the deep patches.
- **Clouds:** clean white tiles outlined in `( ) ; : ~ _ '`, with heavier `o 8` glyphs in their shaded undersides.
- **Page:** a soft white panel with a wavering top edge sits behind the content, and the sky melts into the page toward the bottom.

The clouds are real 3D clouds, rendered the way the Seed Data landing diorama renders its scene (`SeedData/app/landing/main.js`). They are clusters of lit puffs in a Three.js scene, lit by a warm sun and a hemisphere light, with soft self-shadows and haze toward the horizon. The scene renders at about 3.2px per glyph cell into a half-float target, with each pixel's material class in alpha. The glyph pass reads it one tile at a time, so every tile knows how much of it is cloud, which side open sky is on, and how shaded it is. Each cloud turns its side profile to the viewer, so clouds high overhead still read as fluffy cumulus. Clouds drift east, and their puffs slowly swell and settle.

**Interactions:**

- **Pointer wind:** moving the cursor leaves a trail of `- \ | /` strokes in the direction of travel that fades over about half a second. Clouds the trail passes near get nudged along.
- **Gust:** clicking the sky sends a ring of strokes outward and blows nearby clouds back. They then drift back into their places.

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
