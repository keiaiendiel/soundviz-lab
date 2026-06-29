# Sound / Image, a laboratory

A clickable research instrument that catalogs the ways sound can be turned into image, light, and motion. **59 live generative specimens** across eleven families, each a different method for making sound visible, drawn as a parametric Canvas2D sketch.

It is a live instrument, not a static page. Turn on the microphone and one signal, a voice, the room, whatever you are listening to, is rendered at once through every visual dialect. Silence reads as stillness, noise as turbulence. With the microphone off, a gentle synthetic signal keeps the catalogue breathing so each visual register stays legible on its own.

## Open it

Open `index.html` in any browser, or visit the live page (GitHub Pages).

## What is inside

Eleven families: oscillographic (Lissajous, line-scan, Rutt-Etra, Fourier epicycles, vector text), spectral (spectrogram, waveform ribbon, FFT, phase-vocoder smear, spectral terrain), cymatic and modal (Chladni, Faraday interference, Faraday caustics, modal plate), fluid and field (schlieren, curl flow, vector field, reaction-diffusion), particle and attractor (swarm, granular, point cloud, de Jong, Lorenz), vibration and matter (drum membrane, vibrating strings, Chladni sand, scanned string), frequency synthesis (epicycles, spatial Fourier, harmonic ladder, Tonnetz), fractal and recursion (Julia, resonance tree, Lichtenberg breakdown), raster glyph text (halftone, glyph field, ASCII, reversible spectrogram, dither, blue-noise stipple), line and geometry (contour, phase rings, vanishing point, moire), texture and feedback (photoelastic, datamosh, slit-scan, gradient bloom, thin-film, ferrofluid).

Several specimens implement real physics and algorithms: Faraday-wave caustics from the surface Jacobian, Newton-ring thin-film interference, the Niemeyer-Pietronero-Wiesmann dielectric-breakdown model, the Rosensweig ferrofluid instability, Floyd-Steinberg error diffusion, void-and-cluster blue noise, Takens delay embedding, the neo-Riemannian Tonnetz, and the Lorenz 1963 system.

## Controls

Click a specimen to open it large with parameter sliders. `live` enters a full-viewport, one-at-a-time pager (swipe or arrows to move, `mic` to listen against the room). Palette switches amber / signal / night / paper. Keys: `space` pause, `m` mic, `t` palette, `[ ]` sensitivity, arrows to move, `esc` close. Works on phones.

## Build

Each specimen is one file in `src/demos/` calling `LAB.register({...})` with a `draw(ctx, w, h, t, params, state, theme, audio)` function. The shell builds its card, thumbnail, detail view, sliders, present slot, and filters automatically.

- Rebuild the single file: `node src/assemble.js index.html`
- Verify every specimen (mock-canvas, catches throws and non-finite geometry): `node src/verify.js src/demos`

## Credit

Antonin Kindl, kindl.work. Visual system from tools.kindl.work (IBM Plex Mono / Serif, DR Krapka pixel, studio blue). Lineage on the page: Pesanek 1928, Vasulka 1974, Granular Synthesis 1994, Judova 2018, Kindl 2026.
