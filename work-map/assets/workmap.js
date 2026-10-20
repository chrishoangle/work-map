/*
 * work-map renderer — vanilla JS, no dependencies.
 *
 * WorkMap.render(container, spec) draws a diagram from a JSON spec:
 *   groups: [{ id, label, row, direction: "vertical"|"horizontal", accent, grow, gap, status, spacer }]
 *   nodes:  [{ id, group, title, subtitle, stack: [], url, status, accent, detail }]
 *   edges:  [{ from, to, label, status, dir: "forward"|"both"|"none", labelAt, labelDx, labelDy }]
 * status: "shipped" (solid, default) | "in-progress" | "planned" (both dashed)
 * Edge endpoints may be node ids or group ids.
 */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var THEME_KEY = 'workmap-theme';
  var STATUS_TEXT = { 'in-progress': 'in progress', planned: 'planned' };
  var uidCounter = 0;

  function isPending(st) { return st === 'in-progress' || st === 'planned'; }

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function s(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function clamp(v, lo, hi) { return lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi); }

  /* ---------------- theme ---------------- */

  function initTheme() {
    var root = document.documentElement;
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    function sync() {
      var dark = root.dataset.theme !== 'light';
      btn.textContent = dark ? '☀ light' : '☾ dark';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    sync();
    btn.addEventListener('click', function () {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(THEME_KEY, root.dataset.theme); } catch (e) { /* storage blocked */ }
      sync();
    });
  }

  /* ---------------- tooltip ---------------- */

  var tip = null;
  function getTip() {
    if (!tip) {
      tip = h('div', 'wm-tip');
      tip.setAttribute('aria-hidden', 'true'); // content is already in each node's aria-label
      document.body.appendChild(tip);
    }
    return tip;
  }

  function showTip(node, el) {
    var t = getTip();
    t.innerHTML = '';
    t.appendChild(h('div', 'wm-tip-title', node.title));
    if (node.detail) t.appendChild(h('p', 'wm-tip-detail', node.detail));
    if (node.stack && node.stack.length) {
      var chips = h('div', 'wm-chips');
      node.stack.forEach(function (x) { chips.appendChild(h('span', 'wm-chip', x)); });
      t.appendChild(chips);
    }
    var meta = [];
    if (isPending(node.status)) meta.push(STATUS_TEXT[node.status]);
    if (node.url) meta.push('opens case study in a new tab ↗');
    if (meta.length) t.appendChild(h('div', 'wm-tip-meta', meta.join(' · ')));
    t.classList.add('is-on');

    // Prefer the side of the node (keeps the highlighted neighbours visible), then below, then above.
    var r = el.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    var tw = t.offsetWidth;
    var th = t.offsetHeight;
    var gap = 10, x, y;
    var sideY = clamp(r.top, 8, vh - th - 8);
    if (r.right + gap + tw <= vw - 8) { x = r.right + gap; y = sideY; }
    else if (r.left - gap - tw >= 8) { x = r.left - gap - tw; y = sideY; }
    else {
      x = clamp(r.left + r.width / 2 - tw / 2, 8, vw - tw - 8);
      y = r.bottom + 8;
      if (y + th > vh - 8 && r.top - th - 8 >= 8) y = r.top - th - 8;
    }
    t.style.left = Math.round(x) + 'px';
    t.style.top = Math.round(y) + 'px';
  }

  function hideTip() { if (tip) tip.classList.remove('is-on'); }

  /* ---------------- geometry ---------------- */

  // Cubic bezier between two boxes; picks vertical or horizontal attachment by relative position.
  function geom(a, b) {
    var ax2 = a.x + a.w, ay2 = a.y + a.h, bx2 = b.x + b.w, by2 = b.y + b.h;
    var p0, p3, c1, c2, d;

    function xs() {
      var lo = Math.max(a.x, b.x), hi = Math.min(ax2, bx2);
      if (hi - lo > 24) { var x = (lo + hi) / 2; return [x, x]; }
      return [clamp(b.x + b.w / 2, a.x + 14, ax2 - 14), clamp(a.x + a.w / 2, b.x + 14, bx2 - 14)];
    }

    if (b.y >= ay2 - 2) {                    // target below
      var x1 = xs();
      p0 = { x: x1[0], y: ay2 }; p3 = { x: x1[1], y: b.y };
      d = Math.max(14, (p3.y - p0.y) / 2);
      c1 = { x: p0.x, y: p0.y + d }; c2 = { x: p3.x, y: p3.y - d };
    } else if (by2 <= a.y + 2) {             // target above
      var x2 = xs();
      p0 = { x: x2[0], y: a.y }; p3 = { x: x2[1], y: by2 };
      d = Math.max(14, (p0.y - p3.y) / 2);
      c1 = { x: p0.x, y: p0.y - d }; c2 = { x: p3.x, y: p3.y + d };
    } else {                                 // side by side
      var right = b.x + b.w / 2 >= a.x + a.w / 2;
      var lo = Math.max(a.y, b.y), hi = Math.min(ay2, by2);
      var y0 = hi - lo > 12 ? (lo + hi) / 2 : a.y + a.h / 2;
      var y1 = hi - lo > 12 ? y0 : b.y + b.h / 2;
      p0 = { x: right ? ax2 : a.x, y: y0 }; p3 = { x: right ? b.x : bx2, y: y1 };
      d = Math.max(14, Math.abs(p3.x - p0.x) / 2) * (right ? 1 : -1);
      c1 = { x: p0.x + d, y: p0.y }; c2 = { x: p3.x - d, y: p3.y };
    }
    var f = function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); };
    return { p0: p0, c1: c1, c2: c2, p3: p3, d: 'M' + f(p0) + ' C' + f(c1) + ' ' + f(c2) + ' ' + f(p3) };
  }

  function bez(g, t) {
    var u = 1 - t;
    function c(k) { return u * u * u * g.p0[k] + 3 * u * u * t * g.c1[k] + 3 * u * t * t * g.c2[k] + t * t * t * g.p3[k]; }
    return { x: c('x'), y: c('y') };
  }

  /* ---------------- render ---------------- */

  function render(container, spec) {
    var uid = 'wm' + (++uidCounter);
    var groups = spec.groups || [];
    var nodes = spec.nodes || [];
    var edges = spec.edges || [];

    container.innerHTML = '';
    var map = h('div', 'wm-map');
    if (spec.rowGap) map.style.setProperty('--row-gap', spec.rowGap + 'px');
    container.appendChild(map);

    var els = {};   // id -> element (nodes and groups)
    var info = {};  // id -> spec object

    // Rows of groups
    var rows = {}, rowKeys = [];
    groups.forEach(function (g) {
      var r = g.row || 0;
      if (!rows[r]) { rows[r] = []; rowKeys.push(r); }
      rows[r].push(g);
    });
    rowKeys.sort(function (x, y) { return x - y; });
    // Multi-row diagrams collapse to stacked stages on phones (edges become a readable list).
    if (rowKeys.length > 1) map.classList.add('wm-staged');

    rowKeys.forEach(function (r) {
      var row = h('div', 'wm-row');
      map.appendChild(row);
      rows[r].forEach(function (g) {
        var sec = h(g.spacer ? 'div' : 'section', 'wm-group ' + (g.direction === 'vertical' ? 'is-vertical' : 'is-horizontal'));
        if (g.grow) sec.style.setProperty('--grow', g.grow);
        row.appendChild(sec);
        if (g.spacer) { sec.classList.add('is-spacer'); sec.setAttribute('aria-hidden', 'true'); return; }

        sec.dataset.id = g.id;
        sec.style.setProperty('--accent', 'var(--a-' + (g.accent || 'slate') + ')');
        if (g.gap) sec.style.setProperty('--gap', g.gap + 'px');
        if (isPending(g.status)) sec.classList.add('is-pending');

        var labelId = uid + '-g-' + g.id;
        var label = h('h2', 'wm-group-label', g.label);
        label.id = labelId;
        sec.setAttribute('aria-labelledby', labelId);
        sec.appendChild(label);

        var list = h('div', 'wm-nodes');
        sec.appendChild(list);
        nodes.filter(function (n) { return n.group === g.id; }).forEach(function (n) {
          var el = makeNode(n, g);
          list.appendChild(el);
          els[n.id] = el;
          info[n.id] = n;
        });
        els[g.id] = sec;
        info[g.id] = { id: g.id, isGroup: true };
      });
    });

    nodes.forEach(function (n) {
      if (!els[n.id]) console.warn('[work-map] node "' + n.id + '" references unknown group "' + n.group + '"');
    });

    // Edge layers
    var svg = s('svg', { 'class': 'wm-edges', 'aria-hidden': 'true', focusable: 'false' });
    var defs = s('defs', {});
    ['', '-active'].forEach(function (suf) {
      var m = s('marker', {
        id: uid + '-arrow' + suf, viewBox: '0 0 10 10', refX: '9', refY: '5',
        markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse'
      });
      m.appendChild(s('path', { d: 'M0,0 L10,5 L0,10 z', 'class': 'wm-arrowhead' + suf }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);
    var edgeLayer = s('g', {});
    svg.appendChild(edgeLayer);
    map.appendChild(svg);

    var labelLayer = h('div', 'wm-elabels');
    labelLayer.setAttribute('aria-hidden', 'true');
    map.appendChild(labelLayer);

    var edgeObjs = [];
    edges.forEach(function (e) {
      if (!els[e.from] || !els[e.to]) { console.warn('[work-map] edge references unknown id', e); return; }
      var path = s('path', { 'class': 'wm-edge' + (isPending(e.status) ? ' is-pending' : '') });
      edgeLayer.appendChild(path);
      var lab = null;
      if (e.label) {
        lab = h('span', 'wm-elabel' + (isPending(e.status) ? ' is-pending' : ''), e.label);
        labelLayer.appendChild(lab);
      }
      var o = { spec: e, path: path, label: lab };
      setMarkers(o, false);
      edgeObjs.push(o);
    });

    function setMarkers(o, active) {
      var dir = o.spec.dir || 'forward';
      var ref = 'url(#' + uid + '-arrow' + (active ? '-active' : '') + ')';
      if (dir === 'none') return;
      o.path.setAttribute('marker-end', ref);
      if (dir === 'both') o.path.setAttribute('marker-start', ref);
    }

    // Screen-reader list of connections
    if (edgeObjs.length) {
      var sr = h('div', rowKeys.length > 1 ? 'wm-flow' : 'sr-only');
      sr.appendChild(h('h2', 'wm-flow-title', 'Connections'));
      var ul = h('ul');
      edgeObjs.forEach(function (o) {
        var e = o.spec;
        var name = function (id) { var n = info[id]; return n && !n.isGroup ? n.title : (groups.filter(function (g) { return g.id === id; })[0] || {}).label || id; };
        var join = e.dir === 'none' || e.dir === 'both' ? ' ↔ ' : ' → ';
        ul.appendChild(h('li', null, name(e.from) + join + name(e.to) + (e.label ? ': ' + e.label : '') + (isPending(e.status) ? ' (' + STATUS_TEXT[e.status] + ')' : '')));
      });
      sr.appendChild(ul);
      container.appendChild(sr);
    }

    // Layout
    function rel(el) {
      var r = el.getBoundingClientRect(), m = map.getBoundingClientRect();
      return { x: r.left - m.left, y: r.top - m.top, w: r.width, h: r.height };
    }

    function draw() {
      svg.setAttribute('width', map.offsetWidth);
      svg.setAttribute('height', map.offsetHeight);
      edgeObjs.forEach(function (o) {
        var g = geom(rel(els[o.spec.from]), rel(els[o.spec.to]));
        o.path.setAttribute('d', g.d);
        if (o.label) {
          var pt = bez(g, o.spec.labelAt != null ? o.spec.labelAt : 0.5);
          o.label.style.left = Math.round(pt.x + (o.spec.labelDx || 0)) + 'px';
          o.label.style.top = Math.round(pt.y + (o.spec.labelDy || 0)) + 'px';
        }
      });
    }

    var raf = 0;
    function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    draw();
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(map);
    window.addEventListener('resize', schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);

    // Hover / focus highlighting
    function groupOf(id) { return info[id] && info[id].group; }

    function activate(id) {
      map.classList.add('is-focus');
      els[id].classList.add('is-active');
      var grp = groupOf(id);
      edgeObjs.forEach(function (o) {
        var f = o.spec.from, t = o.spec.to;
        var fromHit = f === id || (grp && f === grp);
        var toHit = t === id || (grp && t === grp);
        if (!fromHit && !toHit) return;
        o.path.classList.add('is-active');
        if (o.label) o.label.classList.add('is-active');
        setMarkers(o, true);
        var other = els[fromHit ? t : f];
        other.classList.add('is-related');
        if (other.classList.contains('wm-group')) {
          other.querySelectorAll('.wm-node').forEach(function (n) { n.classList.add('is-related'); });
        }
      });
    }

    function deactivate() {
      map.classList.remove('is-focus');
      map.querySelectorAll('.is-active, .is-related').forEach(function (n) { n.classList.remove('is-active', 'is-related'); });
      edgeObjs.forEach(function (o) { setMarkers(o, false); });
    }

    Object.keys(info).forEach(function (id) {
      var n = info[id];
      if (n.isGroup) return;
      var el = els[id];
      var on = function () { deactivate(); activate(id); showTip(n, el); };
      var off = function () { deactivate(); hideTip(); };
      el.addEventListener('mouseenter', on);
      el.addEventListener('mouseleave', off);
      el.addEventListener('focus', on);
      el.addEventListener('blur', off);
      el.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') hideTip(); });
    });
    window.addEventListener('scroll', hideTip, { passive: true });

    // Help find unfilled placeholder links
    var todo = nodes.filter(function (n) { return n.url && /REPLACE/i.test(n.url); }).map(function (n) { return n.id; });
    if (todo.length) console.info('[work-map] placeholder links still to replace: ' + todo.join(', '));

    return { redraw: draw };
  }

  function makeNode(n, g) {
    var el = n.url ? h('a', 'wm-node') : h('div', 'wm-node');
    if (n.url) {
      el.href = n.url;
      el.target = '_blank';
      el.rel = 'noopener';
    } else {
      el.tabIndex = 0;
      el.setAttribute('role', 'group');
    }
    el.dataset.id = n.id;
    el.style.setProperty('--accent', 'var(--a-' + (n.accent || g.accent || 'slate') + ')');
    if (isPending(n.status)) el.classList.add('is-pending');
    if (n.grow) { el.style.flex = n.grow + ' 1 140px'; el.style.maxWidth = 'none'; }

    var title = h('span', 'wm-node-title', n.title);
    if (isPending(n.status)) title.appendChild(h('span', 'wm-tag', STATUS_TEXT[n.status]));
    el.appendChild(title);
    if (n.subtitle) el.appendChild(h('span', 'wm-node-sub', n.subtitle));
    if (n.url) {
      var ext = h('span', 'wm-ext', '↗');
      ext.setAttribute('aria-hidden', 'true');
      el.appendChild(ext);
    }

    var parts = [n.title + '.'];
    if (n.subtitle) parts.push(n.subtitle + '.');
    if (n.detail) parts.push(n.detail);
    if (n.stack && n.stack.length) parts.push('Stack: ' + n.stack.join(', ') + '.');
    if (isPending(n.status)) parts.push('Status: ' + STATUS_TEXT[n.status] + '.');
    if (n.url) parts.push('Opens case study in a new tab.');
    el.setAttribute('aria-label', parts.join(' '));
    return el;
  }

  /* ---------------- legend ---------------- */

  function renderLegend(el, spec) {
    var legend = spec.legend || {};
    el.innerHTML = '';
    el.setAttribute('aria-label', 'Legend');

    function item(visual, text) {
      var it = h('span', 'legend-item');
      it.appendChild(visual);
      it.appendChild(h('span', null, text));
      el.appendChild(it);
    }
    item(h('span', 'legend-box'), legend.shipped || 'shipped');
    var dashed = h('span', 'legend-box is-pending');
    item(dashed, legend.pending || 'in progress / planned');

    var directed = legend.edgeDirected !== false;
    var svg = s('svg', { width: '28', height: '10', 'aria-hidden': 'true' });
    svg.appendChild(s('path', { d: directed ? 'M1,5 L22,5' : 'M1,5 L27,5', 'class': 'legend-line' }));
    if (directed) svg.appendChild(s('path', { d: 'M21,1 L28,5 L21,9 z', 'class': 'legend-head' }));
    item(svg, legend.edge || 'data flow');
  }

  /* ---------------- loading ---------------- */

  function loadJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' returned ' + r.status);
      return r.json();
    });
  }

  function showError(el, err) {
    console.error(err);
    el.innerHTML = '';
    var box = h('div', 'notice');
    box.textContent = 'Could not load the map data (' + err.message + '). ' +
      (location.protocol === 'file:' ? 'Browsers block JSON loading from file:// — run a local server (see README).' : '');
    el.appendChild(box);
  }

  window.WorkMap = {
    render: render,
    renderLegend: renderLegend,
    initTheme: initTheme,
    loadJSON: loadJSON,
    showError: showError
  };
})();
