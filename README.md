# website v1

Personal website, built from scratch as plain HTML, CSS and JavaScript (no build step).

## Sky

The page header is an animated ASCII sky drawn on a `<canvas>` (`sky.js`):

- a grid of 8×12px cells with white seams, tinted in soft blue patches that drift slowly
- clouds made of glyphs (`. ' : ; ~ ( ) o 8`) that drift to the right and change shape over time, with heavier glyphs on the shaded underside
- a cursor wind trail: moving the pointer stamps `- \ | /` characters in the direction of motion, and they fade out
- the sky fades into the page toward the bottom, and a soft white panel with a wavering top edge sits behind the content
- with `prefers-reduced-motion`, the sky is still and only the cursor trail moves

## Run locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173.
