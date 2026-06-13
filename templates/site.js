// Site behaviour for the blog. Generated into js/site.js by build.py
// (minified + content-hash cache-busted). Each block is an IIFE, exactly
// as they previously appeared as separate inline <script> tags.

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
      // Lift the toggle above the overlay, leaving a same-size placeholder so the
      // nav doesn't reflow (no overlap with the floating toggle). Guarded so a
      // re-open during a close doesn't re-capture the wrong parent.
      function liftToggle() {
        if (!toggle || toggleHome) return;
        toggleHome = toggle.parentNode;
        var trc = toggle.getBoundingClientRect();
        togglePlaceholder = document.createElement('div');
        togglePlaceholder.setAttribute('aria-hidden', 'true');
        togglePlaceholder.style.width = trc.width + 'px';
        togglePlaceholder.style.height = trc.height + 'px';
        toggleHome.insertBefore(togglePlaceholder, toggle);
        toggle.style.position = 'fixed';
        toggle.style.top = trc.top + 'px';
        toggle.style.left = trc.left + 'px';
        toggle.style.width = trc.width + 'px';
        toggle.style.height = trc.height + 'px';
        toggle.style.margin = '0';
        toggle.style.zIndex = '1001';
        document.body.appendChild(toggle);
        // Moving the toggle restarts any CSS animation on its children — on the
        // homepage the nav-stroke-draw load animation would restart and (since a
        // running animation beats a transition) fight the morph, leaving the pill
        // drawn. Kill those one-shot load animations so the morph can run.
        ['.ts-pill', '.ts-cross', '.toggle-knob'].forEach(function (sel) {
          var el = toggle.querySelector(sel);
          if (el) el.style.animation = 'none';
        });
      }
      // Morph done — drop it back into its exact nav slot and clear the lift.
      function homeToggle() {
        if (!toggle || !toggleHome) return;
        toggle.classList.remove('as-close');
        toggle.removeAttribute('style');
        if (togglePlaceholder && togglePlaceholder.parentNode) {
          togglePlaceholder.parentNode.insertBefore(toggle, togglePlaceholder);
          togglePlaceholder.parentNode.removeChild(togglePlaceholder);
        } else {
          toggleHome.appendChild(toggle);
        }
        togglePlaceholder = null;
        toggleHome = null;
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
        // Lift the REAL toggle out to <body> (above the overlay — it can't paint
        // there from inside .container's stacking context) pinned at its exact
        // spot, then morph it pill→✕ in place. So the toggle itself becomes the
        // close control rather than being swapped for a separate one.
        liftToggle();
        requestAnimationFrame(function () { if (toggle) toggle.classList.add('as-close'); });
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
        // Morph the ✕ back to the toggle as the overlay exits.
        if (toggle) toggle.classList.remove('as-close');
        if (closeTimeout) clearTimeout(closeTimeout);
        closeTimeout = setTimeout(() => {
          overlay.classList.remove('closing');
          document.documentElement.style.overflow = '';
          document.documentElement.classList.remove('searching');
          // Re-home the toggle into its exact nav slot (morphed back by now).
          homeToggle();
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

      // While search is open the toggle IS the close ✕ — clicking it closes
      // search (and the theme handler bails out, see toggleTheme's guard).
      if (toggle) toggle.addEventListener('click', function () {
        if (document.documentElement.classList.contains('searching')) close();
      });

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
        // While search is open the toggle acts as the close ✕ — don't switch theme.
        if (html.classList.contains('searching')) return;
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

      // T key — toggle theme; H key — go home
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
        }
      }, true);
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

      // Body blocks + the footer sections.
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

    // Copy-link share button: copy the current URL, flash a checkmark.
    (function () {
      document.querySelectorAll('.share-copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var flash = function () {
            btn.classList.add('copied');
            setTimeout(function () { btn.classList.remove('copied'); }, 1500);
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
        header.classList.toggle('scrolled', window.scrollY > 4);
      }
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }, { passive: true });
      window.addEventListener('resize', measure);
      update();
    })();
