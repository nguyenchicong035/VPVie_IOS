// Vẽ đồ thị "như sách": trục có mũi tên, lưới, đánh dấu đỉnh/giao điểm/ y0, đường gióng,
// tiệm cận đứng/ngang, và tô miền nghiệm bất phương trình (hoặc hệ). Dùng math.js (nguồn mở).
(function (global) {
  "use strict";
  var M = global.math;
  var AX = "#334", CURVE = "#C21807", GRID = "#E3E9EF", MARK = "#1F6FEB", DASH = "#8A98A6", FILL = "rgba(31,111,235,.16)";

  function compile(expr) { try { return M.parse(expr).compile(); } catch (e) { return null; } }
  function val(c, x) { try { var y = c.evaluate({ x: x }); return (typeof y === "number" && isFinite(y)) ? y : NaN; } catch (e) { return NaN; } }

  // Tìm nghiệm của f trong [a,b] bằng đổi dấu + chia đôi
  function roots(c, a, b, step) {
    var rs = [], prev = val(c, a), px = a, x, y;
    for (x = a + step; x <= b; x += step) {
      y = val(c, x);
      if (!isNaN(prev) && !isNaN(y) && prev === 0) { rs.push(px); }
      if (!isNaN(prev) && !isNaN(y) && prev * y < 0) {
        var lo = px, hi = x, fl = prev, m, fm;
        for (var i = 0; i < 40; i++) { m = (lo + hi) / 2; fm = val(c, m); if (isNaN(fm)) break; if (fl * fm <= 0) hi = m; else { lo = m; fl = fm; } }
        rs.push((lo + hi) / 2);
      }
      prev = y; px = x;
    }
    // gộp nghiệm trùng
    var out = []; rs.sort(function (a, b) { return a - b; }).forEach(function (r) { if (!out.length || Math.abs(out[out.length - 1] - r) > step * 0.6) out.push(r); });
    return out;
  }

  // Điểm gián đoạn (tiệm cận đứng): giá trị nhảy vọt lớn giữa hai mẫu
  function vAsymptotes(c, a, b, step) {
    var as = [], prev = val(c, a), px = a, x, y;
    for (x = a + step; x <= b; x += step) {
      y = val(c, x);
      if (!isNaN(prev) && !isNaN(y) && (prev * y < 0) && (Math.abs(prev) + Math.abs(y) > 50)) {
        // tinh vị trí nơi |f| lớn nhất quanh đây
        as.push((px + x) / 2);
      }
      prev = y; px = x;
    }
    return as;
  }

  function draw(container, expr, opts) {
    opts = opts || {};
    container.innerHTML = "";
    var W = opts.w || 380, H = opts.h || 300;
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.style.width = W + "px"; cv.style.height = H + "px";
    container.appendChild(cv);
    var g = cv.getContext("2d");

    // --- Phân tích bất phương trình
    var ineqs = parseIneqs(expr);
    var xmin = opts.xmin != null ? opts.xmin : -10, xmax = opts.xmax != null ? opts.xmax : 10;
    var ymin = opts.ymin != null ? opts.ymin : -7.5, ymax = opts.ymax != null ? opts.ymax : 7.5;

    // Tự co giãn y theo hàm (nếu là hàm thường)
    var mainC = null;
    if (!ineqs.length) {
      var e2 = expr.replace(/^\s*y\s*=\s*/i, ""); mainC = compile(e2);
      if (mainC && opts.autoY !== false) {
        var lo = Infinity, hi = -Infinity;
        for (var sx = xmin; sx <= xmax; sx += (xmax - xmin) / 200) { var sy = val(mainC, sx); if (!isNaN(sy) && Math.abs(sy) < 1e4) { if (sy < lo) lo = sy; if (sy > hi) hi = sy; } }
        if (isFinite(lo) && isFinite(hi) && hi - lo > 0.5) { var pad = (hi - lo) * 0.18; ymin = Math.max(-40, Math.min(-1, lo - pad)); ymax = Math.min(40, Math.max(1, hi + pad)); }
      }
    }
    function X(x) { return (x - xmin) / (xmax - xmin) * W; }
    function Y(y) { return H - (y - ymin) / (ymax - ymin) * H; }

    // --- Tô miền nghiệm bất phương trình (quét lưới điểm)
    if (ineqs.length) {
      var img = g.getImageData(0, 0, W, H), d = img.data, fc = [31, 111, 235];
      for (var py = 0; py < H; py += 1) for (var px = 0; px < W; px += 1) {
        var xr = xmin + px / W * (xmax - xmin), yr = ymax - py / H * (ymax - ymin);
        var ok = true;
        for (var k = 0; k < ineqs.length && ok; k++) if (!ineqs[k].test(xr, yr)) ok = false;
        if (ok) { var idx = (py * W + px) * 4; d[idx] = fc[0]; d[idx + 1] = fc[1]; d[idx + 2] = fc[2]; d[idx + 3] = 70; }
      }
      g.putImageData(img, 0, 0);
    }

    drawGridAxes(g, W, H, X, Y, xmin, xmax, ymin, ymax);

    // --- Đường biên bất phương trình (nét đứt nếu < > ; liền nếu ≤ ≥)
    ineqs.forEach(function (iq) { plotCurve(g, iq.boundary, X, Y, xmin, xmax, iq.strict ? [6, 5] : [], MARK, H); });

    // --- Vẽ hàm chính + đánh dấu
    if (mainC) {
      plotCurve(g, mainC, X, Y, xmin, xmax, [], CURVE, H);
      if (opts.marks !== false) markup(g, mainC, expr, X, Y, xmin, xmax, ymin, ymax, W, H);
    }
    return cv;
  }

  function parseIneqs(expr) {
    // tách hệ theo ; hoặc xuống dòng
    var parts = expr.split(/;|\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [];
    parts.forEach(function (p) {
      var m = p.match(/^(.*?)(<=|>=|≤|≥|<|>)(.*)$/);
      if (!m) return;
      var lhs = m[1].trim(), op = m[2], rhs = m[3].trim();
      // chuẩn hoá về dạng y <op> f(x) hoặc g(x,y) <op> 0
      var cL = compileXY(lhs), cR = compileXY(rhs);
      if (!cL || !cR) return;
      var ge = (op === ">" || op === ">=" || op === "≥");
      var strict = (op === "<" || op === ">");
      out.push({
        strict: strict,
        test: function (x, y) { var L = cL(x, y), R = cR(x, y); if (isNaN(L) || isNaN(R)) return false; return ge ? (strict ? L > R : L >= R) : (strict ? L < R : L <= R); },
        boundary: boundaryFn(lhs, rhs)
      });
    });
    return out;
  }
  function compileXY(s) { try { var n = M.parse(s); var c = n.compile(); return function (x, y) { try { var v = c.evaluate({ x: x, y: y }); return typeof v === "number" ? v : NaN; } catch (e) { return NaN; } }; } catch (e) { return null; } }
  // Đường biên: nếu một vế là y, biên là y = vế kia; ngược lại bỏ qua (chỉ tô miền)
  function boundaryFn(lhs, rhs) {
    if (/^y$/i.test(lhs)) return compile(rhs);
    if (/^y$/i.test(rhs)) return compile(lhs);
    return null;
  }

  function plotCurve(g, c, X, Y, xmin, xmax, dash, color, H) {
    if (!c) return;
    g.save(); g.strokeStyle = color; g.lineWidth = 2.2; g.setLineDash(dash || []); g.beginPath();
    var started = false, step = (xmax - xmin) / 700, prevPy = NaN, hh = H || 300;
    for (var x = xmin; x <= xmax; x += step) {
      var y = val(c, x);
      if (isNaN(y)) { started = false; prevPy = NaN; continue; }
      var px = X(x), py = Y(y);
      // ngắt nét khi nhảy quá 1 màn hình (tiệm cận đứng / gián đoạn)
      if (started && Math.abs(py - prevPy) > hh * 0.95) started = false;
      if (py < -hh * 3 || py > hh * 4) { started = false; prevPy = py; continue; }
      if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
      prevPy = py;
    }
    g.stroke(); g.restore();
  }

  function niceStep(range) { var raw = range / 10, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), n = raw / p; var s = n < 1.5 ? 1 : (n < 3 ? 2 : (n < 7 ? 5 : 10)); return s * p; }
  function drawGridAxes(g, W, H, X, Y, xmin, xmax, ymin, ymax) {
    g.save();
    var sx = niceStep(xmax - xmin), sy = niceStep(ymax - ymin);
    var x0 = Math.max(0, Math.min(W, X(0))), y0 = Math.max(0, Math.min(H, Y(0)));
    // lưới
    g.strokeStyle = GRID; g.lineWidth = 1; g.beginPath();
    for (var gx = Math.ceil(xmin / sx) * sx; gx <= xmax; gx += sx) { g.moveTo(X(gx), 0); g.lineTo(X(gx), H); }
    for (var gy = Math.ceil(ymin / sy) * sy; gy <= ymax; gy += sy) { g.moveTo(0, Y(gy)); g.lineTo(W, Y(gy)); }
    g.stroke();
    // trục
    g.strokeStyle = AX; g.lineWidth = 1.5; g.fillStyle = AX; g.font = "11px 'Segoe UI'";
    g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.moveTo(X(0), H); g.lineTo(X(0), 0); g.stroke();
    arrow(g, W, Y(0), 1, 0); arrow(g, X(0), 0, 0, -1);
    g.fillText("x", W - 10, Y(0) - 6); g.fillText("y", X(0) + 7, 11); g.fillText("O", X(0) + 4, Y(0) + 13);
    // số trên trục (bước đẹp, không chồng)
    g.textAlign = "center";
    for (var tx = Math.ceil(xmin / sx) * sx; tx <= xmax; tx += sx) { if (Math.abs(tx) < 1e-9) continue; g.fillText(fmt(tx), X(tx), y0 + 14); }
    g.textAlign = "right";
    for (var ty = Math.ceil(ymin / sy) * sy; ty <= ymax; ty += sy) { if (Math.abs(ty) < 1e-9) continue; g.fillText(fmt(ty), x0 - 5, Y(ty) + 4); }
    g.restore();
  }
  function arrow(g, x, y, dx, dy) { g.save(); g.fillStyle = AX; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 7 * dx + 4 * dy, y - 7 * dy - 4 * dx); g.lineTo(x - 7 * dx - 4 * dy, y - 7 * dy + 4 * dx); g.closePath(); g.fill(); g.restore(); }

  // Đánh dấu đỉnh/cực trị, giao trục Ox, giao Oy, tiệm cận + đường gióng
  function markup(g, c, expr, X, Y, xmin, xmax, ymin, ymax, W, H) {
    var e2 = expr.replace(/^\s*y\s*=\s*/i, ""), step = (xmax - xmin) / 400;
    // Giao Ox
    roots(c, xmin, xmax, step).forEach(function (r) { marker(g, X, Y, r, 0, fmt(r), ymin, ymax); });
    // Giao Oy
    var y0 = val(c, 0); if (!isNaN(y0) && Math.abs(y0) < 1e4) marker(g, X, Y, 0, y0, null, ymin, ymax, true);
    // Cực trị (đạo hàm = 0)
    try {
      var dStr = M.derivative(e2, "x").toString(), dC = compile(dStr);
      if (dC) roots(dC, xmin, xmax, step).forEach(function (xe) { var ye = val(c, xe); if (!isNaN(ye) && Math.abs(ye) < 1e4) marker(g, X, Y, xe, ye, null, ymin, ymax, false, true); });
    } catch (e) {}
    // Tiệm cận đứng
    vAsymptotes(c, xmin, xmax, step).forEach(function (xa) { dashLine(g, X(xa), 0, X(xa), H, "#C77"); });
    // Tiệm cận ngang (giới hạn ở ±∞ hội tụ)
    var yL = val(c, 1e6), yR = val(c, -1e6);
    if (!isNaN(yL) && !isNaN(yR) && Math.abs(yL - yR) < 0.05 && Math.abs(yL) < 1e4 && yL > ymin && yL < ymax) dashLine(g, 0, Y(yL), W, Y(yL), "#C77");
  }
  function marker(g, X, Y, x, y, label, ymin, ymax, isY, isVertex) {
    var px = X(x), py = Y(y);
    // đường gióng
    dashLine(g, px, py, px, Y(0), DASH); dashLine(g, px, py, X(0), py, DASH);
    g.save(); g.fillStyle = isVertex ? "#1A7F37" : MARK; g.beginPath(); g.arc(px, py, 3.4, 0, 6.2832); g.fill();
    g.font = "11px 'Segoe UI'"; g.fillStyle = "#223";
    var t = isVertex ? ("(" + fmt(x) + "; " + fmt(y) + ")") : (isY ? ("(0; " + fmt(y) + ")") : ("(" + fmt(x) + "; 0)"));
    g.fillText(t, px + 5, py - 5); g.restore();
  }
  function dashLine(g, x1, y1, x2, y2, col) { g.save(); g.strokeStyle = col; g.lineWidth = 1; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore(); }
  function fmt(v) { var r = Math.round(v * 100) / 100; return String(r); }

  global.VPGrapher = { draw: draw };
})(window);
