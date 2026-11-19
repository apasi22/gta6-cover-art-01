# Vice Cover Studio — GTA-style cover art maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/apasi22/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/apasi22/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Built for the [make.fun bounty](https://make.fun/bounty/gta6-cover-art-01).

Vice Cover Studio turns your own photos and a caption into cover art in the
style of a Vice City poster: multi-panel layouts, bold caption lettering, a
sunset or neon colour grade, and a PNG export to share.

- **Any photo:** add photos from your machine (never uploaded) or use the two
  free sample photos, then crop and position each one per panel.
- **Multi-panel layouts:** Hero split, Quad, Strip and Poster — fill several
  panels with one photo or several.
- **Caption & grade:** write your own title and subtitle, pick Sunset, Neon
  or Midnight.
- **Fast export:** one click exports a PNG in 1920 × 1080, 1080 × 1350 or
  1080 × 1080.

## How to run it

Serve the `app/` folder with any static HTTP server and open
`app/index.html` in desktop Chrome. It works fully offline — no network
requests, no account, nothing to install.

To build the hand-in:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
