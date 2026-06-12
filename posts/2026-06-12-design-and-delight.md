---
title: Design and delight
date: 2026-06-12
slug: design-and-delight
tags: design, craft, web
---

Design is invisible until it isn't. When a thing is well made, you don't notice the making — you just glide through it, and the work disappears behind the result. But every so often something catches your eye and makes you smile: a detail that nobody asked for, that no spec required, that exists only because someone cared. That second thing is delight, and it's the part most people skip.

This site is small. A landing page and a blog. But I treated every pixel of it as a decision, and I want to walk through those decisions — not to show off, but because design reasoning is usually hidden, and I think it's more interesting out loud. Here is every choice, and why.

## One palette, two surfaces

Everything starts with colour. The whole site is built on [Flexoki](https://stephango.com/flexoki), Steph Ango's palette for "an inky color scheme for prose and code." It's warm where most screens are cold — paper and ink rather than white and black — and it was tuned for legibility on real displays, with even perceptual steps between shades. The landing page and the blog draw from the exact same set of tokens, so the two surfaces read as one system even though they're built differently underneath.

Against that warm grey canvas there is exactly one accent: a single orange, `#FF791B`. One accent, used sparingly, does more than five used freely. Restraint is the whole game — colour means something only when most of the page declines to use it. So the orange shows up in just a few deliberate places: the cursor when you search, the text selection wash, a burst of confetti, and the two coloured words on the landing page — including this one, which I gave a flexoki **green** so the link you clicked to get here would be its own small event.

## Type and the measure

Body text is set at a deliberate size with a 1.5 line-height and a maximum line length of 760 pixels. That ceiling isn't arbitrary: lines that run too wide make your eye lose its place on the return sweep. The "measure" — the comfortable number of characters per line — is one of the oldest ideas in typography, and ignoring it is the most common way websites become tiring to read.

The blog uses the system font stack — the native humanist sans of whatever device you're on — which means zero font downloads, instant text, and a typeface that already feels at home on your screen. The landing page, being more of a statement, permits itself two web fonts (Figtree and IBM Plex Mono), loaded in a single request so they don't block the page twice.

## Light, dark, and the moment between

The theme toggle looks simple, but most of its design lives in the moments you're not supposed to notice.

The theme is applied *synchronously, before the page paints*. If you load the site in dark mode, you never see a flash of light — the very first frame is already correct, and the toggle's knob starts in its final position instead of sliding into place on every load. That flash-of-wrong-theme is endemic on the web, and avoiding it takes a few lines of script in exactly the right spot.

Switching themes is a slow cross-fade rather than a hard cut — the two palettes dissolve into one another over about half a second, eased so it settles rather than snaps. The toggle itself is a small piece of choreography: its outline morphs between a pill and a cross depending on context, and the knob slides without ever restarting its own animation mid-flight. None of this is necessary. All of it is the point.

## A header that knows where you are

At the top of the page the header sits flush with the body, full width, unobtrusive. The moment you scroll, it gathers itself into a floating pill — frosted glass, a soft shadow, a thin contoured edge — borrowed from the way iOS sub-navigation behaves. The contour literally *draws itself* around the pill as it materialises, a stroke tracing the rounded rectangle rather than simply appearing.

This took an embarrassing amount of iteration to get right, mostly because of mobile Safari's quirks: backdrop-filter isn't captured cleanly during view transitions, box-shadows get clipped on blurred elements, and SVG sizing fights you at every turn. The version you see is the one that survived all of it. It's monochrome on purpose — I tried colour here and it always read as costume jewellery. The pill earns its keep by being quiet.

## The reading ring

In the bottom corner of every article is a small ring that fills as you read. Three details make it more than a scrollbar.

First, it measures *reading*, not scrolling — progress tracks how much of the article has passed your eye-line, the middle of the screen, rather than the bottom edge. It hits 100% when the last line reaches your eyes, not when it merely scrolls into view. Second, on load the ring draws itself clockwise while the percentage counts up from zero in perfect lockstep — the number and the arc arrive together. Third, when you finish, the ring bursts into a small shower of orange confetti. A reward for finishing, fired exactly once, on the rising edge — never on a reload. You can also tap it to leap to the end, or back to the top once you're done.

## Motion with manners

Articles don't just appear; they assemble. The opening paragraphs fade up with a slow, soft upward drift — Apple's house style, because it works — staggered so they arrive in sequence rather than all at once. Everything below the fold waits, then fades up as it scrolls into view.

Getting "fade up once, cleanly" to actually behave took real work. Browsers skip transitions on an element's first paint, double-fire them if you're careless, and flash content visible before the script can hide it. The opening blocks are driven by the Web Animations API precisely because it plays from an explicit starting frame and holds it through the delay, which sidesteps every one of those traps. The reward is an entrance you'd never think twice about — which is the goal. Good motion is motion you feel but don't see.

## The drop cap

Every article opens with a drop cap: the first letter set in a solid tile, in the inverse of the current theme, always the same size regardless of which letter it is. And it draws itself on entrance — the square's outline strokes around, the fill floods in, then the letter pops into place.

There's a hidden constraint here. Drop caps are traditionally a single large glyph, but ornate letters have wildly different widths and flourishes; a script "Q" will crash into your text while an "I" floats alone. The tile solves it by giving every letter the same fixed footprint. And because I wanted no two articles to share a cap, each post now opens with a sentence chosen so its first letter is unique across the whole blog. This very article starts with a "D" that belongs to nothing else.

## The small things

Delight hides in the corners. Press <kbd>S</kbd> anywhere and a search overlay opens, its index loaded only when you first need it. On a phone you can swipe left and right between articles, with edge hints that show you where you'll land. Selecting text paints it in a soft orange. The landing page reveals itself word by word, with a fast-forward chevron in the corner that you can press to replay the whole intro — and which then morphs into a replay arrow, so the control tells you what it does. Each of these is optional. None of them is load-bearing. Together they are most of the personality.

## Speed is a feature

The least visible design choice is how fast everything is. Blog pages make zero third-party requests — no analytics, no fonts, no trackers phoning home. The shared behaviour lives in one cached script instead of being copied into every page, so moving between articles costs almost nothing. Styles and scripts are minified and fingerprinted so your browser can cache them forever and still never serve you something stale. The whole site weighs less than a single photo on most pages.

Performance is design. A layout you can't see yet isn't a layout; an animation that stutters isn't delightful, it's irritating. Smoothness is a feeling, and the feeling is built on milliseconds.

## Respecting the no

Finally: every animation on this site has an off switch you never have to find. If your device asks for reduced motion, the cross-fades, the fade-ups, the self-drawing tiles, the confetti — all of it falls away, and you're left with a calm, instant, fully functional site. Delight should be a gift, never an imposition. The best part of designing for delight is designing the version where delight politely steps aside.

---

That's the whole site, decision by decision. None of it is revolutionary. All of it is considered. The difference between a page that works and a page that feels *alive* is rarely one big idea — it's a hundred small ones, each made with a little more care than strictly necessary. That surplus of care is what we mean by craft, and the visible residue of craft is delight.

If you noticed none of this while reading — good. That was the design. If you noticed some of it and smiled — better. That was the delight.
