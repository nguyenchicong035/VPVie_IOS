// VPVie – Nhận dạng chữ viết tay THEO NÉT (stroke-based / online recognition).
// Dùng thuật toán $P Point-Cloud Recognizer (Wobbrock, Anthony & Wobbrock 2012 –
// nguồn mở, miễn phí). Khác với Tesseract (OCR trên ảnh), cách này dùng CHÍNH QUỸ ĐẠO
// nét vẽ (toạ độ + nhiều nét) nên mạnh với chữ số & ký hiệu toán viết tay, và có thể
// "dạy" thêm mẫu nét của riêng người dùng để tăng độ chính xác.
//
// API: VPInk.recognizeSymbol(strokes) -> {name, score}         (1 ký hiệu, strokes = [[{x,y}...]...])
//      VPInk.recognizeItems(items) -> {text, latex, symbols}   (nhiều nét trên canvas -> biểu thức)
//      VPInk.learn(name, strokes)  (dạy 1 mẫu, lưu localStorage)
//      VPInk.templates() / removeUserTemplate(i) / resetUser()
(function (global) {
  "use strict";
  var N = 32;                 // số điểm chuẩn hoá cho mỗi ký hiệu
  var STORE = "vpvie.ink.templates";
  var _user = load();         // mẫu do người dùng dạy
  var _seed = null;           // mẫu sẵn (tạo 1 lần)

  // ---------- $P core ----------
  function Point(x, y, id) { return { x: x, y: y, id: id }; }
  function pathLen(pts) { var d = 0; for (var i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return d; }
  function resample(points, n) {
    var I = pathLen(points) / (n - 1), D = 0, out = [points[0]];
    var pts = points.slice();
    for (var i = 1; i < pts.length; i++) {
      if (pts[i].id === pts[i - 1].id) {
        var d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (D + d >= I) {
          var qx = pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x);
          var qy = pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y);
          var q = Point(qx, qy, pts[i].id);
          out.push(q); pts.splice(i, 0, q); D = 0;
        } else D += d;
      }
    }
    while (out.length < n) out.push(Point(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[pts.length - 1].id));
    return out;
  }
  function scaleTranslate(points) {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    points.forEach(function (p) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); });
    var s = Math.max(maxx - minx, maxy - miny) || 1, cx = 0, cy = 0;
    var out = points.map(function (p) { return Point((p.x - minx) / s, (p.y - miny) / s, p.id); });
    out.forEach(function (p) { cx += p.x; cy += p.y; });
    cx /= out.length; cy /= out.length;
    out.forEach(function (p) { p.x -= cx; p.y -= cy; });
    return out;
  }
  function normalize(strokes) {
    // strokes: [[{x,y},...], ...] -> point cloud chuẩn hoá
    var pts = [];
    strokes.forEach(function (s, i) { s.forEach(function (p) { pts.push(Point(p.x, p.y, i)); }); });
    if (pts.length < 2) return null;
    return scaleTranslate(resample(pts, N));
  }
  function cloudDistance(pts1, pts2, start) {
    var matched = new Array(pts1.length).fill(false), sum = 0, i = start;
    do {
      var min = Infinity, index = -1;
      for (var j = 0; j < pts2.length; j++) if (!matched[j]) {
        var d = Math.hypot(pts1[i].x - pts2[j].x, pts1[i].y - pts2[j].y);
        if (d < min) { min = d; index = j; }
      }
      if (index >= 0) { matched[index] = true; }
      var weight = 1 - ((i - start + pts1.length) % pts1.length) / pts1.length;
      sum += weight * min;
      i = (i + 1) % pts1.length;
    } while (i !== start);
    return sum;
  }
  function greedyMatch(pts1, pts2) {
    var e = 0.5, step = Math.max(1, Math.round(Math.pow(pts1.length, 1 - e))), min = Infinity;
    for (var i = 0; i < pts1.length; i += step) {
      min = Math.min(min, cloudDistance(pts1, pts2, i), cloudDistance(pts2, pts1, i));
    }
    return min;
  }

  // ---------- Mẫu sẵn (seed) ----------
  function L() { var a = []; for (var k = 0; k < arguments.length; k += 2) a.push({ x: arguments[k], y: arguments[k + 1] }); return a; }
  function seeds() {
    if (_seed) return _seed;
    var T = [];
    function add(name, strokes) { var nm = normalize(strokes); if (nm) T.push({ name: name, pts: nm }); }
    // chữ số
    add("0", [L(50, 0, 20, 10, 5, 40, 5, 70, 25, 95, 55, 95, 75, 70, 75, 40, 60, 10, 50, 0)]);
    add("1", [L(20, 15, 40, 0, 40, 95)]);
    add("1", [L(40, 0, 40, 95)]);
    add("2", [L(5, 20, 25, 0, 55, 5, 60, 30, 10, 95, 65, 95)]);
    add("3", [L(5, 10, 45, 0, 55, 25, 30, 48, 58, 60, 50, 92, 8, 90)]);
    add("4", [L(45, 0, 5, 60, 70, 60), L(50, 25, 50, 95)]);
    add("5", [L(60, 5, 15, 5, 10, 45, 45, 40, 62, 62, 45, 92, 8, 85)]);
    add("6", [L(55, 5, 20, 35, 10, 70, 30, 95, 60, 80, 60, 55, 30, 48, 12, 62)]);
    add("7", [L(5, 8, 65, 8, 30, 95)]);
    add("8", [L(40, 0, 15, 20, 40, 45, 15, 70, 40, 95, 65, 70, 40, 45, 65, 20, 40, 0)]);
    add("9", [L(55, 45, 25, 55, 15, 30, 40, 8, 60, 25, 55, 60, 35, 95)]);
    // toán tử
    add("+", [L(10, 45, 70, 45), L(40, 10, 40, 85)]);
    add("-", [L(10, 45, 75, 45)]);
    add("=", [L(10, 32, 75, 32), L(10, 60, 75, 60)]);
    add("x", [L(10, 10, 70, 80), L(70, 10, 10, 80)]);   // cũng là dấu nhân
    add("(", [L(55, 0, 20, 45, 55, 95)]);
    add(")", [L(20, 0, 55, 45, 20, 95)]);
    add(".", [L(40, 85, 44, 88, 40, 90, 38, 86, 40, 85)]);
    add("/", [L(65, 5, 10, 95)]);
    // vài chữ cái thường gặp trong toán
    add("a", [L(55, 30, 30, 22, 15, 45, 30, 70, 55, 60, 55, 30, 55, 70), L(55, 70, 72, 72)]);
    add("b", [L(20, 0, 20, 95), L(20, 55, 45, 40, 62, 58, 45, 80, 20, 72)]);
    add("y", [L(15, 30, 35, 70, 55, 30), L(55, 30, 35, 100, 12, 108)]);
    add("n", [L(18, 30, 18, 90), L(18, 45, 40, 30, 60, 45, 60, 90)]);
    add("π", [L(10, 30, 70, 30), L(28, 30, 24, 90), L(52, 30, 52, 90)]);
    _seed = T; return T;
  }

  // ---------- Lưu/dạy ----------
  function load() { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { return []; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(_user)); } catch (e) {} }
  function learn(name, strokes) {
    var nm = normalize(strokes); if (!nm) return false;
    _user.push({ name: String(name), pts: nm }); save(); return true;
  }
  function templates() { return _user.slice(); }
  function removeUserTemplate(i) { if (i >= 0 && i < _user.length) { _user.splice(i, 1); save(); } }
  function resetUser() { _user = []; save(); }

  // ---------- Nhận dạng 1 ký hiệu ----------
  function recognizeSymbol(strokes) {
    var cand = normalize(strokes); if (!cand) return { name: "", score: 0 };
    var best = null, bestD = Infinity;
    var all = seeds().concat(_user);          // mẫu người dùng được ưu tiên bằng cách nằm sau (nếu hoà)
    all.forEach(function (t) {
      var d = greedyMatch(cand, t.pts);
      if (d < bestD) { bestD = d; best = t; }
    });
    if (!best) return { name: "", score: 0 };
    var score = Math.max(0, Math.round((1 - bestD / 2) * 100)); // 0..100 tương đối
    return { name: best.name, score: score, dist: bestD };
  }

  // ---------- Nhận dạng nhiều nét trên canvas -> biểu thức ----------
  function itemToStroke(it) {
    if (it.type === "stroke") return (it.points || []).map(function (p) { return { x: p.x, y: p.y }; });
    return null;
  }
  function bbox(stroke) {
    var mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    stroke.forEach(function (p) { mnx = Math.min(mnx, p.x); mny = Math.min(mny, p.y); mxx = Math.max(mxx, p.x); mxy = Math.max(mxy, p.y); });
    return { minx: mnx, miny: mny, maxx: mxx, maxy: mxy, cx: (mnx + mxx) / 2, cy: (mny + mxy) / 2, w: mxx - mnx, h: mxy - mny };
  }
  // Gom các nét gần nhau theo phương ngang thành từng ký hiệu
  function groupStrokes(strokes) {
    var withBox = strokes.map(function (s) { return { s: s, b: bbox(s) }; });
    withBox.sort(function (a, b) { return a.b.minx - b.b.minx; });
    var avgW = withBox.reduce(function (t, o) { return t + o.b.w; }, 0) / (withBox.length || 1);
    var gap = Math.max(10, avgW * 0.35);
    var groups = [], cur = null;
    withBox.forEach(function (o) {
      if (cur && o.b.minx <= cur.maxx + gap && overlapY(o.b, cur)) {
        cur.strokes.push(o.s); cur.maxx = Math.max(cur.maxx, o.b.maxx);
        cur.minx = Math.min(cur.minx, o.b.minx); cur.miny = Math.min(cur.miny, o.b.miny); cur.maxy = Math.max(cur.maxy, o.b.maxy);
      } else {
        cur = { strokes: [o.s], minx: o.b.minx, maxx: o.b.maxx, miny: o.b.miny, maxy: o.b.maxy };
        groups.push(cur);
      }
    });
    return groups;
  }
  function overlapY(b, g) { return !(b.miny > g.maxy + (g.maxy - g.miny) || b.maxy < g.miny - (g.maxy - g.miny)); }

  function recognizeItems(items) {
    var strokes = (items || []).map(itemToStroke).filter(Boolean);
    if (!strokes.length) return { text: "", latex: "", symbols: [] };
    var groups = groupStrokes(strokes);
    var heights = groups.map(function (g) { return g.maxy - g.miny; }).sort(function (a, b) { return a - b; });
    var medH = heights[Math.floor(heights.length / 2)] || 1;
    var baseY = groups.reduce(function (t, g) { return t + g.maxy; }, 0) / groups.length;
    var syms = [], out = "", latex = "";
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], r = recognizeSymbol(g.strokes);
      var sym = { name: r.name, score: r.score, box: g };
      syms.push(sym); out += r.name;
      // mũ (số nhỏ, nằm cao) -> ^{...}
      var small = (g.maxy - g.miny) < medH * 0.72, high = g.maxy < baseY - medH * 0.3;
      if (small && high && /[0-9n]/.test(r.name) && latex) latex += "^{" + r.name + "}";
      else latex += (r.name === "x" ? "\\times " : r.name);
    }
    return { text: out, latex: latex.trim(), symbols: syms };
  }

  global.VPInk = {
    recognizeSymbol: recognizeSymbol, recognizeItems: recognizeItems,
    learn: learn, templates: templates, removeUserTemplate: removeUserTemplate, resetUser: resetUser,
    normalize: normalize, _seedCount: function () { return seeds().length; }
  };
})(window);
