"""Generate LinkedIn banners in the landing-page theme.

Reproduces, pixel-for-pixel where it matters:
  - the radial paper/ink gradient (radial-gradient(120% 120% at 50% 100%, ...))
  - the five footer blob palettes (multi-stop radial discs, heavy blur, low opacity)
  - the real grain.png tile (light theme) / turbulence overlay (dark theme)
"""
import numpy as np
from PIL import Image, ImageFilter

W, H = 1584, 396          # LinkedIn banner
SS = 2                    # supersample for smooth gradient + blobs
GW, GH = W * SS, H * SS

# ---- theme tokens (from landing-page/index.html) ----
LIGHT = dict(field=(255, 255, 255), field_mid=(248, 250, 252))
DARK  = dict(field=(0x0C, 0x0E, 0x14), field_mid=(0x14, 0x18, 0x26))

# blob palettes: (core, mid, outer) — stops at 0% / 42% / 72%, transparent at 74%
PALETTE = {
    "sunset": ((0xFF, 0xCB, 0xDD), (0xFF, 0x6F, 0x9C), (0xFF, 0xB0, 0x70)),
    "aurora": ((0xCD, 0xC6, 0xFF), (0x81, 0x66, 0xEC), (0xFF, 0x7C, 0xC0)),
    "green":  ((0x9F, 0xF0, 0xC2), (0x34, 0xC7, 0x7B), (0x5F, 0xD0, 0xD9)),
    "gold":   ((0xFF, 0xF1, 0xA6), (0xEB, 0xC5, 0x3A), (0xFF, 0xC9, 0x3D)),
    "navy":   ((0xAE, 0xB8, 0xF0), (0x3A, 0x4E, 0xAE), (0x5B, 0x86, 0xEF)),
    # Extras for the cool banner — a luminous cyan and a peach-coral warm accent
    # (a yellow-orange would wash to cream atop the light cyan; coral stays warm).
    "cyan":   ((0xCB, 0xFB, 0xF1), (0x4F, 0xD6, 0xD0), (0x5A, 0x9E, 0xEF)),
    "coral":  ((0xFF, 0xE4, 0xC8), (0xFF, 0xA8, 0x66), (0xFF, 0x73, 0x2E)),
}


def gradient(field, field_mid):
    """radial-gradient(120% 120% at 50% 100%, field 0%, field_mid 60%, field 100%)."""
    ys, xs = np.mgrid[0:GH, 0:GW].astype(np.float64)
    cx, cy = 0.5 * GW, 1.0 * GH
    rx, ry = 1.2 * GW, 1.2 * GH
    d = np.sqrt(((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2)
    d = np.clip(d, 0, 1)
    f = np.array(field, float) / 255.0
    m = np.array(field_mid, float) / 255.0
    out = np.empty((GH, GW, 3), float)
    lo = d <= 0.6
    t = (d[lo] / 0.6)[:, None]
    out[lo] = f * (1 - t) + m * t
    hi = ~lo
    t = ((d[hi] - 0.6) / 0.4)[:, None]
    out[hi] = m * (1 - t) + f * t
    return out


def blob(diam, core, mid, outer):
    """A single blurred disc layer (RGBA float, premultiplied-friendly)."""
    rEnd = 0.891 * diam            # gradient's 100% radius (farthest-corner)
    s1, s2, s3 = 0.42 * rEnd, 0.72 * rEnd, 0.74 * rEnd
    margin = int(diam * 0.45)
    size = int(s3 * 2 + margin * 2)
    c = size / 2.0
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float64)
    dist = np.sqrt((xs - c) ** 2 + (ys - c) ** 2)
    core, mid, outer = map(lambda v: np.array(v, float) / 255.0, (core, mid, outer))
    rgb = np.empty((size, size, 3), float)
    a = np.zeros((size, size), float)
    # 0 -> s1 : core -> mid
    m0 = dist <= s1
    t = (dist[m0] / s1)[:, None]
    rgb[m0] = core * (1 - t) + mid * t
    a[m0] = 1
    # s1 -> s2 : mid -> outer
    m1 = (dist > s1) & (dist <= s2)
    t = ((dist[m1] - s1) / (s2 - s1))[:, None]
    rgb[m1] = mid * (1 - t) + outer * t
    a[m1] = 1
    # s2 -> s3 : outer, alpha 1 -> 0
    m2 = (dist > s2) & (dist <= s3)
    t = (dist[m2] - s2) / (s3 - s2)
    rgb[m2] = outer
    a[m2] = 1 - t
    layer = np.dstack([rgb, a])
    img = Image.fromarray((np.clip(layer, 0, 1) * 255).astype(np.uint8), "RGBA")
    sigma = diam * 0.155
    img = img.filter(ImageFilter.GaussianBlur(sigma))
    return np.asarray(img, float) / 255.0


LIGHT_OP = 0.42
DARK_OP = 0.50


def place(base, layer_rgba, cx, cy, opacity, mode="normal"):
    """Composite a blob layer centred at (cx, cy) onto base RGB (float 0..1)."""
    lh, lw = layer_rgba.shape[:2]
    x0, y0 = int(cx - lw / 2), int(cy - lh / 2)
    bx0, by0 = max(0, x0), max(0, y0)
    bx1, by1 = min(GW, x0 + lw), min(GH, y0 + lh)
    if bx1 <= bx0 or by1 <= by0:
        return
    lx0, ly0 = bx0 - x0, by0 - y0
    sub = layer_rgba[ly0:ly0 + (by1 - by0), lx0:lx0 + (bx1 - bx0)]
    rgb = sub[..., :3]
    a = sub[..., 3:4] * opacity
    dst = base[by0:by1, bx0:bx1]
    if mode == "screen":
        blended = 1 - (1 - dst) * (1 - rgb)
    else:
        blended = rgb
    base[by0:by1, bx0:bx1] = dst * (1 - a) + blended * a


def add_grain_light(img):
    """Tile the real grain.png at 130px (its on-site size) and overlay normally."""
    grain = Image.open("landing-page/grain.png").convert("LA").resize((130, 130), Image.LANCZOS)
    tile = np.asarray(grain, float) / 255.0          # (130,130,2): L, A
    reps = (H // 130 + 2, W // 130 + 2)
    L = np.tile(tile[..., 0], reps)[:H, :W]
    A = np.tile(tile[..., 1], reps)[:H, :W]
    base = np.asarray(img, float) / 255.0
    g = L[..., None]
    a = A[..., None]
    out = base * (1 - a) + g * a
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGB")


def add_grain_dark(img, seed):
    """Monochrome fractal-ish noise, overlay-blended at 0.6 (matches the dark CSS)."""
    rng = np.random.default_rng(seed)
    n = rng.random((H, W))
    # a touch of smoothing so it reads as film grain, not pure static
    n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5)), float) / 255.0
    # Compress the noise hard toward mid-grey: overlay with values near 0.5 barely
    # perturbs, so a tight amplitude gives fine, subtle grain — not static.
    n = 0.5 + (n - 0.5) * 0.34
    base = np.asarray(img, float) / 255.0
    nl = n[..., None]
    overlay = np.where(base < 0.5, 2 * base * nl, 1 - 2 * (1 - base) * (1 - nl))
    out = base * (1 - 0.55) + overlay * 0.55
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGB")


def render_light(blobs, name):
    base = gradient(**LIGHT)
    for spec in blobs:
        colour, (fx, fy), scale = spec[0], spec[1], spec[2]
        op = spec[3] if len(spec) > 3 else LIGHT_OP   # optional per-blob opacity
        core, mid, outer = PALETTE[colour]
        layer = blob(int(GH * scale), core, mid, outer)
        place(base, layer, fx * GW, fy * GH, opacity=op, mode="normal")
    img = Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8), "RGB").resize((W, H), Image.LANCZOS)
    img = add_grain_light(img)
    img.save(name, "PNG")
    print("wrote", name)


def render_dark(colour, pos, name, seed):
    base = gradient(**DARK)
    core, mid, outer = PALETTE[colour]
    layer = blob(int(GH * 1.9), core, mid, outer)     # one large glow, like the dark page
    place(base, layer, pos[0] * GW, pos[1] * GH, opacity=DARK_OP, mode="screen")
    img = Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8), "RGB").resize((W, H), Image.LANCZOS)
    img = add_grain_dark(img, seed)
    img.save(name, "PNG")
    print("wrote", name)


def _hexrgb(h):
    return np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255], float) / 255.0


def _smooth_noise(cells, seed):
    """Smooth value noise in [-0.5, 0.5]; `cells` sets the number of undulations."""
    rng = np.random.default_rng(seed)
    cols = max(2, cells)
    rows = max(2, int(cells * GH / GW))
    low = rng.random((rows, cols))
    img = Image.fromarray((low * 255).astype(np.uint8)).resize((GW, GH), Image.BICUBIC)
    return np.asarray(img, float) / 255.0 - 0.5


def render_aurora(anchors, name, sigma, warp, max_alpha, seed, k):
    """A continuous, smoothly-merged colour field (no disc seams).

    Each pixel is a Gaussian-weighted, *normalised* blend of all colour anchors,
    so neighbouring hues melt together with no hard edges; a low-frequency domain
    warp bends the bands into gentle waves. High k = full coverage (no white
    corners); airiness comes from max_alpha, not from gaps in the field.
    """
    base = gradient(**LIGHT)
    ys, xs = np.mgrid[0:GH, 0:GW].astype(np.float64)
    xn = xs / GW + warp * _smooth_noise(7, seed)
    yn = ys / GH + warp * 1.5 * _smooth_noise(9, seed + 9)
    num = np.zeros((GH, GW, 3))
    den = np.zeros((GH, GW, 1))
    for colour, (fx, fy), w in anchors:
        d2 = (xn - fx) ** 2 + ((yn - fy) * 0.5) ** 2   # aspect-aware falloff
        wi = (w * np.exp(-d2 / (2 * sigma ** 2)))[..., None]
        num += wi * colour
        den += wi
    field = num / np.maximum(den, 1e-6)
    alpha = (1 - np.exp(-den * k)) * max_alpha
    out = base * (1 - alpha) + field * alpha
    img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGB").resize((W, H), Image.LANCZOS)
    img = add_grain_light(img)
    img.save(name, "PNG")
    print("wrote", name)


OUT = "linkedin-banners"
# Variant 1 — light, warm (sunset / gold / aurora)
render_light([
    ("sunset", (0.12, 0.30), 1.25),
    ("gold",   (0.52, 0.92), 1.2),
    ("aurora", (0.90, 0.34), 1.3),
], f"{OUT}/banner-warm.png")

# Variant 2 — cool aurora: green → teal → blue → a soft lilac, all smoothly
# merged (no disc seams) with a gentle wave warp. Ethereal, futuristic.
_AUR_GREEN, _AUR_TEAL, _AUR_CYAN, _AUR_BLUE, _AUR_DEEP, _AUR_VIO = (
    _hexrgb(0x54D6A0), _hexrgb(0x2FC6C9), _hexrgb(0x4AA6F0),
    _hexrgb(0x5E7CEC), _hexrgb(0x4E62D8), _hexrgb(0x8A6FE6))
render_aurora([
    (_AUR_GREEN, (0.00, 0.64), 1.0),
    (_AUR_TEAL,  (0.20, 0.32), 1.0),
    (_AUR_CYAN,  (0.40, 0.70), 1.0),
    (_AUR_VIO,   (0.58, 0.20), 0.75),
    (_AUR_BLUE,  (0.74, 0.62), 1.0),
    (_AUR_DEEP,  (0.99, 0.36), 1.05),
    (_AUR_BLUE,  (0.92, 0.92), 0.8),   # fill bottom-right (no white corner)
    (_AUR_VIO,   (0.84, 0.02), 0.55),  # fill top-right
], f"{OUT}/banner-cool.png", sigma=0.17, warp=0.15, max_alpha=0.48, seed=5, k=5.0)

# Variant 3 — dark, single aurora glow
render_dark("aurora", (0.70, 0.45), f"{OUT}/banner-dark.png", seed=7)


# ---- Plain + single-blob set (light mode only) ----
# Plain: exactly the light-mode blog background — gradient + grain, no blob.
render_light([], f"{OUT}/banner-plain.png")

# One banner per on-site blob palette, the blob set towards the right, at the
# site's own 0.35 opacity over the same background.
for _colour in ("sunset", "aurora", "green", "gold", "navy"):
    render_light([(_colour, (0.80, 0.46), 1.5, 0.35)], f"{OUT}/banner-blob-{_colour}.png")
