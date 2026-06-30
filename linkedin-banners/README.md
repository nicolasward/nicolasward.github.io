# LinkedIn banners

Three 1584×396 banners in the landing-page theme — the same radial paper/ink
gradient, the five footer blob palettes, and the real `grain.png` texture.

### Thematic variants

| File | Look |
| --- | --- |
| `banner-warm.png`  | Light paper — sunset pink, gold, aurora |
| `banner-cool.png`  | Light paper — green → cyan → blue, coral accent |
| `banner-dark.png`  | Deep navy field with a single aurora glow |

The dark variant keeps the left side dark, so a profile photo (bottom-left)
sits cleanly on it.

### Aurora set (light mode)

Buttery, seam-free colour fields — each pixel is a normalised Gaussian blend of
six hues, gently warped into waves. Same geometry, five colourways.

| File | Flow |
| --- | --- |
| `banner-aurora-cool.png`   | green → teal → blue → violet |
| `banner-aurora-meadow.png` | lime → green → teal → aqua |
| `banner-aurora-dusk.png`   | sky → blue → violet → pink |
| `banner-aurora-sunset.png` | gold → peach → coral → pink |
| `banner-aurora-iris.png`   | teal → blue → violet → pink → peach (full spectrum) |

`banner-cool.png` is the same image as `banner-aurora-cool.png`.

### Plain + single-blob set (light mode)

Same light-mode blog background (gradient + grain) everywhere; the colour
washes in from the right, so the bottom-left stays clear for a profile photo.

| File | Look |
| --- | --- |
| `banner-plain.png`        | Just the background — no blob |
| `banner-blob-sunset.png`  | Pink wash, right |
| `banner-blob-aurora.png`  | Lilac wash, right |
| `banner-blob-green.png`   | Green/teal wash, right |
| `banner-blob-gold.png`    | Champagne wash, right |
| `banner-blob-navy.png`    | Periwinkle-blue wash, right |

## Regenerate

From the repo root (needs `numpy` + `Pillow`, already in `requirements.txt`):

```sh
python3 linkedin-banners/make_banner.py
```

Tweak blob colours/positions or `LIGHT_OP` / `DARK_OP` in `make_banner.py`.
