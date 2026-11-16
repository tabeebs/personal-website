# website v1

Personal website. Plain HTML and CSS, plus one bundled script for the sky.

## Sky

The header is an ASCII sky that matches the reference video. Its palette was sampled from the video's frames:

- **Tiles:** 8×12px cyan tiles with thin white seams. They are deeper toward the top, with big soft patches of deeper blue drifting through.
- **Dots:** each tile of open sky has a small dot, a pale one in light tiles and a heavier dark square in the deep patches.
- **Clouds:** soft white tiles with a fine grey outline, one ring of small, light `( ) ~ _ . '` glyphs where cloud meets sky. Shading lives in the tile colour, so sunlit tops stay white and undersides turn a soft blue-grey.
- **Page:** a soft white panel with a wavering top edge sits behind the content, and the sky melts into the page toward the bottom.

The clouds are real 3D clouds, rendered the way the Seed Data landing diorama renders its scene (`SeedData/app/landing/main.js`). They are clusters of lit puffs in a Three.js scene, lit by a warm sun and a hemisphere light, with soft self-shadows and haze toward the horizon. The scene renders at about 3.2px per glyph cell into a half-float target, with each pixel's material class in alpha. The glyph pass reads it one tile at a time, so every tile knows how much of it is cloud, which side open sky is on, and how shaded it is. Each cloud turns its side profile to the viewer, so clouds high overhead still read as fluffy cumulus. Clouds drift east, and their puffs slowly swell and settle.

**Interactions:**

- **Pointer wind:** moving the cursor leaves a trail of `- \ | /` strokes in the direction of travel that fades over about half a second. Clouds the trail passes near ease a short way off their path, then drift back over a few seconds, so the sky can't be swept clear.
- **Gust:** clicking the sky sends a ring of strokes outward and nudges nearby clouds gently back.

Slow devices lower the scene resolution once. Reduced-motion visitors get a still sky, and the pointer trail still works for them.

## Layout

The page is one screen tall plus the sky above the panel. At the top, the whole panel shows under the clouds. Scrolled to the bottom, the clouds have scrolled away but the panel still shows in full, sitting over the ground. The sky gap and the ground's height scale with the window (`--sky` and `--ground` in `style.css`).

## Ground and meadow

The page has a floor. The sky sits at the top, and at the very bottom the sky's tiles come back as pale green ground (`src/ground.js`), deepening downward with soft patches and a gently rolling top edge. A strip of crayon-drawn ASCII grass and flowers grows along it (`src/meadow.js`), in the same 8×12 tiles as the clouds.

The flowers bloom where it rains:

- **Rain from the sky:** click or tap the sky and rain falls from there. Hold to keep it raining, and drag to move the shower. The rain melts into the page, and a moment later a little cloud gathers over the same spot above the meadow and rains on the flowers below.
- **Rain clouds at the meadow:** rain down here always comes from a cloud, drawn the way the sky draws its clouds and carrying a small patch of sky with it. Tap the space above the grass to call one (hold and drag to lead it), and every so often one drifts over by itself.
- **Bloom:** watered flowers (daisies, tulips, lupins and forget-me-nots) open over about a second, stay open for a while, then close back into buds. Moving the pointer through the meadow bends the grass and makes the flowers lean.

The look comes from risograph crayon drawings. Fills are hatched with short vertical strokes (`| ! : ;`) over a pastel layer printed slightly out of register, with waxy grain and rounded edges. Everything redraws about eight times a second ("on twos"), so the drawing boils like hand-drawn animation. The palette lives in `src/crayon.js` and is shared with the doodles. The ground only draws while it's on screen.

## Links

The links (GitHub, Resume, LinkedIn) each have a crayon rendition of their icon beside them (`src/doodles.js`), drawn in the same crayon language:

- **Resume:** a sheet with a photo and lines of text.
- **GitHub:** the Octocat mark.
- **LinkedIn:** the rounded "in" square.

The Octocat and the letters are bare paper left inside the hatched fill. At rest an icon boils slowly. Hovering its row, focusing its link or tapping it brings it to life: the colour layer slides into register, the resume writes itself out over a second page, the Octocat perks its ears and lifts its tail, and the dot on the "i" hops. Each row is one link, and its leader line is a row of small ASCII dots on the sky's 8px rhythm. As the icon comes to life, a crayon dash in the icon's colour sweeps along it and ends in a little arrow. Off-screen icons don't redraw.

Reduced-motion visitors get still drawings with no boil, and tapping the sky waters the flowers without animated rain.

## Change it

```bash
npm install
npm run build
```

Edit the files in `src/`, then run the build. The `build/` output is committed, because the site itself has no build step. Add `?debug` to the URL to expose the renderer on `window.__sky`, including `step(n)` to run frames by hand.

## Run locally

```bash
npm start
```

Then open http://localhost:5173.
