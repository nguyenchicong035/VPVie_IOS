// Hình học động: điểm/đoạn/đường/tròn + DỰNG HÌNH (trung điểm, trung trực, phân giác,
// giao điểm) và TÂM TAM GIÁC (trọng tâm, trực tâm, tâm ngoại/nội tiếp). Kéo điểm -> cập nhật tức thì.
(function (global) {
  "use strict";
  var PT = "#1F3D55", SH = "#13697A", DRV = "#C2410C";

  // Số điểm cần chọn cho mỗi công cụ dựng hình
  var NEED = { segment: 2, line: 2, circle: 2, mid: 2, perpbis: 2, bisector: 3, centroid: 3, ortho: 3, circum: 3, incenter: 3 };

  var G = {
    points: [], shapes: [], tool: null, sel: [], dragging: null, seq: 0,

    setTool: function (t) { this.tool = t; this.sel = []; },
    active: function () { return !!this.tool; },
    clear: function () { this.points = []; this.shapes = []; this.sel = []; this.seq = 0; },
    label: function () { var i = this.seq++; var c = String.fromCharCode(65 + (i % 26)); return i < 26 ? c : c + Math.floor(i / 26); },
    get: function (id) { for (var i = 0; i < this.points.length; i++) if (this.points[i].id === id) return this.points[i]; return null; },
    hit: function (pt, tol) { for (var i = this.points.length - 1; i >= 0; i--) { var p = this.points[i]; if (Math.hypot(p.x - pt.x, p.y - pt.y) <= (tol || 12)) return p; } return null; },
    addPoint: function (pt) { var p = { id: "p" + (Date.now() + Math.random()), x: pt.x, y: pt.y, label: this.label() }; this.points.push(p); return p; },
    pick: function (pt) { return this.hit(pt, 12) || this.addPoint(pt); },
    addDerived: function (d, label) { var p = { id: "p" + (Date.now() + Math.random()), x: 0, y: 0, label: label == null ? this.label() : label, d: d }; this.points.push(p); return p; },

    construct: function (ids) {
      var t = this.tool, a = ids[0], b = ids[1], c = ids[2];
      if (t === "segment") this.shapes.push({ type: "segment", a: a, b: b });
      else if (t === "line") this.shapes.push({ type: "line", a: a, b: b });
      else if (t === "circle") this.shapes.push({ type: "circle", c: a, p: b });
      else if (t === "mid") this.addDerived({ t: "mid", p: [a, b] }, "M");
      else if (t === "centroid") this.addDerived({ t: "centroid", p: [a, b, c] }, "G");
      else if (t === "ortho") this.addDerived({ t: "ortho", p: [a, b, c] }, "H");
      else if (t === "incenter") this.addDerived({ t: "incenter", p: [a, b, c] }, "I");
      else if (t === "circum") { var O = this.addDerived({ t: "circum", p: [a, b, c] }, "O"); this.shapes.push({ type: "circle", c: O.id, p: a }); }
      else if (t === "perpbis") { var M = this.addDerived({ t: "mid", p: [a, b] }, ""); var P = this.addDerived({ t: "perp", base: M.id, a: a, b: b, len: 130 }, ""); this.shapes.push({ type: "line", a: M.id, b: P.id }); }
      else if (t === "bisector") { var P2 = this.addDerived({ t: "bisect", b: b, a: a, c: c, len: 150 }, ""); this.shapes.push({ type: "line", a: b, b: P2.id }); }
    },

    onDown: function (pt) {
      if (this.tool === "move") { this.dragging = this.hit(pt, 14); if (this.dragging && this.dragging.d) this.dragging = null; return; }
      if (this.tool === "point") { this.addPoint(pt); return; }
      var need = NEED[this.tool]; if (!need) return;
      var p = this.pick(pt); this.sel.push(p.id);
      if (this.sel.length === need) { if (new Set(this.sel).size === need) this.construct(this.sel); this.sel = []; }
    },
    onMove: function (pt) { if (this.dragging) { this.dragging.x = pt.x; this.dragging.y = pt.y; return true; } return false; },
    onUp: function () { this.dragging = null; },

    resolve: function () {
      var self = this;
      function P(id) { var q = self.get(id); return q ? { x: q.x, y: q.y } : { x: 0, y: 0 }; }
      for (var pass = 0; pass < 3; pass++) {
        this.points.forEach(function (p) {
          if (!p.d) return; var d = p.d;
          if (d.t === "mid") { var a = P(d.p[0]), b = P(d.p[1]); p.x = (a.x + b.x) / 2; p.y = (a.y + b.y) / 2; }
          else if (d.t === "centroid") { var A = P(d.p[0]), B = P(d.p[1]), C = P(d.p[2]); p.x = (A.x + B.x + C.x) / 3; p.y = (A.y + B.y + C.y) / 3; }
          else if (d.t === "circum") { var o = circum(P(d.p[0]), P(d.p[1]), P(d.p[2])); p.x = o.x; p.y = o.y; }
          else if (d.t === "ortho") { var a2 = P(d.p[0]), b2 = P(d.p[1]), c2 = P(d.p[2]); var o2 = circum(a2, b2, c2); p.x = a2.x + b2.x + c2.x - 2 * o2.x; p.y = a2.y + b2.y + c2.y - 2 * o2.y; }
          else if (d.t === "incenter") { var A3 = P(d.p[0]), B3 = P(d.p[1]), C3 = P(d.p[2]); var la = dist(B3, C3), lb = dist(C3, A3), lc = dist(A3, B3), s = la + lb + lc || 1; p.x = (la * A3.x + lb * B3.x + lc * C3.x) / s; p.y = (la * A3.y + lb * B3.y + lc * C3.y) / s; }
          else if (d.t === "perp") { var m = P(d.base), aa = P(d.a), bb = P(d.b); var dx = bb.x - aa.x, dy = bb.y - aa.y, L = Math.hypot(dx, dy) || 1; p.x = m.x - dy / L * d.len; p.y = m.y + dx / L * d.len; }
          else if (d.t === "bisect") { var Bp = P(d.b), Ap = P(d.a), Cp = P(d.c); var u = unit(Ap, Bp), v = unit(Cp, Bp); var w = { x: u.x + v.x, y: u.y + v.y }; var wl = Math.hypot(w.x, w.y) || 1; p.x = Bp.x + w.x / wl * d.len; p.y = Bp.y + w.y / wl * d.len; }
        });
      }
    },

    render: function (ctx, w, h) {
      this.resolve();
      ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = SH; ctx.fillStyle = SH;
      var self = this;
      this.shapes.forEach(function (s) {
        if (s.type === "segment") { var a = self.get(s.a), b = self.get(s.b); if (a && b) line(ctx, a.x, a.y, b.x, b.y); }
        else if (s.type === "line") { var a2 = self.get(s.a), b2 = self.get(s.b); if (a2 && b2) extLine(ctx, a2, b2, w, h); }
        else if (s.type === "circle") { var c = self.get(s.c), p = self.get(s.p); if (c && p) { ctx.beginPath(); ctx.arc(c.x, c.y, Math.hypot(p.x - c.x, p.y - c.y), 0, Math.PI * 2); ctx.stroke(); } }
      });
      ctx.font = "13px 'Segoe UI'";
      this.points.forEach(function (p) {
        var der = !!p.d; ctx.fillStyle = der ? DRV : PT;
        ctx.beginPath(); ctx.arc(p.x, p.y, der ? 4 : 4.5, 0, Math.PI * 2); ctx.fill();
        if (p.label) { ctx.fillStyle = der ? DRV : "#0E2436"; ctx.fillText(p.label, p.x + 8, p.y - 7); }
      });
      if (this.sel.length) { this.sel.forEach(function (id) { var sp = self.get(id); if (sp) { ctx.strokeStyle = "#E3A008"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2); ctx.stroke(); } }); }
      ctx.restore();
    },
  };

  function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function extLine(ctx, a, b, w, h) { var dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L; var big = (w + h) * 2; line(ctx, a.x - dx * big, a.y - dy * big, a.x + dx * big, a.y + dy * big); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function unit(a, b) { var dx = a.x - b.x, dy = a.y - b.y, L = Math.hypot(dx, dy) || 1; return { x: dx / L, y: dy / L }; }
  function circum(A, B, C) {
    var d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y)) || 1e-9;
    var a2 = A.x * A.x + A.y * A.y, b2 = B.x * B.x + B.y * B.y, c2 = C.x * C.x + C.y * C.y;
    return { x: (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d, y: (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d };
  }

  global.VPGeo = G;
})(window);
