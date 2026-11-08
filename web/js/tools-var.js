// Bảng biến thiên & bảng xét dấu tự động từ hàm số (dùng math.js: đạo hàm, tính giá trị; tìm nghiệm bằng số).
(function (global) {
  "use strict";
  var M = function () { return global.math; };

  function bisect(f, a, b) {
    var fa = f(a), fb = f(b);
    for (var i = 0; i < 60; i++) { var m = (a + b) / 2, fm = f(m); if (fm === 0 || (b - a) < 1e-10) return m; if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; } }
    return (a + b) / 2;
  }
  function roots(f, xmin, xmax, steps) {
    var rs = [], prev, px = xmin;
    try { prev = f(xmin); } catch (e) { prev = NaN; }
    for (var i = 1; i <= steps; i++) {
      var x = xmin + (xmax - xmin) * i / steps, v;
      try { v = f(x); } catch (e) { v = NaN; }
      if (isFinite(prev) && isFinite(v)) {
        if ((prev < 0 && v > 0) || (prev > 0 && v < 0)) rs.push(bisect(f, px, x));
        else if (Math.abs(v) < 1e-9) rs.push(x);
      }
      prev = v; px = x;
    }
    rs.sort(function (a, b) { return a - b; });
    var out = []; rs.forEach(function (r) { if (!out.length || Math.abs(r - out[out.length - 1]) > (xmax - xmin) * 1e-3) out.push(r); });
    return out;
  }
  function fmt(v) {
    if (!isFinite(v)) return v > 0 ? "+∞" : "−∞";
    if (Math.abs(v) > 1e4) return v > 0 ? "+∞" : "−∞";
    var r = Math.round(v * 1000) / 1000;
    return (r === 0 ? 0 : r).toString().replace("-", "−");
  }
  function fmtx(v) { var r = Math.round(v * 1000) / 1000; return (r === 0 ? 0 : r).toString().replace("-", "−"); }

  function analyze(expr, xmin, xmax, useDeriv) {
    var math = M();
    var node = math.parse(expr);
    var dnode = useDeriv ? math.derivative(node, "x") : node;
    var g = function (x) { return dnode.evaluate({ x: x }); };
    var f = function (x) { return node.evaluate({ x: x }); };
    var rts = roots(g, xmin, xmax, 3000);
    var pts = [-Infinity].concat(rts).concat([Infinity]);
    var signs = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i] === -Infinity ? rts.length ? rts[0] - 1 : xmin : pts[i];
      var b = pts[i + 1] === Infinity ? (rts.length ? rts[rts.length - 1] + 1 : xmax) : pts[i + 1];
      var mid = (a + b) / 2;
      if (pts[i] === -Infinity) mid = (rts.length ? rts[0] : xmax) - 1;
      if (pts[i + 1] === Infinity) mid = (rts.length ? rts[rts.length - 1] : xmin) + 1;
      var s = 0; try { s = Math.sign(g(mid)); } catch (e) { s = 0; }
      signs.push(s);
    }
    return { f: f, g: g, node: node, dnode: dnode, dstr: dnode.toString(), roots: rts, signs: signs };
  }

  function cell(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function buildTable(body, data, mode) {
    body.innerHTML = "";
    var xmin = data.xmin != null ? data.xmin : -10, xmax = data.xmax != null ? data.xmax : 10;
    var A;
    try { A = analyze(data.expr, xmin, xmax, mode === "bbt"); }
    catch (e) { body.textContent = "Không phân tích được: " + data.expr; return; }
    var cap = cell("div", "ov-cap", mode === "bbt" ? ("Bảng biến thiên của y = " + data.expr) : ("Bảng xét dấu: " + data.expr));
    body.appendChild(cap);
    if (mode === "bbt") { var dc = cell("div", "var-deriv", "y' = " + A.dstr); body.appendChild(dc); }

    var rts = A.roots, signs = A.signs;
    var tbl = cell("table", "vartbl");
    // Dòng x
    var rx = cell("tr"); rx.appendChild(cell("th", null, "x"));
    rx.appendChild(cell("td", "pt", "−∞"));
    rts.forEach(function (r) { rx.appendChild(cell("td", "gap")); rx.appendChild(cell("td", "pt", fmtx(r))); });
    rx.appendChild(cell("td", "gap")); rx.appendChild(cell("td", "pt", "+∞"));
    tbl.appendChild(rx);

    // Dòng dấu (y' với bbt, hoặc biểu thức với xét dấu)
    var label = mode === "bbt" ? "y'" : "dấu";
    var rs = cell("tr"); rs.appendChild(cell("th", null, label));
    rs.appendChild(cell("td", "pt"));
    for (var i = 0; i < signs.length; i++) {
      rs.appendChild(cell("td", "sign", signs[i] > 0 ? "+" : signs[i] < 0 ? "−" : "0"));
      if (i < rts.length) rs.appendChild(cell("td", "pt zero", "0"));
    }
    rs.appendChild(cell("td", "pt"));
    tbl.appendChild(rs);

    if (mode === "bbt") {
      // Dòng y: mũi tên + cực trị
      var ry = cell("tr"); ry.appendChild(cell("th", null, "y"));
      ry.appendChild(cell("td", "pt", signs[0] > 0 ? "−∞" : "+∞"));
      for (var j = 0; j < signs.length; j++) {
        ry.appendChild(cell("td", "arrow", signs[j] > 0 ? "↗" : "↘"));
        if (j < rts.length) {
          var y = A.f(rts[j]); var kind = (signs[j] > 0 && signs[j + 1] < 0) ? "CĐ" : (signs[j] < 0 && signs[j + 1] > 0) ? "CT" : "";
          ry.appendChild(cell("td", "pt ext", fmt(y) + (kind ? '<div class="ext-k">' + kind + "</div>" : "")));
        }
      }
      var last = signs[signs.length - 1];
      ry.appendChild(cell("td", "pt", last > 0 ? "+∞" : "−∞"));
      tbl.appendChild(ry);
    }
    body.appendChild(tbl);
  }

  // ---- Lưới sửa được: tạo từ hàm số, rồi vẽ bảng từ lưới ----
  // grid = { mode, moc: [{x, yp, y, ytype}], signs: ["+"/"−"/""] (giữa các mốc) }
  function gridFromExpr(expr, xmin, xmax, mode) {
    var A = analyze(expr, xmin, xmax, mode === "bbt");
    var rts = A.roots, signs = A.signs.map(function (s) { return s > 0 ? "+" : s < 0 ? "−" : "0"; });
    var moc = [{ x: "-inf", yp: "", y: "", ytype: "value" }];
    rts.forEach(function (r) { moc.push({ x: fmtx(r), yp: mode === "bbt" ? "0" : "0", y: "", ytype: "value" }); });
    moc.push({ x: "+inf", yp: "", y: "", ytype: "value" });
    if (mode === "bbt") {
      moc[0].y = signs[0] === "+" ? "-inf" : "+inf";
      rts.forEach(function (r, i) { moc[i + 1].y = fmt(A.f(r)); });
      moc[moc.length - 1].y = signs[signs.length - 1] === "+" ? "+inf" : "-inf";
    }
    return { mode: mode, expr: expr, deriv: A.dstr, moc: moc, signs: signs };
  }
  function parseVal(s) {
    s = (s || "").trim().toLowerCase().replace("−", "-").replace("∞", "inf");
    if (s === "-inf" || s === "-vc" || s === "-∞") return -Infinity;
    if (s === "inf" || s === "+inf" || s === "+∞" || s === "vc") return Infinity;
    try { return M().evaluate(s); } catch (e) { return NaN; }
  }
  function show(s) { if (s == null) return ""; s = ("" + s).trim(); var l = s.toLowerCase().replace("−", "-"); if (l === "-inf" || l === "-∞") return "−∞"; if (l === "inf" || l === "+inf" || l === "+∞") return "+∞"; return s.replace("-", "−"); }

  // Vẽ bảng biến thiên kiểu SGK bằng canvas: mũi tên dài chéo nối cực trị.
  function drawBBT(body, grid, W, H) {
    body.innerHTML = "";
    var moc = grid.moc, signs = grid.signs, n = moc.length;
    W = Math.max(320, Math.round(W || 520));
    var LBL = 46, rowX = 40, rowYp = 40, rowY = Math.max(96, Math.round((H || 190) - rowX - rowYp));
    H = rowX + rowYp + rowY;
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H; cv.style.width = W + "px"; cv.style.height = H + "px"; cv.style.maxWidth = "100%";
    body.appendChild(cv);
    var g = cv.getContext("2d");
    g.strokeStyle = "#1d2430"; g.fillStyle = "#1d2430"; g.lineWidth = 1.4;
    // Khung + đường kẻ
    g.strokeRect(0.7, 0.7, W - 1.4, H - 1.4);
    g.beginPath(); g.moveTo(LBL, 0); g.lineTo(LBL, H); g.stroke();
    var y1 = rowX, y2 = rowX + rowYp;
    g.beginPath(); g.moveTo(0, y1); g.lineTo(W, y1); g.moveTo(0, y2); g.lineTo(W, y2); g.stroke();
    // Nhãn x, y', y
    g.font = "italic 17px 'Times New Roman', serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("x", LBL / 2, rowX / 2); g.fillText("y′", LBL / 2, y1 + rowYp / 2); g.fillText("y", LBL / 2, y2 + rowY / 2);
    // Vị trí cột mốc
    var inner = W - LBL, xp = [];
    for (var i = 0; i < n; i++) xp.push(LBL + inner * (i + 0.5) / n);
    // Dòng x
    g.font = "16px 'Times New Roman', serif";
    moc.forEach(function (m, i) { g.fillText(show(m.x), xp[i], rowX / 2); });
    // Dòng y': dấu giữa các mốc + 0/‖ tại mốc trong
    for (var k = 0; k < signs.length; k++) { var mx = (xp[k] + xp[k + 1]) / 2; g.fillText(signs[k] === "||" ? "‖" : signs[k], mx, y1 + rowYp / 2); }
    moc.forEach(function (m, i) { if (i > 0 && i < n - 1) g.fillText(m.yp === "||" ? "‖" : (m.yp || ""), xp[i], y1 + rowYp / 2); });
    // Dòng y: mức trên/dưới + mũi tên dài
    var top = y2 + rowY * 0.26, bot = y2 + rowY * 0.80;
    var lvl = [];
    lvl[0] = signs[0] === "+" ? bot : (signs[0] === "−" ? top : (y2 + rowY / 2));
    for (var j = 1; j < n; j++) lvl[j] = signs[j - 1] === "+" ? top : (signs[j - 1] === "−" ? bot : (y2 + rowY / 2));
    function valText(m) { return m.ytype === "undef" ? "∄" : (m.ytype === "bar" ? "‖" : show(m.y)); }
    // vẽ mũi tên trước, rồi chữ đè lên
    g.lineWidth = 1.6;
    for (var a = 0; a < n - 1; a++) {
      if (moc[a].ytype === "bar" || moc[a + 1].ytype === "bar" || moc[a].ytype === "undef" || moc[a + 1].ytype === "undef") continue;
      var x1 = xp[a], yy1 = lvl[a], x2 = xp[a + 1], yy2 = lvl[a + 1];
      var ang = Math.atan2(yy2 - yy1, x2 - x1), gap = 24;
      var sx = x1 + Math.cos(ang) * gap, sy = yy1 + Math.sin(ang) * gap, ex = x2 - Math.cos(ang) * gap, ey = yy2 - Math.sin(ang) * gap;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 9 * Math.cos(ang - 0.42), ey - 9 * Math.sin(ang - 0.42)); g.lineTo(ex - 9 * Math.cos(ang + 0.42), ey - 9 * Math.sin(ang + 0.42)); g.closePath(); g.fill();
    }
    // vẽ ‖ cho mốc không xác định (suốt ô y)
    g.lineWidth = 1.4;
    moc.forEach(function (m, i) { if (m.ytype === "bar" || m.ytype === "undef") { g.beginPath(); g.moveTo(xp[i] - 3, y2 + 6); g.lineTo(xp[i] - 3, H - 6); g.moveTo(xp[i] + 3, y2 + 6); g.lineTo(xp[i] + 3, H - 6); g.stroke(); } });
    // chữ giá trị y
    g.font = "16px 'Times New Roman', serif";
    moc.forEach(function (m, i) { if (m.ytype === "bar" || m.ytype === "undef") return; g.fillText(valText(m), xp[i], lvl[i]); });
    return cv;
  }

  // Vẽ bảng biến thiên / xét dấu từ lưới (đã sửa tay)
  function buildFromGrid(body, data) {
    var grid = data.grid, mode = grid.mode, moc = grid.moc, signs = grid.signs;
    if (mode === "bbt") { drawBBT(body, grid, data.w, data.h); return; }
    body.innerHTML = "";
    var tbl = cell("table", "vartbl");
    // x
    var rx = cell("tr"); rx.appendChild(cell("th", null, "x"));
    moc.forEach(function (m, i) { rx.appendChild(cell("td", "pt", show(m.x))); if (i < moc.length - 1) rx.appendChild(cell("td", "gap")); });
    tbl.appendChild(rx);
    // y' (dấu)
    var rs = cell("tr"); rs.appendChild(cell("th", null, mode === "bbt" ? "y'" : "dấu"));
    moc.forEach(function (m, i) {
      rs.appendChild(cell("td", "pt zero", m.yp === "||" ? "‖" : (m.yp === "∄" ? "∄" : (m.yp || ""))));
      if (i < signs.length) rs.appendChild(cell("td", "sign", signs[i] === "||" ? "‖" : signs[i]));
    });
    tbl.appendChild(rs);
    // y (chỉ bbt)
    if (mode === "bbt") {
      var ry = cell("tr"); ry.appendChild(cell("th", null, "y"));
      moc.forEach(function (m, i) {
        var val = m.ytype === "undef" ? "∄" : (m.ytype === "bar" ? "‖" : show(m.y));
        ry.appendChild(cell("td", "pt ext", val));
        if (i < signs.length) ry.appendChild(cell("td", "arrow", signs[i] === "+" ? "↗" : signs[i] === "−" ? "↘" : ""));
      });
      tbl.appendChild(ry);
    }
    body.appendChild(tbl);
  }

  function build(body, data) { if (data.grid) return buildFromGrid(body, data); buildTable(body, data, data.mode === "xetdau" ? "xetdau" : "bbt"); }
  global.VPVar = { build: build, analyze: analyze, gridFromExpr: gridFromExpr, buildFromGrid: buildFromGrid };
})(window);
