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
  // grp: "digit" | "op" | "var" (chữ hay dùng trong toán) | "lower" | "upper"
  function seeds() {
    if (_seed) return _seed;
    var T = [];
    function add(name, grp, strokes) { var nm = normalize(strokes); if (nm) T.push({ name: name, grp: grp, pts: nm }); }
    // ----- Chữ số (nhiều kiểu viết cho mỗi số để tăng độ chính xác) -----
    add("0", "digit", [L(50, 0, 20, 10, 5, 40, 5, 70, 25, 95, 55, 95, 75, 70, 75, 40, 60, 10, 50, 0)]);
    add("0", "digit", [L(45, 2, 20, 25, 20, 72, 45, 95, 70, 72, 70, 25, 45, 2)]);
    add("1", "digit", [L(20, 18, 40, 0, 40, 95)]);
    add("1", "digit", [L(40, 0, 40, 95)]);
    add("1", "digit", [L(18, 20, 42, 0, 42, 92, 18, 92, 66, 92)]);
    add("2", "digit", [L(5, 20, 25, 0, 55, 5, 60, 30, 10, 95, 65, 95)]);
    add("2", "digit", [L(10, 25, 30, 5, 58, 12, 58, 38, 12, 92, 68, 92)]);
    add("3", "digit", [L(5, 10, 45, 0, 55, 25, 30, 48, 58, 60, 50, 92, 8, 90)]);
    add("3", "digit", [L(8, 12, 48, 4, 52, 30, 28, 46, 55, 54, 52, 90, 10, 88)]);
    add("4", "digit", [L(45, 0, 5, 60, 70, 60), L(50, 25, 50, 95)]);
    add("4", "digit", [L(52, 0, 10, 62, 72, 62, 52, 20, 52, 95)]);
    add("5", "digit", [L(60, 5, 15, 5, 10, 45, 45, 40, 62, 62, 45, 92, 8, 85)]);
    add("5", "digit", [L(62, 6, 18, 6, 14, 46, 48, 42, 64, 64, 46, 92, 10, 86)]);
    add("6", "digit", [L(55, 5, 20, 35, 10, 70, 30, 95, 60, 80, 60, 55, 30, 48, 12, 62)]);
    add("6", "digit", [L(58, 4, 25, 40, 14, 72, 34, 94, 62, 82, 60, 56, 30, 50)]);
    add("7", "digit", [L(5, 8, 65, 8, 30, 95)]);
    add("7", "digit", [L(8, 8, 68, 8, 34, 95), L(22, 55, 50, 55)]);
    add("8", "digit", [L(40, 0, 15, 20, 40, 45, 15, 70, 40, 95, 65, 70, 40, 45, 65, 20, 40, 0)]);
    add("8", "digit", [L(42, 2, 18, 22, 42, 46, 66, 70, 42, 94, 18, 70, 42, 46, 66, 22, 42, 2)]);
    add("9", "digit", [L(55, 45, 25, 55, 15, 30, 40, 8, 60, 25, 55, 60, 35, 95)]);
    add("9", "digit", [L(58, 48, 28, 56, 18, 30, 44, 8, 62, 24, 58, 58, 40, 95)]);
    // ----- Toán tử & dấu -----
    add("+", "op", [L(10, 45, 70, 45), L(40, 10, 40, 85)]);
    add("-", "op", [L(10, 45, 75, 45)]);
    add("=", "op", [L(10, 32, 75, 32), L(10, 60, 75, 60)]);
    add("(", "op", [L(55, 0, 20, 45, 55, 95)]);
    add(")", "op", [L(20, 0, 55, 45, 20, 95)]);
    add(".", "op", [L(40, 85, 44, 88, 40, 90, 38, 86, 40, 85)]);
    add(",", "op", [L(44, 82, 46, 90, 38, 100)]);
    add("/", "op", [L(65, 5, 10, 95)]);
    add("<", "op", [L(70, 10, 12, 48, 70, 86)]);
    add(">", "op", [L(14, 10, 72, 48, 14, 86)]);
    add("√", "op", [L(6, 54, 18, 48, 34, 88, 56, 10, 94, 10)]);   // căn bậc hai
    // ----- Chữ cái hay gặp trong toán (ưu tiên khi ở chế độ Công thức) -----
    add("x", "var", [L(10, 10, 70, 80), L(70, 10, 10, 80)]);
    add("y", "var", [L(15, 30, 35, 70, 55, 30), L(55, 30, 35, 100, 12, 108)]);
    add("a", "var", [L(55, 30, 30, 22, 15, 45, 30, 70, 55, 60, 55, 30, 55, 70), L(55, 70, 72, 72)]);
    add("b", "var", [L(20, 0, 20, 95), L(20, 55, 45, 40, 62, 58, 45, 80, 20, 72)]);
    add("c", "var", [L(70, 38, 42, 26, 20, 48, 22, 72, 44, 88, 72, 78)]);
    add("m", "var", [L(14, 30, 14, 90), L(14, 44, 30, 30, 40, 44, 40, 90), L(40, 44, 54, 30, 66, 44, 66, 90)]);
    add("n", "var", [L(18, 30, 18, 90), L(18, 45, 40, 30, 60, 45, 60, 90)]);
    add("t", "var", [L(45, 8, 45, 86, 62, 82), L(26, 34, 62, 34)]);
    add("π", "var", [L(10, 30, 70, 30), L(28, 30, 24, 90), L(52, 30, 52, 90)]);
    // ----- Chữ thường a–z (kiểu in, cho chế độ Chữ) -----
    add("a", "lower", [L(55, 30, 30, 22, 15, 45, 30, 70, 55, 60, 55, 30, 55, 92)]);
    add("c", "lower", [L(70, 38, 42, 26, 20, 48, 22, 72, 44, 88, 72, 78)]);
    add("d", "lower", [L(70, 0, 70, 92), L(70, 50, 45, 36, 24, 55, 42, 82, 70, 72)]);
    add("e", "lower", [L(20, 60, 72, 58, 66, 38, 44, 28, 22, 46, 24, 72, 52, 90)]);
    add("g", "lower", [L(66, 36, 44, 28, 26, 44, 42, 62, 66, 54, 66, 36), L(66, 44, 66, 95, 40, 110, 18, 100)]);
    add("h", "lower", [L(20, 0, 20, 92), L(20, 48, 42, 34, 62, 50, 62, 92)]);
    add("i", "lower", [L(40, 32, 40, 92), L(40, 12, 41, 14, 40, 16, 39, 14, 40, 12)]);
    add("k", "lower", [L(22, 0, 22, 92), L(22, 60, 60, 32), L(34, 52, 62, 92)]);
    add("l", "lower", [L(40, 0, 40, 92)]);
    add("o", "lower", [L(45, 28, 22, 45, 22, 72, 45, 88, 68, 72, 68, 45, 45, 28)]);
    add("p", "lower", [L(22, 30, 22, 112), L(22, 50, 46, 34, 64, 52, 46, 78, 22, 70)]);
    add("q", "lower", [L(66, 30, 66, 112), L(66, 50, 42, 34, 24, 52, 42, 78, 66, 70)]);
    add("r", "lower", [L(22, 30, 22, 92), L(22, 48, 40, 32, 60, 36)]);
    add("s", "lower", [L(66, 40, 44, 28, 26, 40, 42, 55, 60, 64, 48, 86, 24, 80)]);
    add("u", "lower", [L(22, 30, 22, 75, 42, 88, 62, 74, 62, 30), L(62, 30, 62, 92)]);
    add("v", "lower", [L(18, 30, 45, 90, 72, 30)]);
    add("w", "lower", [L(12, 30, 30, 90, 45, 48, 60, 90, 78, 30)]);
    add("z", "lower", [L(20, 34, 70, 34, 22, 88, 72, 88)]);
    // ----- Chữ hoa A–Z -----
    add("A", "upper", [L(12, 95, 45, 5, 78, 95), L(26, 60, 64, 60)]);
    add("B", "upper", [L(20, 5, 20, 95), L(20, 5, 56, 14, 56, 44, 20, 50), L(20, 50, 62, 56, 62, 86, 20, 95)]);
    add("C", "upper", [L(76, 22, 46, 8, 20, 32, 20, 68, 46, 92, 76, 80)]);
    add("D", "upper", [L(20, 5, 20, 95), L(20, 5, 56, 16, 72, 50, 56, 84, 20, 95)]);
    add("E", "upper", [L(72, 5, 20, 5, 20, 95, 72, 95), L(20, 50, 58, 50)]);
    add("F", "upper", [L(72, 5, 20, 5, 20, 95), L(20, 50, 56, 50)]);
    add("G", "upper", [L(76, 22, 46, 8, 20, 32, 20, 68, 46, 92, 76, 80, 76, 55, 54, 55)]);
    add("H", "upper", [L(20, 5, 20, 95), L(72, 5, 72, 95), L(20, 50, 72, 50)]);
    add("I", "upper", [L(40, 5, 40, 95)]);
    add("J", "upper", [L(62, 5, 62, 78, 42, 95, 22, 80)]);
    add("K", "upper", [L(20, 5, 20, 95), L(20, 54, 70, 5), L(32, 44, 72, 95)]);
    add("L", "upper", [L(20, 5, 20, 95, 72, 95)]);
    add("M", "upper", [L(14, 95, 14, 5, 45, 58, 76, 5, 76, 95)]);
    add("N", "upper", [L(18, 95, 18, 5, 74, 95, 74, 5)]);
    add("O", "upper", [L(48, 6, 20, 28, 20, 72, 48, 94, 76, 72, 76, 28, 48, 6)]);
    add("P", "upper", [L(20, 5, 20, 95), L(20, 5, 58, 14, 58, 46, 20, 52)]);
    add("Q", "upper", [L(48, 6, 20, 28, 20, 72, 48, 94, 76, 72, 76, 28, 48, 6), L(56, 70, 82, 98)]);
    add("R", "upper", [L(20, 5, 20, 95), L(20, 5, 58, 14, 58, 46, 20, 52), L(34, 52, 72, 95)]);
    add("S", "upper", [L(72, 24, 46, 8, 22, 24, 40, 46, 62, 56, 50, 84, 22, 82)]);
    add("T", "upper", [L(10, 8, 80, 8), L(45, 8, 45, 95)]);
    add("U", "upper", [L(20, 5, 20, 74, 46, 92, 72, 74, 72, 5)]);
    add("V", "upper", [L(14, 8, 45, 95, 76, 8)]);
    add("W", "upper", [L(10, 8, 30, 95, 45, 42, 60, 95, 80, 8)]);
    add("X", "upper", [L(18, 8, 74, 95), L(74, 8, 18, 95)]);
    add("Y", "upper", [L(18, 8, 45, 50, 72, 8), L(45, 50, 45, 95)]);
    add("Z", "upper", [L(14, 10, 80, 10, 16, 92, 82, 92)]);
    _seed = T; return T;
  }
  // Chọn bộ mẫu theo chế độ để giảm nhầm lẫn chữ/số
  function seedSet(mode) {
    var all = seeds();
    if (mode === "math") return all.filter(function (t) { return t.grp === "digit" || t.grp === "op" || t.grp === "var"; });
    if (mode === "text") return all.filter(function (t) { return t.grp !== "var"; }); // chữ: digit + op + lower + upper
    return all; // auto: tất cả
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
  function recognizeSymbol(strokes, mode) {
    var cand = normalize(strokes); if (!cand) return { name: "", score: 0 };
    var best = null, bestD = Infinity;
    seedSet(mode).forEach(function (t) {
      var d = greedyMatch(cand, t.pts);
      if (d < bestD) { bestD = d; best = t; }
    });
    // Mẫu người dùng dạy LUÔN được xét và được ưu tiên hơn một chút (×0.85).
    _user.forEach(function (t) {
      var d = greedyMatch(cand, t.pts) * 0.85;
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

  function recognizeItems(items, mode) {
    var strokes = (items || []).map(itemToStroke).filter(Boolean);
    if (!strokes.length) return { text: "", latex: "", symbols: [] };
    var groups = groupStrokes(strokes);
    var heights = groups.map(function (g) { return g.maxy - g.miny; }).sort(function (a, b) { return a - b; });
    var medH = heights[Math.floor(heights.length / 2)] || 1;
    var baseY = groups.reduce(function (t, g) { return t + g.maxy; }, 0) / groups.length;
    var syms = [], out = "", latex = "", sqrtDepth = 0;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], r = recognizeSymbol(g.strokes, mode);
      var sym = { name: r.name, score: r.score, box: g };
      syms.push(sym); out += r.name;
      // Căn bậc hai: mở \sqrt{ và bọc các ký hiệu phía sau (người dùng chỉnh lại trong hộp công thức nếu cần)
      if (r.name === "√") { latex += "\\sqrt{"; sqrtDepth++; continue; }
      // mũ (số nhỏ, nằm cao) -> ^{...}
      var small = (g.maxy - g.miny) < medH * 0.72, high = g.maxy < baseY - medH * 0.3;
      if (small && high && /[0-9a-zA-Z]/.test(r.name) && latex && !/[{(]$/.test(latex)) latex += "^{" + r.name + "}";
      else latex += r.name;   // x giữ là biến (không tự đổi thành dấu nhân)
    }
    while (sqrtDepth-- > 0) latex += "}";
    return { text: out, latex: latex.trim(), symbols: syms };
  }

  global.VPInk = {
    recognizeSymbol: recognizeSymbol, recognizeItems: recognizeItems,
    learn: learn, templates: templates, removeUserTemplate: removeUserTemplate, resetUser: resetUser,
    normalize: normalize, _seedCount: function () { return seeds().length; }
  };
})(window);
