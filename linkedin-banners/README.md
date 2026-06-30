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
