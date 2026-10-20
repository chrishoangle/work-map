/* Work map renderer: one component for the landing map and per-project diagrams.
   Spec format is documented in README.md. No dependencies. */
(function () {
  "use strict";

  /* ---------- theme ---------- */
  var THEME_KEY = "workmap-theme";
  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function saveTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* storage blocked: fine */ }
  }
  function initialTheme() {
    var q = new URLSearchParams(location.search).get("theme");
    if (q === "light" || q === "dark") return q;
    var s = storedTheme();
    if (s === "light" || s === "dark") return s;
    return "dark"; // dark is the default
  }
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    var btn = document.querySelector(".theme-toggle");
    if (btn) {
      btn.textContent = t === "dark" ? "light mode" : "dark mode";
      btn.setAttribute("aria-label", "Switch to " + (t === "dark" ? "light" : "dark") + " mode");
    }
  }
  function wireThemeToggle() {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(next);
      saveTheme(next);
    });
  }
  setTheme(initialTheme());

  /* ---------- helpers ---------- */
  var SVGNS = "http://www.w3.org/2000/svg";
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  var uid = 0;

  /* ---------- render ---------- */
  function renderDiagram(root, spec, opts) {
    opts = opts || {};
    var mode = opts.mode || "map"; // "map" (landing) or "arch" (project diagram)
    var id = "d" + (++uid);
    root.innerHTML = "";
    root.classList.add("diagram", "diagram-" + mode);

    var grid = el("div", "diagram-grid");
    grid.style.setProperty("--cols", String(spec.groups.length));
    if (mode === "arch") grid.style.gap = "96px";
    root.appendChild(grid);

    var nodeEls = {};
    var nodeById = {};
    spec.nodes.forEach(function (n) { nodeById[n.id] = n; });

    spec.groups.forEach(function (g) {
      var box = el("section", "group");
      box.setAttribute("aria-label", g.label + (g.sublabel ? ", " + g.sublabel : ""));
      box.appendChild(el("h2", "group-label", g.label));
      if (g.sublabel) box.appendChild(el("p", "group-sublabel", g.sublabel));
      var list = el("div", "nodes");
      var groupHasEdges = (spec.edges || []).some(function (e) {
        return spec.nodes.some(function (n) { return n.group === g.id && (n.id === e.from || n.id === e.to); });
      });
      if (mode === "arch" || groupHasEdges) list.style.gap = "30px";
      box.appendChild(list);

      spec.nodes.filter(function (n) { return n.group === g.id; }).forEach(function (n) {
        var wrap = el("div", "node-wrap");
        var status = n.status || "shipped";
        var node;
        var desc = n.title + (n.subtitle ? ", " + n.subtitle : "");
        if (status === "planned") desc += " (planned)";
        if (status === "tbd") desc += " (details to confirm)";

        if (n.link) {
          node = el("a", "node status-" + status);
          node.href = n.link;
          node.target = "_blank";
          node.rel = "noopener";
          node.setAttribute("aria-label", desc + ". Opens case study in a new tab.");
          node.appendChild(el("span", "node-arrow", "↗"));
        } else {
          node = el("div", "node status-" + status);
          node.tabIndex = 0;
          node.setAttribute("role", "group");
          node.setAttribute("aria-label", desc + (mode === "map" ? ". Case study coming soon." : "") +
            (n.stack && n.stack.length ? " Stack: " + n.stack.join(", ") + "." : ""));
        }
        node.dataset.id = n.id;
        node.appendChild(el("span", "node-title", n.title));
        if (n.subtitle) node.appendChild(el("span", "node-sub", n.subtitle));

        var meta = el("span", "node-meta");
        if (status === "planned") meta.appendChild(el("span", "badge planned", "planned"));
        if (status === "tbd") meta.appendChild(el("span", "badge tbd", "to confirm"));
        if (mode === "map" && !n.link) meta.appendChild(el("span", "badge", "case study soon"));
        if (meta.childNodes.length) node.appendChild(meta);

        wrap.appendChild(node);
        if (mode === "map" && n.diagram) {
          var d = el("a", "diagram-link mono", "architecture ↗");
          d.href = (opts.archPage || "arch.html") + "?spec=" + encodeURIComponent(n.diagram);
          d.target = "_blank";
          d.rel = "noopener";
          d.setAttribute("aria-label", "Architecture diagram for " + n.title + ", opens in a new tab");
          wrap.appendChild(d);
        }
        list.appendChild(wrap);
        nodeEls[n.id] = node;
      });
      grid.appendChild(box);
    });

    /* edges layer */
    var edges = (spec.edges || []).filter(function (e) { return nodeEls[e.from] && nodeEls[e.to]; });
    var layer = svg("svg", { "class": "edges", "aria-hidden": "true" });
    var defs = svg("defs", {});
    ["", "-active", "-planned", "-tbd"].forEach(function (s) {
      var m = svg("marker", { id: id + "-arrow" + s, viewBox: "0 0 10 10", refX: "9", refY: "5",
        markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
      m.appendChild(svg("path", { d: "M0,0 L10,5 L0,10 z", "class": "arrowhead" + s }));
      defs.appendChild(m);
    });
    layer.appendChild(defs);
    root.appendChild(layer);

    /* accessible text version of the flows */
    if (edges.length) {
      var flow = el("div", mode === "arch" ? "flow-list" : "sr-only");
      flow.appendChild(el("h2", "group-label", "Connections"));
      var ul = el("ul");
      edges.forEach(function (e) {
        ul.appendChild(el("li", null, nodeById[e.from].title + (e.plain ? " and " : " \u2192 ") + nodeById[e.to].title +
          (e.label ? " (" + e.label + ")" : "") + (e.status === "planned" && e.label !== "planned" ? ", planned" : "")));
      });
      flow.appendChild(ul);
      root.appendChild(flow);
    }

    /* tooltip */
    var tip = el("div", "tooltip");
    tip.setAttribute("role", "tooltip");
    tip.id = id + "-tip";
    root.appendChild(tip);

    var edgeEls = [];

    function rel(r, base) {
      return { left: r.left - base.left, right: r.right - base.left, top: r.top - base.top,
        bottom: r.bottom - base.top, cx: (r.left + r.right) / 2 - base.left, cy: (r.top + r.bottom) / 2 - base.top };
    }
    function between(a, b, others) {
      // is any other node in the same column strictly between a and b vertically?
      var top = Math.min(a.bottom, b.bottom), bot = Math.max(a.top, b.top);
      return others.some(function (o) {
        return o.right > Math.max(a.left, b.left) && o.left < Math.min(a.right, b.right) &&
          o.top >= top - 1 && o.bottom <= bot + 1;
      });
    }

    function draw() {
      while (layer.childNodes.length > 1) layer.removeChild(layer.lastChild);
      edgeEls = [];
      var base = root.getBoundingClientRect();
      layer.setAttribute("width", base.width);
      layer.setAttribute("height", base.height);
      var stacked = window.matchMedia("(max-width: 640px)").matches;
      var rects = {};
      Object.keys(nodeEls).forEach(function (k) { rects[k] = rel(nodeEls[k].getBoundingClientRect(), base); });
      var gutter = 0;

      // spread multiple edges that meet the same side of a node, ordered to avoid crossings
      var ports = {};
      function sideKey(nid, side) { return nid + ":" + side; }
      edges.forEach(function (e, i) {
        var a = rects[e.from], b = rects[e.to];
        if (b.left < a.right && b.right > a.left) return; // vertical edges use centers
        var ltr = b.left >= a.right;
        var ks = sideKey(e.from, ltr ? "R" : "L"), kt = sideKey(e.to, ltr ? "L" : "R");
        (ports[ks] = ports[ks] || []).push({ i: i, other: b.cy });
        (ports[kt] = ports[kt] || []).push({ i: i, other: a.cy });
      });
      function portY(nid, side, i) {
        var list = ports[sideKey(nid, side)], r = rects[nid];
        if (!list || list.length < 2) return { y: r.cy, n: list ? list.length : 1 };
        list.sort(function (p, q) { return p.other - q.other; });
        var k = list.findIndex(function (p) { return p.i === i; });
        var span = Math.min(r.bottom - r.top - 16, 14 * (list.length - 1));
        return { y: r.cy - span / 2 + span * k / (list.length - 1), n: list.length };
      }
      function bez(p0, p1, p2, p3, t) {
        var u = 1 - t;
        return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
      }

      edges.forEach(function (e, ei) {
        var a = rects[e.from], b = rects[e.to];
        var overlapX = b.left < a.right && b.right > a.left;
        var d, lx, ly, anchor = "middle", showLabel = !!e.label;
        if (overlapX) {
          var others = Object.keys(rects).filter(function (k) { return k !== e.from && k !== e.to; })
            .map(function (k) { return rects[k]; });
          var down = b.top >= a.bottom;
          if (!between(a, b, others)) {
            var x = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
            var y1 = down ? a.bottom : a.top, y2 = down ? b.top : b.bottom;
            d = "M" + x + "," + y1 + " L" + x + "," + y2;
            lx = x + 8; ly = (y1 + y2) / 2 + 4; anchor = "start";
          } else {
            // route around the left side so the line does not cross other boxes
            gutter += 1;
            var gx = Math.min(a.left, b.left) - 10 - gutter * 5;
            d = "M" + a.left + "," + a.cy + " C" + gx + "," + a.cy + " " + gx + "," + b.cy + " " + b.left + "," + b.cy;
            showLabel = false;
          }
        } else {
          var ltr = b.left >= a.right;
          var x1 = ltr ? a.right : a.left, x2 = ltr ? b.left : b.right;
          var ps = portY(e.from, ltr ? "R" : "L", ei), pt = portY(e.to, ltr ? "L" : "R", ei);
          var y1 = ps.y, y2 = pt.y;
          var dx = (x2 - x1) / 2;
          d = "M" + x1 + "," + y1 + " C" + (x1 + dx) + "," + y1 + " " + (x2 - dx) + "," + y2 + " " + x2 + "," + y2;
          // put the label where edges are spread apart: near the target on fan-out, near the source on fan-in
          var t = ps.n > 1 ? 0.78 : pt.n > 1 ? 0.22 : 0.5;
          lx = bez(x1, x1 + dx, x2 - dx, x2, t); ly = bez(y1, y1, y2, y2, t) + 4;
        }
        if (stacked) showLabel = showLabel && overlapX;

        var st = e.status || "shipped";
        var g = svg("g", { "class": "edge status-" + st });
        var marker = st === "planned" ? "-planned" : st === "tbd" ? "-tbd" : "";
        var p = svg("path", { d: d });
        if (!e.plain) p.setAttribute("marker-end", "url(#" + id + "-arrow" + marker + ")");
        if (e.both) p.setAttribute("marker-start", "url(#" + id + "-arrow" + marker + ")");
        g.dataset.marker = marker;
        g.dataset.both = e.both ? "1" : "";
        g.dataset.plain = e.plain ? "1" : "";
        g.appendChild(p);
        if (showLabel) {
          var t = svg("text", { x: lx, y: ly, "text-anchor": anchor });
          t.textContent = e.label;
          g.appendChild(t);
          layer.appendChild(g);
          var bb = t.getBBox();
          g.insertBefore(svg("rect", { x: bb.x - 4, y: bb.y - 2, width: bb.width + 8, height: bb.height + 4, rx: 3 }), t);
        } else {
          layer.appendChild(g);
        }
        edgeEls.push({ g: g, path: p, from: e.from, to: e.to });
      });
    }

    /* hover / focus highlighting */
    function activate(nid) {
      root.classList.add("has-active");
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove("is-active", "is-linked"); });
      nodeEls[nid].classList.add("is-active");
      edgeEls.forEach(function (x) {
        var on = x.from === nid || x.to === nid;
        x.g.classList.toggle("is-active", on);
        var mk = "url(#" + id + "-arrow" + (on ? "-active" : x.g.dataset.marker) + ")";
        if (!x.g.dataset.plain) x.path.setAttribute("marker-end", mk);
        if (x.g.dataset.both) x.path.setAttribute("marker-start", mk);
        if (on) nodeEls[x.from === nid ? x.to : x.from].classList.add("is-linked");
      });
      showTip(nid);
    }
    function deactivate() {
      root.classList.remove("has-active");
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove("is-active", "is-linked"); });
      edgeEls.forEach(function (x) {
        x.g.classList.remove("is-active");
        if (!x.g.dataset.plain) x.path.setAttribute("marker-end", "url(#" + id + "-arrow" + x.g.dataset.marker + ")");
        if (x.g.dataset.both) x.path.setAttribute("marker-start", "url(#" + id + "-arrow" + x.g.dataset.marker + ")");
      });
      tip.classList.remove("show");
    }
    function showTip(nid) {
      var n = nodeById[nid];
      if (!n.stack || !n.stack.length) { tip.classList.remove("show"); return; }
      tip.innerHTML = "";
      tip.appendChild(el("div", "tooltip-label", "Stack"));
      var chips = el("div", "chips");
      n.stack.forEach(function (s) { chips.appendChild(el("span", "chip", s)); });
      tip.appendChild(chips);
      var base = root.getBoundingClientRect();
      var r = rel(nodeEls[nid].getBoundingClientRect(), base);
      tip.style.left = "0px"; tip.style.top = "0px";
      tip.classList.add("show");
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left, top = Math.max(r.top, 0);
      if (r.right + 10 + tw <= base.width) left = r.right + 10;
      else if (r.left - 10 - tw >= 0) left = r.left - 10 - tw;
      else { left = Math.min(Math.max(r.left, 0), base.width - tw); top = r.bottom + 8; }
      tip.style.left = left + "px";
      tip.style.top = top + "px";
      nodeEls[nid].setAttribute("aria-describedby", tip.id);
    }
    Object.keys(nodeEls).forEach(function (k) {
      var n = nodeEls[k];
      n.addEventListener("mouseenter", function () { activate(k); });
      n.addEventListener("mouseleave", function () { if (document.activeElement !== n) deactivate(); });
      n.addEventListener("focus", function () { activate(k); });
      n.addEventListener("blur", deactivate);
    });

    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(root);
    else window.addEventListener("resize", draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  }

  function legend(spec) {
    var hasPlanned = spec.nodes.some(function (n) { return n.status === "planned"; }) ||
      (spec.edges || []).some(function (e) { return e.status === "planned"; });
    var hasTbd = spec.nodes.some(function (n) { return n.status === "tbd"; });
    var hasEdges = (spec.edges || []).length > 0;
    var hasBuilt = spec.nodes.some(function (n) { return !n.status || n.status === "shipped"; });
    var lg = el("div", "legend");
    lg.setAttribute("aria-hidden", "true");
    if (!hasPlanned && !hasTbd && !hasEdges) return lg; // nothing to explain
    if (hasBuilt) { var s1 = el("span"); s1.appendChild(el("i", "swatch")); s1.appendChild(document.createTextNode("built")); lg.appendChild(s1); }
    if (hasPlanned) { var s2 = el("span"); s2.appendChild(el("i", "swatch planned")); s2.appendChild(document.createTextNode("in progress / planned")); lg.appendChild(s2); }
    if (hasTbd) { var s3 = el("span"); s3.appendChild(el("i", "swatch tbd")); s3.appendChild(document.createTextNode("details to confirm")); lg.appendChild(s3); }
    if (hasEdges) {
      var allPlain = (spec.edges || []).every(function (e) { return e.plain; });
      lg.appendChild(el("span", null, allPlain ? "── shares data / code" : "→ data / code flow"));
    }
    return lg;
  }

  function load(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " returned " + r.status);
      return r.json();
    });
  }

  window.WorkMap = { renderDiagram: renderDiagram, legend: legend, load: load, wireThemeToggle: wireThemeToggle, el: el };
})();
