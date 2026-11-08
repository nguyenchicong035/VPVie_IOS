// VPVie – Bảng dạy học. Vẽ tay, làm đẹp nét, công thức, đồ thị, nhận dạng AI.
(function () {
  "use strict";

  var board = document.getElementById("board");
  var canvas = document.getElementById("paper");
  var overlay = document.getElementById("overlay");
  var ctx = canvas.getContext("2d");

  var state = {
    tool: "pen",
    color: "#7a1020",
    size: 3,
    beautify: true,
    items: [],        // nét & hình trên canvas
    overlays: [],     // lớp phủ (công thức, đồ thị, máy tính, câu hỏi, chữ) – dạng dữ liệu
    drawing: false,
    cur: null,
    pen: "ball",      // ball | brush | pencil | hl (dạ quang)
    tidyInk: true,    // tự nắn mượt nét chữ viết tay sau khi viết
    tidyStrength: 4,  // 1 nhẹ · 2 vừa · 3 mạnh · 4 rất mượt (mặc định)
    // Cài đặt trang giấy + hình vẽ (toàn cục, không theo trang)
    paper: { style: "lined", bg: "#FFFFFF", lineColor: "#9CC2F0", spacing: 34, thickness: 1, orient: "portrait", titlebox: true, margin: true, pagebreak: true },
    opt: { showdots: true, autolabel: false, snap: false, lblsize: 16, lblcolor: "#111111", dotsize: 4, subject: "toan", cursor: "pen", cursize: "s", touch: "auto", autosave: true, penlead: true, scratchrase: false },
  };

  // ----- Vẽ nền giấy (kẻ dòng / ô vuông / chấm / trơn) – vẽ trước mọi nét
  var _imgCache = {};
  function getImg(url) { if (_imgCache[url]) return _imgCache[url]; var im = new Image(); im.onload = function () { redraw(); }; im.src = url; _imgCache[url] = im; return im; }
  function drawPaper() {
    var w = canvas.clientWidth, h = canvas.clientHeight, p = state.paper;
    ctx.save();
    ctx.fillStyle = p.bg || "#FFFFFF"; ctx.fillRect(0, 0, w, h);
    // Nền là ảnh/đề PDF: vẽ đè, viết lên trên
    if (state.pageBg) {
      var im = getImg(state.pageBg);
      if (im.complete && im.naturalWidth) { var sc = w / im.naturalWidth; ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight, 0, 0, w, im.naturalHeight * sc); }
      if (p.pagebreak) { ctx.fillStyle = "#B7C2CC"; ctx.font = "12px 'Segoe UI'"; ctx.textAlign = "center"; ctx.fillText("— Trang " + (cur + 1) + " —", w / 2, h - 10); ctx.textAlign = "left"; }
      ctx.restore(); return;
    }
    var sp = Math.max(8, p.spacing || 34), lc = p.lineColor || "#CBD8E8", x, y;
    ctx.strokeStyle = lc; ctx.lineWidth = p.thickness || 1;
    if (p.style === "lined") {
      ctx.beginPath();
      for (y = sp; y < h; y += sp) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
      ctx.stroke();
    } else if (p.style === "grid") {
      ctx.beginPath();
      for (y = sp; y < h; y += sp) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
      for (x = sp; x < w; x += sp) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
      ctx.stroke();
    } else if (p.style === "dot") {
      ctx.fillStyle = lc;
      for (y = sp; y < h; y += sp) for (x = sp; x < w; x += sp) { ctx.beginPath(); ctx.arc(x, y, (p.thickness || 1) + 0.6, 0, 6.2832); ctx.fill(); }
    }
    // Đường lề dọc (màu đỏ, kiểu vở)
    if (p.margin) { ctx.strokeStyle = "#E8A6B2"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(52.5, 0); ctx.lineTo(52.5, h); ctx.stroke(); }
    // Ô tiêu đề ở trang đầu
    if (p.titlebox && cur === 0) {
      ctx.setLineDash([6, 4]); ctx.strokeStyle = "#9DB6D6"; ctx.lineWidth = 1.2;
      ctx.strokeRect(66, 14, w - 132, 58); ctx.setLineDash([]);
      ctx.fillStyle = "#9AA7B4"; ctx.font = "13px 'Segoe UI'"; ctx.fillText("Tiêu đề", 76, 32);
    }
    // Số trang
    if (p.pagebreak) { ctx.fillStyle = "#B7C2CC"; ctx.font = "12px 'Segoe UI'"; ctx.textAlign = "center"; ctx.fillText("— Trang " + (cur + 1) + " —", w / 2, h - 10); ctx.textAlign = "left"; }
    ctx.restore();
  }

  // ----- Kích thước canvas theo khung
  function resize() {
    var r = board.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  window.addEventListener("resize", resize);

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, pr: (e.pressure && e.pressure > 0) ? e.pressure : 0.5 };
  }

  // ----- Vẽ
  function drawItem(it) {
    if (it.type === "oxyz") { window.VPOxyz.drawItem(ctx, it); return; }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = it.color || state.color;
    ctx.lineWidth = it.size || state.size;
    ctx.beginPath();
    if (it.type === "stroke") {
      var p = it.points, base = it.size || state.size, pen = it.pen || "ball";
      ctx.save();
      if (pen === "hl") { ctx.globalAlpha = 0.38; ctx.lineCap = "butt"; base = Math.max(base * 3.2, 16); }
      else if (pen === "pencil") { ctx.globalAlpha = 0.72; }
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0].x, p[0].y, base / 2, 0, 6.2832); ctx.fillStyle = it.color; ctx.fill(); ctx.restore(); return; }
      // Bút dạ: biến thiên theo lực → vẽ từng đoạn. Bút bi/chì: nét đều → làm mượt bằng
      // đường cong bậc hai qua trung điểm các điểm (khử răng cưa do lấy mẫu con trỏ).
      if (pen === "brush") {
        for (var i = 1; i < p.length; i++) {
          var pr = p[i].pr != null ? p[i].pr : 0.5;
          ctx.beginPath(); ctx.lineWidth = base * (0.55 + pr * 0.9);
          ctx.moveTo(p[i - 1].x, p[i - 1].y); ctx.lineTo(p[i].x, p[i].y); ctx.stroke();
        }
      } else {
        ctx.lineWidth = pen === "pencil" ? base * 0.85 : base;
        ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
        for (var i = 1; i < p.length - 1; i++) {
          var mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2;
          ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
        }
        ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
        ctx.stroke();
      }
      ctx.restore();
      return;
    } else if (it.type === "line") {
      ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke();
    } else if (it.type === "rect") {
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fillRect(it.x, it.y, it.w, it.h); }
      ctx.strokeRect(it.x, it.y, it.w, it.h);
    } else if (it.type === "triangle") {
      var t = it.pts; ctx.moveTo(t[0].x, t[0].y); ctx.lineTo(t[1].x, t[1].y); ctx.lineTo(t[2].x, t[2].y); ctx.closePath();
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); } ctx.stroke();
    } else if (it.type === "circle") {
      ctx.arc(it.cx, it.cy, it.r, 0, Math.PI * 2);
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); } ctx.stroke();
    } else if (it.type === "ellipse") {
      ctx.ellipse(it.cx, it.cy, it.rx, it.ry, 0, 0, Math.PI * 2);
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); } ctx.stroke();
    } else if (it.type === "poly") {
      var pp = it.pts; ctx.moveTo(pp[0].x, pp[0].y); for (var k = 1; k < pp.length; k++) ctx.lineTo(pp[k].x, pp[k].y); ctx.closePath();
      if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); } ctx.stroke();
    } else if (it.type === "path") {
      var pa = it.pts; ctx.moveTo(pa[0].x, pa[0].y); for (var k2 = 1; k2 < pa.length; k2++) ctx.lineTo(pa[k2].x, pa[k2].y); ctx.stroke();
    } else if (it.type === "arrow") {
      drawArrow(it);
    } else if (it.type === "solid") {
      var sc = it.color || state.color, lw = it.size || 2;
      ctx.strokeStyle = sc; ctx.lineWidth = lw;
      (it.segs || []).forEach(function (s) { ctx.setLineDash(s.dashed ? [6, 5] : []); ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); });
      (it.ellipses || []).forEach(function (e) { ctx.setLineDash(e.dashed ? [6, 5] : []); ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, e.a0 || 0, (e.a1 != null ? e.a1 : Math.PI * 2)); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.fillStyle = sc; ctx.font = "13px 'Segoe UI'";
      (it.labels || []).forEach(function (l) { ctx.fillText(l.t, l.x, l.y); });
    }
  }

  // Vẽ mũi tên / đoạn đo / ngoặc
  function arrowHead(x, y, ang, s) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * Math.cos(ang - 0.4), y - s * Math.sin(ang - 0.4)); ctx.lineTo(x - s * Math.cos(ang + 0.4), y - s * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill(); }
  function drawArrow(it) {
    var x1 = it.x1, y1 = it.y1, x2 = it.x2, y2 = it.y2, w = it.size || 2, st = it.style || "arrow";
    ctx.save(); ctx.strokeStyle = it.color || state.color; ctx.fillStyle = it.color || state.color; ctx.lineWidth = w; ctx.lineCap = "round";
    var ang = Math.atan2(y2 - y1, x2 - x1), hs = 8 + w * 1.6, L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
    if (st === "dash") ctx.setLineDash([8, 6]);
    if (st === "brace") {
      var o = 12, mx = (x1 + x2) / 2 + nx * o, my = (y1 + y2) / 2 + ny * o;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x1 + nx * o, y1 + ny * o, mx - (x2 - x1) / L * 6, my - (y2 - y1) / L * 6);
      ctx.lineTo(mx, my); ctx.lineTo(mx + (x2 - x1) / L * 6, my + (y2 - y1) / L * 6);
      ctx.quadraticCurveTo(x2 + nx * o, y2 + ny * o, x2, y2); ctx.stroke(); ctx.restore(); return;
    }
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
    if (st === "dim") { // đoạn đo: vạch vuông góc 2 đầu
      ctx.beginPath(); ctx.moveTo(x1 + nx * 6, y1 + ny * 6); ctx.lineTo(x1 - nx * 6, y1 - ny * 6); ctx.moveTo(x2 + nx * 6, y2 + ny * 6); ctx.lineTo(x2 - nx * 6, y2 - ny * 6); ctx.stroke(); }
    else { arrowHead(x2, y2, ang, hs); if (st === "darrow") arrowHead(x1, y1, ang + Math.PI, hs); }
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPaper();
    for (var i = 0; i < state.items.length; i++) drawItem(state.items[i]);
    if (state.cur) drawItem(state.cur);
    if (window.VPGeo) window.VPGeo.render(ctx, canvas.clientWidth, canvas.clientHeight);
    // Lớp chọn vùng
    if (state.selected && state.selected.length) {
      ctx.save(); ctx.strokeStyle = "#7a1020"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4;
      state.selected.forEach(function (i) { var it = state.items[i]; if (!it) return; var b = itemBox(it); ctx.strokeRect(b.minx - 4, b.miny - 4, (b.maxx - b.minx) + 8, (b.maxy - b.miny) + 8); });
      ctx.restore();
    }
    if (state.selBox) { ctx.save(); ctx.strokeStyle = "#7a1020"; ctx.fillStyle = "rgba(122,16,32,.08)"; ctx.setLineDash([5, 4]); var sb = state.selBox; ctx.fillRect(sb.x1, sb.y1, sb.x2 - sb.x1, sb.y2 - sb.y1); ctx.strokeRect(sb.x1, sb.y1, sb.x2 - sb.x1, sb.y2 - sb.y1); ctx.restore(); }
    if (typeof updateSelBar === "function") updateSelBar();
    if (typeof scheduleSave === "function") scheduleSave();
  }

  // ----- Tẩy: xóa item gần con trỏ
  function eraseAt(pt) {
    var kept = [], changed = false, tol = state.eraserMode === "part" ? Math.max(8, state.size * 3) : 12;
    for (var i = 0; i < state.items.length; i++) {
      var it = state.items[i];
      if (!nearItem(it, pt, tol)) { kept.push(it); continue; }
      changed = true;
      // Tẩy một phần: cắt nét tay tại chỗ tẩy, giữ lại các đoạn còn lại
      if (state.eraserMode === "part" && it.type === "stroke") {
        var seg = [];
        it.points.forEach(function (q) {
          if (Math.hypot(q.x - pt.x, q.y - pt.y) < tol) { if (seg.length > 1) kept.push(Object.assign({}, it, { points: seg })); seg = []; }
          else seg.push(q);
        });
        if (seg.length > 1) kept.push(Object.assign({}, it, { points: seg }));
      }
    }
    if (changed) {
      if (state.erHist) { undoStack.push(state.erHist); redoStack = []; state.erHist = null; }
      state.items = kept; redraw();
    }
  }
  function nearItem(it, pt, tol) {
    if (it.type === "stroke") {
      for (var i = 0; i < it.points.length; i++) if (Math.hypot(it.points[i].x - pt.x, it.points[i].y - pt.y) < tol) return true;
      return false;
    }
    var b = itemBox(it);
    return pt.x > b.minx - tol && pt.x < b.maxx + tol && pt.y > b.miny - tol && pt.y < b.maxy + tol;
  }
  function itemBox(it) {
    if (it.type === "stroke") { var mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity; it.points.forEach(function (p) { if (p.x < mnx) mnx = p.x; if (p.y < mny) mny = p.y; if (p.x > mxx) mxx = p.x; if (p.y > mxy) mxy = p.y; }); return { minx: mnx, maxx: mxx, miny: mny, maxy: mxy }; }
    if (it.type === "solid") { var sx = [], sy = []; (it.segs || []).forEach(function (s) { sx.push(s.x1, s.x2); sy.push(s.y1, s.y2); }); (it.ellipses || []).forEach(function (e) { sx.push(e.cx - e.rx, e.cx + e.rx); sy.push(e.cy - e.ry, e.cy + e.ry); }); return sx.length ? { minx: Math.min.apply(0, sx), maxx: Math.max.apply(0, sx), miny: Math.min.apply(0, sy), maxy: Math.max.apply(0, sy) } : { minx: 0, maxx: 0, miny: 0, maxy: 0 }; }
    if (it.type === "line" || it.type === "arrow") return { minx: Math.min(it.x1, it.x2), maxx: Math.max(it.x1, it.x2), miny: Math.min(it.y1, it.y2), maxy: Math.max(it.y1, it.y2) };
    if (it.type === "rect" || it.type === "oxyz") return { minx: it.x, maxx: it.x + it.w, miny: it.y, maxy: it.y + it.h };
    if (it.type === "circle") return { minx: it.cx - it.r, maxx: it.cx + it.r, miny: it.cy - it.r, maxy: it.cy + it.r };
    if (it.type === "ellipse") return { minx: it.cx - it.rx, maxx: it.cx + it.rx, miny: it.cy - it.ry, maxy: it.cy + it.ry };
    if (it.type === "triangle" || it.type === "poly" || it.type === "path") { var xs = it.pts.map(function (p) { return p.x; }), ys = it.pts.map(function (p) { return p.y; }); return { minx: Math.min.apply(0, xs), maxx: Math.max.apply(0, xs), miny: Math.min.apply(0, ys), maxy: Math.max.apply(0, ys) }; }
    return { minx: 0, maxx: 0, miny: 0, maxy: 0 };
  }
  // Điểm nằm trong hình kín? (để tô màu miền)
  function inPoly(pts, pt) { var c = false, n = pts.length; for (var i = 0, j = n - 1; i < n; j = i++) { if (((pts[i].y > pt.y) !== (pts[j].y > pt.y)) && (pt.x < (pts[j].x - pts[i].x) * (pt.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x)) c = !c; } return c; }
  function containsPoint(it, pt) {
    if (it.type === "rect") return pt.x >= it.x && pt.x <= it.x + it.w && pt.y >= it.y && pt.y <= it.y + it.h;
    if (it.type === "circle") return Math.hypot(pt.x - it.cx, pt.y - it.cy) <= it.r;
    if (it.type === "ellipse") { var dx = (pt.x - it.cx) / it.rx, dy = (pt.y - it.cy) / it.ry; return dx * dx + dy * dy <= 1; }
    if (it.type === "triangle" || it.type === "poly") return inPoly(it.pts, pt);
    return false;
  }
  // Dịch chuyển một item (cho công cụ chọn vùng)
  function translateItem(it, dx, dy) {
    if (it.type === "stroke" || it.type === "triangle" || it.type === "poly" || it.type === "path") (it.points || it.pts).forEach(function (p) { p.x += dx; p.y += dy; });
    else if (it.type === "line" || it.type === "arrow") { it.x1 += dx; it.y1 += dy; it.x2 += dx; it.y2 += dy; }
    else if (it.type === "rect" || it.type === "oxyz") { it.x += dx; it.y += dy; }
    else if (it.type === "circle" || it.type === "ellipse") { it.cx += dx; it.cy += dy; }
    else if (it.type === "solid") { (it.segs || []).forEach(function (s) { s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; }); (it.ellipses || []).forEach(function (e) { e.cx += dx; e.cy += dy; }); (it.labels || []).forEach(function (l) { l.x += dx; l.y += dy; }); }
  }
  function boxHit(it, pt, tol) { var b = itemBox(it); tol = tol || 8; return pt.x >= b.minx - tol && pt.x <= b.maxx + tol && pt.y >= b.miny - tol && pt.y <= b.maxy + tol; }
  function selUnionBox() { var mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity; state.selected.forEach(function (i) { var it = state.items[i]; if (!it) return; var b = itemBox(it); if (b.minx < mnx) mnx = b.minx; if (b.miny < mny) mny = b.miny; if (b.maxx > mxx) mxx = b.maxx; if (b.maxy > mxy) mxy = b.maxy; }); return { minx: mnx, miny: mny, maxx: mxx, maxy: mxy }; }
  function updateSelBar() {
    var bar = document.getElementById("sel-bar"); if (!bar) return;
    if (state.tool === "select" && state.selected && state.selected.length && !state.selBox) { var b = selUnionBox(); bar.style.left = Math.max(2, b.minx - 4) + "px"; bar.style.top = Math.max(2, b.miny - 40) + "px"; bar.classList.add("show"); }
    else bar.classList.remove("show");
  }
  function fillAt(pt) {
    for (var i = state.items.length - 1; i >= 0; i--) { if (containsPoint(state.items[i], pt)) { pushHist(); state.items[i].fill = (state.items[i].fill === state.color) ? null : state.color; redraw(); return true; } }
    toast("Bấm vào trong một hình kín để tô màu.");
    return false;
  }

  // ----- Sự kiện vẽ
  canvas.addEventListener("pointerdown", function (e) {
    // Chống chạm nhầm lòng bàn tay: khi đang dùng bút thì bỏ qua ngón tay (touch)
    if (e.pointerType === "touch" && (state.penDown || (Date.now() - (state.lastPen || 0) < 700))) return;
    if (e.pointerType === "pen") { state.penDown = true; state.lastPen = Date.now(); }
    var pt = pos(e);
    if (state.tool === "oxyz") {
      canvas.setPointerCapture(e.pointerId); state.drawing = true;
      state.selBox = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y }; redraw(); return;
    }
    if (state.tool === "geo") {
      if (window.VPGeo.tool === "move") canvas.setPointerCapture(e.pointerId);
      window.VPGeo.onDown(pt); state.geoDown = true; redraw(); return;
    }
    if (state.tool === "pan") return;   // công cụ di chuyển: không vẽ
    if (state.tool === "fill") { fillAt(pt); return; }   // tô màu miền
    if (state.tool === "select") {
      canvas.setPointerCapture(e.pointerId); state.drawing = true;
      var onSel = state.selected.length && state.selected.some(function (i) { return state.items[i] && boxHit(state.items[i], pt); });
      if (onSel) { pushHist(); state.selMode = "move"; state.moveStart = pt; state.moved = false; }
      else { state.selMode = "marquee"; state.selBox = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y }; state.selected = []; }
      redraw(); return;
    }
    canvas.setPointerCapture(e.pointerId);
    if (state.tool === "eraser") {
      state.drawing = true;
      if (state.eraserMode === "area") { state.selBox = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y }; redraw(); return; }
      state.erHist = snap(); eraseAt(pt); return;
    }
    if (state.tool === "arrow") { state.drawing = true; state.cur = { type: "arrow", x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, style: state.arrowStyle || "arrow", color: state.color, size: state.size }; return; }
    state.drawing = true;
    state.cur = { type: "stroke", points: [pt], color: state.color, size: state.size, pen: state.pen };
  });
  canvas.addEventListener("pointermove", function (e) {
    if (state.tool === "oxyz") { if (state.drawing && state.selBox) { var p3 = pos(e); state.selBox.x2 = p3.x; state.selBox.y2 = p3.y; redraw(); } return; }
    if (state.tool === "geo") { if (state.geoDown && window.VPGeo.onMove(pos(e))) redraw(); return; }
    if (!state.drawing) return;
    var pt = pos(e);
    if (state.tool === "eraser") { if (state.eraserMode === "area") { state.selBox.x2 = pt.x; state.selBox.y2 = pt.y; redraw(); } else eraseAt(pt); return; }
    if (state.tool === "select") {
      if (state.selMode === "marquee") { state.selBox.x2 = pt.x; state.selBox.y2 = pt.y; }
      else { var ddx = pt.x - state.moveStart.x, ddy = pt.y - state.moveStart.y; if (ddx || ddy) state.moved = true; state.selected.forEach(function (i) { if (state.items[i]) translateItem(state.items[i], ddx, ddy); }); state.moveStart = pt; }
      redraw(); return;
    }
    if (state.tool === "arrow") { state.cur.x2 = pt.x; state.cur.y2 = pt.y; redraw(); return; }
    state.cur.points.push(pt);
    redraw();
  });
  function endStroke() {
    if (state.tool === "geo") { if (window.VPGeo) window.VPGeo.onUp(); state.geoDown = false; return; }
    if (!state.drawing) return;
    state.drawing = false;
    if (state.tool === "oxyz" && state.selBox) {
      var box3 = normBox(state.selBox); state.selBox = null; redraw();
      var w3 = box3.x2 - box3.x1, h3 = box3.y2 - box3.y1;
      if (w3 < 12 && h3 < 12) { w3 = 540; h3 = 400; }
      w3 = Math.max(160, Math.min(w3, canvas.clientWidth)); h3 = Math.max(140, Math.min(h3, canvas.clientHeight));
      var item3 = { type: "oxyz", x: Math.max(0, Math.min(box3.x1, canvas.clientWidth-w3)), y: Math.max(0, Math.min(box3.y1, canvas.clientHeight-h3)), w: w3, h: h3 };
      window.VPOxyz.open(null, function (scene3) { pushHist(); item3.scene = scene3; state.items.push(item3); $("btn-select").click(); state.selected = [state.items.length-1]; redraw(); scheduleSave(); toast("Nhấp đúp vào hình Oxyz để chỉnh sửa."); });
      return;
    }
    if (state.tool === "select") {
      if (state.selMode === "marquee" && state.selBox) {
        var bx = { x1: Math.min(state.selBox.x1, state.selBox.x2), y1: Math.min(state.selBox.y1, state.selBox.y2), x2: Math.max(state.selBox.x1, state.selBox.x2), y2: Math.max(state.selBox.y1, state.selBox.y2) };
        state.selected = [];
        if (Math.abs(bx.x2 - bx.x1) > 4 || Math.abs(bx.y2 - bx.y1) > 4) state.selected = itemsInBox(bx);
        else { var hit = hitItem({ x: bx.x1, y: bx.y1 }); if (hit >= 0) state.selected = [hit]; }   // bấm 1 lần: chọn đối tượng trên cùng
        state.selBox = null;
      } else if (state.selMode === "move" && !state.moved) undoStack.pop();   // không di chuyển → bỏ bản lưu
      redraw(); return;
    }
    if (state.tool === "eraser") {
      state.erHist = null;
      if (state.eraserMode === "area" && state.selBox) {
        var eb = normBox(state.selBox), del = itemsInBox(eb); state.selBox = null;
        if (del.length) { pushHist(); var ds = {}; del.forEach(function (i) { ds[i] = 1; }); state.items = state.items.filter(function (it, i) { return !ds[i]; }); }
        redraw();
      }
      return;
    }
    var s = state.cur; state.cur = null;
    if (!s) return;
    if (s.type !== "arrow" || Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 6) pushHist();
    if (s.type === "arrow") { if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 6) state.items.push(s); redraw(); return; }
    if (state.beautify && window.VPBeautify && s.pen !== "hl") {
      var shp = window.VPBeautify.beautify(s.points);
      if (shp) { shp.color = s.color; shp.size = s.size; state.items.push(shp); redraw(); return; }
    }
    // Nắn nét chữ viết tay: làm mượt, bớt run tay — VẪN là nét chữ của người dùng
    if (state.tidyInk && window.VPBeautify && s.type === "stroke" && s.pen !== "hl" && s.points.length > 3) {
      s.points = window.VPBeautify.refineInk(s.points, state.tidyStrength || 2);
    }
    state.items.push(s); redraw();
  }
  // ----- Lịch sử hoàn tác (chụp toàn bộ items của trang hiện tại)
  var undoStack = [], redoStack = [];
  function snap() { return JSON.stringify(state.items); }
  function pushHist() { undoStack.push(snap()); if (undoStack.length > 100) undoStack.shift(); redoStack = []; }
  function resetHist() { undoStack = []; redoStack = []; }
  function undo() { if (!undoStack.length) { toast("Không còn gì để hoàn tác."); return; } redoStack.push(snap()); state.items = JSON.parse(undoStack.pop()); state.selected = []; redraw(); scheduleSave(); }
  function redo() { if (!redoStack.length) return; undoStack.push(snap()); state.items = JSON.parse(redoStack.pop()); state.selected = []; redraw(); scheduleSave(); }
  function normBox(b) { return { x1: Math.min(b.x1, b.x2), y1: Math.min(b.y1, b.y2), x2: Math.max(b.x1, b.x2), y2: Math.max(b.y1, b.y2) }; }
  function itemsInBox(bx) { var r = []; state.items.forEach(function (it, i) { var b = itemBox(it); if (b.maxx >= bx.x1 && b.minx <= bx.x2 && b.maxy >= bx.y1 && b.miny <= bx.y2) r.push(i); }); return r; }
  // Đối tượng trên cùng tại điểm pt (nét tay: gần nét; hình kín: bên trong hoặc gần viền)
  function hitItem(pt) {
    for (var i = state.items.length - 1; i >= 0; i--) {
      var it = state.items[i];
      if (it.type === "stroke" ? nearItem(it, pt, 9) : (containsPoint(it, pt) || boxHit(it, pt, 6))) return i;
    }
    return -1;
  }
  canvas.addEventListener("pointerup", function (e) { if (e.pointerType === "pen") { state.penDown = false; state.lastPen = Date.now(); } endStroke(); });
  canvas.addEventListener("pointercancel", function (e) { if (state.tool === "oxyz") { state.drawing = false; state.penDown = false; state.selBox = null; redraw(); return; } if (e.pointerType === "pen") { state.penDown = false; state.lastPen = Date.now(); } endStroke(); });
  canvas.addEventListener("pointerleave", function (e) { if (state.drawing && state.tool !== "eraser" && state.tool !== "oxyz") endStroke(); });

  // ----- Lớp phủ dạng DỮ LIỆU (lưu/mở theo trang được)
  function overlayBody(kind, body, data) {
    if (kind === "math") {
      if (data.mode === "text") body.textContent = data.latex || "";
      else window.VPMathPlot.renderMath(body, data.latex, data.display !== false);
      if (data.color) body.style.color = data.color;
      if (data.size) body.style.fontSize = data.size + "px";
    }
    else if (kind === "text") { body.textContent = data.text; if (data.font) body.style.fontFamily = data.font; if (data.size) body.style.fontSize = data.size + "px"; }
    else if (kind === "plot") window.VPCalc.buildGraph(body, data.expr);
    else if (kind === "calc") window.VPSci.build(body);
    else if (kind === "quiz") data.sub === "tf" ? window.VPQuiz.buildTF(body, data) : window.VPQuiz.buildMCQ(body, data);
    else if (kind === "var") window.VPVar.build(body, data);
    else if (kind === "timer") window.VPClass.buildTimer(body, data);
    else if (kind === "picker") window.VPClass.buildPicker(body, data);
    else if (kind === "ptable") window.VPScience.buildPTable(body);
    else if (kind === "chem") window.VPScience.buildChem(body);
    else if (kind === "circuit" || kind === "force" || kind === "pedigree" || kind === "dna") { data._save = scheduleSave; window.VPDiagram.build(body, kind, data); }
    else if (kind === "table") {
      var tb = document.createElement("table"); tb.className = "ov-table";
      data.cells = data.cells || [];
      for (var ri = 0; ri < data.rows; ri++) {
        var tr = document.createElement("tr");
        for (var ci = 0; ci < data.cols; ci++) {
          var td = document.createElement("td"); td.contentEditable = "true";
          data.cells[ri] = data.cells[ri] || [];
          td.textContent = data.cells[ri][ci] || "";
          (function (rr, cc, cell) { cell.addEventListener("input", function () { data.cells[rr] = data.cells[rr] || []; data.cells[rr][cc] = cell.textContent; scheduleSave(); }); })(ri, ci, td);
          tr.appendChild(td);
        }
        tb.appendChild(tr);
      }
      body.appendChild(tb);
    }
    else if (kind === "web") {
      var fr = document.createElement("iframe"); fr.className = "ov-web"; fr.src = data.url; fr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
      var cap = document.createElement("div"); cap.className = "ov-webcap"; cap.textContent = data.url;
      body.appendChild(cap); body.appendChild(fr);
    }
    else if (kind === "note") {
      var host = body.closest(".ov"); host.classList.add("ov-note");
      function applyColor(c) { data.color = c; host.style.background = c; }
      applyColor(data.color || "#FFF1A6");
      var grip = document.createElement("div"); grip.className = "note-grip"; grip.title = "Kéo để di chuyển";
      var ed = document.createElement("div"); ed.className = "note-edit"; ed.contentEditable = "true"; ed.spellcheck = false;
      ed.setAttribute("data-ph", "Ghi chú…"); ed.textContent = data.text || "";
      ed.addEventListener("input", function () { data.text = ed.textContent; scheduleSave(); });
      var bar = document.createElement("div"); bar.className = "note-colors";
      ["#FFF1A6", "#FFD2E0", "#CDEFC6", "#CFE3FF"].forEach(function (c) { var d = document.createElement("button"); d.className = "note-dot"; d.style.background = c; d.onclick = function () { applyColor(c); scheduleSave(); }; bar.appendChild(d); });
      body.appendChild(grip); body.appendChild(ed); body.appendChild(bar);
    }
  }
  function makeOverlayEl(ov) {
    var el = document.createElement("div");
    el.className = "ov ov-" + ov.kind; el.style.left = ov.x + "px"; el.style.top = ov.y + "px"; el.dataset.id = ov.id;
    var body = document.createElement("div"); body.className = "ov-body"; el.appendChild(body);
    var del = document.createElement("button"); del.className = "ov-del"; del.textContent = "✕"; del.title = "Xóa";
    del.onclick = function () { removeOverlay(ov.id); };
    el.appendChild(del);
    overlayBody(ov.kind, body, ov.data);
    makeDraggable(el, ov);
    return el;
  }
  function renderOverlays() { overlay.innerHTML = ""; state.overlays.forEach(function (ov) { overlay.appendChild(makeOverlayEl(ov)); }); }
  function addOverlayData(kind, data, x, y) {
    var n = state.overlays.length;
    var ov = { id: "o" + Date.now() + Math.floor(Math.random() * 1000), kind: kind, x: x != null ? x : 80 + (n * 12) % 240, y: y != null ? y : 80 + (n * 12) % 180, data: data || {} };
    state.overlays.push(ov); overlay.appendChild(makeOverlayEl(ov)); scheduleSave(); return ov;
  }
  function removeOverlay(id) { state.overlays = state.overlays.filter(function (o) { return o.id !== id; }); renderOverlays(); scheduleSave(); }
  function makeDraggable(el, ov) {
    var sx, sy, ox, oy, moving = false;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button, input, textarea, select, label, .tf-cell, .note-edit, .note-colors")) return;
      moving = true; sx = e.clientX; sy = e.clientY;
      ox = parseFloat(el.style.left); oy = parseFloat(el.style.top);
      el.setPointerCapture(e.pointerId); el.classList.add("dragging");
    });
    el.addEventListener("pointermove", function (e) {
      if (!moving) return;
      var nx = ox + e.clientX - sx, ny = oy + e.clientY - sy;
      el.style.left = nx + "px"; el.style.top = ny + "px"; if (ov) { ov.x = nx; ov.y = ny; }
    });
    el.addEventListener("pointerup", function () { moving = false; el.classList.remove("dragging"); scheduleSave(); });
  }

  function insertMath(latex, x, y, opts) { if (latex) addOverlayData("math", Object.assign({ latex: latex }, opts || {}), x, y); }
  function insertText(text, x, y, opts) {
    if (!text) return; opts = opts || {};
    addOverlayData("text", { text: text, font: opts.font, size: opts.size }, x, y);
  }
  function inkBBox() {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, found = false;
    state.items.forEach(function (it) {
      if (it.type === "stroke") it.points.forEach(function (p) { found = true; if (p.x < minx) minx = p.x; if (p.y < miny) miny = p.y; if (p.x > maxx) maxx = p.x; if (p.y > maxy) maxy = p.y; });
    });
    return found ? { x: minx, y: miny, w: maxx - minx, h: maxy - miny } : null;
  }
  function clearStrokes() { pushHist(); state.items = state.items.filter(function (it) { return it.type !== "stroke"; }); }
  // Cắt một vùng (phóng to) để nhận dạng chính xác hơn
  function cropRegion(bb, pad, scale) {
    if (!bb || bb.w < 6 || bb.h < 6) return null;
    var dpr = window.devicePixelRatio || 1; pad = pad || 18; scale = scale || 2;
    var x = Math.max(0, bb.x - pad), y = Math.max(0, bb.y - pad), w = bb.w + 2 * pad, h = bb.h + 2 * pad;
    var oc = document.createElement("canvas"); oc.width = Math.round(w * scale); oc.height = Math.round(h * scale);
    var o = oc.getContext("2d"); o.fillStyle = "#fff"; o.fillRect(0, 0, oc.width, oc.height);
    o.drawImage(canvas, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, oc.width, oc.height);
    return oc;
  }
  function cropForOCR() { return cropRegion(inkBBox(), 18, 2) || canvas; }
  // Gom nét viết tay thành từng DÒNG theo khoảng trống dọc (để nhận dạng từng dòng)
  function strokeLines() {
    var boxes = state.items.filter(function (it) { return it.type === "stroke"; }).map(function (it) { return itemBox(it); });
    if (boxes.length < 2) return [];
    boxes.sort(function (a, b) { return a.miny - b.miny; });
    var hs = boxes.map(function (b) { return b.maxy - b.miny; }).sort(function (a, b) { return a - b; });
    var medH = hs[Math.floor(hs.length / 2)] || 20, lines = [], cur = null;
    boxes.forEach(function (b) {
      var yc = (b.miny + b.maxy) / 2;
      if (!cur || yc > cur.maxy + medH * 0.5) { cur = { minx: b.minx, miny: b.miny, maxx: b.maxx, maxy: b.maxy }; lines.push(cur); }
      else { cur.minx = Math.min(cur.minx, b.minx); cur.miny = Math.min(cur.miny, b.miny); cur.maxx = Math.max(cur.maxx, b.maxx); cur.maxy = Math.max(cur.maxy, b.maxy); }
    });
    return lines.map(function (l) { return { x: l.minx, y: l.miny, w: l.maxx - l.minx, h: l.maxy - l.miny }; });
  }
  function insertPlot(expr, x, y) { if (expr) addOverlayData("plot", { expr: expr }, x, y); }
  function insertCalc(x, y) { addOverlayData("calc", {}, x, y); }
  function insertNote(x, y) { addOverlayData("note", { text: "", color: "#FFF1A6" }, x, y); }
  function insertVar(data, x, y) { addOverlayData("var", data, x, y); }
  function insertTimer(x, y) { addOverlayData("timer", { total: 300 }, x, y); }
  function insertPicker(x, y) { addOverlayData("picker", { names: "" }, x, y); }
  var quizNo = 0;
  function insertQuiz(data, kind, x, y) {
    quizNo += 1; data.no = quizNo; data.sub = kind;
    addOverlayData("quiz", data, x, y);
  }

  // ----- Thanh công cụ
  function $(id) { return document.getElementById(id); }
  var tools = document.querySelectorAll("[data-tool]");
  var geoBtns = document.querySelectorAll("[data-geo]");
  function clearActive() { tools.forEach(function (x) { x.classList.remove("active"); }); geoBtns.forEach(function (x) { x.classList.remove("active"); }); ["btn-arrow", "btn-fill", "btn-select", "btn-oxyz"].forEach(function (id) { if ($(id)) $(id).classList.remove("active"); }); if (state.selected && state.selected.length) { state.selected = []; redraw(); } }
  tools.forEach(function (b) {
    b.onclick = function () {
      state.tool = b.dataset.tool;
      if (b.dataset.pen) state.pen = b.dataset.pen;
      if (b.dataset.erase) state.eraserMode = b.dataset.erase;
      if (window.VPGeo) window.VPGeo.setTool(null);
      clearActive(); b.classList.add("active");
    };
  });
  geoBtns.forEach(function (b) {
    b.onclick = function () {
      state.tool = "geo";
      window.VPGeo.setTool(b.dataset.geo);
      clearActive(); b.classList.add("active");
    };
  });
  document.querySelectorAll("[data-color]").forEach(function (b) {
    b.style.background = b.dataset.color;
    b.onclick = function () {
      state.color = b.dataset.color;
      document.querySelectorAll("[data-color]").forEach(function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
    };
  });
  // Cỡ nét (3 chấm)
  document.querySelectorAll("[data-sizedot]").forEach(function (b) {
    b.onclick = function () {
      state.size = parseInt(b.dataset.sizedot, 10);
      document.querySelectorAll("[data-sizedot]").forEach(function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
    };
  });
  // Bút dạ quang (highlighter)
  document.querySelectorAll("[data-hl]").forEach(function (b) {
    b.onclick = function () {
      state.tool = "pen"; state.pen = "hl"; state.color = b.dataset.hl;
      if (window.VPGeo) window.VPGeo.setTool(null);
      clearActive();
      document.querySelectorAll("[data-hl]").forEach(function (x) { x.classList.remove("sel"); });
      b.classList.add("sel");
    };
  });
  var bt = $("beautify");
  bt.onclick = function () { state.beautify = !state.beautify; bt.classList.toggle("on", state.beautify); bt.title = state.beautify ? "Làm đẹp nét: BẬT" : "Làm đẹp nét: TẮT"; toast(state.beautify ? "Làm đẹp nét: BẬT" : "Làm đẹp nét: TẮT"); };
  $("undo").onclick = undo;
  if ($("redo")) $("redo").onclick = redo;
  $("clear").onclick = function () { if (confirm("Xóa toàn bộ trang?")) { pushHist(); state.items = []; state.overlays = []; overlay.innerHTML = ""; if (window.VPGeo) window.VPGeo.clear(); redraw(); scheduleSave(); } };
  if ($("btn-calc")) $("btn-calc").onclick = function () { insertCalc(100, 90); };
  $("btn-note").onclick = function () { insertNote(130, 100); };
  // Công cụ môn học (Lý/Hoá/Sinh) qua nút ★
  if ($("btn-shapes-fav")) $("btn-shapes-fav").onclick = function () { showDialog("dlg-sci"); };
  document.querySelectorAll("[data-sci]").forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.sci;
      if (k === "ptable") addOverlayData("ptable", {}, 70, 90);
      else if (k === "chem") addOverlayData("chem", {}, 120, 110);
      else if (k === "circuit") addOverlayData("circuit", {}, 120, 110);
      else if (k === "force") addOverlayData("force", {}, 140, 110);
      else if (k === "pedigree") addOverlayData("pedigree", {}, 140, 110);
      else if (k === "dna") addOverlayData("dna", {}, 160, 110);
      else toast("Công cụ này đang được phát triển.");
      hideDialog("dlg-sci");
    };
  });
  // Mũi tên / đoạn đo / ngoặc – nút có menu chọn kiểu
  function activateArrow(style) {
    state.tool = "arrow"; state.arrowStyle = style || state.arrowStyle || "arrow";
    if (window.VPGeo) window.VPGeo.setTool(null);
    clearActive(); $("btn-arrow").classList.add("active");
  }
  if ($("btn-arrow")) $("btn-arrow").onclick = function (e) {
    e.stopPropagation();
    var m = $("arrow-menu"), r = this.getBoundingClientRect();
    m.style.left = r.left + "px"; m.style.top = (r.bottom + 4) + "px"; m.classList.toggle("show");
    activateArrow();
  };
  document.querySelectorAll("#arrow-menu button").forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); activateArrow(b.dataset.arrow); $("arrow-menu").classList.remove("show"); toast("Công cụ: " + b.textContent.trim()); };
  });
  document.addEventListener("click", function () { document.querySelectorAll(".nr-menu.show").forEach(function (m) { m.classList.remove("show"); }); });
  if ($("btn-ai-opt")) $("btn-ai-opt").onclick = function (e) {
    e.stopPropagation();
    var m = $("ai-opts"), r = this.getBoundingClientRect();
    document.querySelectorAll(".nr-menu.show").forEach(function (x) { if (x !== m) x.classList.remove("show"); });
    m.style.left = Math.min(r.left, window.innerWidth - 230) + "px"; m.style.top = (r.bottom + 4) + "px"; m.classList.toggle("show");
  };
  if ($("ai-opts")) $("ai-opts").addEventListener("click", function (e) { e.stopPropagation(); });
  // Thước kẻ / đo góc
  if ($("btn-ruler")) $("btn-ruler").onclick = function () { var on = window.VPRuler.toggle(board); this.classList.toggle("active", on); };
  // Hiện/ẩn danh sách trang
  if ($("btn-sidebar")) $("btn-sidebar").onclick = function () { var s = $("nr-side"); s.classList.toggle("hidden"); this.classList.toggle("active", !s.classList.contains("hidden")); };
  if ($("btn-menu")) $("btn-menu").onclick = function () { var s = $("nr-side"); s.classList.toggle("hidden"); };
  if ($("btn-library")) $("btn-library").onclick = function () { openBookFile(); };
  // Chèn bảng
  if ($("btn-table")) $("btn-table").onclick = function () {
    var r = parseInt(prompt("Số hàng:", "3"), 10), c = parseInt(prompt("Số cột:", "3"), 10);
    if (!r || !c) return; addOverlayData("table", { rows: r, cols: c, cells: [] }, 120, 110);
  };
  // Khung văn bản / chữ
  function askText() { var t = prompt("Nhập nội dung chữ:", ""); if (t) insertText(t, 140, 120, { font: $("text-font") ? $("text-font").value : "", size: 22 }); }
  if ($("btn-textbox")) $("btn-textbox").onclick = askText;
  if ($("btn-text")) $("btn-text").onclick = askText;
  // Trình duyệt web nhúng
  if ($("btn-web")) $("btn-web").onclick = function () { var u = prompt("Địa chỉ trang web:", "https://"); if (u && u !== "https://") addOverlayData("web", { url: u }, 120, 110); };
  // Tô màu miền / Chọn vùng (đang phát triển)
  if ($("btn-fill")) $("btn-fill").onclick = function () { state.tool = "fill"; if (window.VPGeo) window.VPGeo.setTool(null); clearActive(); this.classList.add("active"); toast("Tô màu: bấm vào trong hình kín (bấm lại để bỏ tô)."); };
  if ($("btn-select")) $("btn-select").onclick = function () { state.tool = "select"; state.selected = []; if (window.VPGeo) window.VPGeo.setTool(null); clearActive(); this.classList.add("active"); toast("Chọn vùng: khoanh để chọn, kéo để di chuyển, Delete để xoá."); };
  // ----- Thao tác trên đối tượng đã chọn: sao chép / cắt / dán / nhân bản / thứ tự / xoá
  var clip = null, pasteN = 0;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function hasSel() { return state.selected && state.selected.length > 0; }
  function selItems() { return state.selected.slice().sort(function (a, b) { return a - b; }).map(function (i) { return state.items[i]; }).filter(Boolean); }
  function enterSelect() {
    if (state.tool === "select") return;
    state.tool = "select"; if (window.VPGeo) window.VPGeo.setTool(null);
    tools.forEach(function (x) { x.classList.remove("active"); }); geoBtns.forEach(function (x) { x.classList.remove("active"); });
    ["btn-arrow", "btn-fill"].forEach(function (id) { if ($(id)) $(id).classList.remove("active"); });
    if ($("btn-select")) $("btn-select").classList.add("active");
  }
  function removeSel() { var set = {}; state.selected.forEach(function (i) { set[i] = 1; }); state.items = state.items.filter(function (it, i) { return !set[i]; }); state.selected = []; }
  function addClones(list, dx, dy) {
    var start = state.items.length;
    list.forEach(function (it) { var c = clone(it); translateItem(c, dx, dy); state.items.push(c); });
    state.selected = list.map(function (_, k) { return start + k; });
  }
  var selActions = {
    copy: function () { if (!hasSel()) return; clip = clone(selItems()); pasteN = 0; toast("Đã sao chép " + clip.length + " đối tượng."); },
    cut: function () { if (!hasSel()) return; clip = clone(selItems()); pasteN = 0; pushHist(); removeSel(); toast("Đã cắt " + clip.length + " đối tượng."); },
    paste: function () { if (!clip || !clip.length) { toast("Chưa có gì để dán."); return; } pushHist(); pasteN++; enterSelect(); addClones(clip, 20 * pasteN, 20 * pasteN); },
    dup: function () { if (!hasSel()) return; pushHist(); addClones(selItems(), 18, 18); },
    del: function () { if (!hasSel()) return; pushHist(); removeSel(); },
    front: function () { if (!hasSel()) return; pushHist(); var sel = selItems(), set = {}; state.selected.forEach(function (i) { set[i] = 1; }); state.items = state.items.filter(function (it, i) { return !set[i]; }); var st = state.items.length; sel.forEach(function (it) { state.items.push(it); }); state.selected = sel.map(function (_, k) { return st + k; }); },
    back: function () { if (!hasSel()) return; pushHist(); var sel = selItems(), set = {}; state.selected.forEach(function (i) { set[i] = 1; }); state.items = sel.concat(state.items.filter(function (it, i) { return !set[i]; })); state.selected = sel.map(function (_, k) { return k; }); },
    fill: function () { if (!hasSel()) return; pushHist(); state.selected.forEach(function (i) { var it = state.items[i]; if (it && ["rect", "circle", "ellipse", "triangle", "poly"].indexOf(it.type) >= 0) it.fill = state.color; }); },
    stroke: function () { if (!hasSel()) return; pushHist(); state.selected.forEach(function (i) { if (state.items[i]) state.items[i].color = state.color; }); },
    all: function () { enterSelect(); state.selected = state.items.map(function (_, i) { return i; }); }
  };
  function runAct(act) { if (!selActions[act]) return; selActions[act](); redraw(); scheduleSave(); }
  document.querySelectorAll("#sel-bar button").forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); runAct(b.dataset.act); };
  });
  // Menu chuột phải (menu ngữ cảnh) trên bảng
  function showMenuAt(m, x, y) {
    document.querySelectorAll(".nr-menu.show").forEach(function (o) { if (o !== m) o.classList.remove("show"); });
    m.classList.add("show");
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 4)) + "px";
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - h - 4)) + "px";
  }
  canvas.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    var pt = pos(e), m = $("ctx-menu"); if (!m) return;
    var onSel = hasSel() && state.selected.some(function (i) { return state.items[i] && boxHit(state.items[i], pt); });
    if (!onSel) { var hit = hitItem(pt); if (hit >= 0) { enterSelect(); state.selected = [hit]; } else state.selected = []; }
    state.pastePt = pt; redraw();
    var sel = hasSel();
    m.querySelectorAll("button[data-act]").forEach(function (b) {
      var a = b.dataset.act;
      b.disabled = a === "paste" ? !(clip && clip.length) : (a === "all" ? !state.items.length : !sel);
    });
    showMenuAt(m, e.clientX, e.clientY);
  });
  document.querySelectorAll("#ctx-menu button[data-act]").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation(); $("ctx-menu").classList.remove("show");
      if (b.dataset.act === "paste" && state.pastePt && clip && clip.length) {
        // Dán đúng vị trí bấm chuột phải
        var mnx = Infinity, mny = Infinity; clip.forEach(function (it) { var bb = itemBox(it); mnx = Math.min(mnx, bb.minx); mny = Math.min(mny, bb.miny); });
        pushHist(); enterSelect(); addClones(clip, state.pastePt.x - mnx, state.pastePt.y - mny); redraw(); scheduleSave(); return;
      }
      runAct(b.dataset.act);
    };
  });
  // Menu thả xuống ▾ cho bút và tẩy
  function setPen(pen) {
    state.tool = "pen"; state.pen = pen; if (window.VPGeo) window.VPGeo.setTool(null);
    clearActive();
    var btn = document.querySelector('[data-tool="pen"][data-pen="' + pen + '"]');
    if (btn) btn.classList.add("active");
    else if (pen === "hl") { var h = document.querySelector("[data-hl].sel") || document.querySelector("[data-hl]"); if (h) { state.color = h.dataset.hl; h.classList.add("sel"); } }
  }
  function setEraser(mode) {
    state.tool = "eraser"; state.eraserMode = mode; if (window.VPGeo) window.VPGeo.setTool(null);
    clearActive();
    var btn = document.querySelector('[data-tool="eraser"][data-erase="' + mode + '"]') || document.querySelector('[data-tool="eraser"]');
    if (btn) btn.classList.add("active");
  }
  function syncMenuChecks() {
    document.querySelectorAll("#pen-menu [data-pm]").forEach(function (b) { b.classList.toggle("chk", state.tool === "pen" && state.pen === b.dataset.pm); });
    document.querySelectorAll("#pen-menu [data-pz]").forEach(function (b) { b.classList.toggle("chk", state.size === parseInt(b.dataset.pz, 10)); });
    var bz = document.querySelector('#pen-menu [data-pb]'); if (bz) bz.classList.toggle("chk", !!state.beautify);
    var pt = document.querySelector('#pen-menu [data-pt]'); if (pt) pt.classList.toggle("chk", !!state.tidyInk);
    document.querySelectorAll("#pen-menu [data-tidy]").forEach(function (b) { b.classList.toggle("chk", state.tidyInk && (state.tidyStrength || 2) === parseInt(b.dataset.tidy, 10)); });
    document.querySelectorAll("#eraser-menu [data-em]").forEach(function (b) { b.classList.toggle("chk", state.tool === "eraser" && (state.eraserMode || "stroke") === b.dataset.em); });
  }
  [["btn-pen-dd", "pen-menu"], ["btn-eraser-dd", "eraser-menu"]].forEach(function (pr) {
    var btn = $(pr[0]); if (!btn) return;
    btn.onclick = function (e) {
      e.stopPropagation(); var m = $(pr[1]), r = this.getBoundingClientRect();
      if (m.classList.contains("show")) { m.classList.remove("show"); return; }
      syncMenuChecks(); showMenuAt(m, r.left, r.bottom + 4);
    };
  });
  document.querySelectorAll("#pen-menu button").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      if (b.dataset.pm) { setPen(b.dataset.pm); toast("Bút: " + b.textContent.trim()); }
      else if (b.dataset.pz) {
        state.size = parseInt(b.dataset.pz, 10);
        document.querySelectorAll("[data-sizedot]").forEach(function (x) { x.classList.toggle("sel", parseInt(x.dataset.sizedot, 10) === state.size); });
      } else if (b.dataset.pb != null) { $("beautify").click(); }
      else if (b.dataset.pt != null) { state.tidyInk = !state.tidyInk; saveSettings(); toast(state.tidyInk ? "Tự nắn mượt nét chữ: BẬT" : "Tự nắn mượt nét chữ: TẮT"); }
      else if (b.dataset.tidy != null) { state.tidyInk = true; state.tidyStrength = parseInt(b.dataset.tidy, 10); saveSettings(); toast("Nắn nét mức " + b.dataset.tidy + " (" + b.textContent.trim().replace(/^\d+ · /, "") + ")"); }
      else if (b.dataset.tidyAll != null) { tidyWholePage(); }
      syncMenuChecks();
    };
  });
  // Nắn mượt lại mọi nét viết tay trên trang (giữ nguyên là nét chữ)
  function tidyWholePage() {
    if (!window.VPBeautify) return;
    var strokes = state.items.filter(function (it) { return it.type === "stroke" && it.pen !== "hl" && it.points && it.points.length > 3; });
    if (!strokes.length) { toast("Trang chưa có nét viết tay để nắn."); return; }
    pushHist();
    strokes.forEach(function (it) { it.points = window.VPBeautify.refineInk(it.points, state.tidyStrength || 2); });
    redraw(); scheduleSave();
    toast("Đã nắn mượt " + strokes.length + " nét (Ctrl+Z để hoàn tác).");
  }
  document.querySelectorAll("#eraser-menu button").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation(); $("eraser-menu").classList.remove("show");
      if (b.dataset.em) { setEraser(b.dataset.em); toast("Tẩy: " + b.textContent.trim()); }
      else if (b.dataset.ex === "ink") { if (!state.items.some(function (it) { return it.type === "stroke"; })) { toast("Trang không có nét viết tay."); return; } clearStrokes(); state.selected = []; redraw(); toast("Đã xoá nét viết tay (Ctrl+Z để hoàn tác)."); }
      else if (b.dataset.ex === "page") $("clear").click();
    };
  });
  // Phím tắt: Delete, Ctrl+Z/Y, Ctrl+C/X/V/D/A, Esc, phím mũi tên (dịch chuyển)
  document.addEventListener("keydown", function (e) {
    var t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (document.querySelector(".dlg.show, .ox-studio")) return;
    if (e.key === "Escape" && state.tool === "oxyz") { state.drawing = false; state.selBox = null; state.cur = null; $("btn-select").click(); redraw(); return; }
    var k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && k === "v") { e.preventDefault(); runAct("paste"); return; }
    if (mod && k === "a") { e.preventDefault(); runAct("all"); return; }
    if (!hasSel()) return;
    if (mod && k === "c") { e.preventDefault(); runAct("copy"); }
    else if (mod && k === "x") { e.preventDefault(); runAct("cut"); }
    else if (mod && k === "d") { e.preventDefault(); runAct("dup"); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); runAct("del"); }
    else if (e.key === "Escape") { state.selected = []; redraw(); }
    else if (e.key.indexOf("Arrow") === 0) {
      e.preventDefault(); var st = e.shiftKey ? 10 : 1, dx = 0, dy = 0;
      if (e.key === "ArrowLeft") dx = -st; else if (e.key === "ArrowRight") dx = st; else if (e.key === "ArrowUp") dy = -st; else dy = st;
      if (!e.repeat) pushHist();
      state.selected.forEach(function (i) { if (state.items[i]) translateItem(state.items[i], dx, dy); }); redraw();
    }
  });
  // Quay màn hình
  if ($("btn-record")) $("btn-record").onclick = toggleRecord;
  if ($("btn-timer")) $("btn-timer").onclick = function () { insertTimer(120, 90); };
  if ($("btn-picker")) $("btn-picker").onclick = function () { insertPicker(160, 90); };
  $("btn-var").onclick = function () { showDialog("dlg-var"); $("var-input").focus(); };
  $("var-ok").onclick = function () {
    var expr = $("var-input").value.trim(); if (!expr) return;
    insertVar({ expr: expr, mode: $("var-mode").value, xmin: parseFloat($("var-min").value) || -10, xmax: parseFloat($("var-max").value) || 10 }, 90, 90);
    hideDialog("dlg-var");
  };
  $("btn-png").onclick = async function () { try { toast("Đang tạo ảnh…"); await window.VPExport.png(board); } catch (e) { toast("Lỗi xuất ảnh."); } };
  $("btn-pdf").onclick = async function () { try { toast("Đang tạo PDF…"); await window.VPExport.pdf(board); } catch (e) { toast("Lỗi xuất PDF."); } };

  // Hộp thoại công thức đầy đủ (VPFormula)
  var formulaBuilt = false;
  function buildFormulaUI() {
    if (formulaBuilt) return; formulaBuilt = true;
    window.VPFormula.build({ cats: $("f-cats"), grid: $("f-grid"), quick: $("f-quick"), search: $("f-search"), input: $("math-input"), preview: $("math-preview") });
    // Màu
    document.querySelectorAll("#f-colors .fcs").forEach(function (b) {
      b.onclick = function () { window.VPFormula.setColor(b.dataset.fc); if ($("f-color-wheel")) $("f-color-wheel").value = b.dataset.fc; document.querySelectorAll("#f-colors .fcs").forEach(function (x) { x.classList.remove("sel"); }); b.classList.add("sel"); window.VPFormula.render($("math-preview"), $("math-input").value); };
    });
    if ($("f-color-wheel")) $("f-color-wheel").oninput = function () { window.VPFormula.setColor(this.value); document.querySelectorAll("#f-colors .fcs").forEach(function (x) { x.classList.remove("sel"); }); window.VPFormula.render($("math-preview"), $("math-input").value); };
    // Cỡ
    $("f-size").oninput = function () { window.VPFormula.setSize(parseInt(this.value, 10)); $("f-size-val").textContent = this.value; };
    // Display
    $("f-display").onchange = function () { window.VPFormula.setDisplay(this.checked); window.VPFormula.render($("math-preview"), $("math-input").value); };
    // Toán / Văn bản
    $("f-math").onclick = function () { window.VPFormula.setMode("math"); this.classList.add("sel"); $("f-text").classList.remove("sel"); window.VPFormula.render($("math-preview"), $("math-input").value); };
    $("f-text").onclick = function () { window.VPFormula.setMode("text"); this.classList.add("sel"); $("f-math").classList.remove("sel"); window.VPFormula.render($("math-preview"), $("math-input").value); };
  }
  $("btn-math").onclick = function () { showDialog("dlg-math"); buildFormulaUI(); $("math-input").focus(); };
  $("math-ok").onclick = function () {
    var st = window.VPFormula.state;
    insertMath($("math-input").value, 90, 90, { color: st.color, size: st.size, display: st.display, mode: st.mode });
    $("math-input").value = ""; window.VPFormula.render($("math-preview"), ""); hideDialog("dlg-math");
  };

  // Hộp thoại đồ thị
  $("btn-plot").onclick = function () { showDialog("dlg-plot"); $("plot-input").focus(); };
  $("plot-ok").onclick = function () { insertPlot($("plot-input").value, 80, 80); hideDialog("dlg-plot"); };

  // Mẫu hình học
  $("btn-shapes").onclick = function () { showDialog("dlg-shapes"); };
  $("btn-oxyz").onclick = function () {
    state.tool = "oxyz"; state.drawing = false; state.cur = null; state.selBox = null;
    if (window.VPGeo) window.VPGeo.setTool(null); clearActive(); this.classList.add("active");
    toast("Kéo để vẽ khung hệ trục Oxyz (hoặc chạm một lần), rồi gõ điểm, mặt phẳng, mặt cầu...");
  };
  canvas.addEventListener("dblclick", function (e) {
    if (state.tool !== "select") return;
    var index = hitItem(pos(e)), item = state.items[index];
    if (!item || item.type !== "oxyz") return;
    window.VPOxyz.open(item.scene, function (scene3) { pushHist(); item.scene = scene3; redraw(); scheduleSave(); });
  });
  $("btn-solid").onclick = function () { showDialog("dlg-solid"); };
  document.querySelectorAll("[data-solid]").forEach(function (b) {
    b.onclick = function () {
      pushHist(); state.items.push(window.VPSolid.make(b.dataset.solid, canvas.clientWidth / 2, canvas.clientHeight / 2, 100, state.color, state.size || 2));
      redraw(); hideDialog("dlg-solid");
    };
  });
  document.querySelectorAll("[data-shape]").forEach(function (b) {
    b.onclick = function () { addShapeTemplate(b.dataset.shape); hideDialog("dlg-shapes"); };
  });
  function regPoly(cx, cy, r, n, rot) { var a = []; for (var i = 0; i < n; i++) { var t = rot + i * 2 * Math.PI / n; a.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }); } return a; }
  function addShapeTemplate(kind) {
    var cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2, s = 90, c = state.color, w = state.size;
    pushHist();
    function push(o) { o.color = c; o.size = w; state.items.push(o); }
    if (kind === "triangle") push({ type: "triangle", pts: [{ x: cx, y: cy - s }, { x: cx - s, y: cy + s }, { x: cx + s, y: cy + s }] });
    else if (kind === "triangle-eq") { var h = s * Math.sqrt(3); push({ type: "triangle", pts: [{ x: cx, y: cy - h / 2 }, { x: cx - s, y: cy + h / 2 }, { x: cx + s, y: cy + h / 2 }] }); }
    else if (kind === "right-tri") push({ type: "triangle", pts: [{ x: cx - s, y: cy - s }, { x: cx - s, y: cy + s }, { x: cx + s, y: cy + s }] });
    else if (kind === "square") push({ type: "rect", x: cx - s, y: cy - s, w: 2 * s, h: 2 * s });
    else if (kind === "rect") push({ type: "rect", x: cx - s, y: cy - s * 0.7, w: 2 * s, h: 1.4 * s });
    else if (kind === "para") push({ type: "poly", pts: [{ x: cx - s + 30, y: cy - s * 0.6 }, { x: cx + s + 30, y: cy - s * 0.6 }, { x: cx + s - 30, y: cy + s * 0.6 }, { x: cx - s - 30, y: cy + s * 0.6 }] });
    else if (kind === "rhombus") push({ type: "poly", pts: [{ x: cx, y: cy - s }, { x: cx + s * 0.7, y: cy }, { x: cx, y: cy + s }, { x: cx - s * 0.7, y: cy }] });
    else if (kind === "trapezoid") push({ type: "poly", pts: [{ x: cx - s * 0.55, y: cy - s * 0.6 }, { x: cx + s * 0.55, y: cy - s * 0.6 }, { x: cx + s, y: cy + s * 0.6 }, { x: cx - s, y: cy + s * 0.6 }] });
    else if (kind === "pentagon") push({ type: "poly", pts: regPoly(cx, cy, s, 5, -Math.PI / 2) });
    else if (kind === "hexagon") push({ type: "poly", pts: regPoly(cx, cy, s, 6, -Math.PI / 2) });
    else if (kind === "circle") push({ type: "circle", cx: cx, cy: cy, r: s });
    else if (kind === "ellipse") push({ type: "ellipse", cx: cx, cy: cy, rx: s * 1.3, ry: s * 0.75 });
    else if (kind === "parabola") { var pts = []; for (var x = -s * 1.4; x <= s * 1.4; x += 6) pts.push({ x: cx + x, y: cy + s - (x * x) / (s * 1.0) }); push({ type: "path", pts: pts }); }
    else if (kind === "axes") { push({ type: "line", x1: cx - 180, y1: cy, x2: cx + 180, y2: cy }); push({ type: "line", x1: cx, y1: cy - 140, x2: cx, y2: cy + 140 }); }
    redraw();
  }

  // Nhận dạng (Tesseract miễn phí hoặc máy chủ Ollama/Claude). Kết quả công thức mở ra để sửa trước khi chèn.
  $("btn-ai").onclick = async function () {
    var btn = this; var old = btn.textContent; var statusEl = $("ai-status");
    btn.disabled = true; btn.textContent = "Đang nhận dạng…";
    try {
      var engine = $("ai-engine").value, mode = $("ai-mode").value, data, src = cropForOCR();
      if (engine === "ink") {
        // Nhận dạng THEO NÉT (ngoại tuyến): dùng quỹ đạo các nét viết tay trên trang
        statusEl.textContent = "Đang nhận dạng theo nét…";
        var strokeItems = state.items.filter(function (it) { return it.type === "stroke"; });
        if (!strokeItems.length) throw new Error("Chưa có nét viết tay để nhận dạng.");
        var ink = window.VPInk.recognizeItems(strokeItems);
        if (mode === "math" && ink.latex) data = { kind: "math", latex: ink.latex, text: "", confidence: null };
        else data = { kind: "text", text: ink.text, latex: "", confidence: null };
      } else if (engine === "tesseract") {
        statusEl.textContent = "Đang tải mô hình…";
        var lines = (mode === "text") ? strokeLines() : [];   // chỉ tách dòng cho chữ tiếng Việt; toán giữ cả khối 2D
        if (lines.length >= 2) {
          // Nhận dạng chữ viết tay TỪNG DÒNG rồi ghép -> nhiều dòng chính xác hơn
          var parts = [], conf = 0, nc = 0;
          for (var li = 0; li < lines.length; li++) {
            statusEl.textContent = "Dòng " + (li + 1) + "/" + lines.length + "…";
            var lc = cropRegion(lines[li], 16, 2); if (!lc) continue;
            var r = await window.VPRecognize.recognizeTesseract(lc, null, { math: false, mode: "text", psm: "7" }); // PSM 7 = một dòng
            if (r.text) parts.push(r.text);
            if (r.confidence != null) { conf += r.confidence; nc++; }
          }
          data = { kind: "text", text: parts.join("\n"), latex: "", confidence: nc ? Math.round(conf / nc) : null };
        } else {
          data = await window.VPRecognize.recognizeTesseract(src, function (st) { statusEl.textContent = st; }, { math: mode === "math", mode: mode, psm: mode === "text" ? "6" : "6" });
        }
      } else {
        data = await window.VPRecognize.recognizeServer(src.toDataURL("image/png"), $("ai-mode").value);
      }
      statusEl.textContent = "";
      var bb = inkBBox();
      if ((data.kind === "math" || data.kind === "mixed") && data.latex) {
        showDialog("dlg-math"); buildFormulaUI();
        $("math-input").value = data.latex;
        window.VPFormula.render($("math-preview"), data.latex);   // mở bộ công thức để sửa LaTeX rồi chèn
      }
      if (data.text) {
        var fs = bb ? Math.min(Math.max(Math.round(bb.h), 18), 46) : 22;
        insertText(data.text, bb ? bb.x : 100, bb ? bb.y : 100, { font: $("text-font").value, size: fs });
      }
      // Thay nét viết tay bằng chữ (nếu bật) – đổi chữ tay thành phông chữ tại chỗ
      if ($("ai-replace").checked && bb && (data.text || data.latex)) { clearStrokes(); redraw(); }
      if (!data.latex && !data.text) toast("Không nhận ra nội dung. Hãy viết rõ hơn.");
      else if (data.confidence != null && data.confidence < 55) toast("Đã nhận dạng (độ tin cậy " + data.confidence + "%). Viết to & rõ hơn để chính xác hơn.");
      else toast("Đã chuyển chữ viết tay thành chữ đánh máy." + (data.confidence != null ? " (tin cậy " + data.confidence + "%)" : ""));
    } catch (e) {
      statusEl.textContent = "";
      toast(e.message || "Lỗi nhận dạng.");
    } finally { btn.disabled = false; btn.textContent = old; }
  };

  // ----- Dạy nét chữ (stroke-based): ô viết nhỏ, học mẫu của người dùng
  (function setupInkTrainer() {
    var pad = $("ink-pad"); if (!pad || !window.VPInk) return;
    var pctx = pad.getContext("2d"), strokes = [], curStroke = null, drawingPad = false;
    function redrawPad() {
      pctx.clearRect(0, 0, pad.width, pad.height);
      pctx.strokeStyle = "#7a1020"; pctx.lineWidth = 3; pctx.lineJoin = pctx.lineCap = "round";
      strokes.concat(curStroke ? [curStroke] : []).forEach(function (s) {
        if (s.length < 1) return; pctx.beginPath(); pctx.moveTo(s[0].x, s[0].y);
        for (var i = 1; i < s.length; i++) pctx.lineTo(s[i].x, s[i].y); pctx.stroke();
      });
    }
    function ppos(e) { var r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    pad.addEventListener("pointerdown", function (e) { pad.setPointerCapture(e.pointerId); drawingPad = true; curStroke = [ppos(e)]; });
    pad.addEventListener("pointermove", function (e) { if (!drawingPad) return; curStroke.push(ppos(e)); redrawPad(); });
    function endPad() { if (!drawingPad) return; drawingPad = false; if (curStroke && curStroke.length > 1) strokes.push(curStroke); curStroke = null; redrawPad(); guess(); }
    pad.addEventListener("pointerup", endPad); pad.addEventListener("pointercancel", endPad);
    function clearPad() { strokes = []; curStroke = null; redrawPad(); if ($("ink-guess")) $("ink-guess").innerHTML = ""; }
    function guess() {
      if (!strokes.length || !$("ink-guess")) return;
      var r = window.VPInk.recognizeSymbol(strokes);
      $("ink-guess").innerHTML = r.name ? ("AI đoán: <b>" + r.name + "</b> (" + r.score + "%)") : "";
    }
    function updCount() { if ($("ink-count")) $("ink-count").textContent = "Đã dạy " + window.VPInk.templates().length + " mẫu riêng."; }
    if ($("btn-ink-train")) $("btn-ink-train").onclick = function (e) { e.stopPropagation(); document.querySelectorAll(".nr-menu.show").forEach(function (m) { m.classList.remove("show"); }); clearPad(); updCount(); showDialog("dlg-ink"); };
    if ($("ink-clearpad")) $("ink-clearpad").onclick = clearPad;
    if ($("ink-test")) $("ink-test").onclick = guess;
    if ($("ink-learn")) $("ink-learn").onclick = function () {
      var lbl = ($("ink-label").value || "").trim();
      if (!lbl) { toast("Hãy nhập ký hiệu bạn vừa viết."); return; }
      if (!strokes.length) { toast("Hãy viết ký hiệu vào ô bên trái."); return; }
      if (window.VPInk.learn(lbl, strokes)) { toast('Đã học nét "' + lbl + '".'); clearPad(); updCount(); }
    };
    if ($("ink-reset")) $("ink-reset").onclick = function () { if (confirm("Xoá toàn bộ mẫu nét bạn đã dạy?")) { window.VPInk.resetUser(); updCount(); toast("Đã xoá mẫu đã dạy."); } };
  })();

  // Câu hỏi
  var qTab = "mcq";
  if ($("btn-quiz")) $("btn-quiz").onclick = function () { showDialog("dlg-quiz"); };
  document.querySelectorAll("[data-qtab]").forEach(function (b) {
    b.onclick = function () {
      qTab = b.dataset.qtab;
      document.querySelectorAll("[data-qtab]").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      $("q-mcq").style.display = qTab === "mcq" ? "block" : "none";
      $("q-tf").style.display = qTab === "tf" ? "block" : "none";
    };
  });
  $("quiz-ok").onclick = function () {
    var q = $("q-text").value.trim();
    if (qTab === "mcq") {
      var correct = parseInt((document.querySelector('input[name="q-correct"]:checked') || {}).value || "0", 10);
      insertQuiz({ q: q, opts: [$("q-a").value, $("q-b").value, $("q-c").value, $("q-d").value], correct: correct, sol: $("q-sol").value.trim() }, "mcq", 90, 90);
    } else {
      var rows = [0, 1, 2, 3].map(function (i) {
        var t = $("tf-" + "abcd"[i]).value;
        var sel = document.querySelector('input[name="tf' + i + '"]:checked');
        return { t: t, ans: sel && sel.value === "true" };
      });
      insertQuiz({ q: q, rows: rows }, "tf", 90, 90);
    }
    hideDialog("dlg-quiz");
  };

  // ----- Hộp thoại & toast
  function showDialog(id) { $(id).classList.add("show"); }
  function hideDialog(id) { $(id).classList.remove("show"); }
  document.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = function () { hideDialog(b.dataset.close); }; });
  var toastEl = $("toast"), toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600); }

  // Trạng thái AI
  fetch("./api/health").then(function (r) { return r.json(); }).then(function (d) {
    if (d.ai) {
      // Có AI máy chủ mạnh (Ollama/pix2tex/Claude) -> ưu tiên engine "server" cho nhận dạng toán
      if ($("ai-engine")) $("ai-engine").value = "server";
      var nm = $("ai-note"); if (nm && d.provider) { nm.textContent = "AI: " + (d.model || d.provider); nm.style.display = "inline"; nm.classList.add("ok"); }
    } else { $("ai-note").style.display = "inline"; }
  }).catch(function () {});

  // ----- Trang & sổ bài giảng (lưu/mở)
  var pages = [blankPage()], cur = 0, saveTimer = null;
  function blankPage() { return { items: [], geo: { points: [], shapes: [] }, overlays: [], bg: null }; }
  function capture() { pages[cur] = { items: state.items, geo: { points: window.VPGeo.points, shapes: window.VPGeo.shapes }, overlays: state.overlays, bg: pages[cur] ? pages[cur].bg : null, thumb: pages[cur] ? pages[cur].thumb : null }; }
  function restore() {
    var pg = pages[cur] || blankPage();
    state.items = pg.items; state.overlays = pg.overlays; state.pageBg = pg.bg || null; state.selected = []; resetHist();
    window.VPGeo.points = pg.geo.points; window.VPGeo.shapes = pg.geo.shapes; window.VPGeo.sel = [];
    renderOverlays(); redraw(); updatePageLabel();
  }
  function updatePageLabel() { var el = $("page-label"); if (el) el.textContent = (cur + 1) + " / " + pages.length; }
  function snapshotThumb() { try { var sm = document.createElement("canvas"); sm.width = 130; sm.height = Math.round(130 * canvas.clientHeight / canvas.clientWidth); sm.getContext("2d").drawImage(canvas, 0, 0, sm.width, sm.height); pages[cur].thumb = sm.toDataURL("image/jpeg", 0.5); } catch (e) {} }
  function makeThumbs() {
    var host = $("thumbs"); if (!host) return; host.innerHTML = "";
    pages.forEach(function (pg, i) {
      var d = document.createElement("div"); d.className = "thumb" + (i === cur ? " sel" : "");
      if (pg.thumb) { var im = document.createElement("img"); im.src = pg.thumb; d.appendChild(im); } else { d.style.height = "92px"; d.style.background = "repeating-linear-gradient(#fff 0 10px,#eef2f6 10px 11px)"; }
      var n = document.createElement("div"); n.className = "tn-num"; n.textContent = (i + 1); d.appendChild(n);
      d.onclick = function () { gotoPage(i); };
      host.appendChild(d);
    });
  }
  function gotoPage(i) { capture(); snapshotThumb(); cur = Math.max(0, Math.min(pages.length - 1, i)); restore(); makeThumbs(); scheduleSave(); }
  function addPage() { capture(); snapshotThumb(); pages.splice(cur + 1, 0, blankPage()); cur++; restore(); makeThumbs(); scheduleSave(); }
  function delPage() { if (!confirm("Xóa trang hiện tại?")) return; if (pages.length <= 1) pages[0] = blankPage(); else { pages.splice(cur, 1); if (cur >= pages.length) cur = pages.length - 1; } restore(); makeThumbs(); scheduleSave(); }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveLocal, 400); }
  function serialize() { capture(); return JSON.stringify({ v: 1, cur: cur, pages: pages }); }
  function saveLocal() { if (state.opt && state.opt.autosave === false) return; snapshotThumb(); try { localStorage.setItem("vpvie.book", serialize()); } catch (e) {} if ($("thumbs") && $("thumbs").children[cur]) { var im = $("thumbs").children[cur].querySelector("img"); if (im && pages[cur].thumb) im.src = pages[cur].thumb; } }
  function loadBook(obj) {
    if (!obj || !obj.pages || !obj.pages.length) return;
    pages = obj.pages.map(function (pg) { return { items: pg.items || [], geo: { points: (pg.geo && pg.geo.points) || [], shapes: (pg.geo && pg.geo.shapes) || [] }, overlays: pg.overlays || [], thumb: pg.thumb, bg: pg.bg || null }; });
    cur = Math.min(obj.cur || 0, pages.length - 1); restore(); makeThumbs();
  }
  function loadLocal() { try { var s = localStorage.getItem("vpvie.book"); if (s) loadBook(JSON.parse(s)); } catch (e) {} }
  function downloadBook() { var b = new Blob([serialize()], { type: "application/json" }); var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "so-bai-giang.vpvie.json"; a.click(); }
  function openBookFile() {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = function () { var f = inp.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { loadBook(JSON.parse(rd.result)); scheduleSave(); toast("Đã mở sổ bài giảng."); } catch (e) { toast("Tệp không hợp lệ."); } }; rd.readAsText(f); };
    inp.click();
  }
  if ($("page-prev")) $("page-prev").onclick = function () { gotoPage(cur - 1); };
  if ($("page-next")) $("page-next").onclick = function () { gotoPage(cur + 1); };
  if ($("page-add")) $("page-add").onclick = addPage;
  if ($("sheet-add")) $("sheet-add").onclick = addPage;
  if ($("page-del")) $("page-del").onclick = delPage;
  if ($("book-save")) $("book-save").onclick = downloadBook;
  if ($("book-open")) $("book-open").onclick = openBookFile;
  // ----- Google Drive
  function gdStatus(t, ok) { var el = $("gd-status"); if (el) { el.textContent = t; el.classList.toggle("ok", !!ok); } }
  if ($("btn-gdrive")) $("btn-gdrive").onclick = function () {
    if ($("gd-clientid")) $("gd-clientid").value = window.VPDrive.getClientId();
    gdStatus(window.VPDrive.isSignedIn() ? "Đã đăng nhập" : (window.VPDrive.isConfigured() ? "Đã có Client ID — bấm Đăng nhập" : "Chưa có Client ID"), window.VPDrive.isSignedIn());
    showDialog("dlg-gdrive");
  };
  if ($("gd-save-cid")) $("gd-save-cid").onclick = function () { window.VPDrive.setClientId($("gd-clientid").value); gdStatus("Đã lưu Client ID — bấm Đăng nhập", false); toast("Đã lưu Client ID."); };
  if ($("gd-signin")) $("gd-signin").onclick = async function () {
    if ($("gd-clientid") && $("gd-clientid").value.trim()) window.VPDrive.setClientId($("gd-clientid").value);
    gdStatus("Đang đăng nhập…");
    try { await window.VPDrive.signIn(); gdStatus("Đã đăng nhập Google ✓", true); toast("Đã đăng nhập Google."); }
    catch (e) { gdStatus("Lỗi: " + (e.code === "NO_CLIENT_ID" ? "chưa nhập Client ID" : e.message)); toast(e.code === "NO_CLIENT_ID" ? "Hãy nhập Client ID trước." : e.message); }
  };
  if ($("gd-save")) $("gd-save").onclick = async function () {
    gdStatus("Đang lưu lên Drive…");
    try { await window.VPDrive.save(serialize()); gdStatus("Đã lưu sổ lên Drive ✓", true); toast("Đã đồng bộ sổ lên Google Drive."); }
    catch (e) { gdStatus("Lỗi lưu: " + e.message); toast(e.code === "NO_CLIENT_ID" ? "Hãy nhập Client ID trước." : e.message); }
  };
  if ($("gd-load")) $("gd-load").onclick = async function () {
    gdStatus("Đang mở từ Drive…");
    try { var s = await window.VPDrive.load(); loadBook(JSON.parse(s)); scheduleSave(); gdStatus("Đã mở sổ từ Drive ✓", true); toast("Đã mở sổ từ Google Drive."); hideDialog("dlg-gdrive"); }
    catch (e) { gdStatus("Lỗi mở: " + (e.code === "NO_FILE" ? "Drive chưa có sổ nào" : e.message)); toast(e.code === "NO_FILE" ? "Drive chưa có sổ. Hãy Lưu lên Drive trước." : e.message); }
  };
  if ($("gd-signout")) $("gd-signout").onclick = function () { window.VPDrive.signOut(); gdStatus("Đã đăng xuất"); toast("Đã đăng xuất Google."); };

  // ----- Kích hoạt bản quyền theo máy
  function licMsg(t, ok) { var m = $("lic-msg"); if (m) { m.textContent = t || ""; m.className = "lic-msg" + (t ? (ok ? " ok" : " err") : ""); } }
  function refreshLicUI() {
    if (!window.VPLicense) return;
    var st = window.VPLicense.status(), badge = $("lic-badge"), note = $("lic-state");
    if (badge) badge.hidden = !st.active;
    if (st.active && badge) badge.textContent = "✔ " + (st.plan === "free" ? "Đã kích hoạt" : "Bản quyền " + st.plan.toUpperCase());
    if (note) {
      if (st.active) {
        var exp = st.expiry ? (" · hết hạn " + new Date(st.expiry * 1000).toLocaleDateString("vi-VN")) : " · vĩnh viễn";
        note.textContent = "✔ Đã kích hoạt" + (st.note ? " (" + st.note + ")" : "") + exp;
        note.className = "lic-state ok";
      } else { note.textContent = "Chưa kích hoạt — máy này đang dùng bản miễn phí."; note.className = "lic-state no"; }
    }
  }
  if (window.VPLicense) {
    window.VPLicense.check().then(function () { refreshLicUI(); }).catch(function () {});
    if ($("btn-license")) $("btn-license").onclick = async function () {
      showDialog("dlg-license"); licMsg("");
      if ($("lic-mid")) $("lic-mid").value = await window.VPLicense.machineId();
      await window.VPLicense.check(); refreshLicUI();
    };
    if ($("lic-copy")) $("lic-copy").onclick = function () {
      var v = $("lic-mid").value; if (!v) return;
      if (navigator.clipboard) navigator.clipboard.writeText(v).then(function () { toast("Đã chép Mã máy."); }, function () {});
      else { $("lic-mid").select(); document.execCommand("copy"); toast("Đã chép Mã máy."); }
    };
    if ($("lic-activate")) $("lic-activate").onclick = async function () {
      var key = $("lic-key") ? $("lic-key").value : "";
      if (!key.trim()) { licMsg("Hãy dán Key kích hoạt.", false); return; }
      licMsg("Đang kích hoạt…");
      var r = await window.VPLicense.activate(key);
      if (r.ok) { licMsg("Kích hoạt thành công!" + (r.maxm > 1 ? " (máy " + r.used + "/" + r.maxm + ")" : " Cảm ơn bạn."), true); toast("Đã kích hoạt bản quyền ✓"); $("lic-key").value = ""; }
      else licMsg(r.reason || "Key không hợp lệ.", false);
      refreshLicUI();
    };
    if ($("lic-deactivate")) $("lic-deactivate").onclick = function () {
      if (!confirm("Gỡ kích hoạt trên máy này?")) return;
      window.VPLicense.deactivate(); refreshLicUI(); licMsg("Đã gỡ kích hoạt.", false);
    };
  }
  function movePage(d) { var j = cur + d; if (j < 0 || j >= pages.length) return; capture(); snapshotThumb(); var tmp = pages[cur]; pages[cur] = pages[j]; pages[j] = tmp; cur = j; restore(); makeThumbs(); scheduleSave(); }
  if ($("th-up")) $("th-up").onclick = function () { movePage(-1); };
  if ($("th-down")) $("th-down").onclick = function () { movePage(1); };

  // ----- Cài đặt – lưu riêng, áp dụng toàn cục
  function loadSettings() {
    try { var s = JSON.parse(localStorage.getItem("vpvie.settings") || "null"); if (s) { if (s.paper) state.paper = Object.assign(state.paper, s.paper); if (s.opt) state.opt = Object.assign(state.opt, s.opt); if (typeof s.tidyInk === "boolean") state.tidyInk = s.tidyInk; if (s.tidyStrength) state.tidyStrength = s.tidyStrength; } } catch (e) {}
    applyCursor();
  }
  function saveSettings() { try { localStorage.setItem("vpvie.settings", JSON.stringify({ paper: state.paper, opt: state.opt, tidyInk: state.tidyInk, tidyStrength: state.tidyStrength })); } catch (e) {} }
  function applyCursor() {
    var c = state.opt.cursor, m = { pen: "crosshair", hand: "grab", "default": "default", dot: "crosshair" };
    canvas.style.cursor = m[c] || "crosshair";
  }
  function selGroup(attr, val) { document.querySelectorAll("[data-" + attr + "]").forEach(function (b) { b.classList.toggle("sel", b.dataset[attr] === val); }); }
  function syncSettingsUI() {
    var p = state.paper, o = state.opt;
    selGroup("paper", p.style); selGroup("orient", p.orient);
    selGroup("subj", o.subject); selGroup("cursor", o.cursor); selGroup("cursize", o.cursize); selGroup("touch", o.touch);
    if ($("set-size")) $("set-size").value = p.size || "a4";
    if ($("set-bg")) $("set-bg").value = p.bg;
    if ($("set-line")) $("set-line").value = p.lineColor;
    if ($("set-space")) { $("set-space").value = p.spacing; $("set-space-val").textContent = p.spacing; }
    if ($("set-thick")) $("set-thick").value = p.thickness;
    if ($("set-lblsize")) { $("set-lblsize").value = o.lblsize; $("set-lblsize-val").textContent = o.lblsize; }
    if ($("set-dotsize")) { $("set-dotsize").value = o.dotsize; $("set-dotsize-val").textContent = o.dotsize; }
    [["set-titlebox", p.titlebox], ["set-margin", p.margin], ["set-infinite", p.infinite], ["set-pagebreak", p.pagebreak],
     ["set-autolabel", o.autolabel], ["set-snap", o.snap], ["set-showdots", o.showdots], ["set-autosave", o.autosave], ["set-penlead", o.penlead], ["set-scratchrase", o.scratchrase]].forEach(function (kv) { if ($(kv[0])) $(kv[0]).checked = !!kv[1]; });
    document.querySelectorAll('[data-swatch="bg"] .cs').forEach(function (b) { b.classList.toggle("sel", b.dataset.c === p.bg); });
    document.querySelectorAll('[data-swatch="line"] .cs').forEach(function (b) { b.classList.toggle("sel", b.dataset.c === p.lineColor); });
    document.querySelectorAll('[data-swatch="lblcolor"] .cs').forEach(function (b) { b.classList.toggle("sel", b.dataset.c === o.lblcolor); });
  }
  if ($("btn-settings")) $("btn-settings").onclick = function () { syncSettingsUI(); showDialog("dlg-settings"); };
  document.querySelectorAll("[data-paper]").forEach(function (b) { b.onclick = function () { state.paper.style = b.dataset.paper; syncSettingsUI(); redraw(); saveSettings(); }; });
  document.querySelectorAll("[data-orient]").forEach(function (b) { b.onclick = function () { state.paper.orient = b.dataset.orient; syncSettingsUI(); saveSettings(); toast("Hướng trang: " + (b.dataset.orient === "portrait" ? "Dọc" : "Ngang")); }; });
  document.querySelectorAll("[data-subj]").forEach(function (b) { b.onclick = function () { state.opt.subject = b.dataset.subj; syncSettingsUI(); saveSettings(); }; });
  document.querySelectorAll("[data-cursor]").forEach(function (b) { b.onclick = function () { state.opt.cursor = b.dataset.cursor; syncSettingsUI(); applyCursor(); saveSettings(); }; });
  document.querySelectorAll("[data-cursize]").forEach(function (b) { b.onclick = function () { state.opt.cursize = b.dataset.cursize; syncSettingsUI(); saveSettings(); }; });
  document.querySelectorAll("[data-touch]").forEach(function (b) { b.onclick = function () { state.opt.touch = b.dataset.touch; syncSettingsUI(); saveSettings(); }; });
  document.querySelectorAll('[data-swatch="bg"] .cs').forEach(function (b) { b.onclick = function () { state.paper.bg = b.dataset.c; if ($("set-bg")) $("set-bg").value = b.dataset.c; syncSettingsUI(); redraw(); saveSettings(); }; });
  document.querySelectorAll('[data-swatch="line"] .cs').forEach(function (b) { b.onclick = function () { state.paper.lineColor = b.dataset.c; if ($("set-line")) $("set-line").value = b.dataset.c; syncSettingsUI(); redraw(); saveSettings(); }; });
  document.querySelectorAll('[data-swatch="lblcolor"] .cs').forEach(function (b) { b.onclick = function () { state.opt.lblcolor = b.dataset.c; syncSettingsUI(); saveSettings(); }; });
  if ($("set-bg")) $("set-bg").oninput = function () { state.paper.bg = this.value; syncSettingsUI(); redraw(); saveSettings(); };
  if ($("set-line")) $("set-line").oninput = function () { state.paper.lineColor = this.value; syncSettingsUI(); redraw(); saveSettings(); };
  if ($("set-size")) $("set-size").onchange = function () { state.paper.size = this.value; saveSettings(); };
  if ($("set-space")) $("set-space").oninput = function () { state.paper.spacing = parseInt(this.value, 10); $("set-space-val").textContent = this.value; redraw(); saveSettings(); };
  if ($("set-thick")) $("set-thick").oninput = function () { state.paper.thickness = parseInt(this.value, 10); redraw(); saveSettings(); };
  if ($("set-lblsize")) $("set-lblsize").oninput = function () { state.opt.lblsize = parseInt(this.value, 10); $("set-lblsize-val").textContent = this.value; saveSettings(); };
  if ($("set-dotsize")) $("set-dotsize").oninput = function () { state.opt.dotsize = parseInt(this.value, 10); $("set-dotsize-val").textContent = this.value; saveSettings(); };
  [["set-titlebox", "paper", "titlebox"], ["set-margin", "paper", "margin"], ["set-infinite", "paper", "infinite"], ["set-pagebreak", "paper", "pagebreak"],
   ["set-autolabel", "opt", "autolabel"], ["set-snap", "opt", "snap"], ["set-showdots", "opt", "showdots"], ["set-autosave", "opt", "autosave"], ["set-penlead", "opt", "penlead"], ["set-scratchrase", "opt", "scratchrase"]].forEach(function (kv) {
    if ($(kv[0])) $(kv[0]).onchange = function () { state[kv[1]][kv[2]] = this.checked; redraw(); saveSettings(); };
  });

  // ----- Nhập ảnh / PDF làm nền trang (viết đè lên đề)
  function setPageBg(url) { state.pageBg = url; pages[cur].bg = url; redraw(); scheduleSave(); snapshotThumb(); makeThumbs(); }
  if ($("set-img")) $("set-img").onclick = function () { $("imp-img").click(); };
  if ($("imp-img")) $("imp-img").onchange = function () { var f = this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { setPageBg(rd.result); toast("Đã đặt ảnh làm nền trang."); }; rd.readAsDataURL(f); this.value = ""; hideDialog("dlg-settings"); };
  if ($("set-nobg")) $("set-nobg").onclick = function () { setPageBg(null); toast("Đã bỏ nền trang."); };
  if ($("set-pdf")) $("set-pdf").onclick = function () { $("imp-pdf").click(); };
  if ($("imp-pdf")) $("imp-pdf").onchange = function () {
    var f = this.files[0]; if (!f) return; this.value = ""; hideDialog("dlg-settings");
    if (!window.pdfjsLib) { toast("Chưa tải được pdf.js."); return; }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdfjs/pdf.worker.min.js";
    var rd = new FileReader();
    rd.onload = async function () {
      try {
        toast("Đang mở PDF…");
        var doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(rd.result) }).promise;
        for (var i = 1; i <= doc.numPages; i++) {
          var page = await doc.getPage(i), vp = page.getViewport({ scale: 2 });
          var oc = document.createElement("canvas"); oc.width = vp.width; oc.height = vp.height;
          await page.render({ canvasContext: oc.getContext("2d"), viewport: vp }).promise;
          var url = oc.toDataURL("image/jpeg", 0.8);
          if (i === 1) { setPageBg(url); }
          else { capture(); pages.splice(cur + 1, 0, blankPage()); cur++; pages[cur].bg = url; restore(); }
        }
        makeThumbs(); scheduleSave(); toast("Đã nhập " + doc.numPages + " trang PDF. Hãy viết lên đề.");
      } catch (e) { toast("Không mở được PDF."); }
    };
    rd.readAsArrayBuffer(f);
  };

  // ----- Nhập Word (.docx) làm nền trang (dùng mammoth → HTML → ảnh)
  if ($("set-docx")) $("set-docx").onclick = function () { $("imp-docx").click(); };
  if ($("imp-docx")) $("imp-docx").onchange = function () {
    var f = this.files[0]; if (!f) return; this.value = ""; hideDialog("dlg-settings");
    if (!window.mammoth) { toast("Chưa tải được bộ đọc Word."); return; }
    var rd = new FileReader();
    rd.onload = function () {
      toast("Đang mở Word…");
      window.mammoth.convertToHtml({ arrayBuffer: rd.result }).then(function (res) {
        var wrap = document.createElement("div");
        wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;padding:48px;background:#fff;font-family:'Times New Roman',serif;font-size:16px;line-height:1.5;color:#111";
        wrap.innerHTML = res.value || "<p>(Tài liệu trống)</p>";
        document.body.appendChild(wrap);
        return window.html2canvas(wrap, { scale: 2, backgroundColor: "#fff" }).then(function (cv) {
          document.body.removeChild(wrap);
          setPageBg(cv.toDataURL("image/jpeg", 0.85));
          toast("Đã nhập đề Word. Hãy viết/giải lên trên.");
        });
      }).catch(function () { toast("Không mở được tệp Word."); });
    };
    rd.readAsArrayBuffer(f);
  };

  // ----- Quay màn hình (screen recording) kèm micro
  var mediaRec = null, recChunks = [];
  async function toggleRecord() {
    var btn = $("btn-record");
    if (mediaRec && mediaRec.state !== "inactive") { mediaRec.stop(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { toast("Trình duyệt không hỗ trợ quay màn hình."); return; }
    try {
      var stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      try { var mic = await navigator.mediaDevices.getUserMedia({ audio: true }); mic.getAudioTracks().forEach(function (t) { stream.addTrack(t); }); } catch (e) {}
      recChunks = []; mediaRec = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRec.ondataavailable = function (ev) { if (ev.data.size) recChunks.push(ev.data); };
      mediaRec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(recChunks, { type: "video/webm" }));
        a.download = "bai-giang-" + Date.now() + ".webm"; a.click();
        btn.classList.remove("active"); toast("Đã lưu video bài giảng (.webm).");
      };
      mediaRec.start(); btn.classList.add("active"); toast("Đang quay màn hình… bấm lại để dừng.");
    } catch (e) { toast("Đã hủy quay màn hình."); }
  }

  loadSettings();
  resize();
  loadLocal();
  updatePageLabel();
  makeThumbs();
  // expose cho kiểm thử
  window.__vp = { state: state, insertMath: insertMath, insertPlot: insertPlot, redraw: redraw, resize: resize, gotoPage: gotoPage, addPage: addPage, pages: function () { return pages; }, cur: function () { return cur; }, strokeLines: strokeLines };
})();
