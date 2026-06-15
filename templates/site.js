// Site behaviour for the blog. Generated into js/site.js by build.py
// (minified + content-hash cache-busted). Each block is an IIFE, exactly
// as they previously appeared as separate inline <script> tags.

    // Shared controller: lend the theme toggle to an overlay as its ✕ close
    // control (lift it out to <body>, morph pill→✕, route its click to the
    // overlay's close). Used by both the search and subscribe overlays.
    var ToggleClose = (function () {
      var toggle = document.getElementById('theme-toggle');
      var home = null, placeholder = null, activeClose = null;
      function lift() {
        if (!toggle || home) return;
        home = toggle.parentNode;
        var r = toggle.getBoundingClientRect();
        placeholder = document.createElement('div');
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.style.width = r.width + 'px';
        placeholder.style.height = r.height + 'px';
        home.insertBefore(placeholder, toggle);
        toggle.style.position = 'fixed';
        toggle.style.top = r.top + 'px';
        toggle.style.left = r.left + 'px';
        toggle.style.width = r.width + 'px';
        toggle.style.height = r.height + 'px';
        toggle.style.margin = '0';
        toggle.style.zIndex = '1001';
        document.body.appendChild(toggle);
        // Moving the toggle restarts its children's CSS animations; kill the
        // one-shot load draws so the morph can run.
        ['.ts-pill', '.ts-cross', '.toggle-knob'].forEach(function (sel) {
          var el = toggle.querySelector(sel); if (el) el.style.animation = 'none';
        });
      }
      function rehome() {
        if (!toggle || !home) return;
        toggle.classList.remove('as-close');
        toggle.removeAttribute('style');
        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.insertBefore(toggle, placeholder);
          placeholder.parentNode.removeChild(placeholder);
        } else {
          home.appendChild(toggle);
        }
        placeholder = null; home = null;
      }
      if (toggle) toggle.addEventListener('click', function () {
        if (activeClose) activeClose();   // when engaged, the toggle ✕ closes the overlay
      });
      return {
        engage: function (closeFn) {
          activeClose = closeFn;
          lift();
          requestAnimationFrame(function () { if (toggle) toggle.classList.add('as-close'); });
        },
        startClose: function () { if (toggle) toggle.classList.remove('as-close'); },  // morph back as the overlay exits
        finishClose: function () {
          activeClose = null;
          rehome();
          // Re-sync the header pill to the real scroll position now the toggle is back.
          try { window.dispatchEvent(new Event('scroll')); } catch (e) {}
        },
        isEngaged: function () { return !!activeClose; }
      };
    })();

    // Shared pill toast: a small "..." pill that pops just below an anchor
    // element and fades out (used for "You're subscribed!", "Link copied", …).
    var Toast = (function () {
      var el = null, t = null;
      return {
        show: function (text, anchor) {
          if (!el) { el = document.createElement('div'); el.className = 'toast-pill'; document.body.appendChild(el); }
          el.textContent = text;
          el.classList.add('show');
          var r = anchor.getBoundingClientRect();
          el.style.top = (r.bottom + 10) + 'px';
          el.style.left = Math.max(8, Math.min(r.left + r.width / 2 - el.offsetWidth / 2, window.innerWidth - 8 - el.offsetWidth)) + 'px';
          clearTimeout(t);
          t = setTimeout(function () { el.classList.remove('show'); }, 2000);
        }
      };
    })();

    // Shared sketch-outline helper: a 1px dark <rect> traced over a rounded box
    // (the newsletter card + its input pill). Used both by the subscribe overlay
    // (timed draw on open) and the inline cards (scrubbed by scroll).
    var Outline = {
      make: function (cls) {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'draw-outline ' + cls);
        svg.setAttribute('aria-hidden', 'true');
        svg.appendChild(document.createElementNS(NS, 'rect'));
        return svg;
      },
      // Size the rect to the element's border-box and return the stroke length.
      size: function (svg, el, rx) {
        var w = el.offsetWidth, h = el.offsetHeight;
        if (!w || !h) return 0;
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        var rect = svg.firstChild;
        rect.setAttribute('x', 0.5);
        rect.setAttribute('y', 0.5);
        rect.setAttribute('width', w - 1);
        rect.setAttribute('height', h - 1);
        rect.setAttribute('rx', rx);
        rect.setAttribute('ry', rx);
        var len = rect.getTotalLength ? rect.getTotalLength() : 2 * (w + h);
        rect.style.setProperty('--len', len);
        return len;
      }
    };

    (function () {
      const overlay    = document.getElementById('search-overlay');
      const input      = document.getElementById('search-input');
      const inputWrap  = document.getElementById('search-input-wrap');
      const results    = document.getElementById('search-results');
      const clearBtn   = document.getElementById('search-clear');
      const toggle     = document.getElementById('theme-toggle');
      let toggleHome   = null;   // the toggle's nav parent, so we can re-home it
      let togglePlaceholder = null;   // holds the toggle's slot in the nav while it's lifted
      let INDEX = null;
      let isOpen = false;
      let selectedIndex = -1;
      let closeTimeout = null;
      const EXIT_DURATION = 800; // ms — true reverse: results bottom-up, then divider, then search bar + overlay last

      function navigableLis() {
        return Array.from(results.querySelectorAll('li')).filter(li => li.querySelector('a') && !li.classList.contains('search-empty'));
      }

      function updateSelection() {
        const lis = navigableLis();
        if (selectedIndex >= lis.length) selectedIndex = lis.length - 1;
        lis.forEach((li, i) => li.classList.toggle('selected', i === selectedIndex));
        if (selectedIndex >= 0 && lis[selectedIndex]) lis[selectedIndex].scrollIntoView({ block: 'nearest' });
      }

      function formatDate(date) {
        const [year, month] = date.split('-');
        return `${year}<span class="separator">&middot;</span>${month}`;
      }
      function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      function render(query) {
        if (!INDEX) { results.innerHTML = ''; return; }
        const q = (query || '').toLowerCase().trim();
        let items = q
          ? INDEX.filter(p =>
              (p.tags || []).some(t => t.toLowerCase().includes(q)) ||
              p.title.toLowerCase().includes(q) ||
              p.text.toLowerCase().includes(q))
          : INDEX;
        // Posts (with date) first, sorted newest to oldest; then pages
        const posts = items.filter(p => p.type === 'post').slice().sort((a, b) => b.date.localeCompare(a.date));
        const pages = items.filter(p => p.type === 'page');
        items = posts.concat(pages);
        if (!items.length) {
          results.innerHTML = '<li class="search-empty">No result found. Do <a href="mailto:ward.nicolas@outlook.com">reach out</a> if you want to chat about a topic not mentioned here!</li>';
          return;
        }
        const n = items.length;
        overlay.style.setProperty('--n', n);
        results.innerHTML = items.map((p, i) => {
          const prefix = p.type === 'post'
            ? `<span class="post-date">${formatDate(p.date)}</span>`
            : `<span class="post-date">page</span>`;
          return `<li style="--i:${i}"><a href="{{base}}/${p.slug}">${prefix}<span class="search-title">${escapeHtml(p.title)}</span></a></li>`;
        }).join('');
        selectedIndex = -1;
        updateSelection();
      }
      function ensureIndex(cb) {
        if (INDEX) { cb(); return; }
        fetch('{{base}}/search-index.json').then(r => r.json()).then(data => { INDEX = data; cb(); });
      }
      // (Toggle lift/morph now lives in the shared ToggleClose controller.)
      function homeToggle() {
        // kept as a thin shim for the close flow below
        ToggleClose.finishClose();
      }
      function open(initialQuery) {
        // Cancel any in-progress close
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
          overlay.classList.remove('closing');
        }
        // Ripple origin: expand the overlay's clip-path circle from the search
        // button, out to the farthest corner.
        var nb = document.getElementById('nav-search');
        if (nb) {
          var nr = nb.getBoundingClientRect();
          var cx = nr.left + nr.width / 2, cy = nr.top + nr.height / 2;
          var rad = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
          overlay.style.setProperty('--sx', cx + 'px');
          overlay.style.setProperty('--sy', cy + 'px');
          overlay.style.setProperty('--sr', rad + 'px');
        }
        // The toggle becomes the ✕ close control (lifted out + morphed) — clicking
        // it closes search (see ToggleClose).
        ToggleClose.engage(close);
        document.documentElement.classList.add('searching');
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.documentElement.style.overflow = 'hidden';
        isOpen = true;
        if (initialQuery !== undefined) input.value = initialQuery;
        syncClear(); // setting .value programmatically doesn't fire 'input', so sync manually
        var isTouch = navigator.maxTouchPoints > 0 ||
                      (window.matchMedia && matchMedia('(pointer: coarse)').matches);
        if (isTouch) {
          // Let the open animation play first — focusing synchronously would
          // throw the keyboard up over the entrance. Focus once it has settled
          // (on iOS the keyboard then waits for a tap on the field, which is
          // fine; on Android it rises after the reveal).
          setTimeout(function () {
            input.focus();
            var len = input.value.length;
            input.setSelectionRange(len, len);
          }, 540);
        } else {
          // Desktop: focus synchronously, inside the user gesture, so the caret
          // shows right away and you can type immediately.
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
          requestAnimationFrame(() => {
            input.focus();
            const len = input.value.length;
            input.setSelectionRange(len, len);
          });
        }
        ensureIndex(() => render(input.value));
      }
      function close() {
        if (!isOpen && !overlay.classList.contains('closing')) return;
        overlay.classList.remove('open');
        overlay.classList.add('closing');
        overlay.setAttribute('aria-hidden', 'true');
        isOpen = false;
        input.blur();
        ToggleClose.startClose();   // morph the ✕ back to the toggle as the overlay exits
        if (closeTimeout) clearTimeout(closeTimeout);
        closeTimeout = setTimeout(() => {
          overlay.classList.remove('closing');
          document.documentElement.style.overflow = '';
          document.documentElement.classList.remove('searching');
          ToggleClose.finishClose();   // re-home the toggle into its nav slot
          closeTimeout = null;
        }, EXIT_DURATION);
      }

      function syncClear() {
        inputWrap.classList.toggle('has-value', input.value.length > 0);
      }

      input.addEventListener('input', e => { render(e.target.value); syncClear(); });

      // The overlay and input row fade in from opacity 0, and a caret focused
      // during that fade won't paint until the user types. Once the input row
      // has finished fading in, re-assert the caret so the orange cursor is
      // visible from the get-go.
      inputWrap.addEventListener('animationend', function (e) {
        if (e.animationName !== 'search-fade-in') return;
        const len = input.value.length;
        input.focus();
        input.setSelectionRange(len, len);
      });

      clearBtn.addEventListener('click', () => {
        input.value = '';
        syncClear();
        render('');
        input.focus();
      });

      // Up / Down / Enter navigation in the results
      input.addEventListener('keydown', function (e) {
        const lis = navigableLis();
        if (e.key === 'ArrowDown') {
          if (!lis.length) return;
          e.preventDefault();
          selectedIndex = selectedIndex === -1 ? 0 : (selectedIndex + 1) % lis.length;
          updateSelection();
        } else if (e.key === 'ArrowUp') {
          if (!lis.length) return;
          e.preventDefault();
          selectedIndex = selectedIndex === -1 ? lis.length - 1 : (selectedIndex - 1 + lis.length) % lis.length;
          updateSelection();
        } else if (e.key === 'Enter') {
          if (!lis.length) return;
          e.preventDefault();
          const idx = selectedIndex === -1 ? 0 : selectedIndex;
          const link = lis[idx] && lis[idx].querySelector('a');
          if (link) window.location.href = link.getAttribute('href');
        }
      });

      overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });

      // Clicking a topic chip opens the search prefilled with that topic
      document.addEventListener('click', function (e) {
        const trigger = e.target.closest('[data-search]');
        if (!trigger) return;
        e.preventDefault();
        open(trigger.getAttribute('data-search'));
      });

      // Nav search icon opens the (empty) search
      const navSearch = document.getElementById('nav-search');
      if (navSearch) navSearch.addEventListener('click', () => open());

      // On-screen close button (needed on touch where there's no Esc key)
      const searchClose = document.getElementById('search-close');
      if (searchClose) searchClose.addEventListener('click', () => close());

      // (The toggle-✕ click is routed to close() via ToggleClose.engage above.)

      document.addEventListener('keydown', function (e) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        const inField = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
        if ((e.key === 's' || e.key === 'S') && !inField && !isOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          open();
        } else if (e.key === 'Escape' && isOpen) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }, true);
    })();

    // Reading progress widget — only active when present (article pages)
    (function () {
      const widget = document.getElementById('reading-progress');
      if (!widget) return;
      const article = document.querySelector('article .post-content');
      if (!article) return;

      const fill = widget.querySelector('.progress-fill');
      const percentEl = widget.querySelector('.progress-percent');
      const CIRCUMFERENCE = 2 * Math.PI * 19; // matches r=19 in SVG

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let wasComplete = false, firstRun = true;
      // The dark arc stays empty until the entrance, then draws clockwise to
      // its value in sync with the track ring-draw (see entrance timing below).
      // The percent text counts 0 → value over that same entrance window.
      let entered = false, countingUp = false, currentPercent = 0;

      // Pop a burst of accent-orange confetti out of the circle on completion.
      function burst() {
        if (reduceMotion) return;
        const rect = widget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        for (let i = 0; i < 29; i++) {
          const piece = document.createElement('div');
          piece.className = 'confetti-piece';
          const angle = Math.random() * Math.PI * 2;
          const dist = 55 + Math.random() * 85;
          piece.style.left = cx + 'px';
          piece.style.top = cy + 'px';
          piece.style.setProperty('--tx', (Math.cos(angle) * dist).toFixed(1) + 'px');
          piece.style.setProperty('--ty', (Math.sin(angle) * dist).toFixed(1) + 'px');
          piece.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
          piece.style.setProperty('--size', (6 + Math.random() * 5).toFixed(1) + 'px');
          piece.style.setProperty('--b', (0.85 + Math.random() * 0.4).toFixed(2));
          piece.style.setProperty('--dur', Math.round(650 + Math.random() * 450) + 'ms');
          piece.addEventListener('animationend', function () { piece.remove(); });
          document.body.appendChild(piece);
        }
      }

      function update() {
        const rect = article.getBoundingClientRect();
        const articleHeight = article.offsetHeight;
        const viewportHeight = window.innerHeight;
        // Progress tracks how much of the article has passed the reader's
        // eye-line (~middle of the viewport) rather than the bottom edge — so
        // it reflects what's actually been *read*, and completes when the last
        // line reaches your eyes, not when it merely scrolls into view.
        const READING_LINE = 0.5;
        const seen = viewportHeight * READING_LINE - rect.top;
        const progress = Math.max(0, Math.min(1, seen / articleHeight));
        const percent = Math.round(progress * 100);

        currentPercent = percent;
        // While the entrance count-up is running, it owns the text; before the
        // entrance the text holds at 0%. Otherwise track the live value.
        if (entered && !countingUp) percentEl.textContent = percent + '%';
        if (entered) fill.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

        const done = percent >= 100;
        widget.classList.toggle('complete', done);
        widget.title = done ? 'Back to top' : 'Skip to end';

        // Fire confetti on the rising edge only (not on initial load).
        if (done && !wasComplete && !firstRun) burst();
        wasComplete = done;
        firstRun = false;
      }

      let ticking = false;
      function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { update(); ticking = false; });
      }

      // Count the percent text up from 0 to its entrance value over `duration`,
      // easing out so it decelerates into place alongside the arc draw.
      function countUp(target, duration) {
        countingUp = true;
        if (target <= 0) { percentEl.textContent = '0%'; countingUp = false; return; }
        const start = performance.now();
        (function frame(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);   // easeOutCubic — mirrors the arc
          percentEl.textContent = Math.round(eased * target) + '%';
          if (t < 1) {
            requestAnimationFrame(frame);
          } else {
            countingUp = false;
            percentEl.textContent = currentPercent + '%';   // settle on live value
          }
        })(start);
      }

      update();   // computes the value; text holds at 0% until the entrance

      // Draw the dark arc in clockwise on load, synced with the track ring-draw
      // (which starts at 1.7s and runs 0.7s), and count the number up in lockstep.
      // Reduced motion skips straight to the live value.
      if (reduceMotion) {
        entered = true;
        update();
      } else {
        setTimeout(function () {
          fill.style.transition = 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
          entered = true;
          countingUp = true;        // suppress the text in update() so it can count
          update();                 // animates the arc from empty to the current value
          countUp(currentPercent, 700);   // number counts up over the same window
          setTimeout(function () {
            // Restore the snappy transition for live scrolling.
            fill.style.transition = 'stroke-dashoffset 0.15s ease, stroke 0.35s ease';
          }, 750);
        }, 1700);
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });

      // Click scrolls to the top once complete, or jumps to the bottom
      // while still reading (the inverse of the back-to-top action).
      widget.addEventListener('click', function () {
        const toBottom = !widget.classList.contains('complete');
        window.scrollTo({
          top: toBottom ? document.documentElement.scrollHeight : 0,
          behavior: 'smooth'
        });
      });
    })();

    // Drop the footer "Share this article" section on short articles, where it
    // would otherwise sit in the same frame of view as the top share row.
    (function () {
      var topRow  = document.querySelector('.post-header .post-share');
      var section = document.querySelector('.post-share-section');
      if (!topRow || !section) return;
      function check() {
        section.classList.remove('is-redundant');          // reveal to measure
        var top = topRow.getBoundingClientRect().top + window.scrollY;
        var bot = section.getBoundingClientRect().bottom + window.scrollY;
        // Whole span (top share row → end of footer share) fits one viewport?
        if (bot - top < window.innerHeight) section.classList.add('is-redundant');
      }
      check();
      window.addEventListener('load', check);
      window.addEventListener('resize', check, { passive: true });
    })();

    (function() {
      const toggle = document.getElementById('theme-toggle');
      const html = document.documentElement;

      const themeColorMeta = document.getElementById('theme-color-meta');
      const THEME_COLORS = { light: '#f6f8fa', dark: '#100F0F' };

      // Apply a theme WITHOUT persisting it — used for the device default and for
      // live OS changes, so the site keeps tracking the device.
      function applyTheme(theme) {
        html.setAttribute('data-theme', theme);
        if (themeColorMeta) themeColorMeta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.light);
      }
      // Apply AND remember — only for an explicit choice made via the toggle.
      function setTheme(theme) {
        applyTheme(theme);
        localStorage.setItem('theme-choice', theme);
      }

      const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
      localStorage.removeItem('theme');   // retire the old key (it auto-persisted the system value, locking it)

      // Init: an explicit saved choice wins; otherwise follow the device — without
      // persisting, so it keeps adapting on later visits and OS changes.
      const choice = localStorage.getItem('theme-choice');
      applyTheme(choice ? choice : (systemDark.matches ? 'dark' : 'light'));

      // Live-adapt: follow the device unless the user has explicitly chosen a
      // theme via the toggle.
      function followSystem() {
        if (!localStorage.getItem('theme-choice')) applyTheme(systemDark.matches ? 'dark' : 'light');
      }
      if (systemDark.addEventListener) systemDark.addEventListener('change', followSystem);
      else if (systemDark.addListener) systemDark.addListener(followSystem);  // older Safari
      // On mobile, switching the system theme usually means leaving Safari
      // (Control Centre / Settings) and coming back — the change event can be
      // missed while backgrounded, so re-check whenever the tab becomes visible.
      document.addEventListener('visibilitychange', function () { if (!document.hidden) followSystem(); });
      window.addEventListener('pageshow', followSystem);

      // Toggle the theme. Where supported, the two themes slowly cross-fade into
      // one another (View Transitions API) — a soft, even dissolve; otherwise it
      // just switches.
      function toggleTheme() {
        // While an overlay (search/subscribe) uses the toggle as its ✕, don't switch theme.
        if (ToggleClose.isEngaged()) return;
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }  // tiny tactile tap
        if (!document.startViewTransition || reduce) { setTheme(next); return; }

        // vt-toggling freezes the knob's live slide so its view-transition
        // snapshots are the true endpoints (rather than a half-slid blur).
        html.classList.add('vt-toggling');
        const vt = document.startViewTransition(() => setTheme(next));
        vt.finished.finally(function () { html.classList.remove('vt-toggling'); });
      }

      toggle.addEventListener('click', toggleTheme);

      // T key — toggle theme; H key — go home; ← / → — newer / older article
      // (the desktop equivalent of the mobile swipe-between-articles gesture).
      document.addEventListener('keydown', function(e) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          e.stopPropagation();
          toggleTheme();
        } else if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '{{base}}';
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (ToggleClose.isEngaged()) return;   // an overlay is open
          var sib = document.querySelector('.post-siblings');   // only present on articles
          if (!sib) return;
          var url = sib.getAttribute(e.key === 'ArrowLeft' ? 'data-newer-url' : 'data-older-url');
          if (url) { e.preventDefault(); e.stopPropagation(); window.location.href = url; }
        }
      }, true);

      // Footer shortcut legend: the S/T/H chips trigger the real controls.
      var footerKeys = document.querySelector('.footer-keys');
      if (footerKeys) footerKeys.addEventListener('click', function (e) {
        var btn = e.target.closest('.key-hint[data-act]');
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        if (act === 'search') { var s = document.getElementById('nav-search'); if (s) s.click(); }
        else if (act === 'theme') { if (toggle) toggle.click(); }
        else if (act === 'home') { window.location.href = '{{base}}'; }
      });
    })();

    // Homepage: roll the content out line by line on load. Runs synchronously
    // at end of body (before paint) and tags each row with its index so CSS
    // can stagger the rise. Rows are hidden up front via the .js gate in CSS.
    (function () {
      if (!document.body.classList.contains('home')) return;
      // Header first: reveal the nav links left-to-right.
      var heads = document.querySelectorAll('.site-nav > a');
      for (var h = 0; h < heads.length; h++) {
        heads[h].style.setProperty('--hi', h);
        heads[h].classList.add('head-in');
      }
      var rows = document.querySelectorAll(
        'main .section-label, main .latest-card, main .section-divider, ' +
        'main .post-list li, main .topics-inline'
      );
      for (var i = 0; i < rows.length; i++) {
        rows[i].style.setProperty('--i', i);
        rows[i].classList.add('roll-in');
      }
    })();

    // Drop cap: wrap the first letter of the opening paragraph in a layered
    // span.dropcap (outline + fill + letter) so CSS can render it as a fixed-
    // size tile AND animate an entrance: the square outline draws itself, the
    // fill floods in, then the letter pops. (::first-letter can't be a box.)
    (function () {
      if (!document.body.classList.contains('article') &&
          !document.body.classList.contains('page')) return;
      var p = document.querySelector('.post-content > p');
      if (!p) return;
      var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
      var node = walker.nextNode();
      while (node && !node.nodeValue.trim()) node = walker.nextNode();
      if (!node) return;
      var text = node.nodeValue;
      var i = 0;
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length || !/[A-Za-z0-9]/.test(text[i])) return;  // only real letters

      var SVGNS = 'http://www.w3.org/2000/svg';
      var span = document.createElement('span');
      span.className = 'dropcap';

      var fill = document.createElement('span');
      fill.className = 'dropcap-fill';

      var svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'dropcap-outline');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      var rect = document.createElementNS(SVGNS, 'rect');
      rect.setAttribute('x', '3'); rect.setAttribute('y', '3');
      rect.setAttribute('width', '94'); rect.setAttribute('height', '94');
      rect.setAttribute('rx', '8'); rect.setAttribute('ry', '8');
      svg.appendChild(rect);

      var letter = document.createElement('span');
      letter.className = 'dropcap-letter';
      letter.textContent = text[i];

      span.appendChild(fill);
      span.appendChild(svg);
      span.appendChild(letter);

      var parent = node.parentNode;
      if (i > 0) parent.insertBefore(document.createTextNode(text.slice(0, i)), node);
      parent.insertBefore(span, node);
      parent.insertBefore(document.createTextNode(text.slice(i + 1)), node);
      parent.removeChild(node);

      // Arm the self-drawing entrance (skip entirely for reduced motion — the
      // base CSS state is the finished, filled tile).
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      try { rect.style.setProperty('--cap-len', rect.getTotalLength()); } catch (e) {}
      requestAnimationFrame(function () { span.classList.add('draw'); });
    })();

    // Article body: fade each block up into place — slow, soft upward motion
    // (Apple-style). The opening fold staggers in on load (after the header);
    // everything below fades up as it scrolls into view.
    (function () {
      if (!document.body.classList.contains('article') &&
          !document.body.classList.contains('page')) return;
      var content = document.querySelector('.post-content');
      if (!content) return;
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
        content.style.opacity = 1; return;
      }

      // Body blocks + the footer sections. (The newsletter card is excluded —
      // it reveals via its own scroll-scrubbed contour draw + content flush.)
      var items = Array.prototype.slice.call(content.children);
      ['.post-share-section', '.linked-mentions', '.related-posts'].forEach(function (sel) {
        var s = document.querySelector('article ' + sel);
        if (s) items.push(s);
      });
      var foot = document.querySelector('.site-footer');
      if (foot) items.push(foot);

      // Classify each block against the fold *before* revealing anything, so we
      // can drop each straight into its hidden state — never flashing it visible.
      var threshold = window.innerHeight * 0.92;
      // Opening fold starts after the header (title → meta → share); static pages
      // (About) have no share row, so the body follows the title.
      var baseDelay = document.querySelector('.post-header .post-share') ? 0.78 : 0.4;
      var below = [], open = [];
      items.forEach(function (el) {
        if (el.getBoundingClientRect().top < threshold) open.push(el);
        else below.push(el);
      });

      // Below the fold: hidden via CSS (.reveal-up carries the transition), then
      // faded up as each scrolls into view. They're off-screen, so adding the
      // class can never produce a visible fade-out.
      below.forEach(function (el) { el.classList.add('reveal-up'); });

      // Opening fold: held hidden and faded up by the Web Animations API — NOT
      // .reveal-up, so there's no CSS transition that could fade these out when
      // the container is revealed. animate() always plays from its explicit
      // `from` keyframe, and fill:'both' holds opacity:0 through the stagger
      // delay, so the block stays hidden until its turn, then glides up once.
      open.forEach(function (el, i) {
        if (!el.animate) return;  // ancient browser: leave it visible
        var anim = el.animate(
          [{ opacity: 0, transform: 'translateY(24px)' },
           { opacity: 1, transform: 'none' }],
          { duration: 900, delay: (baseDelay + i * 0.1) * 1000,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
        );
        // Clear the fill once done; the block rests at its default opacity:1
        // (no .reveal-up base), so nothing snaps.
        anim.finished.then(function () { anim.cancel(); }).catch(function () {});
      });

      // Every block is now in its hidden state — safe to reveal the container.
      content.style.opacity = 1;

      // Below the fold: fade up as each scrolls into view.
      if (below.length && 'IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
          });
        }, { rootMargin: '0px 0px -12% 0px' });
        below.forEach(function (el) { obs.observe(el); });
      } else {
        below.forEach(function (el) { el.classList.add('in'); });
      }
    })();

    // (The home-page newsletter card reveals via its own scroll-scrubbed
    // contour draw + content flush — see the inline-cards block below.)

    // Inline newsletter cards: only the outer card border draws (scroll-scrubbed,
    // untracing as you scroll back). Once it finishes drawing, the contents —
    // the input box (which carries a dark-grey border) and the text — flush from
    // muted grey to full dark grey over the rest of the scroll.
    (function () {
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var cards = [];
      Array.prototype.forEach.call(document.querySelectorAll('.newsletter'), function (nl) {
        if (nl.closest('.subscribe-overlay')) return;          // overlay draws its own
        var card  = nl.querySelector('.newsletter-card');
        if (!card) return;
        card.classList.add('has-draw');                        // CSS drops the card's real border
        var cardSvg = Outline.make('draw-card'); card.appendChild(cardSvg);
        cards.push({ card: card, cardSvg: cardSvg, co: cardSvg.firstChild, cl: 0 });
      });
      if (!cards.length) return;

      function measure() {
        cards.forEach(function (c) {
          c.cl = Outline.size(c.cardSvg, c.card, 20);
        });
      }
      function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
      function draw() {
        var vh = window.innerHeight;
        // Completion guarantee: in the last half-viewport of the page's scroll,
        // ramp progress up to 1 — so the contour always finishes even when the
        // content below the card (footer-only, on the home page) keeps it from
        // climbing high. This blends smoothly with the geometry term below.
        var sy = window.scrollY || window.pageYOffset || 0;
        var maxScroll = document.documentElement.scrollHeight - vh;
        var nearBottom = maxScroll > 0 ? clamp((sy - (maxScroll - vh * 0.5)) / (vh * 0.5)) : 1;
        cards.forEach(function (c) {
          var top = c.card.getBoundingClientRect().top;
          // Trace as the card rises through the middle of the viewport: it
          // only begins once the card's top has climbed to ~70% down (the card
          // is already a third into view, not just peeking), and completes near
          // the upper third (~30% down). Drawing over that band means it's
          // still tracing as you bring the card into reading position — not
          // started while it's still at the bottom — and untraces on the way back.
          var p  = Math.max(clamp((vh * 0.7 - top) / (vh * 0.4)), nearBottom);
          // The outer border draws over the first ~55% of the band; once it has
          // finished, the contents flush from muted grey to full over the rest.
          var cp = clamp(p / 0.55);
          var flush = clamp((p - 0.55) / 0.45);
          c.co.style.strokeDashoffset = c.cl * (1 - cp);
          c.card.style.setProperty('--flush', flush);
        });
      }
      var ticking = false;
      function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { draw(); ticking = false; });
      }
      measure(); draw();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', function () { measure(); draw(); });
      window.addEventListener('load', function () { measure(); draw(); });  // fonts/images settled
    })();

    // Copy-link share button: copy the current URL, flash the icon checkmark + a "Link copied" pill.
    (function () {
      document.querySelectorAll('.share-copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var flash = function () {
            btn.classList.add('copied');
            setTimeout(function () { btn.classList.remove('copied'); }, 1500);
            Toast.show('Copied to clipboard', btn);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(location.href).then(flash, flash);
          } else {
            var ta = document.createElement('textarea');
            ta.value = location.href;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            flash();
          }
        });
      });
    })();

    // Mobile: swipe left/right between articles. A horizontal drag follows the
    // finger, reveals an edge hint with the target post's title, and commits
    // past a threshold (or on a quick flick). Touch + article pages only.
    (function () {
      if (!document.body.classList.contains('article')) return;
      if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
      var data = document.querySelector('.post-siblings');
      var main = document.querySelector('main');
      if (!data || !main) return;

      var newer = { url: data.getAttribute('data-newer-url'), title: data.getAttribute('data-newer-title') };
      var older = { url: data.getAttribute('data-older-url'), title: data.getAttribute('data-older-title') };
      var edgeL = document.querySelector('.swipe-edge--left');    // newer (swipe right)
      var edgeR = document.querySelector('.swipe-edge--right');   // older (swipe left)
      if (newer.url && edgeL) edgeL.querySelector('.swipe-title').textContent = newer.title;
      if (older.url && edgeR) edgeR.querySelector('.swipe-title').textContent = older.title;

      var W = function () { return window.innerWidth; };
      var startX = 0, startY = 0, dx = 0, lock = null, active = false;

      function setX(x) { main.style.transform = x ? 'translateX(' + x + 'px)' : ''; }
      function showHint(edge, on, mag) {
        if (!edge) return;
        edge.style.opacity = on ? Math.min(1, mag).toFixed(3) : 0;
        edge.style.transform = 'translateY(-50%) translateX(' + (on ? (edge === edgeL ? 1 : -1) * Math.min(1, mag) * 10 : 0) + 'px)';
      }

      function onStart(e) {
        if (e.touches.length > 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        dx = 0; lock = null; active = true;
        main.style.transition = 'none';
      }
      function onMove(e) {
        if (!active || e.touches.length > 1) return;
        var ddx = e.touches[0].clientX - startX, ddy = e.touches[0].clientY - startY;
        if (lock === null) {
          if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
          lock = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v';
          if (lock === 'h') document.body.classList.add('swiping');
        }
        if (lock !== 'h') return;
        e.preventDefault();
        dx = ddx;
        var hasTarget = dx > 0 ? !!newer.url : !!older.url;
        var eff = hasTarget ? dx : dx * 0.22;       // rubber-band when there's nowhere to go
        setX(eff);
        var mag = Math.abs(eff) / (W() * 0.3);
        showHint(edgeL, dx > 0 && !!newer.url, mag);
        showHint(edgeR, dx < 0 && !!older.url, mag);
      }
      function onEnd() {
        if (!active) return;
        active = false;
        if (lock !== 'h') { document.body.classList.remove('swiping'); return; }
        var hasTarget = dx > 0 ? !!newer.url : !!older.url;
        var target = dx > 0 ? newer : older;
        main.style.transition = 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)';
        if (hasTarget && Math.abs(dx) > W() * 0.28) {
          if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
          requestAnimationFrame(function () { setX((dx > 0 ? 1 : -1) * W()); });
          setTimeout(function () { location.href = target.url; }, 300);
        } else {
          showHint(edgeL, false, 0);
          showHint(edgeR, false, 0);
          requestAnimationFrame(function () { setX(0); });
          setTimeout(function () { document.body.classList.remove('swiping'); main.style.transition = ''; }, 340);
        }
      }

      main.addEventListener('touchstart', onStart, { passive: true });
      main.addEventListener('touchmove', onMove, { passive: false });
      main.addEventListener('touchend', onEnd);
      main.addEventListener('touchcancel', onEnd);
    })();

    // Floating pill header: frost it in as soon as the page scrolls, and measure
    // the outline's perimeter so it can stroke itself around the pill on scroll.
    (function () {
      var header = document.querySelector('.site-header');
      if (!header) return;
      var rect = header.querySelector('.pill-outline rect');
      var svg = header.querySelector('.pill-outline');
      function measure() {
        if (!rect) return;
        // The replaced SVG can't take a % height (auto-height parent), so pin its
        // height to the header in px; then measure the outline for the dash.
        if (svg) svg.style.height = header.offsetHeight + 'px';
        // Match the CSS capsule: corner radius = half the height, so the drawn
        // contour is fully rounded too.
        var rad = header.offsetHeight / 2;
        rect.setAttribute('rx', rad);
        rect.setAttribute('ry', rad);
        if (rect.getTotalLength) {
          // Disarm the transition so setting --pill-len snaps (no flash of a
          // draw on load / re-measure), then re-arm on the next frame.
          header.classList.remove('pill-armed');
          try { rect.style.setProperty('--pill-len', rect.getTotalLength()); } catch (e) {}
          requestAnimationFrame(function () { header.classList.add('pill-armed'); });
        }
      }
      measure();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
      var ticking = false;
      function update() {
        ticking = false;
        // Freeze the pill state while an overlay has borrowed the toggle, so the
        // header doesn't reflow (pill in/out) under the lifted toggle and snap it.
        if (ToggleClose.isEngaged()) return;
        header.classList.toggle('scrolled', window.scrollY > 4);
      }
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }, { passive: true });
      window.addEventListener('resize', measure);
      update();
    })();

    // Newsletter signup. Validate, then fire-and-forget the POST to the form's
    // data-endpoint (when set) — there's nothing to wait on, so the success state
    // shows immediately. To go live, set data-endpoint in build.py's
    // newsletter_section() and use your provider's field name:
    //   Buttondown : https://buttondown.com/api/emails/embed-subscribe/USERNAME   (field: email)
    //   Mailchimp  : https://DC.list-manage.com/subscribe/post?u=U&id=ID          (field: EMAIL)
    //   Kit        : https://app.kit.com/forms/FORM_ID/subscriptions              (field: email_address)
    (function () {
      var forms = document.querySelectorAll('.newsletter-form');
      if (!forms.length) return;
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // A celebratory confetti rain on success (before liftoff): lots of orange
      // pieces pop out near the top of the page, then sway, spin, and fade as
      // they fall. Body-fixed at viewport coords, like the reading-ring confetti.
      function confettiBurst() {
        if (reduce || typeof document.body.animate !== 'function') return;
        var vw = window.innerWidth, vh = window.innerHeight, N = 64;
        for (var i = 0; i < N; i++) {
          var bit = document.createElement('i');
          bit.className = 'confetti-bit';
          var size = 6 + Math.random() * 5;
          bit.style.width = size.toFixed(1) + 'px';
          bit.style.height = (size * 0.42).toFixed(1) + 'px';
          bit.style.left = (Math.random() * vw).toFixed(1) + 'px';
          bit.style.top = '0px';
          bit.style.filter = 'brightness(' + (0.85 + Math.random() * 0.4).toFixed(2) + ')';
          document.body.appendChild(bit);
          var startY = -10 + Math.random() * 50;         // near the top edge
          var popUp = 30 + Math.random() * 45;           // the upward pop
          var popX = (Math.random() - 0.5) * 110;        // outward pop
          var sway = popX * 0.6 + (Math.random() - 0.5) * 80;
          var endY = vh + 60;                            // past the bottom
          var midY = startY + (endY - startY) * 0.62;
          var rot = Math.round(Math.random() * 1080 - 540);
          var dur = 2600 + Math.random() * 2200;         // slow, graceful fall
          var delay = Math.random() * 800;               // keep it raining, not all at once
          bit.animate([
            { transform: 'translate(-50%, ' + startY.toFixed(0) + 'px) scale(0.2) rotate(0deg)', opacity: 1, offset: 0, easing: 'cubic-bezier(0.12, 0.9, 0.25, 1)' },
            { transform: 'translate(calc(-50% + ' + popX.toFixed(0) + 'px), ' + (startY - popUp).toFixed(0) + 'px) scale(1.12) rotate(' + Math.round(rot * 0.12) + 'deg)', opacity: 1, offset: 0.09, easing: 'cubic-bezier(0.4, 0, 0.65, 1)' },
            { transform: 'translate(calc(-50% + ' + sway.toFixed(0) + 'px), ' + midY.toFixed(0) + 'px) scale(1) rotate(' + Math.round(rot * 0.6) + 'deg)', opacity: 1, offset: 0.7, easing: 'cubic-bezier(0.4, 0, 0.65, 1)' },
            { transform: 'translate(calc(-50% + ' + (sway * 0.5).toFixed(0) + 'px), ' + endY.toFixed(0) + 'px) scale(1) rotate(' + rot + 'deg)', opacity: 0, offset: 1 }
          ], { duration: dur, delay: delay, fill: 'both' });
          (function (b, total) { setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, total + 80); })(bit, dur + delay);
        }
      }

      // Once subscribed (from any touchpoint, this visit or a prior one), the
      // inline cards across the site retire — the header badge stands in for them.
      function retireInlineCards() {
        Array.prototype.forEach.call(document.querySelectorAll('.newsletter'), function (nl) {
          if (nl.closest('.subscribe-overlay')) return;            // keep the overlay card
          var f = nl.querySelector('.newsletter-form');
          if (f && f.classList.contains('is-done')) return;        // the submitted one animates itself out
          nl.style.display = 'none';
        });
      }
      try { if (localStorage.getItem('newsletter-subscribed') === '1') retireInlineCards(); } catch (e) {}
      document.addEventListener('newsletter:subscribed', function () { setTimeout(retireInlineCards, 50); });

      Array.prototype.forEach.call(forms, function (form) {
        var input  = form.querySelector('.newsletter-input');
        var field  = form.querySelector('.newsletter-field');
        var msg    = form.querySelector('.newsletter-msg');
        var gotcha = form.querySelector('.newsletter-gotcha');
        var section = form.closest('.newsletter');
        var endpoint = form.getAttribute('data-endpoint') || '';

        function setMsg(text, kind) {
          msg.textContent = text || '';
          msg.classList.remove('is-error', 'is-success');
          if (kind) msg.classList.add('is-' + kind);
        }
        function fail(text) {
          setMsg(text, 'error');
          field.classList.remove('shake');
          void field.offsetWidth;            // restart the shake
          field.classList.add('shake');
          input.focus();
        }
        // Collapse the emptied section to nothing.
        function collapse() {
          section.style.height = section.offsetHeight + 'px';
          section.style.overflow = 'hidden';
          void section.offsetHeight;
          section.style.transition = 'height 0.5s cubic-bezier(0.22, 1, 0.36, 1), ' +
            'margin-top 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
          requestAnimationFrame(function () {
            section.style.height = '0px';
            section.style.marginTop = '0px';
          });
        }
        // Draw the card out: content + fill fade while an outline traced over the
        // Soft scale-down + blur + fade (keeping the orange border), then collapse.
        var inOverlay = !!form.closest('.subscribe-overlay');
        function lifted() { document.dispatchEvent(new CustomEvent('newsletter:lifted')); }
        function dismiss() {
          var card = section && section.querySelector('.newsletter-card');
          if (reduce || !card) {
            lifted();                                  // the card is "gone" — flip the badge
            if (!inOverlay && section) section.style.display = 'none';
            return;
          }
          section.style.pointerEvents = 'none';
          card.classList.add('is-dismissing');
          card.addEventListener('animationend', function te(ev) {
            if (ev.animationName !== 'ns-liftoff') return;   // the liftoff keyframes
            card.removeEventListener('animationend', te);
            lifted();                                  // liftoff done (overlay + inline alike)
            if (!inOverlay) collapse();                // inline: also close the gap
          });
        }
        function succeed() {
          form.classList.add('is-done');         // plane morphs to the check
          input.disabled = true;
          var card = section && section.querySelector('.newsletter-card');
          if (card) card.classList.add('is-subscribed');   // gradient border + colour flush
          confettiBurst();                                  // celebrate: confetti rains down
          var btn = form.querySelector('.newsletter-submit');
          if (btn) btn.setAttribute('aria-label', 'Subscribed');   // confirmation for screen readers
          // Persist + broadcast so the header badge flips (and other cards retire).
          try { localStorage.setItem('newsletter-subscribed', '1'); } catch (e) {}
          document.dispatchEvent(new CustomEvent('newsletter:subscribed'));
          // Hold while the confetti rains + the colour flush lands, then lift off.
          setTimeout(dismiss, reduce ? 1600 : 2000);
        }

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          if (form.classList.contains('is-done')) return;
          if (gotcha && gotcha.value) return;    // bot trap: ignore silently
          var email = (input.value || '').trim();
          if (!EMAIL_RE.test(email)) { fail('Please enter a valid email address.'); return; }
          // Fire-and-forget — nothing to wait on, so confirm immediately.
          if (endpoint) {
            var body = new FormData();
            body.append('email', email);
            try { fetch(endpoint, { method: 'POST', body: body, mode: 'no-cors' }); } catch (err) {}
          }
          succeed();
        });
      });
    })();

    // Header subscribe button: opens the signup card in an overlay so people can
    // convert from anywhere. Once subscribed (persisted), it becomes a gradient
    // check badge that shows a quiet "You're subscribed" note on tap.
    (function () {
      var btn = document.getElementById('nav-subscribe');
      if (!btn) return;
      var overlay  = document.getElementById('subscribe-overlay');
      var closeBtn = document.getElementById('subscribe-close');
      var reduce   = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

      try { if (localStorage.getItem('newsletter-subscribed') === '1') btn.classList.add('is-subscribed'); } catch (e) {}

      function showNote() { Toast.show('You’re subscribed!', btn); }

      // --- Draw-in outlines: the shared dark sketch, traced over the card and
      // the input bar (so the bar appears with its own contour). Built once,
      // re-sized on each open (it may reflow).
      var cardOutline = null, fieldOutline = null;
      function prepDraw() {
        if (!overlay || reduce) return;
        var card  = overlay.querySelector('.newsletter-card');
        var field = overlay.querySelector('.newsletter-field');
        if (!card || !field) return;
        if (!cardOutline)  { cardOutline  = Outline.make('draw-card');  card.appendChild(cardOutline); }
        if (!fieldOutline) { fieldOutline = Outline.make('draw-field'); field.appendChild(fieldOutline); }
        Outline.size(cardOutline, card, 20);                       // card radius
        Outline.size(fieldOutline, field, field.offsetHeight / 2); // capsule
      }

      var lastFocus = null, closing = false;
      function openOverlay() {
        if (!overlay) return;
        closing = false;
        lastFocus = document.activeElement;
        ToggleClose.engage(closeOverlay);   // toggle morphs into the ✕ close (like search)
        overlay.classList.remove('closing');
        prepDraw();                         // size + reset the outlines (hidden)
        // Flush the reset (dashoffset = full) before flipping to .open, so the
        // stroke-dashoffset transition actually animates from full → 0 (the trace).
        void overlay.offsetWidth;
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.documentElement.style.overflow = 'hidden';
        // Focus the input only once it has faded in (it's invisible before).
        var input = overlay.querySelector('.newsletter-input');
        setTimeout(function () { if (input) input.focus(); }, reduce ? 60 : 1500);
      }
      function closeOverlay(skipOutro) {
        if (!overlay || closing) return;
        closing = true;
        document.documentElement.style.overflow = '';
        ToggleClose.startClose();           // morph the ✕ back to the toggle
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        var finish = function () {
          overlay.classList.remove('open', 'closing');
          overlay.setAttribute('aria-hidden', 'true');
          ToggleClose.finishClose();        // re-home the toggle once the morph completes
          closing = false;
        };
        // Subscribed: the card already whooshed off — just fade the backdrop.
        if (skipOutro === true || reduce) {
          overlay.classList.remove('open');
          overlay.setAttribute('aria-hidden', 'true');
          setTimeout(finish, 800);
          return;
        }
        // Dismissed without subscribing: play the intro in reverse (input bar
        // undraws + sinks, then dek, then tagline, then the card border undraws),
        // and fade the backdrop once the content is on its way out.
        overlay.classList.add('closing');
        setTimeout(function () { overlay.classList.remove('open'); }, 500);
        setTimeout(finish, 950);
      }

      btn.addEventListener('click', function () {
        if (btn.classList.contains('is-subscribed')) { showNote(); return; }
        openOverlay();
      });
      if (overlay) {
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
        if (closeBtn) closeBtn.addEventListener('click', closeOverlay);
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && overlay.classList.contains('open')) closeOverlay();
        });
      }

      // Only flip the badge once the card has actually lifted off (and the modal
      // closes), and draw the check in rather than popping it.
      document.addEventListener('newsletter:lifted', function () {
        btn.classList.add('is-subscribed', 'just-subscribed');
        if (overlay && overlay.classList.contains('open')) closeOverlay(true);  // skip outro — card already lifted
      });
    })();
