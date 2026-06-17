#!/usr/bin/env python3
"""Static site generator for the blog."""

import json
import os
import re
import shutil
import math
import html
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

import markdown

ROOT = Path(__file__).parent
POSTS_DIR = ROOT / "posts"
PAGES_DIR = ROOT / "pages"
TEMPLATES_DIR = ROOT / "templates"
OUTPUT_DIR = ROOT / "_site"
LANDING_DIR = ROOT / "landing-page"
CSS_DIR = ROOT / "css"

# The blog lives under this path; the landing page is served at the site root.
BASE_PATH = "/blog"
BLOG_DIR = OUTPUT_DIR / BASE_PATH.strip("/")

SITE_TITLE = "Nico Ward"
SITE_URL = "https://nicolasward.github.io"

# Share buttons -------------------------------------------------------------
_ICON_LINKEDIN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
_ICON_X = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>'
_ICON_WHATSAPP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.412 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.449L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>'
_ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/></svg>'
_ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>'
_ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
# Matter (read-later): bookmark glyph standing in for the brand mark — swap in
# the official SVG path here if desired.
_ICON_MATTER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"/></svg>'


def share_row(url, title):
    """A row of share buttons: LinkedIn, X, email, and copy-link."""
    u = quote(url, safe="")
    t = quote(title, safe="")
    linkedin = f"https://www.linkedin.com/sharing/share-offsite/?url={u}"
    x = f"https://twitter.com/intent/tweet?url={u}&text={t}"
    whatsapp = f"https://wa.me/?text={quote(title + ' ' + url, safe='')}"
    email = f"mailto:?subject={t}&body={u}"
    matter = f"https://hq.getmatter.com/share?url={u}"
    return (
        '<div class="post-share">'
        f'<a class="share-btn" href="{linkedin}" target="_blank" rel="noopener" aria-label="Share on LinkedIn" title="Share on LinkedIn">{_ICON_LINKEDIN}</a>'
        f'<a class="share-btn" href="{x}" target="_blank" rel="noopener" aria-label="Share on X" title="Share on X">{_ICON_X}</a>'
        f'<a class="share-btn" href="{whatsapp}" target="_blank" rel="noopener" aria-label="Share on WhatsApp" title="Share on WhatsApp">{_ICON_WHATSAPP}</a>'
        f'<a class="share-btn" href="{email}" aria-label="Share by email" title="Share by email">{_ICON_MAIL}</a>'
        f'<a class="share-btn" href="{matter}" target="_blank" rel="noopener" aria-label="Save to Matter" title="Save to Matter">{_ICON_MATTER}</a>'
        '<button class="share-btn share-copy" type="button" aria-label="Copy link" title="Copy link">'
        f'<span class="icon-link">{_ICON_LINK}</span><span class="icon-check">{_ICON_CHECK}</span>'
        '</button>'
        '</div>'
    )

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def read_template(name):
    return (TEMPLATES_DIR / name).read_text()


def parse_frontmatter(text):
    """Parse YAML-ish frontmatter between --- delimiters."""
    meta = {}
    content = text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            for line in parts[1].strip().splitlines():
                if ":" in line:
                    key, val = line.split(":", 1)
                    val = val.strip().strip('"').strip("'")
                    if key.strip() == "tags":
                        meta[key.strip()] = [t.strip().lower() for t in val.split(",")]
                    else:
                        meta[key.strip()] = val
            content = parts[2].strip()
    return meta, content


def estimate_read_time(text):
    words = len(re.findall(r'\w+', text))
    return max(1, math.ceil(words / 250))


def slugify(title):
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug).strip('-')
    return slug


def strip_markdown(text):
    """Reduce markdown body to plain searchable text."""
    text = re.sub(r'```[\s\S]*?```', ' ', text)          # code blocks
    text = re.sub(r'`[^`]*`', ' ', text)                  # inline code
    text = re.sub(r'!\[[^\]]*\]\([^)]+\)', ' ', text)     # images
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # links → keep label
    text = re.sub(r'[#>*_~`]', '', text)                  # markup chars
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def prefix_internal_links(html, slug_set, base):
    """Rewrite internal post links (href="/slug") to sit under the base path.
    Leaves the landing-page root link (href="/") and external links alone."""
    def repl(m):
        target = m.group(1)
        if target in slug_set or target in ("about",):
            return f'href="{base}/{target}"'
        return m.group(0)
    return re.sub(r'href="/([^"#/]+)"', repl, html)


def add_heading_anchors(html):
    """Add anchor links to h2 and h3 elements."""
    def replacer(m):
        tag = m.group(1)
        content = m.group(2)
        anchor_id = slugify(re.sub(r'<[^>]+>', '', content))
        return f'<{tag} id="{anchor_id}">{content} <a class="heading-anchor" href="#{anchor_id}">#</a></{tag}>'
    return re.sub(r'<(h[23])>(.*?)</\1>', replacer, html)


def render(template_str, **kwargs):
    result = template_str
    for key, val in kwargs.items():
        result = result.replace("{{" + key + "}}", str(val))
    return result


def format_date_long(date_str):
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.strftime("%B %d, %Y")


def format_date_list(date_str):
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return f'{dt.year}<span class="separator">&middot;</span>{dt.strftime("%m")}'


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def pixel_separator(message="think"):
    """A blocky, glitchy pixel rule above the inline newsletter — and a hidden
    message. Each column is one bit of the message in 8-bit ASCII, read left to
    right: a TOP cell means 1, a BOTTOM cell means 0. (It currently spells
    "think".) Same-bit columns merge into runs so the band reads as a clean glitch
    waveform. Inherits its colour from `currentColor`."""
    bits = "".join(format(ord(c), "08b") for c in message)
    top = bits                                        # 1 → top track
    bot = "".join("0" if b == "1" else "1" for b in bits)  # 0 → bottom track
    def runs(bits, y):
        out, i, n = [], 0, len(bits)
        while i < n:
            if bits[i] == "1":
                j = i
                while j < n and bits[j] == "1":
                    j += 1
                out.append(f'<rect x="{i}" y="{y}" width="{j - i}" height="1"/>')
                i = j
            else:
                i += 1
        return out
    rects = "".join(runs(top, 0) + runs(bot, 1))
    return (f'<svg class="ns-pixels" viewBox="0 0 {len(top)} 2" fill="currentColor" '
            f'shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet" '
            f'aria-hidden="true">{rects}</svg>')


def newsletter_section():
    """Email signup block (custom UI). Runs in demo mode until an endpoint is set
    on the form via data-endpoint — see the newsletter handler in site.js."""
    return '''<section class="newsletter" aria-labelledby="newsletter-heading">
  <div class="newsletter-card">
    <div class="newsletter-separator" aria-hidden="true">''' + "".join(
        pixel_separator(w) for w in ["think", "craft", "cogito", "helloworld", "renaissance"]
    ) + '''</div>
    <div class="newsletter-intro">
      <h2 class="newsletter-heading" id="newsletter-heading">New essays in your inbox.</h2>
      <p class="newsletter-dek">Human-typed essays about AI, learning, and design to supercharge your thinking.</p>
    </div>
    <form class="newsletter-form" data-endpoint="" novalidate>
      <div class="newsletter-field">
        <input class="newsletter-input" type="email" name="email" inputmode="email"
               autocomplete="email" spellcheck="false" placeholder="you@example.com"
               aria-label="Email address" required>
        <input class="newsletter-gotcha" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="newsletter-submit" type="submit" aria-label="Subscribe">
          <svg class="ns-state ns-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="ns-mark-path" d="M9 6 L15 12 L9 18" pathLength="100"/></svg>
        </button>
      </div>
      <p class="newsletter-msg" role="status" aria-live="polite"></p>
    </form>
    <span class="newsletter-shine" aria-hidden="true"></span>
  </div>
</section>'''



def build():
    # Clean output
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir()

    # Landing page → site root (index.html + its assets). Old template baggage
    # that nothing references (Font Awesome, jQuery plugins, legacy scripts) is
    # left out of the artifact entirely.
    LANDING_EXCLUDE = {".DS_Store", "fa", "plugins", "scripts"}
    if LANDING_DIR.exists():
        for item in LANDING_DIR.iterdir():
            if item.name in LANDING_EXCLUDE:
                continue
            dest = OUTPUT_DIR / item.name
            if item.is_dir():
                shutil.copytree(item, dest,
                                ignore=shutil.ignore_patterns(".DS_Store"))
            else:
                shutil.copy2(item, dest)

    # Tell GitHub Pages not to run Jekyll over the output
    (OUTPUT_DIR / ".nojekyll").write_text("")

    # Blog lives under /blog
    BLOG_DIR.mkdir(parents=True, exist_ok=True)

    # --- CSS / JS: minify where the minifiers are available (they're in
    # requirements.txt, so CI always minifies; a bare local env still builds,
    # just unminified). Output is byte-identical in rendering either way.
    try:
        from rcssmin import cssmin as _cssmin
    except ImportError:
        _cssmin = lambda s: s
    try:
        from rjsmin import jsmin as _jsmin
    except ImportError:
        _jsmin = lambda s: s

    import hashlib
    def _hash(text):
        return hashlib.md5(text.encode("utf-8")).hexdigest()[:8]

    # Copy CSS (minified)
    css_out = BLOG_DIR / "css"
    css_out.mkdir()
    css_ver = {}
    for f in CSS_DIR.glob("*.css"):
        minified = _cssmin(f.read_text(encoding="utf-8"))
        (css_out / f.name).write_text(minified, encoding="utf-8")
        css_ver[f.name] = _hash(minified)

    base_tpl = read_template("base.html")
    home_tpl = read_template("home.html")
    post_tpl = read_template("post.html")
    page_tpl = read_template("page.html")

    # Site JS: one shared, cacheable file instead of inline scripts repeated in
    # every page's HTML (smaller pages; the JS is fetched once and cached).
    js_out = BLOG_DIR / "js"
    js_out.mkdir()
    site_js = _jsmin(render(read_template("site.js"), base=BASE_PATH))
    (js_out / "site.js").write_text(site_js, encoding="utf-8")

    # Cache-bust the stylesheets and JS with a content hash so browsers always
    # fetch the latest copy after a change, and cache it indefinitely otherwise.
    base_tpl = base_tpl.replace('css/style.css"', f'css/style.css?v={css_ver["style.css"]}"')
    base_tpl = base_tpl.replace('css/flexoki.css"', f'css/flexoki.css?v={css_ver["flexoki.css"]}"')
    base_tpl = base_tpl.replace('js/site.js"', f'js/site.js?v={_hash(site_js)}"')

    # The "/ Writing" header link points back to the blog index. It appears on
    # every part of the blog, not just on individual articles.
    writing_nav = f'<a href="{BASE_PATH}" class="nav-section-link"><span class="nav-slash">/</span> <span class="nav-label">Writing</span></a>'

    md = markdown.Markdown(extensions=["extra", "meta", "toc"])

    # --- Build posts ---
    posts = []
    for filepath in sorted(POSTS_DIR.glob("*.md")):
        raw = filepath.read_text()
        meta, body = parse_frontmatter(raw)
        md.reset()
        html_content = md.convert(body)
        html_content = add_heading_anchors(html_content)

        slug = meta.get("slug", filepath.stem)
        title = meta.get("title", filepath.stem.replace("-", " ").title())
        date = meta.get("date", "2024-01-01")
        tags = meta.get("tags", [])

        posts.append({
            "slug": slug,
            "title": title,
            "date": date,
            "tags": tags,
            "html": html_content,
            "body": body,
            "read_time": estimate_read_time(body),
        })

    # Sort newest first
    posts.sort(key=lambda p: p["date"], reverse=True)

    # --- Build backlinks index ---
    # For each post, find which other posts link to it via internal links
    slug_set = {p["slug"] for p in posts}
    # Map slug -> list of posts that link TO it
    backlinks = {p["slug"]: [] for p in posts}
    for post in posts:
        # Scan the raw HTML for internal links like href="/some-slug"
        linked_slugs = set(re.findall(r'href="/([^"/#]+)"', post["html"]))
        for target_slug in linked_slugs:
            if target_slug in slug_set and target_slug != post["slug"]:
                backlinks[target_slug].append(post)

    # Also scan the raw markdown for markdown-style links like [text](/slug)
    for filepath in POSTS_DIR.glob("*.md"):
        raw = filepath.read_text()
        meta, body = parse_frontmatter(raw)
        source_slug = meta.get("slug", filepath.stem)
        md_links = set(re.findall(r'\]\(/([^)/#]+)\)', body))
        for target_slug in md_links:
            if target_slug in slug_set and target_slug != source_slug:
                # Avoid duplicates
                source_post = next((p for p in posts if p["slug"] == source_slug), None)
                if source_post and source_post not in backlinks[target_slug]:
                    backlinks[target_slug].append(source_post)

    # Helper to get first 1-2 sentences for excerpt
    def get_excerpt(post_slug):
        for fp in POSTS_DIR.glob("*.md"):
            raw_text = fp.read_text()
            m, b = parse_frontmatter(raw_text)
            if m.get("slug", fp.stem) == post_slug:
                plain = re.sub(r'[#*_\[\]()]', '', b).strip()
                sentences = re.split(r'(?<=[.!?])\s', plain)
                return sentences[0] if sentences else ""
        return ""

    # Write individual post pages
    for i, post in enumerate(posts):
        # Chronological siblings (posts are sorted newest-first) for mobile
        # swipe navigation: swipe right → newer, swipe left → older.
        newer = posts[i - 1] if i > 0 else None
        older = posts[i + 1] if i < len(posts) - 1 else None

        # Related posts: pick up to 3 others
        others = [p for j, p in enumerate(posts) if j != i]
        related_html = ""
        for rp in others[:3]:
            related_html += f'<li><a href="{BASE_PATH}/{rp["slug"]}">{rp["title"]}</a></li>\n'

        # Build linked mentions section
        mentions = backlinks.get(post["slug"], [])
        linked_mentions_html = ""
        if mentions:
            cards_html = ""
            for mp in mentions:
                excerpt = get_excerpt(mp["slug"])
                cards_html += f'''<a href="{BASE_PATH}/{mp["slug"]}" class="mention-card">
  <span class="mention-title">{mp["title"]}</span>
  <span class="mention-excerpt">{excerpt}</span>
</a>\n'''
            linked_mentions_html = f'''<div class="linked-mentions">
  <h2 class="eyebrow">Linked mentions</h2>
  <div class="mention-grid">
    {cards_html}
  </div>
</div>'''

        post_html = render(
            post_tpl,
            title=post["title"],
            date_formatted=format_date_long(post["date"]),
            read_time=str(post["read_time"]),
            content=prefix_internal_links(post["html"], slug_set, BASE_PATH),
            related_posts=related_html,
            linked_mentions=linked_mentions_html,
            newsletter=newsletter_section(),
            share=share_row(f"{SITE_URL}{BASE_PATH}/{post['slug']}", post["title"]),
            newer_url=(f"{BASE_PATH}/{newer['slug']}" if newer else ""),
            newer_title=(html.escape(newer["title"], quote=True) if newer else ""),
            older_url=(f"{BASE_PATH}/{older['slug']}" if older else ""),
            older_title=(html.escape(older["title"], quote=True) if older else ""),
        )

        page_html = render(
            base_tpl,
            base=BASE_PATH,
            title=f'{post["title"]} — {SITE_TITLE}',
            content=post_html,
            nav_section=writing_nav,
            body_class="article",
        )

        post_dir = BLOG_DIR / post["slug"]
        post_dir.mkdir(parents=True, exist_ok=True)
        (post_dir / "index.html").write_text(page_html)

    # --- Build homepage ---
    # Latest post section
    latest = posts[0] if posts else None
    latest_section = ""
    if latest:
        # Get first sentence of the markdown content for excerpt
        raw_latest = (POSTS_DIR / f"{latest['slug']}.md").read_text() if (POSTS_DIR / f"{latest['slug']}.md").exists() else ""
        if not raw_latest:
            # Try to find the file by iterating
            for fp in POSTS_DIR.glob("*.md"):
                raw_tmp = fp.read_text()
                meta_tmp, _ = parse_frontmatter(raw_tmp)
                if meta_tmp.get("slug", fp.stem) == latest["slug"]:
                    raw_latest = raw_tmp
                    break
        _, latest_body = parse_frontmatter(raw_latest)
        # Extract first sentence from plain text
        plain = re.sub(r'[#*_\[\]()]', '', latest_body).strip()
        first_sentence = re.split(r'(?<=[.!?])\s', plain)[0] if plain else ""

        latest_section = f'''<div class="home-section">
  <span class="section-label eyebrow">Latest</span>
  <a href="{BASE_PATH}/{latest["slug"]}" class="latest-card">
    <h1 class="latest-title">{latest["title"]}</h1>
    <div class="latest-meta">{format_date_long(latest["date"])} <span class="separator">&middot;</span> {latest["read_time"]} minute read</div>
    <p class="latest-excerpt">{first_sentence} <span class="keep-reading">Keep reading &rarr;</span></p>
  </a>
</div>
<hr class="section-divider">'''

    post_items = ""
    for post in posts:
        date_html = format_date_list(post["date"])
        post_items += (
            f'<li><span class="post-date">{date_html}</span> '
            f'<a href="{BASE_PATH}/{post["slug"]}">{post["title"]}</a></li>\n'
        )

    # Collect all tags — only those actually present in posts
    all_tags = sorted(set(tag for p in posts for tag in p["tags"]))
    topic_links = ", ".join(f'<a href="#" data-search="{tag}">{tag}</a>' for tag in all_tags)

    home_html = render(home_tpl, post_items=post_items, topic_links=topic_links, latest_section=latest_section, newsletter=newsletter_section())
    index_html = render(base_tpl, base=BASE_PATH, title=SITE_TITLE, content=home_html, nav_section=writing_nav, body_class="home")
    (BLOG_DIR / "index.html").write_text(index_html)

    # --- Build static pages ---
    static_pages = []
    if PAGES_DIR.exists():
        for filepath in PAGES_DIR.glob("*.md"):
            raw = filepath.read_text()
            meta, body = parse_frontmatter(raw)
            md.reset()
            html_content = md.convert(body)

            slug = meta.get("slug", filepath.stem)
            title = meta.get("title", filepath.stem.replace("-", " ").title())

            pg_html = render(page_tpl, title=title, content=prefix_internal_links(html_content, slug_set, BASE_PATH))
            full_html = render(base_tpl, base=BASE_PATH, title=f'{title} — {SITE_TITLE}', content=pg_html, nav_section=writing_nav, body_class="page")

            pg_dir = BLOG_DIR / slug
            pg_dir.mkdir(parents=True, exist_ok=True)
            (pg_dir / "index.html").write_text(full_html)

            static_pages.append({
                "slug": slug,
                "title": title,
                "body": body,
            })

    # --- Build search index (used by global search + tag-page live filter) ---
    search_index = [{
        "slug": p["slug"],
        "type": "post",
        "title": p["title"],
        "date": p["date"],
        "tags": p["tags"],
        "text": strip_markdown(p["body"]),
    } for p in posts]
    search_index += [{
        "slug": pg["slug"],
        "type": "page",
        "title": pg["title"],
        "date": "",
        "tags": [],
        "text": strip_markdown(pg["body"]),
    } for pg in static_pages]
    (BLOG_DIR / "search-index.json").write_text(json.dumps(search_index))

    # --- Build RSS feed ---
    rss_items = ""
    for post in posts[:10]:
        rss_items += f"""  <item>
    <title>{post["title"]}</title>
    <link>{BASE_PATH}/{post["slug"]}</link>
    <pubDate>{post["date"]}</pubDate>
    <description><![CDATA[{post["html"][:500]}]]></description>
  </item>
"""
    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>{SITE_TITLE}</title>
  <description>Thoughts on design, technology, and building things.</description>
{rss_items}</channel>
</rss>"""
    (BLOG_DIR / "feed.xml").write_text(rss)

    print(f"Built {len(posts)} posts, {len(all_tags)} tags → _site/ (landing at /, blog at {BASE_PATH})")


if __name__ == "__main__":
    build()
