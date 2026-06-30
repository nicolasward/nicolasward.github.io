# LinkedIn banners

Three 1584×396 banners in the landing-page theme — the same radial paper/ink
gradient, the five footer blob palettes, and the real `grain.png` texture.

| File | Look |
| --- | --- |
| `banner-warm.png`  | Light paper — sunset pink, gold, aurora |
| `banner-cool.png`  | Light paper — green, aurora, navy |
| `banner-dark.png`  | Deep navy field with a single aurora glow |

The dark variant keeps the left side dark, so a profile photo (bottom-left)
sits cleanly on it.

## Regenerate

From the repo root (needs `numpy` + `Pillow`, already in `requirements.txt`):

```sh
python3 linkedin-banners/make_banner.py
```

Tweak blob colours/positions or `LIGHT_OP` / `DARK_OP` in `make_banner.py`.
