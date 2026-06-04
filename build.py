#!/usr/bin/env python3
"""Static site generator for the blog."""

import json
import os
import re
import shutil
import math
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
_ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/></svg>'
_ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>'
_ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'


def share_row(url, title):
    """A row of share buttons: LinkedIn, X, email, and copy-link."""
    u = quote(url, safe="")
    t = quote(title, safe="")
    linkedin = f"https://www.linkedin.com/sharing/share-offsite/?url={u}"
    x = f"https://twitter.com/intent/tweet?url={u}&text={t}"
    email = f"mailto:?subject={t}&body={u}"
    return (
        '<div class="post-share">'
        f'<a class="share-btn" href="{linkedin}" target="_blank" rel="noopener" aria-label="Share on LinkedIn" title="Share on LinkedIn">{_ICON_LINKEDIN}</a>'
        f'<a class="share-btn" href="{x}" target="_blank" rel="noopener" aria-label="Share on X" title="Share on X">{_ICON_X}</a>'
        f'<a class="share-btn" href="{email}" aria-label="Share by email" title="Share by email">{_ICON_MAIL}</a>'
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

def build():
    # Clean output
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir()

    # Landing page → site root (index.html + its assets)
    if LANDING_DIR.exists():
        for item in LANDING_DIR.iterdir():
            if item.name == ".DS_Store":
                continue
            dest = OUTPUT_DIR / item.name
            if item.is_dir():
                shutil.copytree(item, dest)
            else:
                shutil.copy2(item, dest)

    # Tell GitHub Pages not to run Jekyll over the output
    (OUTPUT_DIR / ".nojekyll").write_text("")

    # Blog lives under /blog
    BLOG_DIR.mkdir(parents=True, exist_ok=True)

    # Copy CSS
    css_out = BLOG_DIR / "css"
    shutil.copytree(CSS_DIR, css_out)

    base_tpl = read_template("base.html")
    home_tpl = read_template("home.html")
    post_tpl = read_template("post.html")
    page_tpl = read_template("page.html")

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
            share=share_row(f"{SITE_URL}{BASE_PATH}/{post['slug']}", post["title"]),
        )

        page_html = render(
            base_tpl,
            base=BASE_PATH,
            title=f'{post["title"]} — {SITE_TITLE}',
            content=post_html,
            nav_section=writing_nav,
            body_class="",
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

    home_html = render(home_tpl, post_items=post_items, topic_links=topic_links, latest_section=latest_section)
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
            full_html = render(base_tpl, base=BASE_PATH, title=f'{title} — {SITE_TITLE}', content=pg_html, nav_section=writing_nav, body_class="")

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
