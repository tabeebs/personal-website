# website v1

Personal website, built from scratch as plain HTML, CSS and JavaScript (no build step).

## Sky

The page header is an animated ASCII sky drawn with WebGL2 (`sky.js`). It works the same way as the Seed Data diorama: render a real image first, then turn it into ASCII.

1. **Scene pass:** a lit sky, rendered at two texels per character cell. Cumulus clouds come from domain-warped fbm noise, with two layers drifting right at different speeds. Light is marched toward the sun, so cloud tops are bright white and the undersides fall into blue-grey shadow.
2. **ASCII pass:** for every 8×12px cell, it samples the scene colour and picks a glyph from the cell's brightness (`. : ~ o O`), using edge direction (`| \ - /`) along strong cloud edges. The glyph is inked in a darker shade of the cell's own colour, so the picture stays photographic.
3. **Cursor wind:** moving the pointer stamps `- \ | /` characters in the direction of motion, and they fade out.
4. **Fade and panel:** the sky melts into the page toward the bottom, and a soft white panel with a wavering top edge sits behind the content.

Add `?scene` to the URL to see the lit sky before the ASCII pass, which is handy when tuning clouds. With `prefers-reduced-motion`, the sky is still and only the cursor trail moves.

## Run locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173.
