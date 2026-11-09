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
    pressure: true,   // bút theo lực nhấn (nét to nhỏ)
    writeMode: "both",// hand | line | shape | both (chế độ viết / làm đẹp)
    laserColor: "#FF3B30", laserGlow: 1, laserLife: 0, // bút laser
    fillAlpha: 0.35,  // độ trong suốt khi tô miền
    eraseSize: 0,     // cỡ tẩy từng đoạn (0 = cả nét)
    // Cài đặt trang giấy + hình vẽ (toàn cục, không theo trang)
    paper: { style: "lined", bg: "#FFFFFF", lineColor: "#9CC2F0", spacing: 34, thickness: 1, orient: "portrait", titlebox: true, margin: true, pagebreak: true },
    opt: { showdots: true, autolabel: false, snap: false, lblsize: 16, lblcolor: "#111111", dotsize: 4, subject: "toan", cursor: "pen", cursize: "s", touch: "auto", autosave: true, penlead: true, scratchrase: false },
  };

  var pageView = window.VPPageViewport.create(board, {
    isPan: function () { return state.tool === "pan"; },
    touchAllowed: function (e) { return !state.penDown && Date.now() - (state.lastPen || 0) >= 700 && (e.width || 0) <= 40 && (e.height || 0) <= 40; },
    snapshot: function () { return { items: snap(), geo: JSON.stringify({ points: window.VPGeo.points, shapes: window.VPGeo.shapes }), overlays: JSON.stringify(state.overlays), undo: undoStack.slice(), redo: redoStack.slice() }; },
    cancel: function (before) {
      clearTimeout(autoRecogTimer); autoRecogTimer = 0;
      state.drawing = false; state.cur = null; state.selBox = null; state.activePointer = null; state.geoDown = false; state.erHist = null;
      if (before) { state.items = JSON.parse(before.items); state.overlays = JSON.parse(before.overlays); var geo = JSON.parse(before.geo); window.VPGeo.points = geo.points; window.VPGeo.shapes = geo.shapes; window.VPGeo.setTool(window.VPGeo.tool); undoStack = before.undo; redoStack = before.redo; renderOverlays(); }
      redraw();
    }
  });
  window.VPViewport = pageView;
  if (window.VPDesktop && window.VPDesktop.onPageZoom) window.VPDesktop.onPageZoom(function (action) {
    pageView.zoomTo(action === "reset" ? 1 : pageView.getState().zoom * (action === "in" ? 1.25 : .8));
  });

  // ----- Vẽ nền giấy (kẻ dòng / ô vuông / chấm / trơn) – vẽ trước mọi nét
  var _imgCache = {};
  function getImg(url) { if (_imgCache[url]) return _imgCache[url]; var im = new Image(); im.onload = function () { redraw(); }; im.src = url; _imgCache[url] = im; return im; }
  function shade(hex, d) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return hex || "#CBD8E8";
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return Math.max(0, Math.min(255, v + d)); }
    return "rgb(" + c(r) + "," + c(g) + "," + c(b) + ")";
  }
  function drawPaper() {
    var w = canvas.clientWidth, h = canvas.clientHeight, p = state.paper;
    ctx.save();
    ctx.fillStyle = p.bg || "#FFFFFF"; ctx.fillRect(0, 0, w, h);
    // Nền là ảnh/đề PDF: vẽ đè, viết lên trên
    if (state.pageBg) {
      var im = getImg(state.pageBg);
      if (im.complete && im.naturalWidth) {
        var sc = Math.min(w / im.naturalWidth, Math.max(1, h - 24) / im.naturalHeight);
        var dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
        ctx.drawImage(im, (w - dw) / 2, 0, dw, dh);
      }
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
    } else if (p.style === "taptviet") {
      // Vở tập viết: mỗi dòng gồm 4 đường (trên · giữa nét đứt · chân chữ · đáy)
      var rowH = Math.max(28, (p.spacing || 34) * 1.6);
      for (y = rowH; y < h; y += rowH) {
        var top = y - rowH * 0.62, mid = y - rowH * 0.31, base = y, bot = y + 0; // base là chân chữ
        ctx.strokeStyle = lc; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(w, top + 0.5); ctx.stroke();            // đỉnh
        ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.stroke();           // chân chữ (đậm hơn)
        ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = lc;
        ctx.beginPath(); ctx.moveTo(0, mid + 0.5); ctx.lineTo(w, mid + 0.5); ctx.stroke(); ctx.restore(); // đường giữa nét đứt
      }
    } else if (p.style === "oli") {
      // Ô li: lưới ô vuông nhỏ, đường chính đậm mỗi 5 ô
      var u = Math.max(10, Math.min(sp, 22));
      ctx.lineWidth = 1; var i2 = 0;
      for (x = 0; x <= w; x += u, i2++) { ctx.strokeStyle = (i2 % 5 === 0) ? shade(lc, -22) : lc; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
      i2 = 0; for (y = 0; y <= h; y += u, i2++) { ctx.strokeStyle = (i2 % 5 === 0) ? shade(lc, -22) : lc; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
    } else if (p.style === "music") {
      // Khuông nhạc: các khuông 5 dòng
      var staff = Math.max(10, (p.spacing || 34) * 0.42), gap = staff * 3.2;
      ctx.strokeStyle = lc; ctx.lineWidth = 1;
      for (y = gap; y < h; y += (staff * 4 + gap)) {
        for (var k = 0; k < 5; k++) { var yy = y + k * staff; ctx.beginPath(); ctx.moveTo(24, yy + 0.5); ctx.lineTo(w - 24, yy + 0.5); ctx.stroke(); }
      }
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
    var r = { width: board.clientWidth, height: board.clientHeight };
    pageView.resize();
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
    var pt = pageView.point(e.clientX, e.clientY);
    return { x: pt.x, y: pt.y, pr: (e.pressure && e.pressure > 0) ? e.pressure : 0.5 };
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
      if (pen === "laser" || pen === "laserp") { drawLaserStroke(p, base, it.color, it._alpha); ctx.restore(); return; }
      if (pen === "hl") { ctx.globalAlpha = 0.38; ctx.lineCap = "butt"; base = Math.max(base * 3.2, 16); }
      else if (pen === "pencil") { ctx.globalAlpha = 0.72; }
      if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0].x, p[0].y, base / 2, 0, 6.2832); ctx.fillStyle = it.color; ctx.fill(); ctx.restore(); return; }
      // Bút dạ: biến thiên theo lực → vẽ từng đoạn. Bút bi/chì: nét đều → làm mượt bằng
      // đường cong bậc hai qua trung điểm các điểm (khử răng cưa do lấy mẫu con trỏ).
      if (pen === "brush" || pen === "fountain") {
        var usePr = it.pressure !== false;
        for (var i = 1; i < p.length; i++) {
          var pr = p[i].pr != null ? p[i].pr : 0.5;
          ctx.beginPath();
          ctx.lineWidth = usePr ? base * (pen === "fountain" ? (0.35 + pr * 1.25) : (0.55 + pr * 0.9)) : base;
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
      ctx.ellipse(it.cx, it.cy, it.rx, it.ry, it.rot || 0, 0, Math.PI * 2);
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
      (it.ellipses || []).forEach(function (e) { ctx.setLineDash(e.dashed ? [6, 5] : []); ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, e.rot || 0, e.a0 || 0, (e.a1 != null ? e.a1 : Math.PI * 2)); ctx.stroke(); });
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
    else if (st !== "dash" && st !== "dot" && st !== "line") { arrowHead(x2, y2, ang, hs); if (st === "darrow") arrowHead(x1, y1, ang + Math.PI, hs); }
    ctx.restore();
  }

  // ----- Bút laser: nét phát sáng neon (giữ nét) + con trỏ laser (tự tan)
  function laserStrokePath(p) {
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
    for (var i = 1; i < p.length - 1; i++) { var mx = (p[i].x + p[i + 1].x) / 2, my = (p[i].y + p[i + 1].y) / 2; ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my); }
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y); ctx.stroke();
  }
  function drawLaserStroke(p, base, color, alpha) {
    var lc = (color || "").toLowerCase();
    var col = (lc && lc !== "#111111" && lc !== "#000000" && lc !== "#111") ? color : "#ff2d6f";
    var a = alpha == null ? 1 : alpha;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (p.length === 1) {
      ctx.globalAlpha = 0.5 * a; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p[0].x, p[0].y, Math.max(3, base * 1.1), 0, 6.2832); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = a; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(p[0].x, p[0].y, Math.max(1, base * 0.4), 0, 6.2832); ctx.fill(); return;
    }
    ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.strokeStyle = col; ctx.lineWidth = Math.max(6, base * 2.4); ctx.globalAlpha = 0.4 * a; laserStrokePath(p);
    ctx.shadowBlur = 9; ctx.lineWidth = Math.max(3, base * 1.3); ctx.globalAlpha = 0.95 * a; laserStrokePath(p);
    ctx.shadowBlur = 0; ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, base * 0.5); ctx.globalAlpha = 0.95 * a; laserStrokePath(p);
  }
  var laserTrails = [], laserAnim = 0, LASER_LIFE = 1200, LASER_FADE = 650;
  function addLaserTrail(s) { s.born = performance.now(); s.life = (typeof state.laserLife === "number" && state.laserLife > 0) ? state.laserLife : LASER_LIFE; laserTrails.push(s); if (!laserAnim) laserAnim = requestAnimationFrame(laserTick); }
  function laserTick() {
    var now = performance.now();
    laserTrails = laserTrails.filter(function (t) { return now - t.born < (t.life || LASER_LIFE); });
    redraw();
    laserAnim = laserTrails.length ? requestAnimationFrame(laserTick) : 0;
  }
  function drawLaserTrails() {
    if (!laserTrails.length) return;
    var now = performance.now();
    laserTrails.forEach(function (t) {
      var life = t.life || LASER_LIFE, fade = Math.min(LASER_FADE, life);
      var age = now - t.born, al = (age < life - fade ? 1 : Math.max(0, (life - age) / fade)) * (t._alpha != null ? t._alpha : 1);
      ctx.save(); drawLaserStroke(t.points, t.size || state.size, t.color, al); ctx.restore();
    });
  }
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPaper();
    for (var i = 0; i < state.items.length; i++) drawItem(state.items[i]);
    if (state.cur) drawItem(state.cur);
    drawLaserTrails();
    if (window.VPGeo) window.VPGeo.render(ctx, canvas.clientWidth, canvas.clientHeight);
    // Lớp chọn vùng + tay cầm đổi kích thước
    if (state.selected && state.selected.length) {
      ctx.save(); ctx.strokeStyle = "#7a1020"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4;
      state.selected.forEach(function (i) { var it = state.items[i]; if (!it) return; var b = itemBox(it); ctx.strokeRect(b.minx - 4, b.miny - 4, (b.maxx - b.minx) + 8, (b.maxy - b.miny) + 8); });
      // hộp bao chung + 8 tay cầm (chỉ khi dùng công cụ chọn)
      if (state.tool === "select" && !state.selBox) {
        var ub = selUnionBox();
        ctx.setLineDash([]); ctx.strokeStyle = "#7a1020"; ctx.lineWidth = 1;
        ctx.strokeRect(ub.minx - 4, ub.miny - 4, (ub.maxx - ub.minx) + 8, (ub.maxy - ub.miny) + 8);
        selHandles().forEach(function (h) {
          ctx.beginPath(); ctx.arc(h.x, h.y, 5, 0, 6.2832);
          ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#7a1020"; ctx.stroke();
        });
        // tay cầm xoay (vòng tròn phía trên, nối với cạnh trên bằng một đoạn)
        var rh = rotHandle();
        ctx.beginPath(); ctx.moveTo(rh.x, ub.miny - 4); ctx.lineTo(rh.x, rh.y + 6); ctx.lineWidth = 1; ctx.strokeStyle = "#7a1020"; ctx.stroke();
        ctx.beginPath(); ctx.arc(rh.x, rh.y, 6, 0, 6.2832); ctx.fillStyle = "#7a1020"; ctx.fill();
        ctx.beginPath(); ctx.arc(rh.x, rh.y, 3.2, -0.6, 3.6); ctx.lineWidth = 1.6; ctx.strokeStyle = "#fff"; ctx.stroke();
      }
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
    if (it.type === "ellipse") { var er = it.rot || 0, ec = Math.cos(er), es = Math.sin(er), hw = Math.hypot(it.rx * ec, it.ry * es), hh = Math.hypot(it.rx * es, it.ry * ec); return { minx: it.cx - hw, maxx: it.cx + hw, miny: it.cy - hh, maxy: it.cy + hh }; }
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
  // Phóng to/thu nhỏ một hình quanh điểm neo (ox,oy) theo hệ số (sx,sy)
  function scaleItem(it, sx, sy, ox, oy) {
    function sp(p) { p.x = ox + (p.x - ox) * sx; p.y = oy + (p.y - oy) * sy; }
    if (it.type === "stroke" || it.type === "triangle" || it.type === "poly" || it.type === "path") (it.points || it.pts).forEach(sp);
    else if (it.type === "line" || it.type === "arrow") { var a = { x: it.x1, y: it.y1 }, b = { x: it.x2, y: it.y2 }; sp(a); sp(b); it.x1 = a.x; it.y1 = a.y; it.x2 = b.x; it.y2 = b.y; }
    else if (it.type === "rect" || it.type === "oxyz") { var tl = { x: it.x, y: it.y }; sp(tl); it.x = tl.x; it.y = tl.y; it.w *= sx; it.h *= sy; if (it.w < 0) { it.x += it.w; it.w = -it.w; } if (it.h < 0) { it.y += it.h; it.h = -it.h; } }
    else if (it.type === "circle") { var c = { x: it.cx, y: it.cy }; sp(c); it.cx = c.x; it.cy = c.y; var f = (Math.abs(sx) + Math.abs(sy)) / 2; if (Math.abs(sx - sy) > 0.03) { it.type = "ellipse"; it.rx = it.r * sx; it.ry = it.r * sy; delete it.r; } else it.r *= f; }
    else if (it.type === "ellipse") { var e = { x: it.cx, y: it.cy }; sp(e); it.cx = e.x; it.cy = e.y; it.rx *= sx; it.ry *= sy; }
    else if (it.type === "solid") {
      (it.segs || []).forEach(function (s) { var p1 = { x: s.x1, y: s.y1 }, p2 = { x: s.x2, y: s.y2 }; sp(p1); sp(p2); s.x1 = p1.x; s.y1 = p1.y; s.x2 = p2.x; s.y2 = p2.y; });
      (it.ellipses || []).forEach(function (e2) { var c2 = { x: e2.cx, y: e2.cy }; sp(c2); e2.cx = c2.x; e2.cy = c2.y; e2.rx *= sx; e2.ry *= sy; });
      (it.labels || []).forEach(function (l) { var p = { x: l.x, y: l.y }; sp(p); l.x = p.x; l.y = p.y; });
    }
  }
  // Xoay một hình quanh tâm (cx,cy) một góc ang (radian)
  function rotateItem(it, ang, cx, cy) {
    var c = Math.cos(ang), s = Math.sin(ang);
    function rp(p) { var dx = p.x - cx, dy = p.y - cy; p.x = cx + dx * c - dy * s; p.y = cy + dx * s + dy * c; }
    if (it.type === "stroke" || it.type === "triangle" || it.type === "poly" || it.type === "path") { (it.points || it.pts).forEach(rp); }
    else if (it.type === "line" || it.type === "arrow") { var a = { x: it.x1, y: it.y1 }, b = { x: it.x2, y: it.y2 }; rp(a); rp(b); it.x1 = a.x; it.y1 = a.y; it.x2 = b.x; it.y2 = b.y; }
    else if (it.type === "rect") {
      // chuyển chữ nhật thành đa giác 4 đỉnh để xoay tự do
      var pts = [{ x: it.x, y: it.y }, { x: it.x + it.w, y: it.y }, { x: it.x + it.w, y: it.y + it.h }, { x: it.x, y: it.y + it.h }];
      pts.forEach(rp); it.type = "poly"; it.pts = pts; delete it.x; delete it.y; delete it.w; delete it.h;
    }
    else if (it.type === "circle") { var cc = { x: it.cx, y: it.cy }; rp(cc); it.cx = cc.x; it.cy = cc.y; } // tròn: xoay không đổi hình
    else if (it.type === "ellipse") { var e = { x: it.cx, y: it.cy }; rp(e); it.cx = e.x; it.cy = e.y; it.rot = (it.rot || 0) + ang; }
    else if (it.type === "solid") {
      (it.segs || []).forEach(function (sg) { var p1 = { x: sg.x1, y: sg.y1 }, p2 = { x: sg.x2, y: sg.y2 }; rp(p1); rp(p2); sg.x1 = p1.x; sg.y1 = p1.y; sg.x2 = p2.x; sg.y2 = p2.y; });
      (it.ellipses || []).forEach(function (e2) { var c2 = { x: e2.cx, y: e2.cy }; rp(c2); e2.cx = c2.x; e2.cy = c2.y; e2.rot = (e2.rot || 0) + ang; });
      (it.labels || []).forEach(function (l) { var p = { x: l.x, y: l.y }; rp(p); l.x = p.x; l.y = p.y; });
    }
  }
  // 8 tay cầm trên hộp bao vùng chọn
  function selHandles() {
    var b = selUnionBox();
    return [
      { n: "nw", x: b.minx, y: b.miny }, { n: "n", x: (b.minx + b.maxx) / 2, y: b.miny }, { n: "ne", x: b.maxx, y: b.miny },
      { n: "e", x: b.maxx, y: (b.miny + b.maxy) / 2 }, { n: "se", x: b.maxx, y: b.maxy }, { n: "s", x: (b.minx + b.maxx) / 2, y: b.maxy },
      { n: "sw", x: b.minx, y: b.maxy }, { n: "w", x: b.minx, y: (b.miny + b.maxy) / 2 }
    ];
  }
  // Tay cầm xoay: nằm phía trên cạnh giữa của hộp bao
  function rotHandle() { var b = selUnionBox(); return { n: "rot", x: (b.minx + b.maxx) / 2, y: b.miny - 26 }; }
  function hitHandle(pt) {
    if (!state.selected || !state.selected.length) return null;
    var rh = rotHandle();
    if (Math.abs(pt.x - rh.x) <= 11 && Math.abs(pt.y - rh.y) <= 11) return rh;
    var hs = selHandles();
    for (var i = 0; i < hs.length; i++) if (Math.abs(pt.x - hs[i].x) <= 9 && Math.abs(pt.y - hs[i].y) <= 9) return hs[i];
    return null;
  }
  function boxHit(it, pt, tol) { var b = itemBox(it); tol = tol || 8; return pt.x >= b.minx - tol && pt.x <= b.maxx + tol && pt.y >= b.miny - tol && pt.y <= b.maxy + tol; }
  function selUnionBox() { var mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity; state.selected.forEach(function (i) { var it = state.items[i]; if (!it) return; var b = itemBox(it); if (b.minx < mnx) mnx = b.minx; if (b.miny < mny) mny = b.miny; if (b.maxx > mxx) mxx = b.maxx; if (b.maxy > mxy) mxy = b.maxy; }); return { minx: mnx, miny: mny, maxx: mxx, maxy: mxy }; }
  function updateSelBar() {
    var bar = document.getElementById("sel-bar"); if (!bar) return;
    if (state.tool === "select" && state.selected && state.selected.length && !state.selBox) {
      var b = selUnionBox(); bar.style.left = Math.max(2, b.minx - 4) + "px"; bar.style.top = Math.max(2, b.miny - 66) + "px"; bar.classList.add("show");
      var isOxyz = selOxyzItem(); var eb = bar.querySelector(".sb-edit"); if (eb) eb.hidden = !selEditable();
      var ox = bar.querySelector(".sb-oxyz"); if (ox) ox.hidden = !isOxyz;
      bar.querySelectorAll('button[data-act="fill"],button[data-act="stroke"]').forEach(function (x) { x.hidden = !!isOxyz; });
      if (isOxyz) {
        var cv = (isOxyz.scene && isOxyz.scene.camera && isOxyz.scene.camera.view) || "3d";
        bar.querySelectorAll(".sb-oxyz [data-oxv]").forEach(function (x) { x.classList.toggle("on", x.dataset.oxv === cv); });
        var axb = bar.querySelector(".sb-oxyz [data-oxaxes]"); if (axb) axb.textContent = (isOxyz.scene && isOxyz.scene.display && isOxyz.scene.display.axes === false) ? "⊹ Hiện trục" : "⊹ Ẩn trục";
        var spb = bar.querySelector(".sb-oxyz [data-oxspin]"); if (spb) spb.classList.toggle("on", state.oxyzRot === isOxyz);
      }
    }
    else bar.classList.remove("show");
  }
  function hexToRgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return hex;
    var n = parseInt(m[1], 16); return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function fillAt(pt) {
    var alpha = state.fillAlpha != null ? state.fillAlpha : 0.35;
    var want = alpha <= 0 ? null : hexToRgba(state.color, alpha);
    for (var i = state.items.length - 1; i >= 0; i--) {
      if (containsPoint(state.items[i], pt)) {
        pushHist();
        if (want == null) state.items[i].fill = null;                       // Bỏ màu (0%)
        else state.items[i].fill = (state.items[i].fill === want) ? null : want;
        redraw(); scheduleSave(); return true;
      }
    }
    toast("Bấm vào trong một hình kín để tô màu.");
    return false;
  }

  // ----- Sự kiện vẽ
  canvas.addEventListener("pointerdown", function (e) {
    // Bỏ chọn mọi lớp phủ (ẩn thanh công cụ nổi) khi thao tác trên canvas
    overlay.querySelectorAll(".ov.sel").forEach(function (o) { o.classList.remove("sel"); });
    // ----- Chống chạm nhầm lòng bàn tay (palm rejection) + chế độ cảm ứng -----
    var touchMode = (state.opt && state.opt.touch) || "auto";
    if (e.pointerType === "touch") {
      if (touchMode === "pen") return;                                   // Chỉ bút: bỏ mọi chạm tay
      if (state.penDown || (Date.now() - (state.lastPen || 0) < 700)) return; // đang/vừa dùng bút → bỏ tay
      // Lòng bàn tay có vùng tiếp xúc LỚN → bỏ qua (giữ lại ngón tay/bút cảm ứng nhỏ).
      var cw = e.width || 0, ch = e.height || 0;
      if (touchMode !== "finger" && (cw > 40 || ch > 40)) return;
      // Nhiều điểm chạm cùng lúc (tì cả bàn tay) → bỏ các điểm thừa, chỉ vẽ 1 nét.
      if (state.drawing && state.activePointer != null && e.pointerId !== state.activePointer) return;
    } else if (e.pointerType === "pen") {
      if (touchMode === "finger") return;                                // Chỉ ngón tay: bỏ bút
      state.penDown = true; state.lastPen = Date.now();
    }
    state.activePointer = e.pointerId;
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
    if (state.tool === "plotregion" || state.tool === "varregion") { canvas.setPointerCapture(e.pointerId); state.drawing = true; state.selBox = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y }; redraw(); return; }
    if (state.tool === "fill") { fillAt(pt); return; }   // tô màu miền
    if (state.tool === "select") {
      canvas.setPointerCapture(e.pointerId); state.drawing = true;
      // Chế độ xoay 3D tự do: kéo trên hình Oxyz để xoay mọi phía
      if (state.oxyzRot && state.oxyzRot.type === "oxyz" && boxHit(state.oxyzRot, pt) && state.oxyzRot.scene) {
        var i3 = state.items.indexOf(state.oxyzRot);
        if (i3 >= 0) { pushHist(); state.selected = [i3]; state.selMode = "rot3d"; state.moved = false; var cam = state.oxyzRot.scene.camera || {}; state.rot3d = { start: pt, yaw0: cam.yaw || 0, pitch0: cam.pitch || 0 }; redraw(); return; }
      }
      var h = hitHandle(pt);
      if (h && h.n === "rot") {   // kéo tay cầm xoay -> quay quanh tâm hộp bao
        pushHist(); state.selMode = "rotate"; state.moved = false;
        var rb = selUnionBox(); var rcx = (rb.minx + rb.maxx) / 2, rcy = (rb.miny + rb.maxy) / 2;
        state.rot = { cx: rcx, cy: rcy, last: Math.atan2(pt.y - rcy, pt.x - rcx) };
        redraw(); return;
      }
      if (h) {   // kéo tay cầm -> đổi kích thước quanh điểm neo (góc/cạnh đối diện)
        pushHist(); state.selMode = "resize"; state.moved = false;
        var b = selUnionBox();
        var ax = /w/.test(h.n) ? b.maxx : (/e/.test(h.n) ? b.minx : (b.minx + b.maxx) / 2);
        var ay = /n/.test(h.n) ? b.maxy : (/s/.test(h.n) ? b.miny : (b.miny + b.maxy) / 2);
        state.resize = { anchor: { x: ax, y: ay }, last: pt, ax: /[ew]/.test(h.n), ay: /[ns]/.test(h.n) };
        redraw(); return;
      }
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
    var isLas = state.pen === "laser" || state.pen === "laserp";
    var scol = isLas ? (state.laserUsePen ? state.color : (state.laserColor || "#FF3B30")) : state.color;
    state.cur = { type: "stroke", points: [pt], color: scol, size: state.size, pen: state.pen, pressure: state.pressure !== false, _alpha: isLas ? (state.laserGlow || 1) : undefined };
  });
  canvas.addEventListener("pointermove", function (e) {
    if (state.tool === "oxyz") { if (state.drawing && state.selBox) { var p3 = pos(e); state.selBox.x2 = p3.x; state.selBox.y2 = p3.y; redraw(); } return; }
    if (state.tool === "geo") { if (state.geoDown && window.VPGeo.onMove(pos(e))) redraw(); return; }
    if (!state.drawing) return;
    var pt = pos(e);
    if (state.tool === "eraser") { if (state.eraserMode === "area") { state.selBox.x2 = pt.x; state.selBox.y2 = pt.y; redraw(); } else eraseAt(pt); return; }
    if (state.tool === "plotregion" || state.tool === "varregion") { if (state.selBox) { state.selBox.x2 = pt.x; state.selBox.y2 = pt.y; redraw(); } return; }
    if (state.tool === "select") {
      if (state.selMode === "rot3d" && state.rot3d && state.oxyzRot && state.oxyzRot.scene) {
        var r3 = state.rot3d, cam3 = state.oxyzRot.scene.camera;
        cam3.view = "3d";
        cam3.yaw = r3.yaw0 + (pt.x - r3.start.x) * 0.01;                 // kéo ngang → Ox,Oy xoay quanh Oz
        cam3.pitch = Math.max(-1.45, Math.min(1.45, r3.pitch0 - (pt.y - r3.start.y) * 0.01)); // kéo lên → Oz ngẩng lên
        state.moved = true; redraw(); return;
      }
      if (state.selMode === "marquee") { state.selBox.x2 = pt.x; state.selBox.y2 = pt.y; }
      else if (state.selMode === "rotate" && state.rot) {
        var rr = state.rot, ang = Math.atan2(pt.y - rr.cy, pt.x - rr.cx), d = ang - rr.last;
        if (d) { state.moved = true; state.selected.forEach(function (i) { if (state.items[i]) rotateItem(state.items[i], d, rr.cx, rr.cy); }); rr.last = ang; }
      }
      else if (state.selMode === "resize" && state.resize) {
        var rz = state.resize, ox = rz.anchor.x, oy = rz.anchor.y;
        var sx = rz.ax && Math.abs(rz.last.x - ox) > 2 ? (pt.x - ox) / (rz.last.x - ox) : 1;
        var sy = rz.ay && Math.abs(rz.last.y - oy) > 2 ? (pt.y - oy) / (rz.last.y - oy) : 1;
        // giữ tỉ lệ cho tay cầm góc (cả 2 trục) để hình không méo
        if (rz.ax && rz.ay) { var f = (Math.abs(sx) + Math.abs(sy)) / 2 || 1; sx = sx < 0 ? -f : f; sy = sy < 0 ? -f : f; }
        if (sx !== 1 || sy !== 1) { state.moved = true; state.selected.forEach(function (i) { if (state.items[i]) scaleItem(state.items[i], sx, sy, ox, oy); }); rz.last = pt; }
      }
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
    if (state.tool === "plotregion" || state.tool === "varregion") {
      var sb = state.selBox, which = state.tool; state.selBox = null; redraw();
      if (sb) {
        var rx = Math.min(sb.x1, sb.x2), ry = Math.min(sb.y1, sb.y2), rw = Math.abs(sb.x2 - sb.x1), rh = Math.abs(sb.y2 - sb.y1);
        if (rw < 40) rw = which === "varregion" ? 520 : 380;
        if (rh < 30) rh = which === "varregion" ? 180 : 300;
        if (which === "varregion") openVarDialog({ x: rx, y: ry, w: rw, h: rh });
        else openPlotDialog({ x: rx, y: ry, w: rw, h: rh });
      }
      return;
    }
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
      } else if ((state.selMode === "move" || state.selMode === "resize" || state.selMode === "rotate" || state.selMode === "rot3d") && !state.moved) undoStack.pop();   // không đổi gì → bỏ bản lưu
      state.resize = null; state.rot = null; state.rot3d = null; state.selMode = null;
      redraw(); scheduleSave(); return;
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
    // Con trỏ laser: không lưu vào trang, chỉ sáng rồi tự tan
    if (s.type === "stroke" && s.pen === "laserp") { addLaserTrail(s); return; }
    var isLaser = s.type === "stroke" && s.pen === "laser";
    if (s.type !== "arrow" || Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 6) pushHist();
    if (s.type === "arrow") { if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 6) state.items.push(s); redraw(); return; }
    var wm = state.writeMode || "both";
    if (state.beautify && wm !== "hand" && window.VPBeautify && s.pen !== "hl" && !isLaser) {
      var shp = window.VPBeautify.beautify(s.points);
      var isLine = shp && shp.type === "line";
      var keep = shp && (wm === "both" || (wm === "line" && isLine) || (wm === "shape" && !isLine));
      if (keep) { shp.color = s.color; shp.size = s.size; state.items.push(shp); redraw(); return; }
    }
    // Nắn nét chữ viết tay: làm mượt, bớt run tay — VẪN là nét chữ của người dùng
    if (state.tidyInk && window.VPBeautify && s.type === "stroke" && s.pen !== "hl" && !isLaser && s.points.length > 3) {
      s.points = window.VPBeautify.refineInk(s.points, state.tidyStrength || 2);
    }
    state.items.push(s); redraw();
    if (state.autoRecognize && s.type === "stroke" && s.pen !== "hl" && !isLaser) scheduleAutoRecognize();
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
  canvas.addEventListener("pointerup", function (e) { if (e.pointerType === "pen") { state.penDown = false; state.lastPen = Date.now(); } if (e.pointerId === state.activePointer) state.activePointer = null; endStroke(); });
  canvas.addEventListener("pointercancel", function (e) { if (e.pointerId === state.activePointer) state.activePointer = null; if (state.tool === "oxyz") { state.drawing = false; state.penDown = false; state.selBox = null; redraw(); return; } if (e.pointerType === "pen") { state.penDown = false; state.lastPen = Date.now(); } endStroke(); });
  canvas.addEventListener("pointerleave", function (e) { if (state.drawing && state.tool !== "eraser" && state.tool !== "oxyz") endStroke(); });

  // ----- Lớp phủ dạng DỮ LIỆU (lưu/mở theo trang được)
  // Đổi link YouTube/Vimeo sang dạng nhúng được (iframe); trang khác giữ nguyên.
  function toEmbedUrl(u) {
    u = (u || "").trim();
    var m = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
    if (m) return "https://www.youtube.com/embed/" + m[1];
    m = u.match(/vimeo\.com\/(\d+)/i);
    if (m) return "https://player.vimeo.com/video/" + m[1];
    return u;
  }
  function overlayBody(kind, body, data) {
    if (kind === "math") {
      if (data.mode === "text") body.textContent = data.latex || "";
      else window.VPMathPlot.renderMath(body, data.latex, data.display !== false);
      if (data.color) body.style.color = data.color;
      if (data.size) body.style.fontSize = data.size + "px";
    }
    else if (kind === "text") {
      var thost = body.closest(".ov");
      var ed = document.createElement("div");
      ed.className = "text-edit"; ed.contentEditable = "true"; ed.spellcheck = false;
      ed.setAttribute("data-ph", "Nhập chữ…");
      if (data.html != null) ed.innerHTML = data.html; else if (data.text) ed.textContent = data.text;
      ed.style.fontFamily = data.font || "'Patrick Hand','Be Vietnam Pro',cursive";
      ed.style.fontSize = (data.size || 40) + "px";
      if (data.color) ed.style.color = data.color;
      if (data.align) ed.style.textAlign = data.align;
      thost.classList.remove("frame-border", "frame-box");
      if (data.frame && data.frame !== "none") thost.classList.add("frame-" + data.frame);
      ed.addEventListener("input", function () { data.html = ed.innerHTML; scheduleSave(); if (RT) RT.position(); });
      ed.addEventListener("focus", function () { if (RT) RT.attach(ed, data, thost); });
      body.appendChild(ed);
    }
    else if (kind === "plot") {
      if (data.funcs && data.funcs.length && window.VPGrapher) {
        body.innerHTML = "";
        try { var po = { w: data.w || 380, h: data.h || 300, funcs: data.funcs, autoY: data.autoY !== false, points: data.points || [] }; if (data.view) { po.autoY = false; po.xmin = data.view.xmin; po.xmax = data.view.xmax; po.ymin = data.view.ymin; po.ymax = data.view.ymax; } window.VPGrapher.draw(body, data.funcs[0].expr || "x^2", po); }
        catch (e) { body.textContent = "Không vẽ được đồ thị."; }
      } else window.VPCalc.buildGraph(body, data.expr, data);
    }
    else if (kind === "calc") window.VPSci.build(body);
    else if (kind === "quiz") data.sub === "tf" ? window.VPQuiz.buildTF(body, data) : window.VPQuiz.buildMCQ(body, data);
    else if (kind === "var") window.VPVar.build(body, data);
    else if (kind === "timer") window.VPClass.buildTimer(body, data);
    else if (kind === "picker") window.VPClass.buildPicker(body, data);
    else if (kind === "sticker") {
      var host = body.closest(".ov"); host.classList.add("ov-stk-" + (data.skind || "emoji"));
      var sp = document.createElement("div"); sp.className = "stk-item stk-" + (data.skind || "emoji"); sp.textContent = data.text;
      body.appendChild(sp);
    }
    else if (kind === "wheel") window.VPClass.buildWheel(body, data);
    else if (kind === "groups") window.VPClass.buildGroups(body, data);
    else if (kind === "attend") window.VPClass.buildAttend(body, data);
    else if (kind === "score") window.VPClass.buildScore(body, data);
    else if (kind === "quizgame") window.VPQuiz2.buildPlayer(body, data);
    else if (kind === "crossword") window.VPQuiz2.buildCrossword(body, data);
    else if (kind === "mindmap") { data._save = scheduleSave; window.VPMindmap.build(body, data); }
    else if (kind === "chart") { data._save = scheduleSave; window.VPChart.build(body, data); }
    else if (kind === "flashcard") { data._save = scheduleSave; window.VPFlash.build(body, data); }
    else if (kind === "multab") { data._save = scheduleSave; window.VPMultab.build(body, data); }
    else if (kind === "video") { data._save = scheduleSave; window.VPVideo.build(body, data); }
    else if (kind === "alpha") { data._save = scheduleSave; window.VPAlpha.build(body, data); }
    else if (kind === "ptable") window.VPScience.buildPTable(body);
    else if (kind === "chem") window.VPScience.buildChem(body);
    else if (kind === "circuit" || kind === "force" || kind === "pedigree" || kind === "dna") { data._save = scheduleSave; window.VPDiagram.build(body, kind, data); }
    else if (kind === "table") window.VPTable.build(body, data, scheduleSave);
    else if (kind === "web") {
      var embed = toEmbedUrl(data.url);
      var bar = document.createElement("div"); bar.className = "ov-webcap";
      var cap = document.createElement("span"); cap.textContent = data.url; cap.style.flex = "1"; cap.style.overflow = "hidden"; cap.style.textOverflow = "ellipsis";
      var open = document.createElement("button"); open.className = "ov-webopen"; open.textContent = "↗ Mở ngoài"; open.title = "Mở bằng trình duyệt";
      open.onclick = function (e) { e.stopPropagation(); try { window.open(data.url, "_blank"); } catch (err) {} };
      bar.appendChild(cap); bar.appendChild(open);
      var nativeBrowser = window.VPDesktop && window.VPDesktop.embeddedBrowser;
      var fr = document.createElement(nativeBrowser ? "webview" : "iframe"); fr.className = "ov-web";
      var address;
      try { address = new URL(data.url); if (!/^https?:$/.test(address.protocol)) throw new Error(); }
      catch (e) { body.textContent = "Địa chỉ web không hợp lệ."; return; }
      fr.src = nativeBrowser ? address.href : embed;
      var status = document.createElement("div"); status.className = "ov-web-status";
      if (nativeBrowser) {
        fr.setAttribute("partition", "persist:vpvie-browser");
        fr.addEventListener("did-fail-load", function (e) {
          if (e.isMainFrame && e.errorCode !== -3) status.textContent = "Không tải được trang (" + e.errorDescription + "). Kiểm tra kết nối hoặc chọn Mở ngoài.";
        });
        fr.addEventListener("did-start-loading", function () { status.textContent = "Đang tải…"; });
        fr.addEventListener("did-stop-loading", function () { if (status.textContent === "Đang tải…") status.textContent = ""; });
      } else {
        fr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation");
        fr.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
        status.textContent = "Nếu website chặn nhúng, chọn Mở ngoài để xem trong trình duyệt.";
      }
      body.appendChild(bar); body.appendChild(status); body.appendChild(fr);
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
  function applyOvScale(el, ov) {
    var body = el.querySelector(".ov-body"); if (!body) return;
    var s = ov.scale || 1;
    el.style.setProperty("--table-toolbar-top", (-42 - 22 * s) + "px");
    body.style.transformOrigin = "top left";
    body.style.transform = s === 1 ? "" : "scale(" + s + ")";
  }
  var OV_EDITABLE = { var: 1, plot: 1, math: 1, chart: 1, mindmap: 1 };
  function makeOverlayEl(ov) {
    var el = document.createElement("div");
    el.className = "ov ov-" + ov.kind; el.style.left = ov.x + "px"; el.style.top = ov.y + "px"; el.dataset.id = ov.id;
    // Thanh công cụ nổi phía trên đối tượng (hiện khi chọn)
    var tb = document.createElement("div"); tb.className = "ov-bar";
    function tbtn(txt, title, fn) { var b = document.createElement("button"); b.innerHTML = txt; b.title = title; b.onpointerdown = function (e) { e.stopPropagation(); }; b.onclick = function (e) { e.stopPropagation(); fn(); }; tb.appendChild(b); return b; }
    if (OV_EDITABLE[ov.kind]) tbtn("✎ Sửa", "Sửa nội dung", function () { editOverlay(ov); });
    tbtn("⎘ Sao chép", "Sao chép", function () { ovClip = JSON.parse(JSON.stringify(ov.data)); ovClipKind = ov.kind; toast("Đã sao chép đối tượng."); });
    tbtn("⧉ Nhân bản", "Nhân bản", function () { addOverlayData(ov.kind, JSON.parse(JSON.stringify(ov.data)), ov.x + 24, ov.y + 24); });
    tbtn("✂ Cắt", "Cắt", function () { ovClip = JSON.parse(JSON.stringify(ov.data)); ovClipKind = ov.kind; removeOverlay(ov.id); });
    tbtn("🗑 Xóa", "Xóa", function () { removeOverlay(ov.id); });
    el.appendChild(tb);
    var body = document.createElement("div"); body.className = "ov-body"; el.appendChild(body);
    var del = document.createElement("button"); del.className = "ov-del"; del.textContent = "✕"; del.title = "Xóa";
    del.onclick = function () { removeOverlay(ov.id); };
    el.appendChild(del);
    var rz = document.createElement("div"); rz.className = "ov-resize"; rz.title = "Kéo để đổi kích thước";
    el.appendChild(rz);
    overlayBody(ov.kind, body, ov.data);
    applyOvScale(el, ov);
    makeDraggable(el, ov, rz);
    if (OV_EDITABLE[ov.kind]) el.addEventListener("dblclick", function (e) { e.stopPropagation(); editOverlay(ov); });
    return el;
  }
  var ovClip = null, ovClipKind = null, editOv = null;
  function reRenderOverlay(ov) {
    var old = overlay.querySelector('.ov[data-id="' + ov.id + '"]');
    if (old) overlay.replaceChild(makeOverlayEl(ov), old); else renderOverlays();
    scheduleSave();
  }
  function editOverlay(ov) {
    editOv = ov;
    if (ov.kind === "math") {
      showDialog("dlg-math"); buildFormulaUI();
      if ($("math-input")) $("math-input").value = ov.data.latex || "";
      if (window.VPFormula) {
        if (VPFormula.setColor) VPFormula.setColor(ov.data.color || "#111111");
        if (VPFormula.setSize) VPFormula.setSize(ov.data.size || 46);
        if (VPFormula.setDisplay) VPFormula.setDisplay(ov.data.display !== false);
        if (VPFormula.setMode) VPFormula.setMode(ov.data.mode || "math");
        VPFormula.render($("math-preview"), ov.data.latex || "");
      }
      if ($("f-size")) { $("f-size").value = ov.data.size || 46; $("f-size-val").textContent = ov.data.size || 46; }
      if ($("f-display")) $("f-display").checked = ov.data.display !== false;
    } else if (ov.kind === "plot") {
      if (ov.data.funcs && ov.data.funcs.length) plotFuncs = ov.data.funcs.map(function (f) { return { expr: f.expr, color: f.color || "#C21807", dash: !!f.dash }; });
      else if (ov.data.expr) plotFuncs = [{ expr: ov.data.expr, color: "#C21807", dash: false }];
      plotPoints = ov.data.points || []; plotView = ov.data.view || null; plotAutoFit = ov.data.autoY !== false;
      showDialog("dlg-plot"); buildFuncRows(); renderPlotPreview();
    } else if (ov.kind === "var") {
      varGrid = JSON.parse(JSON.stringify(ov.data.grid)); varRegion = { x: ov.x, y: ov.y, w: ov.data.w, h: ov.data.h };
      showDialog("dlg-var"); buildVarGrid(); renderVarPreview();
    } else { editOv = null; toast("Nhấp đúp hoặc kéo tay cầm để chỉnh đối tượng này."); }
  }
  function renderOverlays() { overlay.innerHTML = ""; state.overlays.forEach(function (ov) { overlay.appendChild(makeOverlayEl(ov)); }); }
  function addOverlayData(kind, data, x, y) {
    var n = state.overlays.length;
    var ov = { id: "o" + Date.now() + Math.floor(Math.random() * 1000), kind: kind, x: x != null ? x : 80 + (n * 12) % 240, y: y != null ? y : 80 + (n * 12) % 180, data: data || {} };
    state.overlays.push(ov); overlay.appendChild(makeOverlayEl(ov)); scheduleSave(); return ov;
  }
  function removeOverlay(id) { state.overlays = state.overlays.filter(function (o) { return o.id !== id; }); renderOverlays(); scheduleSave(); }
  function selectOverlay(el) {
    overlay.querySelectorAll(".ov.sel").forEach(function (o) { if (o !== el) o.classList.remove("sel"); });
    if (el) el.classList.add("sel");
  }
  function makeDraggable(el, ov, rz) {
    var sx, sy, ox, oy, moving = false, resizing = false, startScale = 1, startW = 0;
    // Kéo tay cầm góc -> đổi kích thước (scale)
    if (rz) rz.addEventListener("pointerdown", function (e) {
      e.stopPropagation(); resizing = true; sx = e.clientX; sy = e.clientY;
      startScale = ov.scale || 1; startW = el.querySelector(".ov-body").offsetWidth || 100;
      rz.setPointerCapture(e.pointerId); selectOverlay(el);
    });
    if (rz) rz.addEventListener("pointermove", function (e) {
      if (!resizing) return;
      var dw = (e.clientX - sx);
      var ns = Math.max(0.3, Math.min(6, startScale * (startW + dw / pageView.getState().zoom) / startW));
      ov.scale = ns; applyOvScale(el, ov);
    });
    if (rz) rz.addEventListener("pointerup", function () { resizing = false; scheduleSave(); });
    // Kéo thân -> di chuyển
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button, input, textarea, select, label, .tf-cell, .note-edit, .note-colors, .text-edit, [contenteditable], .mm-node, .ov-resize")) { if (!e.target.closest(".ov-resize")) selectOverlay(el); return; }
      moving = true; sx = e.clientX; sy = e.clientY;
      ox = parseFloat(el.style.left); oy = parseFloat(el.style.top);
      el.setPointerCapture(e.pointerId); el.classList.add("dragging"); selectOverlay(el);
    });
    el.addEventListener("pointermove", function (e) {
      if (!moving) return;
      var z = pageView.getState().zoom;
      var nx = ox + (e.clientX - sx) / z, ny = oy + (e.clientY - sy) / z;
      el.style.left = nx + "px"; el.style.top = ny + "px"; if (ov) { ov.x = nx; ov.y = ny; }
    });
    el.addEventListener("pointerup", function () { moving = false; el.classList.remove("dragging"); scheduleSave(); });
  }

  // ----- Thanh định dạng chữ (rich text) cho khung chữ
  function setupRichText() {
    var bar = document.getElementById("rt-bar"); if (!bar) return null;
    var sym = document.getElementById("rt-sym");
    var selFont = bar.querySelector(".rt-font"), selSize = bar.querySelector(".rt-size"), selFrame = bar.querySelector(".rt-frame");
    var colIn = bar.querySelector(".rt-colin");
    var cur = null; // {ed, data, host}
    function save() { if (cur) { cur.data.html = cur.ed.innerHTML; scheduleSave(); } }
    function exec(cmd) { if (!cur) return; cur.ed.focus(); try { document.execCommand(cmd, false, null); } catch (e) {} save(); refresh(); }
    function refresh() {
      ["bold", "italic", "underline", "strikeThrough"].forEach(function (c) {
        var b = bar.querySelector('[data-cmd="' + c + '"]'); if (!b) return;
        var on = false; try { on = document.queryCommandState(c); } catch (e) {}
        b.classList.toggle("on", !!on);
      });
    }
    function position() {
      if (!cur || bar.hidden) return;
      var r = cur.host.getBoundingClientRect();
      var bw = bar.offsetWidth || 520, bh = bar.offsetHeight || 40;
      var left = Math.max(8, Math.min(window.innerWidth - bw - 8, r.left));
      var top = r.top - bh - 10; if (top < 8) top = r.bottom + 10;
      bar.style.left = left + "px"; bar.style.top = top + "px";
    }
    function attach(ed, data, host) {
      cur = { ed: ed, data: data, host: host };
      selFont.value = data.font || "'Patrick Hand','Be Vietnam Pro',cursive";
      if (!Array.prototype.some.call(selFont.options, function (o) { return o.value === selFont.value; })) selFont.selectedIndex = 0;
      selSize.value = String(data.size || 40);
      selFrame.value = data.frame || "none";
      colIn.value = data.color || "#111111";
      bar.hidden = false; refresh(); position();
    }
    function hide() { bar.hidden = true; sym.hidden = true; cur = null; }
    // Nút định dạng: giữ vùng chọn bằng cách chặn mousedown lấy tiêu điểm
    bar.querySelectorAll(".rt-b").forEach(function (b) {
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.addEventListener("click", function (e) { e.preventDefault(); exec(b.dataset.cmd); });
    });
    selFont.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    selFont.addEventListener("change", function () { if (!cur) return; cur.ed.style.fontFamily = selFont.value; cur.data.font = selFont.value; save(); cur.ed.focus(); });
    selSize.addEventListener("change", function () { if (!cur) return; cur.ed.style.fontSize = selSize.value + "px"; cur.data.size = +selSize.value; save(); position(); cur.ed.focus(); });
    selFrame.addEventListener("change", function () { if (!cur) return; cur.host.classList.remove("frame-border", "frame-box"); if (selFrame.value !== "none") cur.host.classList.add("frame-" + selFrame.value); cur.data.frame = selFrame.value; save(); position(); cur.ed.focus(); });
    colIn.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    colIn.addEventListener("input", function () {
      if (!cur) return; var v = colIn.value; cur.ed.focus();
      var sel = window.getSelection();
      if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed) { try { document.execCommand("foreColor", false, v); } catch (e) {} }
      else { cur.ed.style.color = v; cur.data.color = v; }
      save();
    });
    // Ω — bảng ký hiệu đặc biệt
    var SYMS = "± × ÷ ≠ ≤ ≥ ≈ ∞ √ ∑ ∏ ∫ π α β γ δ θ λ μ σ φ ω Δ Ω → ← ↔ ⇒ ⇔ ∈ ∉ ⊂ ⊆ ∪ ∩ ∅ ∀ ∃ ∠ ⊥ ∥ ° ′ ″ · ∘ ℝ ℤ ℕ ℚ".split(" ");
    sym.innerHTML = ""; SYMS.forEach(function (s) { var b = document.createElement("button"); b.textContent = s; b.addEventListener("mousedown", function (e) { e.preventDefault(); }); b.addEventListener("click", function () { if (!cur) return; cur.ed.focus(); try { document.execCommand("insertText", false, s); } catch (e) { } save(); }); sym.appendChild(b); });
    bar.querySelector(".rt-omega").addEventListener("mousedown", function (e) { e.preventDefault(); });
    bar.querySelector(".rt-omega").addEventListener("click", function () {
      if (sym.hidden) { sym.hidden = false; var r = bar.querySelector(".rt-omega").getBoundingClientRect(); sym.style.left = Math.min(window.innerWidth - 290, r.left) + "px"; sym.style.top = (r.bottom + 6) + "px"; }
      else sym.hidden = true;
    });
    // √x — mở bảng công thức LaTeX trực quan, chèn nội tuyến vào khung chữ
    bar.querySelector(".rt-fx").addEventListener("mousedown", function (e) { e.preventDefault(); });
    bar.querySelector(".rt-fx").addEventListener("click", function () {
      if (!cur) return;
      openTextFormula(cur.ed, cur.data);
    });
    bar.querySelector(".rt-done").addEventListener("mousedown", function (e) { e.preventDefault(); });
    bar.querySelector(".rt-done").addEventListener("click", function () { if (cur) cur.ed.blur(); hide(); });
    // Nhấn ra ngoài khung chữ + thanh công cụ -> ẩn thanh
    document.addEventListener("pointerdown", function (e) {
      if (!cur || bar.hidden) return;
      if (e.target.closest("#rt-bar") || e.target.closest(".text-edit") || e.target.closest("#rt-sym")) return;
      hide();
    }, true);
    document.addEventListener("keyup", refresh);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return { attach: attach, hide: hide, position: position };
  }
  var RT = setupRichText();

  function insertMath(latex, x, y, opts) { if (latex) addOverlayData("math", Object.assign({ latex: latex }, opts || {}), x, y); }
  // Chèn khung chữ trống, gõ trực tiếp bằng bàn phím + hiện thanh định dạng
  function insertTextBox(x, y) {
    var cx = x != null ? x : Math.max(40, canvas.clientWidth / 2 - 80), cy = y != null ? y : Math.max(40, canvas.clientHeight / 2 - 40);
    var ov = addOverlayData("text", { html: "", font: "'Patrick Hand','Be Vietnam Pro',cursive", size: 40, frame: "none" }, cx, cy);
    setTimeout(function () { var el = overlay.querySelector('.ov[data-id="' + ov.id + '"] .text-edit'); if (el) { el.focus(); } }, 40);
    return ov;
  }
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
  function insertPlot(expr, x, y, w, h) { if (expr) addOverlayData("plot", { expr: expr, w: w, h: h }, x, y); }
  function insertCalc(x, y) { addOverlayData("calc", {}, x, y); }
  function insertNote(x, y) { addOverlayData("note", { text: "", color: "#FFF1A6" }, x, y); }
  function insertVar(data, x, y) { addOverlayData("var", data, x, y); }
  function insertTimer(x, y) { addOverlayData("timer", { total: 300 }, x, y); }
  function insertPicker(x, y) { addOverlayData("picker", {}, x, y); }
  function insertWheel(x, y) { addOverlayData("wheel", {}, x, y); }
  function insertGroups(x, y) { addOverlayData("groups", { groups: 4 }, x, y); }
  function insertAttend(x, y) { addOverlayData("attend", {}, x, y); }
  function insertScore(x, y) { addOverlayData("score", {}, x, y); }
  function insertMindmap(x, y) { addOverlayData("mindmap", {}, x != null ? x : 80, y != null ? y : 70); }
  function insertChart(x, y) { addOverlayData("chart", {}, x != null ? x : 110, y != null ? y : 80); }
  function insertFlash(x, y) { addOverlayData("flashcard", {}, x != null ? x : 120, y != null ? y : 90); }
  function insertMultab(x, y) { addOverlayData("multab", {}, x != null ? x : 120, y != null ? y : 80); }
  function insertVideo(x, y) { addOverlayData("video", {}, x != null ? x : 130, y != null ? y : 90); }
  function insertAlpha(x, y) { addOverlayData("alpha", {}, x != null ? x : 120, y != null ? y : 80); }
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
    b.onclick = function (e) {
      if (b.dataset.geo === "line") { e.stopPropagation(); activateArrow("dash"); clearActive(); b.classList.add("active"); return; }   // ╱ mở bảng dựng hình động
      state.tool = "geo";
      window.VPGeo.setTool(b.dataset.geo);
      clearActive(); b.classList.add("active");
    };
  });
  // ===== Bảng DỰNG HÌNH ĐỘNG (4 cột) =====
  var GEO_HINT = {
    move: "Kéo để di chuyển điểm.", point: "Bấm để tạo điểm.",
    segment: "Bấm 2 điểm để vẽ đoạn thẳng.", line: "Bấm 2 điểm để vẽ đường thẳng.", ray: "Bấm 2 điểm: gốc rồi hướng.", "ray-opp": "Bấm 2 điểm: gốc rồi hướng (vẽ tia đối).",
    circle: "Bấm tâm rồi 1 điểm trên đường tròn.", mid: "Bấm 2 điểm để lấy trung điểm.",
    perp: "Bấm điểm cần hạ, rồi 2 điểm xác định đường.", parallel: "Bấm điểm, rồi 2 điểm xác định đường song song.",
    altitude: "Bấm đỉnh A, rồi 2 đỉnh B, C (đường cao từ A).", bisector: "Bấm 3 điểm A, B, C (phân giác góc B).",
    intersect: "Bấm 4 điểm: đường 1 (2 điểm) rồi đường 2 (2 điểm).",
    centroid: "Bấm 3 đỉnh tam giác (trọng tâm).", ortho: "Bấm 3 đỉnh (trực tâm).",
    circum: "Bấm 3 đỉnh (đường tròn ngoại tiếp).", incenter: "Bấm 3 đỉnh (tâm nội tiếp).", incircle: "Bấm 3 đỉnh (đường tròn nội tiếp).",
    "sym-line": "Bấm điểm cần lấy đối xứng, rồi 2 điểm xác định trục.", "sym-point": "Bấm điểm, rồi tâm đối xứng.",
    translate: "Bấm điểm, rồi 2 điểm xác định vectơ tịnh tiến.", rotate: "Bấm điểm, rồi tâm quay."
  };
  var GEO_COLS = [
    [["h", "Hình vẽ"], ["opt", "showdots", "Hiện chấm tròn ở các điểm của hình"], ["opt", "snap", "Bắt điểm lưới"],
     ["h", "Kí hiệu"], ["todo", "Góc (số đo)", "ic-angle"], ["todo", "Kí hiệu góc", "ic-arc"], ["todo", "Kí hiệu góc vuông", "ic-right"], ["todo", "Kí hiệu đoạn thẳng bằng nhau", "ic-tick"], ["todo", "Kí hiệu hai góc bằng nhau", "ic-2arc"],
     ["h", "Phép biến hình"], ["t", "sym-line", "Đối xứng trục"], ["t", "sym-point", "Đối xứng tâm"], ["t", "translate", "Tịnh tiến"], ["t", "rotate", "Phép quay"], ["t", "homothety", "Phép vị tự"]],
    [["h", "Vẽ"], ["t", "move", "Di chuyển điểm", "U"], ["t", "point", "Điểm"], ["t", "segment", "Đoạn thẳng qua 2 điểm"], ["t", "line", "Đường thẳng qua 2 điểm"], ["t", "ray", "Tia"], ["t", "ray-opp", "Tia đối"], ["todo", "Đa giác", "ic-poly"], ["t", "circle", "Đường tròn (tâm, điểm)"], ["todo", "Cung tròn qua 3 điểm", "ic-arc3"]],
    [["h", "Dựng hình"], ["t", "mid", "Trung điểm"], ["t", "perp", "Đường vuông góc"], ["t", "parallel", "Đường song song"], ["t", "altitude", "Đường cao (chân đường vuông góc)"], ["t", "bisector", "Tia phân giác"], ["t", "intersect", "Giao điểm"], ["todo", "Tiếp tuyến của đường tròn", "ic-tan"], ["todo", "Tiếp tuyến chung hai đường tròn", "ic-tan2"]],
    [["h", "Tâm tam giác"], ["t", "centroid", "Trọng tâm"], ["t", "ortho", "Trực tâm"], ["t", "circum", "Tâm đường tròn ngoại tiếp"], ["t", "incenter", "Tâm đường tròn nội tiếp"], ["t", "circum", "Đường tròn ngoại tiếp (qua 3 đỉnh)"], ["t", "incircle", "Đường tròn nội tiếp (tiếp xúc 3 cạnh)"]]
  ];
  // Vẽ icon schematic nhỏ cho từng công cụ dựng hình
  function drawGeoIcon(cv, id) {
    var g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
    g.strokeStyle = "#8a1020"; g.fillStyle = "#8a1020"; g.lineWidth = 1.5; g.lineJoin = g.lineCap = "round";
    var W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
    function dot(x, y, r) { g.beginPath(); g.arc(x, y, r || 2, 0, 6.28); g.fill(); }
    function ln(x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    function arr(x1, y1, x2, y2) { ln(x1, y1, x2, y2); var a = Math.atan2(y2 - y1, x2 - x1); g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 5 * Math.cos(a - .5), y2 - 5 * Math.sin(a - .5)); g.lineTo(x2 - 5 * Math.cos(a + .5), y2 - 5 * Math.sin(a + .5)); g.closePath(); g.fill(); }
    var pad = 4, x0 = pad, x1 = W - pad, y0 = pad, y1 = H - pad;
    switch (id) {
      case "move": arr(x0 + 2, y1 - 2, x1 - 4, y0 + 4); dot(x0 + 2, y1 - 2); break;
      case "point": dot(cx, cy, 3); break;
      case "segment": ln(x0, y1 - 2, x1, y0 + 2); dot(x0, y1 - 2); dot(x1, y0 + 2); break;
      case "line": ln(x0, cy, x1, cy); dot(cx - 7, cy); dot(cx + 7, cy); break;
      case "ray": dot(x0 + 1, cy); arr(x0 + 1, cy, x1, cy); break;
      case "ray-opp": dot(cx, cy); arr(cx, cy, x0, cy); arr(cx, cy, x1, cy); break;
      case "circle": g.beginPath(); g.arc(cx, cy, Math.min(W, H) / 2 - pad, 0, 6.28); g.stroke(); dot(cx, cy); break;
      case "mid": ln(x0, cy, x1, cy); dot(x0, cy); dot(x1, cy); dot(cx, cy, 3); break;
      case "perp": ln(x0, y1, x1, y1); ln(cx, y0, cx, y1); g.strokeRect(cx, y1 - 7, 7, 7); break;
      case "parallel": ln(x0, cy - 5, x1, cy - 5); ln(x0, cy + 5, x1, cy + 5); break;
      case "altitude": g.beginPath(); g.moveTo(cx, y0); g.lineTo(x0, y1); g.lineTo(x1, y1); g.closePath(); g.stroke(); ln(cx, y0, cx, y1); break;
      case "bisector": ln(x0, y1, x1, y0); ln(x0, y1, x1, y1); ln(x0, y1, x1 - 2, cy); break;
      case "intersect": ln(x0, y0, x1, y1); ln(x0, y1, x1, y0); dot(cx, cy, 3); break;
      case "centroid": case "ortho": case "circum": case "incenter":
        g.beginPath(); g.moveTo(cx, y0); g.lineTo(x0, y1); g.lineTo(x1, y1); g.closePath(); g.stroke(); dot(cx, cy + 2, 3); break;
      case "incircle": g.beginPath(); g.moveTo(cx, y0); g.lineTo(x0, y1); g.lineTo(x1, y1); g.closePath(); g.stroke(); g.beginPath(); g.arc(cx, cy + 3, 5, 0, 6.28); g.stroke(); break;
      case "sym-line": ln(cx, y0, cx, y1); dot(cx - 7, cy); dot(cx + 7, cy); g.setLineDash([2, 2]); ln(cx - 7, cy, cx + 7, cy); g.setLineDash([]); break;
      case "sym-point": dot(cx, cy); dot(x0 + 2, y1 - 2); dot(x1 - 2, y0 + 2); break;
      case "translate": arr(x0, y1, x1 - 3, y0 + 3); break;
      case "rotate": g.beginPath(); g.arc(cx, cy, 6, -0.5, 3.6); g.stroke(); dot(cx, cy); break;
      case "homothety": dot(x0 + 2, cy); ln(x0 + 2, cy, x1 - 2, cy); dot(cx, cy); dot(x1 - 2, cy, 3); break;
      case "ic-angle": ln(x0 + 2, y1, x1, y0 + 2); ln(x0 + 2, y1, x1, y1); g.beginPath(); g.arc(x0 + 2, y1, 9, -0.9, 0); g.stroke(); break;
      case "ic-arc": ln(x0 + 2, y1, x1, y0 + 2); ln(x0 + 2, y1, x1, y1); g.beginPath(); g.arc(x0 + 2, y1, 10, -0.95, 0); g.stroke(); break;
      case "ic-right": ln(x0 + 3, y0 + 2, x0 + 3, y1); ln(x0 + 3, y1, x1, y1); g.strokeRect(x0 + 3, y1 - 7, 7, 7); break;
      case "ic-tick": ln(x0, cy, x1, cy); ln(cx - 3, cy - 5, cx + 3, cy + 5); break;
      case "ic-2arc": ln(x0 + 2, y1, x1, y0 + 2); ln(x0 + 2, y1, x1, y1); g.beginPath(); g.arc(x0 + 2, y1, 8, -0.95, 0); g.stroke(); g.beginPath(); g.arc(x0 + 2, y1, 11, -0.95, 0); g.stroke(); break;
      case "ic-poly": g.beginPath(); for (var pi = 0; pi < 5; pi++) { var pa = -1.57 + pi * 1.2566, px = cx + 9 * Math.cos(pa), py = cy + 9 * Math.sin(pa); pi ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.stroke(); break;
      case "ic-arc3": g.beginPath(); g.arc(cx, cy + 5, 9, -2.4, -0.7); g.stroke(); dot(cx - 8, cy); dot(cx, cy - 4); dot(cx + 8, cy); break;
      case "ic-tan": g.beginPath(); g.arc(cx - 3, cy, 7, 0, 6.28); g.stroke(); ln(cx + 4, y0 + 2, cx + 4, y1); break;
      case "ic-tan2": g.beginPath(); g.arc(x0 + 7, cy, 5, 0, 6.28); g.stroke(); g.beginPath(); g.arc(x1 - 7, cy, 5, 0, 6.28); g.stroke(); ln(x0 + 7, cy - 5, x1 - 7, cy - 5); break;
      default: g.beginPath(); g.arc(cx, cy, 3, 0, 6.28); g.stroke();
    }
  }
  var geoMenuBuilt = false;
  function closeGeoMenu() { var m = $("geo-menu"); if (m) m.classList.remove("show"); }
  function activateGeoTool(t) {
    if (t === "rotate") { var a = parseFloat(prompt("Góc quay (độ):", "90")); window.VPGeo.rotAngle = isNaN(a) ? 90 : a; }
    if (t === "homothety") { var k = parseFloat(prompt("Tỉ số vị tự k:", "2")); window.VPGeo.homoK = isNaN(k) ? 2 : k; }
    state.tool = "geo"; window.VPGeo.setTool(t); clearActive();
    var gb = $("btn-solid"); if (gb) gb.classList.add("active");
    toast(GEO_HINT[t] || "Chọn điểm trên bảng.");
  }
  function buildGeoMenu() {
    if (geoMenuBuilt) return; var host = $("geo-menu"); if (!host) return;
    GEO_COLS.forEach(function (colData) {
      var col = document.createElement("div"); col.className = "sm-col";
      colData.forEach(function (row) {
        if (row[0] === "h") { var hd = document.createElement("div"); hd.className = "sm-h"; hd.textContent = row[1]; col.appendChild(hd); return; }
        var b = document.createElement("button"); b.className = "sm-item";
        if (row[0] === "opt") {
          var ck = document.createElement("span"); ck.className = "sm-ck"; ck.textContent = state.opt[row[1]] ? "✓" : "";
          b.appendChild(ck); var sp = document.createElement("span"); sp.textContent = row[2]; b.appendChild(sp);
          if (state.opt[row[1]]) b.classList.add("on");
          b.onclick = function () { state.opt[row[1]] = !state.opt[row[1]]; ck.textContent = state.opt[row[1]] ? "✓" : ""; b.classList.toggle("on", state.opt[row[1]]); saveSettings(); redraw(); };
        } else if (row[0] === "todo") {
          var ic0 = document.createElement("canvas"); ic0.className = "sm-ic"; ic0.width = 30; ic0.height = 24; b.appendChild(ic0);
          if (row[2]) try { drawGeoIcon(ic0, row[2]); } catch (e) {}
          var sp2 = document.createElement("span"); sp2.textContent = row[1]; b.appendChild(sp2);
          b.onclick = function () { toast("Công cụ \"" + row[1] + "\" đang được hoàn thiện."); };
        } else {
          var ic = document.createElement("canvas"); ic.className = "sm-ic"; ic.width = 30; ic.height = 24; b.appendChild(ic);
          try { drawGeoIcon(ic, row[1]); } catch (e) {}
          var sp3 = document.createElement("span"); sp3.textContent = row[2]; b.appendChild(sp3);
          if (row[3]) { var k = document.createElement("span"); k.className = "sm-key"; k.textContent = row[3]; b.appendChild(k); }
          b.onclick = function () { activateGeoTool(row[1]); closeGeoMenu(); };
        }
        col.appendChild(b);
      });
      host.appendChild(col);
    });
    geoMenuBuilt = true;
  }
  function openGeoMenu(btn) {
    buildGeoMenu(); var m = $("geo-menu"), r = btn.getBoundingClientRect();
    document.querySelectorAll(".nr-menu.show").forEach(function (x) { if (x !== m) x.classList.remove("show"); });
    if (m.classList.contains("show")) { m.classList.remove("show"); return; }
    m.style.left = Math.max(6, Math.min(r.left, window.innerWidth - 820)) + "px"; m.style.top = (r.bottom + 4) + "px";
    m.classList.add("show");
  }
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
  // Nhãn dán & con dấu (nút ★) — gộp cả lối vào Công cụ môn Tự nhiên
  var STK_EMOJI = ["⭐", "🌟", "👍", "👏", "😊", "🎉", "❤️", "✅", "💯", "🏆", "🔥", "🌸", "🦋", "🍎", "✏️", "😍"];
  var STK_PRAISE = ["Giỏi!", "Đúng rồi!", "Tốt lắm!", "Xuất sắc!", "Cố lên!", "10 điểm", "Tiến bộ!", "Tuyệt vời!"];
  var STK_STAMPS = ["Đã chấm", "Đã xem", "Cần cố gắng", "Nộp bài", "✔ Đạt", "Hoàn thành"];
  function buildStickerMenu() {
    if (buildStickerMenu.done) return; buildStickerMenu.done = true;
    function fill(id, arr, kind) {
      var c = $(id); if (!c) return;
      arr.forEach(function (t) {
        var b = document.createElement("button"); b.className = "stk"; b.textContent = t;
        b.onclick = function () { $("sticker-menu").classList.remove("show"); insertSticker(t, kind); };
        c.appendChild(b);
      });
    }
    fill("stk-emoji", STK_EMOJI, "emoji");
    fill("stk-praise", STK_PRAISE, "praise");
    fill("stk-stamps", STK_STAMPS, "stamp");
    if ($("stk-sci")) $("stk-sci").onclick = function () { $("sticker-menu").classList.remove("show"); showDialog("dlg-sci"); };
  }
  function insertSticker(text, kind) {
    var cx = Math.max(40, canvas.clientWidth / 2 - 40), cy = Math.max(40, canvas.clientHeight / 2 - 40);
    addOverlayData("sticker", { text: text, skind: kind }, cx, cy);
  }
  if ($("btn-shapes-fav")) $("btn-shapes-fav").onclick = function (e) { e.stopPropagation(); buildFavMenu(); var r = this.getBoundingClientRect(); showMenuAt($("fav-menu"), Math.min(r.left, window.innerWidth - $("fav-menu").offsetWidth - 8), r.bottom + 4); };
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
  if ($("btn-ruler")) $("btn-ruler").onclick = function (e) { var r = this.getBoundingClientRect(); showMenuAt($("ruler-menu"), r.left, r.bottom + 4); e.stopPropagation(); };
  document.querySelectorAll("#ruler-menu [data-ruler]").forEach(function (b) {
    b.onclick = function () { $("ruler-menu").classList.remove("show"); var on = window.VPRuler.show(pageView.surface, b.dataset.ruler); if ($("btn-ruler")) $("btn-ruler").classList.toggle("active", on); };
  });
  // Hiện/ẩn danh sách trang
  if ($("btn-sidebar")) $("btn-sidebar").onclick = function () { var s = $("nr-side"); s.classList.toggle("hidden"); this.classList.toggle("active", !s.classList.contains("hidden")); };
  // ===== Menu ứng dụng (nút ☰) =====
  function openAppMenu() {
    var m = $("app-menu"), bd = $("app-menu-bd"); if (!m) return;
    if ($("am-page")) $("am-page").value = (cur + 1);
    if ($("am-total")) $("am-total").textContent = pages.length;
    m.hidden = false; bd.hidden = false;
  }
  function closeAppMenu() { if ($("app-menu")) $("app-menu").hidden = true; if ($("app-menu-bd")) $("app-menu-bd").hidden = true; }
  if ($("btn-menu")) $("btn-menu").onclick = function (e) { e.stopPropagation(); if ($("app-menu") && $("app-menu").hidden) openAppMenu(); else closeAppMenu(); };
  if ($("app-menu-bd")) $("app-menu-bd").onclick = closeAppMenu;
  function newBook() { createBook(); resetHist(); toast("Đã tạo sổ mới."); }
  function toggleFull() { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) {} }
  function applyTheme(t) {
    document.body.classList.remove("theme-dark");
    var dark = t === "dark" || (t === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.body.classList.add("theme-dark");
    try { localStorage.setItem("vpvie.theme", t); } catch (e) {}
    document.querySelectorAll("#app-menu [data-theme]").forEach(function (b) { b.classList.toggle("on", b.dataset.theme === t); });
  }
  (function () { var t = "light"; try { t = localStorage.getItem("vpvie.theme") || "light"; } catch (e) {} applyTheme(t); })();
  function setSheetBar(hide) {
    var s = document.querySelector(".nr-sheets"), btn = $("sheet-show"); if (!s) return;
    s.classList.toggle("hidden", hide);
    if (btn) btn.hidden = !hide;
    try { localStorage.setItem("vpvie.hideSheets", hide ? "1" : "0"); } catch (e) {}
  }
  if ($("sheet-hide")) $("sheet-hide").onclick = function (e) { e.stopPropagation(); setSheetBar(true); toast("Đã ẩn thanh Sheet."); };
  if ($("sheet-show")) $("sheet-show").onclick = function (e) { e.stopPropagation(); setSheetBar(false); };
  (function () { try { if (localStorage.getItem("vpvie.hideSheets") === "1") setSheetBar(true); } catch (e) {} })();
  var AM = {
    library: function () { openLibrary(); },
    "new": newBook,
    newwin: function () { try { window.open(location.href, "_blank"); } catch (e) {} },
    fullscreen: toggleFull,
    present: function () { var s = $("nr-side"); if (s) s.classList.add("hidden"); if (typeof hideNote === "function") hideNote(); toggleFull(); },
    curtain: function () { startTeach("curtain"); },
    spotlight: function () { startTeach("spotlight"); },
    history: function () { openHistory(); },
    pagegrid: function () { openPageGrid(); },
    notes: function () { toggleNote(); },
    mindmap: function () { insertMindmap(); },
    chart: function () { insertChart(); },
    flash: function () { insertFlash(); },
    multab: function () { insertMultab(); },
    video: function () { insertVideo(); },
    alpha: function () { insertAlpha(); },
    open: function () { openBookFile(); },
    save: function () { saveLocal(); toast("Đã lưu sổ (trên máy này)."); },
    saveas: function () { downloadBook(); },
    "import": function () { if ($("imp-img")) $("imp-img").click(); },
    png: function () { $("btn-png").click(); },
    pdf: function () { $("btn-pdf").click(); },
    print: async function () { try { toast("Đang chuẩn bị in…"); var ok = await window.VPExport.print(board); if (!ok) toast("Trình duyệt chặn cửa sổ in. Hãy cho phép cửa sổ bật lên."); } catch (e) { toast("Lỗi khi in."); } },
    addpage: function () { addPage(); },
    delpage: function () { delPage(); },
    toolbar: function () { document.querySelectorAll(".nr-row-tools, .nr-row-tools2").forEach(function (r) { r.classList.toggle("hidden"); }); },
    sheetbar: function () { var s = document.querySelector(".nr-sheets"); setSheetBar(!(s && s.classList.contains("hidden"))); },
    license: function () { if ($("btn-license")) $("btn-license").click(); },
    update: function () {
      if (window.VPDesktop && window.VPDesktop.isApp && window.VPDesktop.checkUpdate) {
        toast("Đang kiểm tra cập nhật…");
        window.VPDesktop.checkUpdate().then(function (r) { if (r && r.reason === "dev") toast("Bản đang chạy từ mã nguồn (không tự cập nhật)."); });
        return;
      }
      // Web/PWA: cập nhật qua service worker
      if ("serviceWorker" in navigator) {
        toast("Đang kiểm tra cập nhật…");
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (!reg) { toast("Không có cập nhật tự động ở chế độ này."); return; }
          reg.update().then(function () {
            if (reg.waiting) { reg.waiting.postMessage({ type: "SKIP_WAITING" }); toast("Đang tải bản mới…"); }
            else toast("Bạn đang dùng bản mới nhất.");
          }).catch(function () { toast("Không kiểm tra được cập nhật."); });
        });
      } else toast("Bạn đang dùng bản mới nhất của VPVie.");
    },
    about: function () {
      alert("VPVie – Bảng dạy học\n\nPhím tắt:\n  Ctrl+Z / Ctrl+Y : Hoàn tác / Làm lại\n  Ctrl+C/X/V/D : Chép/Cắt/Dán/Nhân bản\n  Ctrl+A : Chọn tất cả · Delete : Xoá\n  L : Đoạn thẳng · V : Vectơ · C : Đường tròn\n  Q : Hình vuông · 3 : Tam giác\n\nPhần mềm văn phòng + dạy học tiếng Việt, mã nguồn mở.");
    },
    close: closeAppMenu
  };
  document.querySelectorAll("#app-menu [data-am]").forEach(function (b) {
    b.onclick = function () { var fn = AM[b.dataset.am]; closeAppMenu(); if (fn) setTimeout(fn, 10); };
  });
  if ($("am-goto")) $("am-goto").onclick = function () { var n = parseInt($("am-page").value, 10); if (n >= 1 && n <= pages.length) { gotoPage(n - 1); } closeAppMenu(); };
  document.querySelectorAll("#app-menu [data-theme]").forEach(function (b) { b.onclick = function () { applyTheme(b.dataset.theme); }; });
  document.querySelectorAll("#app-menu [data-lang]").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll("#app-menu [data-lang]").forEach(function (x) { x.classList.toggle("on", x === b); });
      if (b.dataset.lang === "en") toast("Giao diện tiếng Anh đang được hoàn thiện.");
    };
  });
  // Thông báo tiến trình tự cập nhật (app .exe)
  if (window.VPDesktop && window.VPDesktop.onUpdateStatus) {
    window.VPDesktop.onUpdateStatus(function (d) {
      if (!d) return;
      if (d.state === "available") toast("Có bản cập nhật " + (d.version || "") + " — đang tải…");
      else if (d.state === "downloading") toast("Đang tải cập nhật… " + (d.percent || 0) + "%");
      else if (d.state === "none") toast("Bạn đang dùng bản mới nhất.");
      else if (d.state === "error") toast("Lỗi kiểm tra cập nhật.");
    });
  }
  // Phím tắt F11 / Ctrl+N / Ctrl+O / Ctrl+S
  document.addEventListener("keydown", function (e) {
    var t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key === "F11") { e.preventDefault(); toggleFull(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); newBook(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); openBookFile(); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); saveLocal(); toast("Đã lưu sổ."); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); downloadBook(); }
  });
  if ($("btn-library")) $("btn-library").onclick = function () { openLibrary(); };
  // ---- Thư viện: nút & tương tác
  if ($("lib-back")) $("lib-back").onclick = function () { closeLibrary(); };
  if ($("lib-search")) $("lib-search").oninput = function () { renderLibrary(); };
  if ($("lib-proj-new")) $("lib-proj-new").onclick = function () { newProject(); };
  if ($("lib-openstart")) $("lib-openstart").onchange = function () { lib.openOnStart = this.checked; libSave(); };
  // ----- Sao lưu / khôi phục toàn bộ thư viện -----
  function exportBackup() {
    persistCurrent();
    var books = {}; (lib.books || []).forEach(function (m) { try { books[m.id] = localStorage.getItem(bookKey(m.id)) || ""; } catch (e) {} });
    var pack = { v: 1, type: "vpvie-backup", date: new Date().toISOString(), lib: lib, books: books };
    try { pack.classes = JSON.parse(localStorage.getItem("vpvie.classes") || "null"); } catch (e) {}
    try { pack.quizzes = JSON.parse(localStorage.getItem("vpvie.quizzes") || "null"); } catch (e) {}
    var json = JSON.stringify(pack), name = "vpvie-sao-luu-" + new Date().toISOString().slice(0, 10) + ".json";
    if (window.VPDesktop && window.VPDesktop.isApp && folders.books) { window.VPDesktop.saveFile(folders.books, name, json, false).then(function (r) { toast(r.ok ? "Đã lưu sao lưu: " + r.path : "Lỗi lưu."); }); return; }
    var blob = new Blob([json], { type: "application/json" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    toast("Đã tải file sao lưu (" + lib.books.length + " sổ).");
  }
  function importBackup(obj) {
    if (!obj || obj.type !== "vpvie-backup" || !obj.lib) { toast("File sao lưu không hợp lệ."); return; }
    persistCurrent();
    var added = 0;
    (obj.lib.books || []).forEach(function (m) {
      var nid = genId(), content = (obj.books || {})[m.id] || "";
      lib.books.unshift({ id: nid, name: (m.name || "Sổ") + "", created: m.created || Date.now(), updated: m.updated || Date.now(), project: null, cover: m.cover || null });
      try { localStorage.setItem(bookKey(nid), content); } catch (e) {} added++;
    });
    try { if (obj.classes && obj.classes.list) { var c = JSON.parse(localStorage.getItem("vpvie.classes") || "null") || { current: "", list: {} }; Object.keys(obj.classes.list).forEach(function (nm) { if (c.list[nm] == null) c.list[nm] = obj.classes.list[nm]; }); if (!c.current) c.current = obj.classes.current || Object.keys(c.list)[0] || ""; localStorage.setItem("vpvie.classes", JSON.stringify(c)); } } catch (e) {}
    try { if (obj.quizzes && obj.quizzes.list) { var q = JSON.parse(localStorage.getItem("vpvie.quizzes") || "null") || { current: "", list: {} }; Object.keys(obj.quizzes.list).forEach(function (nm) { if (q.list[nm] == null) q.list[nm] = obj.quizzes.list[nm]; }); localStorage.setItem("vpvie.quizzes", JSON.stringify(q)); } } catch (e) {}
    libSave(); renderLibrary();
    toast("Đã khôi phục " + added + " sổ từ file sao lưu. (Lớp/câu đố sẽ áp dụng khi mở lại.)");
  }
  if ($("lib-export")) $("lib-export").onclick = exportBackup;
  if ($("lib-import")) $("lib-import").onclick = function () {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = function () { var f = inp.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { importBackup(JSON.parse(rd.result)); } catch (e) { toast("File không đọc được."); } }; rd.readAsText(f); };
    inp.click();
  };
  if ($("lib-multi")) $("lib-multi").onclick = function () {
    var lb = $("library"); var on = lb.classList.toggle("multi"); this.classList.toggle("on", on);
    this.lastChild.textContent = on ? " Xong" : " Chọn nhiều";
    if (!on) { document.querySelectorAll("#lib-grid .lib-chk").forEach(function (c) { c.checked = false; }); }
    if ($("lib-bulk-del")) $("lib-bulk-del").hidden = true;
  };
  if ($("lib-bulk-del")) $("lib-bulk-del").onclick = function () {
    var ids = checkedIds(); if (!ids.length) return;
    if (!confirm("Chuyển " + ids.length + " sổ đã chọn vào Thùng rác?")) return;
    ids.forEach(function (id) { deleteBook(id); });
    renderLibrary(); updateBulkBar();
  };
  document.querySelectorAll("#library .lib-nav[data-filter]").forEach(function (b) { b.onclick = function () { libFilter = b.dataset.filter; syncNav(); renderLibrary(); }; });
  document.addEventListener("pointerdown", function (e) { var mm = $("lib-more"); if (mm && !mm.hidden && !e.target.closest("#lib-more") && !e.target.closest(".lib-more")) mm.hidden = true; }, true);
  // Chèn bảng
  if ($("btn-table")) $("btn-table").onclick = function () {
    showDialog("dlg-table"); $("table-rows").focus(); $("table-rows").select();
  };
  $("table-form").onsubmit = function (e) {
    e.preventDefault(); if (!this.reportValidity()) return;
    var r = Number($("table-rows").value), c = Number($("table-cols").value);
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 1 || r > 100 || c < 1 || c > 50) return;
    hideDialog("dlg-table"); addOverlayData("table", { rows: r, cols: c, cells: [] }, 120, 110);
  };
  // Khung văn bản / chữ
  if ($("btn-textbox")) $("btn-textbox").onclick = function () { insertTextBox(); };
  if ($("btn-text")) $("btn-text").onclick = function () { insertTextBox(); };
  // Trình duyệt web nhúng
  if ($("btn-web")) $("btn-web").onclick = function () {
    $("web-url").value = "https://"; showDialog("dlg-web"); $("web-url").focus();
  };
  if ($("web-add")) $("web-add").onclick = function () {
    var u = $("web-url").value; if (!u || u === "https://") return;
    u = u.trim(); if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = "https://" + u;
    try { var parsed = new URL(u); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); u = parsed.href; }
    catch (e) { toast("Hãy nhập địa chỉ HTTP hoặc HTTPS hợp lệ."); return; }
    hideDialog("dlg-web"); addOverlayData("web", { url: u }, 120, 110);
  };
  if ($("web-url")) $("web-url").addEventListener("keydown", function (e) { if (e.key === "Enter") $("web-add").click(); });
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
  // Chọn luôn hình vừa chèn (để kéo-thả/đổi kích thước ngay)
  function selectLast() { enterSelect(); state.selected = [state.items.length - 1]; redraw(); toast("Kéo thân để di chuyển, kéo tay cầm góc để đổi kích thước."); }
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
    all: function () { enterSelect(); state.selected = state.items.map(function (_, i) { return i; }); },
    edit: function () {
      if (state.selected.length !== 1) return;
      var it = state.items[state.selected[0]];
      if (it && it.type === "oxyz" && window.VPOxyz) window.VPOxyz.open(it.scene, function (sc) { pushHist(); it.scene = sc; redraw(); scheduleSave(); });
    }
  };
  function selEditable() { return state.selected.length === 1 && state.items[state.selected[0]] && state.items[state.selected[0]].type === "oxyz"; }
  function selOxyzItem() { if (state.selected.length !== 1) return null; var it = state.items[state.selected[0]]; return (it && it.type === "oxyz") ? it : null; }
  function runAct(act) { if (!selActions[act]) return; selActions[act](); redraw(); scheduleSave(); }
  // ===== Thanh công cụ Oxyz (góc nhìn / xoay 3D / ẩn trục) =====
  // state.oxyzRot: hình Oxyz đang ở chế độ "xoay tự do" (kéo trên hình để xoay mọi phía)
  document.querySelectorAll("#sel-bar button[data-act]").forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); if (b.dataset.act === "edit") state.oxyzRot = null; runAct(b.dataset.act); };
  });
  document.querySelectorAll("#sel-bar [data-oxv]").forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); var it = selOxyzItem(); if (!it || !window.VPOxyz) return; state.oxyzRot = null; pushHist(); it.scene.camera = Object.assign(window.VPOxyz.defaults().camera, { view: b.dataset.oxv }); if (it.scene.display) it.scene.display.auto = false; redraw(); scheduleSave(); updateSelBar(); };
  });
  var oxAxesBtn = document.querySelector("#sel-bar [data-oxaxes]");
  if (oxAxesBtn) oxAxesBtn.onclick = function (e) { e.stopPropagation(); var it = selOxyzItem(); if (!it) return; pushHist(); it.scene.display = it.scene.display || {}; it.scene.display.axes = !(it.scene.display.axes !== false); redraw(); scheduleSave(); updateSelBar(); };
  var oxSpinBtn = document.querySelector("#sel-bar [data-oxspin]");
  if (oxSpinBtn) oxSpinBtn.onclick = function (e) {
    e.stopPropagation(); var it = selOxyzItem(); if (!it) return;
    if (state.oxyzRot === it) { state.oxyzRot = null; toast("Đã tắt xoay 3D."); }
    else { state.oxyzRot = it; if (it.scene && it.scene.camera) { it.scene.camera.view = "3d"; if (it.scene.display) it.scene.display.auto = false; } toast("Kéo trên hình để xoay mọi phía; bấm Xoay 3D lần nữa để thôi."); }
    redraw(); updateSelBar();
  };
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
  // ===== Bảng màu lớn trong menu bút (≈30 màu, 5 hàng) =====
  var PEN_PALETTE = [
    "#111111", "#5B5B5B", "#8A8A8A", "#C0C0C0", "#FFFFFF", "#7A1020",
    "#C21807", "#E8453C", "#FF7A00", "#F2A516", "#FFD400", "#9C6B1E",
    "#1A7F37", "#39B54A", "#8BC53F", "#0FA3A3", "#1F7A8C", "#1F6FEB",
    "#2D5BFF", "#5B8DEF", "#7A3FB3", "#B06AB3", "#E83E8C", "#F06292",
    "#6D4C41", "#A1887F", "#455A64", "#90A4AE", "#F5C6A5", "#FCE8D5"
  ];
  var PEN_LABEL = { ball: "Bút bi", brush: "Bút dạ", pencil: "Bút chì", fountain: "Bút máy", hl: "Bút dạ quang", laser: "Bút laser", laserp: "Con trỏ laser" };
  function buildPenPalette() {
    var g = $("pm-palette"); if (!g || g.childElementCount) return;
    PEN_PALETTE.forEach(function (c) {
      var b = document.createElement("button"); b.className = "pm-sw"; b.dataset.c = c; b.style.background = c; b.title = c;
      b.onclick = function (e) { e.stopPropagation(); setPenColor(c); };
      g.appendChild(b);
    });
  }
  function setPenColor(c) {
    state.color = c;
    document.querySelectorAll("[data-color]").forEach(function (x) { x.classList.toggle("sel", x.dataset.color === c); });
    syncPenMenu();
  }
  var SMOOTH_LABEL = ["Tắt", "Hơi mượt", "Mượt vừa", "Mượt", "Mượt nhất"];
  function syncPenMenu() {
    $("pm-penname") && ($("pm-penname").textContent = PEN_LABEL[state.pen] || "Bút");
    document.querySelectorAll("#pm-pentypes .pm-pt").forEach(function (b) { b.classList.toggle("sel", b.dataset.pm === state.pen); });
    document.querySelectorAll("#pm-palette .pm-sw").forEach(function (b) { b.classList.toggle("sel", (b.dataset.c || "").toLowerCase() === (state.color || "").toLowerCase()); });
    if ($("pm-thick")) $("pm-thick").value = state.size || 3;
    var sm = state.tidyInk ? (state.tidyStrength || 4) : 0;
    if ($("pm-smooth")) { $("pm-smooth").value = sm; $("pm-smooth-val").textContent = SMOOTH_LABEL[sm]; }
    if ($("pm-pressure")) $("pm-pressure").checked = state.pressure !== false;
  }
  function syncMenuChecks() {
    syncPenMenu();
    document.querySelectorAll("#eraser-menu [data-em]").forEach(function (b) {
      var on = state.tool === "eraser" && (state.eraserMode || "stroke") === b.dataset.em && (parseInt(b.dataset.esz, 10) || 0) === (state.eraseSize || 0);
      b.classList.toggle("chk", on);
    });
    document.querySelectorAll("#write-menu [data-wm]").forEach(function (b) { b.classList.toggle("chk", (state.writeMode || "both") === b.dataset.wm && (b.dataset.wm === "hand" ? !state.beautify : state.beautify)); });
    document.querySelectorAll("#laser-menu [data-ll]").forEach(function (b) { b.classList.toggle("chk", String(state.laserLife) === b.dataset.ll || (b.dataset.ll === "fade" && state.pen === "laserp" && !state.laserLife)); });
    document.querySelectorAll("#laser-dots .laser-dot").forEach(function (b) { b.classList.toggle("sel", b.dataset.lc === "pen" ? !!state.laserUsePen : (!state.laserUsePen && b.dataset.lc === state.laserColor)); });
    document.querySelectorAll("#fill-menu [data-fm]").forEach(function (b) { b.classList.toggle("chk", state.tool === "fill" && (state.fillMode || "area") === b.dataset.fm); });
  }
  buildPenPalette();
  // Mở các menu thả xuống
  [["btn-pen-dd", "pen-menu"], ["btn-eraser-dd", "eraser-menu"], ["btn-write-dd", "write-menu"], ["btn-laser-dd", "laser-menu"], ["btn-fill-dd", "fill-menu"], ["btn-select-dd", "select-menu"], ["btn-text-dd", "text-menu"]].forEach(function (pr) {
    var btn = $(pr[0]); if (!btn) return;
    btn.onclick = function (e) {
      e.stopPropagation(); var m = $(pr[1]), r = this.getBoundingClientRect();
      if (m.classList.contains("show")) { m.classList.remove("show"); return; }
      syncMenuChecks(); if (pr[1] === "fav-menu") buildFavMenu(); showMenuAt(m, Math.min(r.left, window.innerWidth - m.offsetWidth - 8), r.bottom + 4);
    };
  });
  // Chọn loại bút (hàng icon)
  document.querySelectorAll("#pm-pentypes .pm-pt").forEach(function (b) {
    b.onclick = function (e) { e.stopPropagation(); setPen(b.dataset.pm); if (b.dataset.pm === "hl") { var h = document.querySelector("[data-hl]"); if (h) state.color = h.dataset.hl; } toast("Bút: " + (PEN_LABEL[b.dataset.pm] || "")); syncPenMenu(); };
  });
  // Độ dày
  if ($("pm-thick")) $("pm-thick").oninput = function () {
    state.size = parseInt(this.value, 10) || 3;
    document.querySelectorAll("[data-sizedot]").forEach(function (x) { x.classList.toggle("sel", parseInt(x.dataset.sizedot, 10) === state.size); });
  };
  // Độ mượt nét (0 = tắt nắn; 1..4 mức nắn)
  if ($("pm-smooth")) $("pm-smooth").oninput = function () {
    var v = parseInt(this.value, 10) || 0;
    state.tidyInk = v > 0; if (v > 0) state.tidyStrength = v;
    $("pm-smooth-val").textContent = SMOOTH_LABEL[v];
    if (typeof saveSettings === "function") saveSettings();
  };
  // Lực nhấn bút
  if ($("pm-pressure")) $("pm-pressure").onchange = function () { state.pressure = this.checked; if (typeof saveSettings === "function") saveSettings(); };
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
      if (b.dataset.em) { state.eraseSize = parseInt(b.dataset.esz, 10) || 0; setEraser(b.dataset.em); toast("Tẩy: " + b.textContent.replace(/\s*[A-Z]$/, "").trim()); }
    };
  });
  // ===== Chế độ viết (CHẾ ĐỘ VIẾT) =====
  document.querySelectorAll("#write-menu [data-wm]").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation(); $("write-menu").classList.remove("show");
      var wm = b.dataset.wm; state.writeMode = wm;
      state.beautify = (wm !== "hand");
      var bt = $("beautify"); if (bt) bt.classList.toggle("on", state.beautify);
      var notes = { hand: "Nét giữ nguyên như bạn viết.", line: "Tự nắn các nét thành đường thẳng.", shape: "Tự nhận hình (tròn, tam giác, chữ nhật…).", both: "Nắn cả hình và đường thẳng." };
      if ($("wm-note")) $("wm-note").textContent = notes[wm] || "";
      if (typeof saveSettings === "function") saveSettings();
      toast("Chế độ viết: " + b.textContent.trim());
    };
  });
  // Nút ✨ bấm nhanh: bật/tắt làm đẹp (giữ tay <-> thành hình)
  // ===== Bút laser =====
  var LASER_COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#00C7BE", "#0A84FF", "#AF52DE", "#FF2D55"];
  (function buildLaserDots() {
    var g = $("laser-dots"); if (!g) return;
    var first = document.createElement("button"); first.className = "laser-dot pen-tint"; first.dataset.lc = "pen"; first.title = "Theo màu bút";
    first.onclick = function (e) { e.stopPropagation(); state.laserUsePen = true; syncMenuChecks(); }; g.appendChild(first);
    LASER_COLORS.forEach(function (c) {
      var d = document.createElement("button"); d.className = "laser-dot"; d.dataset.lc = c; d.style.background = c; d.style.color = c;
      d.onclick = function (e) { e.stopPropagation(); state.laserUsePen = false; state.laserColor = c; syncMenuChecks(); }; g.appendChild(d);
    });
  })();
  if ($("btn-laser")) $("btn-laser").onclick = function () { setPen(state.laserLife ? "laserp" : "laser"); this.classList.add("active"); toast("Bút laser phát sáng."); };
  document.querySelectorAll("#laser-menu [data-ll]").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation(); $("laser-menu").classList.remove("show");
      var v = b.dataset.ll;
      if (v === "0") { state.laserLife = 0; setPen("laser"); }
      else if (v === "fade") { state.laserLife = 0; setPen("laserp"); state.laserLife = 1200; }
      else { state.laserLife = parseInt(v, 10); setPen("laserp"); }
      if ($("btn-laser")) $("btn-laser").classList.add("active");
      toast("Laser: " + b.textContent.trim());
    };
  });
  if ($("laser-usepen")) $("laser-usepen").onchange = function () { state.laserUsePen = this.checked; syncMenuChecks(); };
  if ($("laser-glow")) $("laser-glow").oninput = function () { state.laserGlow = (parseInt(this.value, 10) || 100) / 100; $("laser-glow-val").textContent = this.value + "%"; };
  // ===== Tô màu miền =====
  document.querySelectorAll("#fill-menu [data-fm]").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation(); $("fill-menu").classList.remove("show");
      var fm = b.dataset.fm;
      if (fm === "clear") { state.tool = "fill"; state.fillMode = "clear"; state.fillAlpha = 0; if ($("fill-alpha")) { $("fill-alpha").value = 0; $("fill-alpha-val").textContent = "0%"; } }
      else { state.fillMode = fm; if (state.fillAlpha <= 0) state.fillAlpha = 0.35; }
      state.tool = "fill"; if (window.VPGeo) window.VPGeo.setTool(null); clearActive(); $("btn-fill").classList.add("active");
      toast(fm === "clear" ? "Chạm vào chỗ đã tô để bỏ màu." : "Tô màu: bấm vào trong hình kín.");
    };
  });
  if ($("fill-alpha")) $("fill-alpha").oninput = function () { state.fillAlpha = (parseInt(this.value, 10) || 0) / 100; $("fill-alpha-val").textContent = this.value + "%"; };
  // ===== Kiểu chọn / cắt =====
  document.querySelectorAll("#select-menu [data-sm]").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation(); $("select-menu").classList.remove("show");
      var sm = b.dataset.sm;
      if (sm === "space") { state.tool = "varregion"; } // chọn vùng rồi chèn khoảng trống (tạm map)
      state.selectMode = sm;
      if (sm !== "space") $("btn-select").click();
      if (sm === "lasso") toast("Khoanh vùng tự do để chọn.");
      else if (sm === "object") toast("Chạm từng đối tượng để chọn.");
      else if (sm === "cropR" || sm === "cropF") toast("Khoanh vùng trên ảnh để cắt.");
      else if (sm === "space") toast("Kéo dọc để chèn khoảng trống.");
      else toast("Chọn vùng chữ nhật.");
    };
  });
  // ===== Menu chữ T: chèn đường / mũi tên / ngoặc / bảng =====
  var TX_ITEMS = [
    ["text", "Gõ chữ (T)", '<path d="M6 7h12M12 7v11"/>'],
    ["line", "Đường thẳng", '<path d="M5 19L19 5"/>'],
    ["dash", "Nét đứt", '<path d="M5 19L19 5" stroke-dasharray="3 3"/>'],
    ["dot", "Gạch chấm", '<path d="M5 19L19 5" stroke-dasharray="1 4"/>'],
    ["arrow", "Mũi tên", '<path d="M6 18L18 6"/><path d="M11 6h7v7"/>'],
    ["darrow", "Mũi tên hai đầu", '<path d="M6 18L18 6"/><path d="M11 6h7v7"/><path d="M13 18H6v-7"/>'],
    ["elbow", "Đường gấp khúc", '<path d="M6 6v8h8"/>'],
    ["elbowA", "Mũi tên gấp khúc", '<path d="M6 6v8h7"/><path d="M11 11l4 3-4 3"/>'],
    ["elbow2", "Gấp khúc hai đầu", '<path d="M6 8l0 8 8 0"/><path d="M9 5l-3 3 3 3"/>'],
    ["curve", "Đường cong nối", '<path d="M5 18C5 10 19 14 19 6"/>'],
    ["curveA", "Mũi tên cong", '<path d="M5 18C5 10 17 14 18 7"/><path d="M14 7h5v5"/>'],
    ["curve2", "Cong hai đầu", '<path d="M5 17C8 9 16 9 19 17"/>'],
    ["arc", "Cung", '<path d="M5 16a9 9 0 0 1 14 0"/>'],
    ["brackets", "Cặp ngoặc vuông", '<path d="M9 5H6v14h3M15 5h3v14h-3"/>'],
    ["braces", "Cặp ngoặc nhọn", '<path d="M10 5c-2 0-2 3-3 3-1 0-1 0-1 4 0 0 0 4 1 4 1 0 1 3 3 3M14 5c2 0 2 3 3 3 1 0 1 0 1 4 0 0 0 4-1 4-1 0-1 3-3 3"/>'],
    ["bracketL", "Ngoặc vuông trái", '<path d="M14 5h-4v14h4"/>'],
    ["bracketR", "Ngoặc vuông phải", '<path d="M10 5h4v14h-4"/>'],
    ["braceL", "Ngoặc nhọn trái", '<path d="M14 5c-3 0-2 6-5 7 3 1 2 7 5 7"/>'],
    ["braceR", "Ngoặc nhọn phải", '<path d="M10 5c3 0 2 6 5 7-3 1-2 7-5 7"/>'],
    ["connector", "Mũi tên nối khung", '<rect x="4" y="13" width="6" height="6" rx="1"/><rect x="14" y="5" width="6" height="6" rx="1"/><path d="M10 15l4-4"/>'],
    ["callout", "Chú thích", '<path d="M5 15c0-6 14-6 14 0M5 15h4M15 15h4" /><path d="M14 10l5-4"/>']
  ];
  function buildTextMenu() {
    var g = $("tx-grid"); if (!g || g.childElementCount) return;
    TX_ITEMS.forEach(function (it) {
      var b = document.createElement("button"); b.className = "tx-cell"; b.dataset.tx = it[0];
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + it[2] + '</svg><span>' + it[1] + '</span>';
      b.onclick = function (e) { e.stopPropagation(); $("text-menu").classList.remove("show"); pickTextTool(it[0], it[1]); };
      g.appendChild(b);
    });
  }
  buildTextMenu();
  function pickTextTool(id, label) {
    if (id === "text") { insertTextBox(); return; }
    if (id === "line") { if (window.VPGeo) { window.VPGeo.setTool("line"); state.tool = "geo"; clearActive(); } toast("Vẽ đường thẳng."); return; }
    var arrowMap = { dash: "dash", dot: "dash", arrow: "arrow", darrow: "darrow", elbow: "arrow", elbowA: "arrow", elbow2: "darrow", curve: "arrow", curveA: "arrow", curve2: "darrow", connector: "arrow", callout: "arrow", brace: "brace" };
    if (id === "arc") { addShapeTemplate && addShapeTemplate("arc"); selectLast && selectLast(); return; }
    if (/^brack|^brace/.test(id)) { activateArrow("brace"); toast("Vẽ " + label.toLowerCase() + "."); return; }
    if (arrowMap[id]) { activateArrow(arrowMap[id]); toast("Vẽ " + label.toLowerCase() + "."); return; }
    toast(label + ": đang hoàn thiện.");
  }
  if ($("text-menu")) $("text-menu").querySelector(".tx-table") && ($("text-menu").querySelector(".tx-table").onclick = function (e) { e.stopPropagation(); $("text-menu").classList.remove("show"); if ($("btn-table")) $("btn-table").click(); });
  // ===== Dụng cụ: Cắt dụng cụ (R) =====
  document.querySelectorAll("#ruler-menu [data-ruler]").forEach(function (b) {
    if (b.dataset.ruler === "off") b.onclick = function () { $("ruler-menu").classList.remove("show"); if (window.VPRuler && window.VPRuler.hide) window.VPRuler.hide(); if ($("btn-ruler")) $("btn-ruler").classList.remove("active"); };
  });
  // ===== Ưa thích (khay công cụ hay dùng) =====
  var FAV_TOOLS = [
    { id: "stickers", ic: "★", lb: "Nhãn dán", run: function (e) { buildStickerMenu(); var r = $("btn-shapes-fav").getBoundingClientRect(); showMenuAt($("sticker-menu"), r.left, r.bottom + 4); } },
    { id: "math", ic: "√x", lb: "Công thức", run: function () { $("btn-math").click(); } },
    { id: "plot", ic: "📈", lb: "Đồ thị", run: function () { $("btn-plot").click(); } },
    { id: "var", ic: "▦", lb: "Bảng BT", run: function () { $("btn-var").click(); } },
    { id: "shapes", ic: "△", lb: "Hình 2D", run: function () { $("btn-shapes").click(); } },
    { id: "solid", ic: "△", lb: "Dựng hình động", run: function () { $("btn-solid").click(); } },
    { id: "oxyz", ic: "⊹", lb: "Oxyz", run: function () { $("btn-oxyz").click(); } },
    { id: "table", ic: "⊞", lb: "Bảng", run: function () { $("btn-table").click(); } },
    { id: "ruler", ic: "📐", lb: "Thước", run: function () { var r = $("btn-ruler").getBoundingClientRect(); showMenuAt($("ruler-menu"), r.left, r.bottom + 4); } },
    { id: "timer", ic: "⏱", lb: "Đồng hồ", run: function () { $("btn-timer").click(); } },
    { id: "picker", ic: "🎲", lb: "Lớp học", run: function () { $("btn-picker").click(); } },
    { id: "note", ic: "🗒", lb: "Giấy note", run: function () { $("btn-note").click(); } },
    { id: "textbox", ic: "⌯", lb: "Khung chữ", run: function () { $("btn-textbox").click(); } },
    { id: "web", ic: "🌐", lb: "Web", run: function () { $("btn-web").click(); } }
  ];
  function favGet() { try { return JSON.parse(localStorage.getItem("vpvie.favs") || "[]"); } catch (e) { return []; } }
  function favSet(a) { try { localStorage.setItem("vpvie.favs", JSON.stringify(a)); } catch (e) {} }
  var favEditing = false;
  function buildFavMenu() {
    var body = $("fav-body"); if (!body) return;
    var favs = favGet(); body.innerHTML = "";
    if (favEditing) {
      body.className = "fav-body";
      FAV_TOOLS.forEach(function (t) {
        var b = document.createElement("button"); b.className = "fav-item fav-pick" + (favs.indexOf(t.id) >= 0 ? " on" : "");
        b.innerHTML = t.ic + "<span>" + t.lb + "</span>";
        b.onclick = function (e) { e.stopPropagation(); var f = favGet(); var i = f.indexOf(t.id); if (i >= 0) f.splice(i, 1); else f.push(t.id); favSet(f); buildFavMenu(); };
        body.appendChild(b);
      });
      return;
    }
    if (!favs.length) {
      var p = document.createElement("div"); p.className = "fav-empty";
      p.textContent = "Chưa có công cụ nào. Bấm Sửa để chọn những thứ bạn hay dùng, từ mọi menu.";
      body.appendChild(p); return;
    }
    favs.forEach(function (id) {
      var t = FAV_TOOLS.filter(function (x) { return x.id === id; })[0]; if (!t) return;
      var b = document.createElement("button"); b.className = "fav-item"; b.innerHTML = t.ic + "<span>" + t.lb + "</span>";
      b.onclick = function (e) { e.stopPropagation(); $("fav-menu").classList.remove("show"); t.run(e); };
      body.appendChild(b);
    });
  }
  if ($("fav-edit")) $("fav-edit").onclick = function (e) { e.stopPropagation(); favEditing = !favEditing; this.textContent = favEditing ? "✓ Xong" : "✎ Sửa"; buildFavMenu(); };
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
  if ($("btn-picker")) $("btn-picker").onclick = function (e) { var r = this.getBoundingClientRect(); showMenuAt($("class-menu"), r.left, r.bottom + 4); e.stopPropagation(); };
  var classIns = { picker: insertPicker, wheel: insertWheel, groups: insertGroups, attend: insertAttend, score: insertScore, timer: insertTimer };
  document.querySelectorAll("#class-menu [data-class]").forEach(function (b) {
    b.onclick = function () { $("class-menu").classList.remove("show"); var fn = classIns[b.dataset.class]; if (fn) fn(160, 100); };
  });
  // ----- Trò chơi câu đố -----
  function insertQuizGame(x, y) {
    var nm = window.VPQuiz2.current(); if (!nm) { toast("Chưa có bộ câu đố. Hãy Soạn câu đố."); openQuizEditor(); return; }
    addOverlayData("quizgame", { title: nm, raw: window.VPQuiz2.getRaw(nm) }, x || 120, y || 90);
  }
  function insertCrossword(x, y) {
    var nm = window.VPQuiz2.current(); if (!nm) { toast("Chưa có bộ câu đố. Hãy Soạn câu đố."); openQuizEditor(); return; }
    addOverlayData("crossword", { title: nm, raw: window.VPQuiz2.getRaw(nm) }, x || 120, y || 90);
  }
  function refreshQuizPick() {
    var sel = $("qze-pick"); if (!sel) return; sel.innerHTML = "";
    var ns = window.VPQuiz2.names();
    if (!ns.length) { var o = document.createElement("option"); o.textContent = "(chưa có bộ nào)"; o.value = ""; sel.appendChild(o); }
    ns.forEach(function (nm) { var o = document.createElement("option"); o.value = nm; o.textContent = nm; if (nm === window.VPQuiz2.current()) o.selected = true; sel.appendChild(o); });
  }
  function loadQuizIntoEditor(nm) { $("qze-name").value = nm || ""; $("qze-raw").value = nm ? window.VPQuiz2.getRaw(nm) : ""; }
  function openQuizEditor() { refreshQuizPick(); loadQuizIntoEditor(window.VPQuiz2.current()); showDialog("dlg-quized"); }
  document.querySelectorAll("#class-menu [data-quiz]").forEach(function (b) {
    b.onclick = function () {
      $("class-menu").classList.remove("show");
      if (b.dataset.quiz === "play") insertQuizGame();
      else if (b.dataset.quiz === "cross") insertCrossword();
      else openQuizEditor();
    };
  });
  if ($("qze-pick")) $("qze-pick").onchange = function () { if (this.value) { window.VPQuiz2.select(this.value); loadQuizIntoEditor(this.value); } };
  if ($("qze-save")) $("qze-save").onclick = function () {
    var nm = $("qze-name").value.trim(); if (!nm) { toast("Hãy nhập tên bộ câu đố."); return; }
    var oldSel = $("qze-pick").value;
    if (oldSel && oldSel !== nm && window.VPQuiz2.names().indexOf(oldSel) >= 0) window.VPQuiz2.renameQuiz(oldSel, nm);
    window.VPQuiz2.setQuiz(nm, $("qze-raw").value); refreshQuizPick();
    var n = window.VPQuiz2.parse($("qze-raw").value).length; toast("Đã lưu bộ “" + nm + "” (" + n + " câu).");
  };
  if ($("qze-play")) $("qze-play").onclick = function () {
    var nm = $("qze-name").value.trim() || "Câu đố";
    window.VPQuiz2.setQuiz(nm, $("qze-raw").value); refreshQuizPick(); hideDialog("dlg-quized");
    addOverlayData("quizgame", { title: nm, raw: $("qze-raw").value }, 120, 90);
  };
  if ($("qze-del")) $("qze-del").onclick = function () {
    var nm = $("qze-pick").value; if (!nm) return;
    if (!confirm("Xóa bộ câu đố “" + nm + "”?")) return;
    window.VPQuiz2.del(nm); refreshQuizPick(); loadQuizIntoEditor(window.VPQuiz2.current());
  };
  if ($("qze-save-file")) $("qze-save-file").onclick = function () {
    var nm = $("qze-name").value.trim() || "cau-do", content = $("qze-raw").value;
    var fname = nm.replace(/[\\/:*?"<>|]/g, "_") + ".txt";
    if (window.VPDesktop && window.VPDesktop.isApp && folders.books) { window.VPDesktop.saveFile(folders.books, fname, content, false).then(function (r) { toast(r.ok ? "Đã lưu: " + r.path : "Lỗi lưu."); }); return; }
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; a.click(); toast("Đã lưu file " + fname);
  };
  if ($("qze-open")) $("qze-open").onclick = function () {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".txt,text/plain";
    inp.onchange = function () { var f = inp.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { $("qze-name").value = f.name.replace(/\.txt$/i, ""); $("qze-raw").value = String(rd.result || ""); }; rd.readAsText(f); };
    inp.click();
  };

  // ----- Quản lý nhiều lớp (chọn lớp đang dạy; lưu/mở theo file) -----
  function renderClassSwitch() {
    var box = $("class-switch"); if (!box || !window.VPClass) return;
    box.innerHTML = "";
    var cur = window.VPClass.currentClass();
    window.VPClass.classNames().forEach(function (nm) {
      var b = document.createElement("button"); b.className = "cls-chip" + (nm === cur ? " on" : "");
      var n = window.VPClass.getClass(nm).split("\n").map(function (s) { return s.trim(); }).filter(Boolean).length;
      b.innerHTML = '<span class="cls-nm"></span><span class="cls-n">' + n + '</span>';
      b.querySelector(".cls-nm").textContent = nm;
      b.onclick = function () { window.VPClass.selectClass(nm); };
      box.appendChild(b);
    });
  }
  if (window.VPClass) window.VPClass.onChange(function () { renderClassSwitch(); renderOverlays(); setClassTitle(); });
  function setClassTitle() { var btn = $("btn-picker"); if (btn && window.VPClass) btn.title = "Lớp học: " + window.VPClass.currentClass(); }
  // mở menu lớp -> dựng lại danh sách lớp
  (function () { var orig = $("btn-picker"); if (orig) { var prev = orig.onclick; orig.onclick = function (e) { renderClassSwitch(); if (prev) prev.call(this, e); }; } })();
  if ($("cls-new")) $("cls-new").onclick = function () { $("class-menu").classList.remove("show"); clsEditing = null; $("cls-name").value = ""; $("cls-list").value = ""; showDialog("dlg-class"); $("cls-name").focus(); };
  if ($("cls-edit")) $("cls-edit").onclick = function () { $("class-menu").classList.remove("show"); clsEditing = window.VPClass.currentClass(); $("cls-name").value = clsEditing; $("cls-list").value = window.VPClass.getClass(clsEditing); showDialog("dlg-class"); };
  var clsEditing = null;
  if ($("cls-save-dlg")) $("cls-save-dlg").onclick = function () {
    var nm = $("cls-name").value.trim(), content = $("cls-list").value;
    if (!nm) { toast("Hãy nhập tên lớp."); return; }
    if (clsEditing && clsEditing !== nm) window.VPClass.renameClass(clsEditing, nm);
    window.VPClass.addClass(nm, content); // addClass đặt làm lớp hiện tại + lưu
    clsEditing = null; hideDialog("dlg-class"); toast("Đã lưu lớp “" + nm + "”.");
  };
  if ($("cls-del")) $("cls-del").onclick = function () {
    var nm = window.VPClass.currentClass();
    if (!confirm("Xóa lớp “" + nm + "”? (danh sách học sinh của lớp này sẽ mất)")) return;
    window.VPClass.deleteClass(nm); $("class-menu").classList.remove("show");
  };
  if ($("cls-save")) $("cls-save").onclick = function () {
    $("class-menu").classList.remove("show");
    var nm = window.VPClass.currentClass(), content = window.VPClass.getClass(nm);
    var fname = nm.replace(/[\\/:*?"<>|]/g, "_") + ".txt";
    if (window.VPDesktop && window.VPDesktop.isApp && folders.books) {
      window.VPDesktop.saveFile(folders.books, fname, content, false).then(function (r) { toast(r.ok ? "Đã lưu lớp: " + r.path : "Lỗi lưu."); });
      return;
    }
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; a.click();
    toast("Đã lưu lớp ra file " + fname);
  };
  if ($("cls-open")) $("cls-open").onclick = function () {
    $("class-menu").classList.remove("show");
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".txt,text/plain";
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var nm = f.name.replace(/\.txt$/i, "").trim() || "Lớp mới";
        window.VPClass.addClass(nm, String(rd.result || ""));
        toast("Đã mở lớp “" + nm + "”.");
      };
      rd.readAsText(f);
    };
    inp.click();
  };
  setClassTitle();
  // ===== Bảng biến thiên: kéo chọn vùng -> bảng điền =====
  var varRegion = null, varGrid = null;
  $("btn-var").onclick = function () { state.tool = "varregion"; if (window.VPGeo) window.VPGeo.setTool(null); clearActive(); this.classList.add("active"); toast("Kéo chuột để chọn vùng đặt bảng biến thiên."); };
  function openVarDialog(region) {
    varRegion = region; varGrid = null; showDialog("dlg-var");
    $("var-grid").innerHTML = ""; $("var-preview").innerHTML = ""; $("var-input").value = $("var-input").value || "x^3 - 3x"; $("var-input").focus(); $("var-input").select();
  }
  if ($("var-sqrt")) $("var-sqrt").onclick = function () { var inp = $("var-input"); inp.value += "sqrt()"; inp.focus(); inp.selectionStart = inp.selectionEnd = inp.value.length - 1; };
  function renderVarPreview() {
    if (!varGrid) return;
    try { window.VPVar.buildFromGrid($("var-preview"), { grid: varGrid }); } catch (e) { $("var-preview").textContent = "Không vẽ được bảng."; }
  }
  var YP_OPTS = [["", "Trống"], ["0", "0"], ["‖", "Không xác định"]];
  var SIGN_OPTS = [["+", "+"], ["−", "−"], ["‖", "‖"]];
  var YTYPE_OPTS = [["value", "Có giá trị"], ["undef", "Không xác định"], ["bar", "Gạch bỏ ‖"]];
  function sel(opts, val, cb) { var s = document.createElement("select"); opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; if (o[0] === val) op.selected = true; s.appendChild(op); }); s.onchange = cb; return s; }
  function inp(val, cb) { var i = document.createElement("input"); i.value = val || ""; i.oninput = cb; return i; }
  function buildVarGrid() {
    var host = $("var-grid"); host.innerHTML = ""; if (!varGrid) return;
    var moc = varGrid.moc, signs = varGrid.signs, bbt = varGrid.mode === "bbt";
    var tbl = document.createElement("table");
    function td(cls, el) { var c = document.createElement("td"); if (cls) c.className = cls; if (el) c.appendChild(el); return c; }
    // x
    var rx = document.createElement("tr"); rx.appendChild(td("lbl", document.createTextNode("x")));
    moc.forEach(function (m, i) { rx.appendChild(td("mcell", inp(m.x, function (e) { m.x = e.target.value; renderVarPreview(); }))); if (i < moc.length - 1) rx.appendChild(td("gapcol")); });
    tbl.appendChild(rx);
    // y'
    var ry = document.createElement("tr"); ry.appendChild(td("lbl", document.createTextNode("y′")));
    moc.forEach(function (m, i) {
      ry.appendChild(td("", sel(YP_OPTS, m.yp, function (e) { m.yp = e.target.value; renderVarPreview(); })));
      if (i < signs.length) ry.appendChild(td("gapcol", sel(SIGN_OPTS, signs[i], function (e) { signs[i] = e.target.value; renderVarPreview(); })));
    });
    tbl.appendChild(ry);
    // y
    if (bbt) {
      var ryy = document.createElement("tr"); ryy.appendChild(td("lbl", document.createTextNode("y")));
      moc.forEach(function (m, i) {
        var wrap = document.createElement("div");
        wrap.appendChild(inp(m.y, function (e) { m.y = e.target.value; renderVarPreview(); }));
        wrap.appendChild(sel(YTYPE_OPTS, m.ytype, function (e) { m.ytype = e.target.value; renderVarPreview(); }));
        ryy.appendChild(td("mcell", wrap));
        if (i < signs.length) ryy.appendChild(td("gapcol"));
      });
      tbl.appendChild(ryy);
    }
    host.appendChild(tbl);
  }
  if ($("var-make")) $("var-make").onclick = function () {
    var expr = $("var-input").value.trim(); if (!expr) { toast("Hãy nhập hàm số."); return; }
    var mode = $("var-signonly") && $("var-signonly").checked ? "xetdau" : "bbt";
    try { varGrid = window.VPVar.gridFromExpr(expr, -20, 20, mode); }
    catch (e) { toast("Không phân tích được hàm số."); return; }
    buildVarGrid(); renderVarPreview();
  };
  if ($("var-signonly")) $("var-signonly").onchange = function () { if ($("var-input").value.trim()) $("var-make").click(); };
  $("var-ok").onclick = function () {
    if (!varGrid) { if ($("var-input").value.trim()) { $("var-make").click(); } if (!varGrid) { toast("Hãy bấm Lập bảng trước."); return; } }
    var r = varRegion || { x: 90, y: 90, w: 520, h: 180 };
    if (editOv && editOv.kind === "var") { editOv.data.grid = varGrid; editOv.data.w = r.w; editOv.data.h = r.h; reRenderOverlay(editOv); editOv = null; hideDialog("dlg-var"); varRegion = null; state.tool = "pen"; clearActive(); return; }
    addOverlayData("var", { grid: varGrid, w: r.w, h: r.h }, r.x, r.y);
    hideDialog("dlg-var"); varRegion = null; state.tool = "pen"; clearActive();
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
  var pendingTextFx = null;   // khi mở bảng công thức từ khung chữ (nút √x)
  function openTextFormula(ed, data) {
    var range = null;
    try { var sel = window.getSelection(); if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange(); } catch (e) {}
    pendingTextFx = { ed: ed, data: data, range: range };
    showDialog("dlg-math"); buildFormulaUI();
    var mi = $("math-input"); if (mi) { mi.value = ""; mi.focus(); }
    if (window.VPFormula) window.VPFormula.render($("math-preview"), "");
  }
  $("btn-math").onclick = function () { pendingTextFx = null; showDialog("dlg-math"); buildFormulaUI(); $("math-input").focus(); };
  $("math-ok").onclick = function () {
    var st = window.VPFormula.state, latex = $("math-input").value;
    if (editOv && editOv.kind === "math") {
      editOv.data.latex = latex; editOv.data.color = st.color; editOv.data.size = st.size; editOv.data.display = st.display; editOv.data.mode = st.mode;
      reRenderOverlay(editOv); editOv = null; $("math-input").value = ""; window.VPFormula.render($("math-preview"), ""); hideDialog("dlg-math"); return;
    }
    if (pendingTextFx) {
      var tgt = pendingTextFx; pendingTextFx = null;
      if (latex) {
        var span = document.createElement("span"); span.contentEditable = "false"; span.className = "rt-fx-inline"; span.setAttribute("data-latex", latex);
        try { window.VPMathPlot.renderMath(span, latex, false); } catch (e) { span.textContent = latex; }
        if (st.color) span.style.color = st.color;
        tgt.ed.focus();
        var sel = window.getSelection();
        if (tgt.range) { try { sel.removeAllRanges(); sel.addRange(tgt.range); } catch (e) {} }
        if (sel && sel.rangeCount && tgt.ed.contains(sel.anchorNode)) { var rg = sel.getRangeAt(0); rg.deleteContents(); rg.insertNode(span); var sp = document.createTextNode("​"); rg.setStartAfter(span); rg.insertNode(sp); rg.setStartAfter(sp); rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg); }
        else tgt.ed.appendChild(span);
        tgt.data.html = tgt.ed.innerHTML; scheduleSave();
      }
      $("math-input").value = ""; window.VPFormula.render($("math-preview"), ""); hideDialog("dlg-math"); return;
    }
    insertMath(latex, 90, 90, { color: st.color, size: st.size, display: st.display, mode: st.mode });
    $("math-input").value = ""; window.VPFormula.render($("math-preview"), ""); hideDialog("dlg-math");
  };

  // Hộp thoại đồ thị
  // Đồ thị: kéo chọn vùng trước, rồi hiện bảng điền hàm số
  $("btn-plot").onclick = function () { state.tool = "plotregion"; if (window.VPGeo) window.VPGeo.setTool(null); clearActive(); this.classList.add("active"); toast("Kéo chuột để chọn vùng chứa đồ thị."); };
  var plotRegion = null, plotAutoFit = true, plotView = null, plotActiveFn = 0;
  var plotFuncs = [{ expr: "x^2 - 2", color: "#C21807", dash: false }];
  var PLOT_COLORS = ["#C21807", "#1F6FEB", "#1A7F37", "#7A3FB3", "#E3A008", "#0E7490"];
  function buildFuncRows() {
    var host = $("plot-funcs"); if (!host) return; host.innerHTML = "";
    plotFuncs.forEach(function (f, i) {
      var row = document.createElement("div"); row.className = "plot-func";
      var col = document.createElement("input"); col.type = "color"; col.className = "pf-color"; col.value = f.color;
      col.oninput = function () { f.color = col.value; schedulePreview(); };
      var ys = document.createElement("span"); ys.className = "pf-ys"; ys.textContent = "y =";
      var ex = document.createElement("input"); ex.className = "pf-expr"; ex.value = f.expr; ex.placeholder = "x^2 - 2";
      ex.onfocus = function () { plotActiveFn = i; };
      ex.oninput = function () { f.expr = ex.value; schedulePreview(); };
      ex.onkeydown = function (e) { if (e.key === "Enter") $("plot-ok").click(); };
      var sq = document.createElement("button"); sq.className = "pf-btn pf-sqrt"; sq.innerHTML = "√x"; sq.title = "Chèn căn bậc hai";
      sq.onclick = function () { var p = ex.selectionStart || ex.value.length; ex.value = ex.value.slice(0, p) + "sqrt()" + ex.value.slice(p); f.expr = ex.value; ex.focus(); ex.selectionStart = ex.selectionEnd = p + 5; schedulePreview(); };
      var lim = document.createElement("button"); lim.className = "pf-btn" + (f.xmin != null || f.xmax != null ? " on" : ""); lim.textContent = "Giới hạn"; lim.title = "Giới hạn miền x";
      lim.onclick = function () { var s = prompt("Giới hạn x (vd: -3 ; 3). Để trống = toàn trục:", (f.xmin != null ? f.xmin : "") + " ; " + (f.xmax != null ? f.xmax : "")); if (s === null) return; var m = s.split(";"); var a = parseFloat(m[0]), b = parseFloat(m[1]); f.xmin = isNaN(a) ? null : a; f.xmax = isNaN(b) ? null : b; lim.classList.toggle("on", f.xmin != null || f.xmax != null); schedulePreview(); };
      var ls = document.createElement("button"); ls.className = "pf-btn" + (f.dash ? " on" : ""); ls.innerHTML = "╱"; ls.title = "Kiểu nét (liền/đứt)";
      ls.onclick = function () { f.dash = !f.dash; ls.classList.toggle("on", f.dash); schedulePreview(); };
      var del = document.createElement("button"); del.className = "pf-btn"; del.textContent = "✕"; del.title = "Xoá hàm";
      del.onclick = function () { if (plotFuncs.length > 1) { plotFuncs.splice(i, 1); buildFuncRows(); schedulePreview(); } };
      [col, ys, ex, sq, lim, ls, del].forEach(function (el) { row.appendChild(el); });
      host.appendChild(row);
    });
  }
  function schedulePreview() { clearTimeout(window._pvT); window._pvT = setTimeout(renderPlotPreview, 220); }
  function plotOpts(w, h) {
    var o = { w: w, h: h, funcs: plotFuncs.filter(function (f) { return (f.expr || "").trim(); }), autoY: plotAutoFit, points: plotPoints };
    if (plotView) { o.autoY = false; o.xmin = plotView.xmin; o.xmax = plotView.xmax; o.ymin = plotView.ymin; o.ymax = plotView.ymax; }
    return o;
  }
  function renderPlotPreview() {
    var pv = $("plot-preview"); if (!pv || !window.VPGrapher) return;
    var fs = plotFuncs.filter(function (f) { return (f.expr || "").trim(); });
    try { window.VPGrapher.draw(pv, (fs[0] && fs[0].expr) || "x^2", plotOpts(pv.clientWidth || 340, pv.clientHeight || 298)); }
    catch (e) { pv.textContent = "Không vẽ được — kiểm tra lại hàm."; }
  }
  var plotPoints = [];
  function openPlotDialog(region) {
    plotRegion = region; plotPoints = []; plotView = null; showDialog("dlg-plot");
    buildFuncRows(); renderPlotPreview();
    var first = document.querySelector("#plot-funcs .pf-expr"); if (first) { first.focus(); first.select(); }
  }
  if ($("plot-add")) $("plot-add").onclick = function () { plotFuncs.push({ expr: "", color: PLOT_COLORS[plotFuncs.length % PLOT_COLORS.length], dash: false }); buildFuncRows(); var rows = document.querySelectorAll("#plot-funcs .pf-expr"); if (rows.length) rows[rows.length - 1].focus(); };
  if ($("plot-autofit-btn")) $("plot-autofit-btn").onclick = function () { plotAutoFit = true; plotView = null; this.classList.add("on"); renderPlotPreview(); toast("Đã tự căn khung nhìn."); };
  if ($("plot-help-btn")) $("plot-help-btn").onclick = function () { var h = $("plot-help"); h.hidden = !h.hidden; this.textContent = (h.hidden ? "▸" : "▾") + " Cách gõ hàm số"; };
  // Hàng nút công cụ đồ thị
  document.querySelectorAll("#dlg-plot .plot-tbtn").forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.pt;
      if (k === "view") {
        var s = prompt("Khung nhìn: x_min ; x_max ; y_min ; y_max", (plotView ? [plotView.xmin, plotView.xmax, plotView.ymin, plotView.ymax].join(" ; ") : "-10 ; 10 ; -8 ; 8"));
        if (s === null) return; var m = s.split(";").map(function (t) { return parseFloat(t); });
        if (m.length >= 4 && m.every(function (v) { return !isNaN(v); })) { plotView = { xmin: m[0], xmax: m[1], ymin: m[2], ymax: m[3] }; plotAutoFit = false; if ($("plot-autofit-btn")) $("plot-autofit-btn").classList.remove("on"); renderPlotPreview(); } else toast("Nhập 4 số, ngăn bằng dấu ;");
      } else if (k === "region") toast("Miền nghiệm: gõ bất phương trình, vd  y < x^2 - 2  hoặc hệ  y>=x ; y<=-x+4");
      else if (k === "point") { b.classList.toggle("on"); plotMarkMode = b.classList.contains("on"); toast(plotMarkMode ? "Bấm vào hình để đánh dấu điểm." : "Tắt đánh dấu điểm."); }
      else toast("Công cụ \"" + b.textContent.trim() + "\" đang được hoàn thiện.");
    };
  });
  // Đánh dấu điểm khi bấm vào ô xem trước
  var plotMarkMode = false;
  if ($("plot-preview")) $("plot-preview").addEventListener("click", function (e) {
    if (!plotMarkMode || !window.VPGrapher || !window.VPGrapher.pxToData) return;
    var cv = $("plot-preview").querySelector("canvas"); if (!cv) return;
    var r = cv.getBoundingClientRect(); var d = window.VPGrapher.pxToData(e.clientX - r.left, e.clientY - r.top);
    if (d) { plotPoints.push(d); renderPlotPreview(); }
  });
  $("plot-ok").onclick = function () {
    var fs = plotFuncs.filter(function (f) { return (f.expr || "").trim(); });
    if (!fs.length) { toast("Hãy nhập ít nhất một hàm số."); return; }
    var r = plotRegion || { x: 90, y: 90, w: 380, h: 300 };
    var data = { funcs: fs.map(function (f) { return { expr: f.expr, color: f.color, dash: f.dash, xmin: f.xmin, xmax: f.xmax }; }), expr: fs[0].expr, w: r.w, h: r.h, autoY: plotAutoFit, points: plotPoints.slice() };
    if (plotView) { data.view = plotView; }
    if (editOv && editOv.kind === "plot") { editOv.data = Object.assign(editOv.data, data); reRenderOverlay(editOv); editOv = null; hideDialog("dlg-plot"); plotRegion = null; state.tool = "pen"; clearActive(); return; }
    addOverlayData("plot", data, r.x, r.y);
    hideDialog("dlg-plot"); plotRegion = null; state.tool = "pen"; clearActive();
  };

  // Mẫu hình học
  // Vẽ hình mẫu nhỏ cho từng nút hình 2D (dùng chính bộ dựng hình)
  function drawItemsThumb(cv, items) {
    var g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
    var xs = [], ys = [];
    items.forEach(function (it) {
      if (it.pts) it.pts.forEach(function (p) { xs.push(p.x); ys.push(p.y); });
      else if (it.type === "line") { xs.push(it.x1, it.x2); ys.push(it.y1, it.y2); }
      else if (it.type === "rect") { xs.push(it.x, it.x + it.w); ys.push(it.y, it.y + it.h); }
      else if (it.type === "circle") { xs.push(it.cx - it.r, it.cx + it.r); ys.push(it.cy - it.r, it.cy + it.r); }
      else if (it.type === "ellipse") { xs.push(it.cx - it.rx, it.cx + it.rx); ys.push(it.cy - it.ry, it.cy + it.ry); }
    });
    if (!xs.length) return;
    var mnx = Math.min.apply(0, xs), mxx = Math.max.apply(0, xs), mny = Math.min.apply(0, ys), mxy = Math.max.apply(0, ys);
    var pad = 7, sc = Math.min((cv.width - pad * 2) / (mxx - mnx || 1), (cv.height - pad * 2) / (mxy - mny || 1));
    g.save(); g.translate(cv.width / 2, cv.height / 2); g.scale(sc, sc); g.translate(-(mnx + mxx) / 2, -(mny + mxy) / 2);
    g.strokeStyle = "#1d2a33"; g.lineWidth = 1.5 / sc; g.lineJoin = g.lineCap = "round";
    items.forEach(function (it) {
      g.beginPath();
      if (it.type === "triangle" || it.type === "poly") { it.pts.forEach(function (p, i) { i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); }
      else if (it.type === "path") { it.pts.forEach(function (p, i) { i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); }
      else if (it.type === "line") { g.moveTo(it.x1, it.y1); g.lineTo(it.x2, it.y2); }
      else if (it.type === "rect") g.rect(it.x, it.y, it.w, it.h);
      else if (it.type === "circle") g.arc(it.cx, it.cy, it.r, 0, 6.2832);
      else if (it.type === "ellipse") g.ellipse(it.cx, it.cy, it.rx, it.ry, 0, 0, 6.2832);
      g.stroke();
    });
    g.restore();
  }
  var shape2dThumbsDone = false;
  function renderShape2DThumbs() {
    if (shape2dThumbsDone) return;
    document.querySelectorAll("#dlg-shapes [data-shape]").forEach(function (b) {
      var cv = b.querySelector("canvas.shape-thumb"); if (cv) try { drawItemsThumb(cv, makeShapeItems(b.dataset.shape, 0, 0, 30)); } catch (e) {}
    });
    shape2dThumbsDone = true;
  }
  // ===== Bảng gộp: Đường + Hình phẳng + Hình không gian + tuỳ chọn =====
  function drawLineThumb(cv, kind) {
    var g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
    g.strokeStyle = "#1d2a33"; g.fillStyle = "#1d2a33"; g.lineWidth = 1.6; g.lineCap = "round";
    var y = cv.height / 2, x1 = 5, x2 = cv.width - 5;
    g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke();
    if (kind === "vector" || kind === "ray") { g.beginPath(); g.moveTo(x2, y); g.lineTo(x2 - 6, y - 4); g.lineTo(x2 - 6, y + 4); g.closePath(); g.fill(); }
    if (kind === "line") { g.beginPath(); g.moveTo(x1, y); g.lineTo(x1 + 4, y - 3); g.moveTo(x1, y); g.lineTo(x1 + 4, y + 3); g.stroke(); }  // 2 đầu kéo dài
  }
  var SHAPES_2D = [
    ["triangle", "Tam giác", "3"], ["right-tri", "Tam giác vuông"], ["iso-tri", "Tam giác cân"], ["triangle-eq", "Tam giác đều"], ["alt-tri", "Tam giác có đường cao"], ["square", "Hình vuông", "Q"],
    ["rect", "Hình chữ nhật", "4"], ["para", "Hình bình hành"], ["rhombus", "Hình thoi"], ["trapezoid", "Hình thang"], ["__poly__", "Đa giác đều"], ["circle", "Đường tròn", "C"], ["arc", "Cung tròn"], ["semicircle", "Nửa đường tròn"], ["sector", "Hình quạt"], ["ellipse", "Elip"], ["hyperbola", "Hypebol"], ["parabola", "Parabol"], ["annulus", "Hình vành khăn"]
  ];
  var SHAPES_3D = [
    ["chop-para", "Hình chóp đáy hình bình hành"], ["chop-para-sa", "Chóp đáy bình hành, SA⊥đáy"], ["chop4", "Hình chóp đáy tứ giác"], ["chop-thang", "Hình chóp đáy hình thang"], ["chop3", "Hình chóp tam giác"], ["chop3-sa", "Chóp tam giác, SA⊥đáy"], ["hop", "Hình hộp"], ["lapphuong", "Hình lập phương"], ["langtru", "Lăng trụ tam giác"], ["non", "Hình nón"], ["tru", "Hình trụ"], ["cau", "Mặt cầu"], ["batdien", "Bát diện đều"],
    ["langtru-xien", "Lăng trụ xiên"], ["langtru-para", "Lăng trụ xiên đáy bình hành"],
    ["chop-cut", "Hình chóp cụt"], ["non-cut", "Hình nón cụt"], ["tru-cut", "Hình trụ cụt"],
    ["nem1", "Hình nêm (kiểu 1)"], ["nem2", "Hình nêm (kiểu 2)"], ["chom-cau", "Chỏm cầu"], ["plane", "Mặt phẳng"]
  ];
  var LINES = [["segment", "Đoạn thẳng", "L"], ["vector", "Vectơ", "V"], ["line", "Đường thẳng", "Shift+L"], ["ray", "Tia"]];
  function smItem(cls) { var b = document.createElement("button"); b.className = "sm-item" + (cls ? " " + cls : ""); return b; }
  function smThumb() { var c = document.createElement("canvas"); c.width = 60; c.height = 48; return c; }
  function closeShapesMenu() { var m = $("shapes-menu"); if (m) m.classList.remove("show"); }
  function insertSolid(kind) { pushHist(); state.items.push(window.VPSolid.make(kind, canvas.clientWidth / 2, canvas.clientHeight / 2, 100, state.color, state.size || 2)); selectLast(); }
  function insertPolygonN(n) { n = Math.max(3, Math.min(20, n || 5)); var cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2; pushHist(); var o = { type: "poly", pts: regPoly(cx, cy, 90, n, -Math.PI / 2), color: state.color, size: state.size }; state.items.push(o); selectLast(); }
  var shapesMenuBuilt = false;
  function buildShapesMenu() {
    if (shapesMenuBuilt) return; var host = $("shapes-menu"); if (!host) return;
    function col() { var d = document.createElement("div"); d.className = "sm-col"; return d; }
    function head(t) { var d = document.createElement("div"); d.className = "sm-h"; d.textContent = t; return d; }
    function shapeBtn(kind, name, key, is3d) {
      var b = smItem("sm-shape"); var cv = smThumb(); b.appendChild(cv);
      var sp = document.createElement("span"); sp.textContent = name; b.appendChild(sp);
      if (key) { var k = document.createElement("span"); k.className = "sm-key"; k.textContent = key; b.appendChild(k); }
      try { if (is3d) drawSolidThumb(cv, kind); else drawItemsThumb(cv, makeShapeItems(kind, 0, 0, 30)); } catch (e) {}
      b.onclick = function () { if (is3d) insertSolid(kind); else { addShapeTemplate(kind); selectLast(); } closeShapesMenu(); };
      return b;
    }
    var c1 = col(), c2 = col(), c3 = col();
    // Cột 1: tuỳ chọn + Đường + phần đầu Hình phẳng
    c1.appendChild(head("Hình vẽ"));
    [["showdots", "Hiện chấm tròn ở các điểm của hình"], ["snap", "Bắt điểm lưới"]].forEach(function (o) {
      var b = smItem("sm-opt"); var ck = document.createElement("span"); ck.className = "sm-ck"; ck.textContent = state.opt[o[0]] ? "✓" : "";
      b.appendChild(ck); var sp = document.createElement("span"); sp.textContent = o[1]; b.appendChild(sp);
      if (state.opt[o[0]]) b.classList.add("on");
      b.onclick = function () { state.opt[o[0]] = !state.opt[o[0]]; ck.textContent = state.opt[o[0]] ? "✓" : ""; b.classList.toggle("on", state.opt[o[0]]); saveSettings(); redraw(); };
      c1.appendChild(b);
    });
    c1.appendChild(head("Đường"));
    LINES.forEach(function (l) {
      var b = smItem("sm-line"); var cv = smThumb(); cv.width = 60; cv.height = 24; b.appendChild(cv);
      var sp = document.createElement("span"); sp.textContent = l[1]; b.appendChild(sp);
      if (l[2]) { var k = document.createElement("span"); k.className = "sm-key"; k.textContent = l[2]; b.appendChild(k); }
      try { drawLineThumb(cv, l[0]); } catch (e) {}
      b.onclick = function () {
        clearActive();
        if (l[0] === "vector") { state.tool = "arrow"; state.arrowStyle = "arrow"; if (window.VPGeo) window.VPGeo.setTool(null); toast("Vectơ: kéo để vẽ."); }
        else { state.tool = "geo"; if (window.VPGeo) window.VPGeo.setTool(l[0]); toast(l[1] + ": bấm 2 điểm."); }
        closeShapesMenu();
      };
      c1.appendChild(b);
    });
    c1.appendChild(head("Hình phẳng"));
    var split = 6;  // số hình 2D ở cột 1 (phần còn lại sang cột 2)
    SHAPES_2D.forEach(function (sh, i) {
      var target = i < split ? c1 : c2;
      if (sh[0] === "__poly__") {
        var b = smItem("sm-shape"); var cv = smThumb(); b.appendChild(cv);
        var sp = document.createElement("span"); sp.textContent = sh[1]; b.appendChild(sp);
        var inp = document.createElement("input"); inp.className = "sm-n"; inp.type = "number"; inp.value = 5; inp.min = 3; inp.max = 20;
        inp.onclick = function (e) { e.stopPropagation(); }; b.appendChild(inp);
        try { drawItemsThumb(cv, [{ type: "poly", pts: regPoly(0, 0, 26, 5, -Math.PI / 2) }]); } catch (e) {}
        b.onclick = function () { insertPolygonN(parseInt(inp.value, 10)); closeShapesMenu(); };
        target.appendChild(b);
      } else target.appendChild(shapeBtn(sh[0], sh[1], sh[2], false));
    });
    // Cột 3: Hình không gian
    c3.appendChild(head("Hình không gian"));
    var c4 = col(); c4.appendChild(head("Hình không gian (tiếp)"));
    SHAPES_3D.forEach(function (sh, index) { (index < 13 ? c3 : c4).appendChild(shapeBtn(sh[0], sh[1], null, true)); });
    host.appendChild(c1); host.appendChild(c2); host.appendChild(c3); host.appendChild(c4);
    shapesMenuBuilt = true;
  }
  if ($("btn-shapes")) $("btn-shapes").onclick = function (e) {
    e.stopPropagation(); buildShapesMenu();
    var m = $("shapes-menu"), r = this.getBoundingClientRect();
    document.querySelectorAll(".nr-menu.show").forEach(function (x) { if (x !== m) x.classList.remove("show"); });
    if (m.classList.contains("show")) { m.classList.remove("show"); return; }
    m.style.left = Math.max(6, Math.min(r.left, window.innerWidth - 840)) + "px"; m.style.top = (r.bottom + 4) + "px";
    m.classList.add("show");
  };
  // Vẽ hình mẫu nhỏ cho từng nút hình 3D (dùng chính VPSolid)
  function drawSolidThumb(cv, kind) {
    var g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
    var o = window.VPSolid.make(kind, 0, 0, 34, "#1d2a33", 1.4);
    // gom toạ độ để căn giữa & vừa khung
    var xs = [], ys = [];
    (o.segs || []).forEach(function (s) { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2); });
    (o.ellipses || []).forEach(function (e) { xs.push(e.cx - e.rx, e.cx + e.rx); ys.push(e.cy - e.ry, e.cy + e.ry); });
    if (!xs.length) return;
    var mnx = Math.min.apply(0, xs), mxx = Math.max.apply(0, xs), mny = Math.min.apply(0, ys), mxy = Math.max.apply(0, ys);
    var pad = 8, sc = Math.min((cv.width - pad * 2) / (mxx - mnx || 1), (cv.height - pad * 2) / (mxy - mny || 1));
    g.save(); g.translate(cv.width / 2, cv.height / 2); g.scale(sc, sc); g.translate(-(mnx + mxx) / 2, -(mny + mxy) / 2);
    g.strokeStyle = "#1d2a33"; g.lineWidth = 1.4 / sc; g.lineJoin = g.lineCap = "round";
    (o.segs || []).forEach(function (s) { g.setLineDash(s.dashed ? [4 / sc, 3 / sc] : []); g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke(); });
    (o.ellipses || []).forEach(function (e) { g.setLineDash(e.dashed ? [4 / sc, 3 / sc] : []); g.beginPath(); g.ellipse(e.cx, e.cy, e.rx, e.ry, e.rot || 0, e.a0 || 0, (e.a1 != null ? e.a1 : Math.PI * 2)); g.stroke(); });
    g.restore();
  }
  $("btn-solid").onclick = function (e) { e.stopPropagation(); openGeoMenu(this); };
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
  document.querySelectorAll("[data-shape]").forEach(function (b) {
    b.onclick = function () { addShapeTemplate(b.dataset.shape); hideDialog("dlg-shapes"); selectLast(); };
  });
  function regPoly(cx, cy, r, n, rot) { var a = []; for (var i = 0; i < n; i++) { var t = rot + i * 2 * Math.PI / n; a.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }); } return a; }
  // Dựng danh sách item cho một hình 2D (dùng chung: chèn + vẽ hình mẫu)
  function makeShapeItems(kind, cx, cy, s) {
    var P = function (x, y) { return { x: x, y: y }; }, out = [];
    function arcPts(r, a0, a1, ysc) { var p = []; ysc = ysc || 1; for (var a = a0; a <= a1 + 1e-6; a += 0.12) p.push(P(cx + r * Math.cos(a), cy - r * Math.sin(a) * ysc)); return p; }
    if (kind === "triangle") out.push({ type: "triangle", pts: [P(cx, cy - s), P(cx - s, cy + s), P(cx + s, cy + s)] });
    else if (kind === "triangle-eq") { var h = s * Math.sqrt(3); out.push({ type: "triangle", pts: [P(cx, cy - h / 2), P(cx - s, cy + h / 2), P(cx + s, cy + h / 2)] }); }
    else if (kind === "iso-tri") out.push({ type: "triangle", pts: [P(cx, cy - s), P(cx - s * 0.68, cy + s), P(cx + s * 0.68, cy + s)] });
    else if (kind === "right-tri") out.push({ type: "triangle", pts: [P(cx - s, cy - s), P(cx - s, cy + s), P(cx + s, cy + s)] });
    else if (kind === "alt-tri") {
      var A = P(cx - 0.25 * s, cy - s), B = P(cx - s, cy + s), C = P(cx + s, cy + s), Hh = P(A.x, cy + s);
      out.push({ type: "triangle", pts: [A, B, C] });
      out.push({ type: "line", x1: A.x, y1: A.y, x2: Hh.x, y2: Hh.y });
      out.push({ type: "path", pts: [P(Hh.x, Hh.y - 11), P(Hh.x + 11, Hh.y - 11), P(Hh.x + 11, Hh.y)] });
    }
    else if (kind === "square") out.push({ type: "rect", x: cx - s, y: cy - s, w: 2 * s, h: 2 * s });
    else if (kind === "rect") out.push({ type: "rect", x: cx - s, y: cy - s * 0.7, w: 2 * s, h: 1.4 * s });
    else if (kind === "para") out.push({ type: "poly", pts: [P(cx - s + 30, cy - s * 0.6), P(cx + s + 30, cy - s * 0.6), P(cx + s - 30, cy + s * 0.6), P(cx - s - 30, cy + s * 0.6)] });
    else if (kind === "rhombus") out.push({ type: "poly", pts: [P(cx, cy - s), P(cx + s * 0.7, cy), P(cx, cy + s), P(cx - s * 0.7, cy)] });
    else if (kind === "trapezoid") out.push({ type: "poly", pts: [P(cx - s * 0.55, cy - s * 0.6), P(cx + s * 0.55, cy - s * 0.6), P(cx + s, cy + s * 0.6), P(cx - s, cy + s * 0.6)] });
    else if (kind === "pentagon") out.push({ type: "poly", pts: regPoly(cx, cy, s, 5, -Math.PI / 2) });
    else if (kind === "hexagon") out.push({ type: "poly", pts: regPoly(cx, cy, s, 6, -Math.PI / 2) });
    else if (kind === "circle") out.push({ type: "circle", cx: cx, cy: cy, r: s });
    else if (kind === "ellipse") out.push({ type: "ellipse", cx: cx, cy: cy, rx: s * 1.3, ry: s * 0.75 });
    else if (kind === "arc") out.push({ type: "path", pts: arcPts(s, Math.PI * 0.18, Math.PI * 0.82) });
    else if (kind === "semicircle") { var p = arcPts(s, 0, Math.PI); p.push(P(cx - s, cy)); out.push({ type: "poly", pts: p }); }
    else if (kind === "sector") { var ps = arcPts(s, Math.PI * 0.18, Math.PI * 0.82); ps.unshift(P(cx, cy)); ps.push(P(cx, cy)); out.push({ type: "poly", pts: ps }); }
    else if (kind === "annulus") { out.push({ type: "circle", cx: cx, cy: cy, r: s }); out.push({ type: "circle", cx: cx, cy: cy, r: s * 0.55 }); }
    else if (kind === "parabola") { var pp = []; for (var x = -s * 1.4; x <= s * 1.4; x += 6) pp.push(P(cx + x, cy + s - (x * x) / (s * 1.0))); out.push({ type: "path", pts: pp }); }
    else if (kind === "hyperbola") {
      var l = [], r = []; for (var t = -1.3; t <= 1.3; t += 0.1) { var ch = Math.cosh(t) * s * 0.7, sh = Math.sinh(t) * s * 0.8; l.push(P(cx - ch, cy + sh)); r.push(P(cx + ch, cy + sh)); }
      out.push({ type: "path", pts: l }); out.push({ type: "path", pts: r });
    }
    else if (kind === "axes") { out.push({ type: "line", x1: cx - 180, y1: cy, x2: cx + 180, y2: cy }); out.push({ type: "line", x1: cx, y1: cy - 140, x2: cx, y2: cy + 140 }); }
    return out;
  }
  function addShapeTemplate(kind) {
    var cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2, c = state.color, w = state.size;
    var items = makeShapeItems(kind, cx, cy, 90);
    if (!items.length) return;
    pushHist();
    items.forEach(function (o) { o.color = c; o.size = w; state.items.push(o); });
    redraw();
  }

  // Nhận dạng (Tesseract miễn phí hoặc máy chủ Ollama/Claude). Kết quả công thức mở ra để sửa trước khi chèn.
  var aiRunning = false;
  $("btn-ai").onclick = async function () {
    var btn = this; var old = btn.textContent; var statusEl = $("ai-status");
    if (aiRunning) return; aiRunning = true;
    btn.disabled = true; btn.textContent = "Đang nhận dạng…";
    try {
      var engine = $("ai-engine").value, mode = $("ai-mode").value, data, src = cropForOCR();
      if (engine === "ink") {
        // Nhận dạng THEO NÉT (ngoại tuyến): dùng quỹ đạo các nét viết tay trên trang
        statusEl.textContent = "Đang nhận dạng theo nét…";
        var strokeItems = state.items.filter(function (it) { return it.type === "stroke" && it.pen !== "hl"; });
        if (!strokeItems.length) throw new Error("Chưa có nét viết tay để nhận dạng.");
        var ink = window.VPInk.recognizeItems(strokeItems, mode);
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
      if (!this._auto) toast(e.message || "Lỗi nhận dạng.");
    } finally { btn.disabled = false; btn.textContent = old; aiRunning = false; }
  };
  // ===== Tự nhận dạng ngay sau khi viết xong =====
  var autoRecogTimer = 0;
  if ($("ai-auto")) {
    try { state.autoRecognize = localStorage.getItem("vpvie.autoRecog") === "1"; $("ai-auto").checked = state.autoRecognize; } catch (e) {}
    $("ai-auto").onchange = function () {
      state.autoRecognize = this.checked;
      try { localStorage.setItem("vpvie.autoRecog", this.checked ? "1" : "0"); } catch (e) {}
      toast(this.checked ? "⚡ Tự nhận dạng: BẬT (viết xong, ngừng tay là tự nhận dạng)." : "Tự nhận dạng: TẮT.");
    };
  }
  function scheduleAutoRecognize() {
    if (!state.autoRecognize) return;
    if (autoRecogTimer) clearTimeout(autoRecogTimer);
    autoRecogTimer = setTimeout(function () {
      autoRecogTimer = 0;
      if (aiRunning) { scheduleAutoRecognize(); return; }               // đang bận → chờ thêm
      if (state.tool !== "pen" || state.drawing) return;                 // đang vẽ tiếp thì thôi
      if (!state.items.some(function (it) { return it.type === "stroke" && it.pen !== "hl"; })) return;
      var b = $("btn-ai"); if (!b || b.disabled) return;
      b._auto = true;                                                    // chạy im lặng, không báo lỗi ồn ào
      Promise.resolve(b.onclick.call(b)).catch(function () {}).then(function () { b._auto = false; });
    }, 1100);
  }

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
    function endPad() { if (!drawingPad) return; drawingPad = false; if (curStroke && curStroke.length > 1) strokes.push(curStroke); curStroke = null; redrawPad(); $("ink-label").focus(); }
    pad.addEventListener("pointerup", endPad); pad.addEventListener("pointercancel", endPad);
    function clearPad() { strokes = []; curStroke = null; redrawPad(); if ($("ink-guess")) $("ink-guess").innerHTML = ""; }
    function guess() {
      if (!strokes.length || !$("ink-guess")) return;
      var r = window.VPInk.recognizeSymbol(strokes);
      $("ink-guess").innerHTML = r.name ? ("AI đoán: <b>" + r.name + "</b> (" + r.score + "%)") : "";
    }
    function updCount() { if ($("ink-count")) $("ink-count").textContent = "Đã dạy " + window.VPInk.templates().length + " mẫu riêng."; }
    if ($("btn-ink-train")) $("btn-ink-train").onclick = function (e) { e.stopPropagation(); document.querySelectorAll(".nr-menu.show").forEach(function (m) { m.classList.remove("show"); }); clearPad(); updCount(); showDialog("dlg-ink"); $("ink-label").focus(); };
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
  if ($("btn-quiz")) $("btn-quiz").onclick = function () { showDialog("dlg-quized"); };
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
    hideDialog("dlg-quized");
  };

  // ----- Hộp thoại & toast
  function showDialog(id) { $(id).classList.add("show"); }
  function hideDialog(id) { $(id).classList.remove("show"); if (id === "dlg-math") pendingTextFx = null; if (id === "dlg-math" || id === "dlg-plot" || id === "dlg-var") editOv = null; }
  document.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = function () { hideDialog(b.dataset.close); }; });
  var toastEl = $("toast"), toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2600); }

  // Trạng thái AI
  fetch("api/health").then(function (r) { return r.json(); }).then(function (d) {
    if (d.ai) {
      // Có AI máy chủ mạnh (Ollama/pix2tex/Claude) -> ưu tiên engine "server" cho nhận dạng toán
      if ($("ai-engine")) $("ai-engine").value = "server";

    } else { $("ai-note").style.display = "inline"; }
  }).catch(function () {});

  // ----- Trang & sổ bài giảng (lưu/mở)
  var pages = [blankPage()], cur = 0, saveTimer = null;
  function blankPage() { return { items: [], geo: { points: [], shapes: [] }, overlays: [], bg: null, note: "" }; }
  function capture() { pages[cur] = { items: state.items, geo: { points: window.VPGeo.points, shapes: window.VPGeo.shapes }, overlays: state.overlays, bg: pages[cur] ? pages[cur].bg : null, thumb: pages[cur] ? pages[cur].thumb : null, note: pages[cur] ? pages[cur].note : "" }; }
  function restore() {
    var pg = pages[cur] || blankPage();
    state.items = pg.items; state.overlays = pg.overlays; state.pageBg = pg.bg || null; state.selected = []; resetHist();
    window.VPGeo.points = pg.geo.points; window.VPGeo.shapes = pg.geo.shapes; window.VPGeo.sel = [];
    renderOverlays(); redraw(); updatePageLabel();
    if (typeof refreshNote === "function") refreshNote();
  }
  function updatePageLabel() { var el = $("page-label"); if (el) el.textContent = (cur + 1) + " / " + pages.length; }
  function snapshotThumb() { try { var sm = document.createElement("canvas"); sm.width = 130; sm.height = Math.round(130 * canvas.clientHeight / canvas.clientWidth); sm.getContext("2d").drawImage(canvas, 0, 0, sm.width, sm.height); pages[cur].thumb = sm.toDataURL("image/jpeg", 0.5); } catch (e) {} }
  function makeThumbs() {
    var host = $("thumbs"); if (!host) return; host.innerHTML = "";
    pages.forEach(function (pg, i) {
      var wrap = document.createElement("div"); wrap.className = "thumb-wrap";
      var d = document.createElement("div"); d.className = "thumb" + (i === cur ? " sel" : "");
      if (pg.thumb) { var im = document.createElement("img"); im.src = pg.thumb; d.appendChild(im); } else { d.style.height = "92px"; d.style.background = "repeating-linear-gradient(#fff 0 10px,#eef2f6 10px 11px)"; }
      var n = document.createElement("div"); n.className = "tn-num"; n.textContent = (i + 1); d.appendChild(n);
      var del = document.createElement("button"); del.className = "tn-del"; del.innerHTML = "🗑"; del.title = "Xóa trang này";
      del.onclick = function (e) { e.stopPropagation(); deletePageAt(i); }; d.appendChild(del);
      d.onclick = function () { gotoPage(i); };
      d.oncontextmenu = function (e) { e.preventDefault(); showPageMenu(i, e.clientX, e.clientY); };
      wrap.appendChild(d);
      host.appendChild(wrap);
    });
  }
  function gotoPage(i) { var dir = i > cur ? "next" : (i < cur ? "prev" : null); capture(); snapshotThumb(); cur = Math.max(0, Math.min(pages.length - 1, i)); restore(); makeThumbs(); scheduleSave(); if (dir) pageAnim(dir); }
  function pageAnim(dir) {
    var b = document.getElementById("board"); if (!b || (state.opt && state.opt.pageAnim === false)) return;
    b.classList.remove("pg-slide-next", "pg-slide-prev"); void b.offsetWidth;
    b.classList.add(dir === "next" ? "pg-slide-next" : "pg-slide-prev");
    setTimeout(function () { b.classList.remove("pg-slide-next", "pg-slide-prev"); }, 340);
  }
  // ----- Xem tổng thể các trang (lưới) -----
  function openPageGrid() {
    capture(); snapshotThumb();
    var grid = $("pg-grid"); if (!grid) return; grid.innerHTML = "";
    if ($("pg-count")) $("pg-count").textContent = pages.length + " trang";
    pages.forEach(function (pg, i) {
      var card = document.createElement("div"); card.className = "pg-card" + (i === cur ? " current" : "");
      var th = document.createElement("div"); th.className = "pg-thumb";
      if (pg.thumb) { var im = document.createElement("img"); im.src = pg.thumb; th.appendChild(im); } else { th.classList.add("empty"); th.textContent = "Trống"; }
      var no = document.createElement("div"); no.className = "pg-no"; no.textContent = "Trang " + (i + 1) + (i === cur ? " · đang xem" : "");
      card.appendChild(th); card.appendChild(no);
      card.onclick = function () { gotoPage(i); closePageGrid(); };
      grid.appendChild(card);
    });
    $("page-grid").hidden = false;
  }
  function closePageGrid() { if ($("page-grid")) $("page-grid").hidden = true; }
  if ($("pg-close")) $("pg-close").onclick = closePageGrid;
  // ----- Ghi chú riêng của giáo viên (theo trang, ẩn khi trình chiếu) -----
  function refreshNote() { var ta = $("tn-text"); if (ta && pages[cur]) ta.value = pages[cur].note || ""; }
  function toggleNote() { var panel = $("teacher-note"); if (!panel) return; panel.hidden = !panel.hidden; if (!panel.hidden) { refreshNote(); var ta = $("tn-text"); if (ta) ta.focus(); } }
  function hideNote() { if ($("teacher-note")) $("teacher-note").hidden = true; }
  if ($("tn-close")) $("tn-close").onclick = hideNote;
  if ($("tn-text")) $("tn-text").addEventListener("input", function () { if (pages[cur]) { pages[cur].note = this.value; scheduleSave(); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("page-grid") && !$("page-grid").hidden) closePageGrid(); });
  function addPage() { capture(); snapshotThumb(); pages.splice(cur + 1, 0, blankPage()); cur++; restore(); makeThumbs(); scheduleSave(); }
  function delPage() { deletePageAt(cur); }
  function insertPageAt(i, after) { capture(); snapshotThumb(); var at = after ? i + 1 : i; pages.splice(at, 0, blankPage()); cur = at; restore(); makeThumbs(); scheduleSave(); }
  function duplicatePage(i) { capture(); snapshotThumb(); var cl = JSON.parse(JSON.stringify(pages[i])); pages.splice(i + 1, 0, cl); cur = i + 1; restore(); makeThumbs(); scheduleSave(); toast("Đã nhân bản trang."); }
  function deletePageAt(i) {
    if (!confirm("Xóa trang " + (i + 1) + "?")) return;
    capture();
    if (pages.length <= 1) { pages[0] = blankPage(); cur = 0; }
    else { pages.splice(i, 1); if (cur > i) cur--; if (cur >= pages.length) cur = pages.length - 1; }
    restore(); makeThumbs(); scheduleSave();
  }
  // Menu chuột phải cho trang (chèn trước/sau, nhân bản, xóa)
  var pageMenuIdx = 0;
  function showPageMenu(i, x, y) {
    pageMenuIdx = i; var m = $("page-menu"); if (!m) return;
    document.querySelectorAll(".nr-menu.show").forEach(function (o) { if (o !== m) o.classList.remove("show"); });
    m.classList.add("show");
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 4)) + "px";
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - h - 4)) + "px";
  }
  document.querySelectorAll("#page-menu [data-pm-act]").forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation(); $("page-menu").classList.remove("show");
      var a = b.dataset.pmAct;
      if (a === "before") insertPageAt(pageMenuIdx, false);
      else if (a === "after") insertPageAt(pageMenuIdx, true);
      else if (a === "dup") duplicatePage(pageMenuIdx);
      else if (a === "del") deletePageAt(pageMenuIdx);
    };
  });
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveLocal, 400); }
  function serialize() { capture(); return JSON.stringify({ v: 1, cur: cur, pages: pages }); }
  function saveLocal() {
    if (state.opt && state.opt.autosave === false) return;
    snapshotThumb();
    try { if (lib.current) localStorage.setItem(bookKey(lib.current), serialize()); } catch (e) {}
    updateCurrentMeta();
    pushHistorySnapshot(false);
    if ($("thumbs") && $("thumbs").children[cur]) { var im = $("thumbs").children[cur].querySelector("img"); if (im && pages[cur].thumb) im.src = pages[cur].thumb; }
  }
  // ----- Lịch sử phiên bản (tự lưu mốc, khôi phục được) -----
  var lastSnapAt = 0;
  function histKey(id) { return "vpvie.hist." + id; }
  function loadHist(id) { try { return JSON.parse(localStorage.getItem(histKey(id)) || "[]"); } catch (e) { return []; } }
  function saveHist(id, arr) { try { localStorage.setItem(histKey(id), JSON.stringify(arr)); } catch (e) {} }
  function pushHistorySnapshot(force) {
    if (!lib.current) return;
    var now = Date.now();
    if (!force && now - lastSnapAt < 120000) return;   // tối đa 2 phút/mốc
    var content; try { content = serialize(); } catch (e) { return; }
    var arr = loadHist(lib.current);
    if (arr.length && arr[arr.length - 1].data === content) { lastSnapAt = now; return; } // không đổi -> bỏ
    lastSnapAt = now;
    arr.push({ t: now, data: content, pages: pages.length });
    while (arr.length > 20) arr.shift();
    saveHist(lib.current, arr);
  }
  function restoreVersion(idx) {
    var arr = loadHist(lib.current), v = arr[idx]; if (!v) return;
    pushHistorySnapshot(true);                 // lưu hiện trạng trước khi khôi phục
    try { loadBook(JSON.parse(v.data)); try { localStorage.setItem(bookKey(lib.current), v.data); } catch (e) {} updateCurrentMeta(); resetHist(); updatePageLabel(); hideDialog("dlg-history"); toast("Đã khôi phục phiên bản " + new Date(v.t).toLocaleString("vi-VN") + "."); }
    catch (e) { toast("Không khôi phục được phiên bản này."); }
  }
  function openHistory() {
    pushHistorySnapshot(true);
    var list = $("hist-list"); if (!list) return; list.innerHTML = "";
    var arr = loadHist(lib.current);
    if (!arr.length) { list.innerHTML = '<div class="hint">Chưa có mốc nào được lưu.</div>'; showDialog("dlg-history"); return; }
    for (var i = arr.length - 1; i >= 0; i--) {
      (function (idx, v, latest) {
        var row = document.createElement("div"); row.className = "hist-row" + (latest ? " latest" : "");
        var info = document.createElement("div"); info.className = "hist-info";
        info.innerHTML = '<b>' + new Date(v.t).toLocaleString("vi-VN") + '</b><span>' + (v.pages || 1) + ' trang' + (latest ? ' · hiện tại' : '') + '</span>';
        var b = document.createElement("button"); b.className = "hist-restore"; b.textContent = latest ? "Đang dùng" : "Khôi phục"; b.disabled = latest;
        b.onclick = function () { if (confirm("Khôi phục về phiên bản " + new Date(v.t).toLocaleString("vi-VN") + "?")) restoreVersion(idx); };
        row.appendChild(info); row.appendChild(b); list.appendChild(row);
      })(i, arr[i], i === arr.length - 1);
    }
    showDialog("dlg-history");
  }
  function loadBook(obj) {
    if (!obj || !obj.pages || !obj.pages.length) return;
    pages = obj.pages.map(function (pg) { return { items: pg.items || [], geo: { points: (pg.geo && pg.geo.points) || [], shapes: (pg.geo && pg.geo.shapes) || [] }, overlays: pg.overlays || [], thumb: pg.thumb, bg: pg.bg || null, note: pg.note || "" }; });
    cur = Math.min(obj.cur || 0, pages.length - 1); restore(); makeThumbs();
  }

  // ===== Thư viện sổ (nhiều sổ, màn hình đầu) =====
  var lib = { books: [], projects: [], current: null, openOnStart: true, trash: [] };
  var libFilter = "all";
  function bookKey(id) { return "vpvie.book." + id; }
  function genId() { return "b" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function defaultBookName() { var d = new Date(); return "Sổ " + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + "." + pad2(d.getMinutes()); }
  function fmtDate(ts) { var d = new Date(ts); return d.getDate() + " thg " + (d.getMonth() + 1) + ", " + d.getFullYear(); }
  function libSave() { try { localStorage.setItem("vpvie.lib", JSON.stringify(lib)); } catch (e) {} }
  function curMeta() { return lib.books.filter(function (b) { return b.id === lib.current; })[0] || null; }
  function updateCurrentMeta() {
    var m = curMeta(); if (!m) return;
    m.updated = Date.now();
    try { if (pages[cur] && pages[cur].thumb) m.cover = pages[cur].thumb; else if (pages[0] && pages[0].thumb) m.cover = pages[0].thumb; } catch (e) {}
    libSave();
  }
  function libLoad() {
    try { var s = JSON.parse(localStorage.getItem("vpvie.lib") || "null"); if (s) lib = s; } catch (e) {}
    if (!lib.books) lib.books = [];
    if (!lib.projects) lib.projects = [];
    if (!lib.trash) lib.trash = [];
    if (typeof lib.openOnStart !== "boolean") lib.openOnStart = true;
    if (!lib.books.length) {
      var old = null; try { old = localStorage.getItem("vpvie.book"); } catch (e) {}
      var id = genId();
      lib.books.push({ id: id, name: defaultBookName(), created: Date.now(), updated: Date.now(), project: null, cover: null });
      lib.current = id;
      if (old) { try { localStorage.setItem(bookKey(id), old); } catch (e) {} }
      libSave();
    }
    if (!lib.current || !lib.books.some(function (b) { return b.id === lib.current; })) lib.current = lib.books[0] && lib.books[0].id;
  }
  function loadCurrentContent() {
    if (!lib.current) { pages = [blankPage()]; cur = 0; restore(); makeThumbs(); return; }
    var s = null; try { s = localStorage.getItem(bookKey(lib.current)); } catch (e) {}
    if (s) { try { loadBook(JSON.parse(s)); } catch (e) { pages = [blankPage()]; cur = 0; restore(); makeThumbs(); } }
    else { pages = [blankPage()]; cur = 0; restore(); makeThumbs(); }
    setDocTitle();
  }
  function loadLocal() { libLoad(); loadCurrentContent(); }
  function setDocTitle() { var m = curMeta(); if ($("doc-title")) $("doc-title").textContent = (m ? m.name : "Sổ bài giảng") + " – VPVie"; }
  function persistCurrent() { try { if (lib.current) localStorage.setItem(bookKey(lib.current), serialize()); } catch (e) {} updateCurrentMeta(); }
  // --- thao tác sổ
  function createBook(project) {
    persistCurrent();
    var id = genId();
    lib.books.unshift({ id: id, name: defaultBookName(), created: Date.now(), updated: Date.now(), project: project || null, cover: null });
    lib.current = id; libSave();
    pages = [blankPage()]; cur = 0; restore(); makeThumbs(); updatePageLabel();
    try { localStorage.setItem(bookKey(id), serialize()); } catch (e) {}
    setDocTitle();
    return id;
  }
  function pinHash(s) { var h = 5381; s = "vpv" + (s || ""); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
  function openBook(id) {
    if (id === lib.current) { closeLibrary(); return; }
    var m = lib.books.filter(function (b) { return b.id === id; })[0];
    if (m && m.pin) { var ent = prompt("Nhập mã PIN để mở sổ “" + m.name + "”:"); if (ent == null) return; if (pinHash(ent) !== m.pin) { toast("Mã PIN không đúng."); return; } }
    persistCurrent();
    lib.current = id; libSave();
    loadCurrentContent(); updatePageLabel(); resetHist();
    closeLibrary();
  }
  function deleteBook(id) {
    var idx = -1; lib.books.forEach(function (b, i) { if (b.id === id) idx = i; });
    if (idx < 0) return;
    var m = lib.books[idx];
    var content = ""; try { content = localStorage.getItem(bookKey(id)) || ""; } catch (e) {}
    lib.trash.push({ meta: m, content: content, deletedAt: Date.now() });
    lib.books.splice(idx, 1);
    try { localStorage.removeItem(bookKey(id)); } catch (e) {}
    if (lib.current === id) {
      if (lib.books.length) { lib.current = lib.books[0].id; libSave(); loadCurrentContent(); updatePageLabel(); }
      else { libSave(); createBook(); }
    } else libSave();
    renderLibrary();
  }
  function renameBook(id) {
    var m = lib.books.filter(function (b) { return b.id === id; })[0]; if (!m) return;
    var nn = prompt("Đổi tên sổ:", m.name); if (nn == null) return;
    m.name = nn.trim() || m.name; libSave(); if (id === lib.current) setDocTitle(); renderLibrary();
  }
  function duplicateBook(id) {
    var m = lib.books.filter(function (b) { return b.id === id; })[0]; if (!m) return;
    if (id === lib.current) persistCurrent();
    var content = ""; try { content = localStorage.getItem(bookKey(id)) || ""; } catch (e) {}
    var nid = genId();
    var idx = lib.books.indexOf(m);
    lib.books.splice(idx + 1, 0, { id: nid, name: m.name + " (bản sao)", created: Date.now(), updated: Date.now(), project: m.project || null, cover: m.cover || null });
    try { localStorage.setItem(bookKey(nid), content); } catch (e) {}
    libSave(); renderLibrary();
  }
  function moveBookToProject(id, proj) {
    var m = lib.books.filter(function (b) { return b.id === id; })[0]; if (!m) return;
    m.project = proj; libSave(); renderLibrary();
  }
  function newProject() {
    var nn = prompt("Tên project mới:", ""); if (!nn) return;
    lib.projects.push({ id: "p" + genId(), name: nn.trim() }); libSave(); renderLibrary();
  }
  // --- giao diện Thư viện
  function filteredBooks() {
    var list = lib.books.slice();
    if (libFilter === "noproj") list = list.filter(function (b) { return !b.project; });
    else if (libFilter && libFilter.indexOf("p") === 0 && libFilter !== "all") list = list.filter(function (b) { return b.project === libFilter; });
    var q = ($("lib-search") && $("lib-search").value || "").trim().toLowerCase();
    if (q) list = list.filter(function (b) { return (b.name || "").toLowerCase().indexOf(q) >= 0; });
    return list;
  }
  function renderLibrary() {
    var grid = $("lib-grid"); if (!grid) return;
    // bộ đếm
    if ($("lib-cnt-all")) $("lib-cnt-all").textContent = lib.books.length;
    if ($("lib-cnt-np")) $("lib-cnt-np").textContent = lib.books.filter(function (b) { return !b.project; }).length;
    // danh sách project ở sidebar
    var pc = $("lib-projects");
    if (pc) {
      pc.innerHTML = "";
      lib.projects.forEach(function (p) {
        var b = document.createElement("button"); b.className = "lib-nav" + (libFilter === p.id ? " active" : ""); b.dataset.filter = p.id;
        b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span></span><b class="lib-badge-n"></b>';
        b.querySelector("span").textContent = p.name;
        b.querySelector("b").textContent = lib.books.filter(function (x) { return x.project === p.id; }).length;
        b.onclick = function () { libFilter = p.id; syncNav(); renderLibrary(); };
        pc.appendChild(b);
      });
    }
    // tiêu đề
    var titleMap = { all: "Tất cả sổ", noproj: "Không thuộc project" };
    var ft = titleMap[libFilter]; if (!ft) { var pp = lib.projects.filter(function (p) { return p.id === libFilter; })[0]; ft = pp ? pp.name : "Tất cả sổ"; }
    if ($("lib-title")) $("lib-title").textContent = ft;
    var list = filteredBooks();
    if ($("lib-count")) $("lib-count").textContent = list.length + " sổ";
    // lưới thẻ
    grid.innerHTML = "";
    var add = document.createElement("div"); add.className = "lib-new"; add.innerHTML = '<span class="lp">＋</span><span>Sổ mới</span>';
    add.onclick = function () { var p = (libFilter.indexOf("p") === 0 && libFilter !== "all" && libFilter !== "noproj") ? libFilter : null; createBook(p); renderLibrary(); closeLibrary(); };
    grid.appendChild(add);
    list.forEach(function (m) {
      var card = document.createElement("div"); card.className = "lib-card" + (m.id === lib.current ? " current" : ""); card.dataset.id = m.id;
      var cover = '<div class="lib-cover">' + (m.cover ? '<img src="' + m.cover + '">' : '<div class="lib-ph">Sổ trống</div>') + (m.id === lib.current ? '<span class="lib-badge">Đang mở</span>' : '') + (m.pin ? '<span class="lib-lock" title="Sổ có khóa PIN">🔒</span>' : '') + '<input type="checkbox" class="lib-chk"><button class="lib-del" title="Xóa">🗑</button></div>';
      card.innerHTML = cover + '<div class="lib-name"><span class="nm"></span><button class="lib-more" title="Tùy chọn">⋯</button></div><div class="lib-date">' + fmtDate(m.updated || m.created) + '</div>';
      card.querySelector(".nm").textContent = m.name;
      card.onclick = function (e) {
        if (e.target.closest(".lib-more") || e.target.closest(".lib-del")) return;
        if ($("library").classList.contains("multi")) { if (!e.target.closest(".lib-chk")) { var c = card.querySelector(".lib-chk"); c.checked = !c.checked; } updateBulkBar(); return; }
        if (e.target.closest(".lib-chk")) return;
        openBook(m.id);
      };
      card.querySelector(".lib-chk").onchange = function () { updateBulkBar(); };
      card.querySelector(".lib-del").onclick = function (e) { e.stopPropagation(); if (confirm("Chuyển sổ “" + m.name + "” vào Thùng rác?")) deleteBook(m.id); };
      card.querySelector(".lib-more").onclick = function (e) { e.stopPropagation(); openMoreMenu(e.currentTarget, m); };
      grid.appendChild(card);
    });
  }
  function checkedIds() { return Array.prototype.map.call(document.querySelectorAll("#lib-grid .lib-card"), function (c) { return c.querySelector(".lib-chk") && c.querySelector(".lib-chk").checked ? c.dataset.id : null; }).filter(Boolean); }
  function updateBulkBar() {
    var btn = $("lib-bulk-del"); var n = checkedIds().length;
    if (btn) { btn.hidden = n === 0; btn.textContent = "🗑 Xóa đã chọn (" + n + ")"; }
  }
  function syncNav() { document.querySelectorAll("#library .lib-nav[data-filter]").forEach(function (b) { b.classList.toggle("active", b.dataset.filter === libFilter); }); }
  function openMoreMenu(anchor, m) {
    var menu = $("lib-more"); if (!menu) return;
    menu.innerHTML = "";
    function item(label, fn, danger) { var b = document.createElement("button"); b.textContent = label; if (danger) b.className = "danger"; b.onclick = function () { menu.hidden = true; fn(); }; menu.appendChild(b); }
    item("Đổi tên", function () { renameBook(m.id); });
    item("Nhân bản", function () { duplicateBook(m.id); });
    item(m.pin ? "🔒 Đổi / bỏ mã PIN" : "🔒 Đặt mã PIN (khóa nhẹ)", function () {
      if (m.pin) {
        var cur = prompt("Mã PIN hiện tại (để trống để bỏ khóa):"); if (cur == null) return;
        if (pinHash(cur) !== m.pin) { toast("Mã PIN hiện tại không đúng."); return; }
        if (cur === "" || !cur) { delete m.pin; libSave(); renderLibrary(); toast("Đã bỏ khóa sổ."); return; }
      }
      var np = prompt("Đặt mã PIN mới (vài chữ số). Lưu ý: chỉ là khóa nhẹ chống xem nhầm, KHÔNG mã hoá dữ liệu:"); if (np == null) return;
      np = np.trim(); if (!np) { if (m.pin) { delete m.pin; libSave(); renderLibrary(); toast("Đã bỏ khóa sổ."); } return; }
      m.pin = pinHash(np); libSave(); renderLibrary(); toast("Đã đặt mã PIN cho sổ.");
    });
    if (lib.projects.length) {
      item(m.project ? "Bỏ khỏi project" : "Thêm vào project…", function () {
        if (m.project) { moveBookToProject(m.id, null); return; }
        var names = lib.projects.map(function (p, i) { return (i + 1) + ". " + p.name; }).join("\n");
        var k = prompt("Chọn project (nhập số):\n" + names, "1"); var idx = parseInt(k, 10) - 1;
        if (lib.projects[idx]) moveBookToProject(m.id, lib.projects[idx].id);
      });
    }
    item("Xóa", function () { if (confirm("Chuyển sổ “" + m.name + "” vào Thùng rác?")) deleteBook(m.id); }, true);
    var r = anchor.getBoundingClientRect();
    menu.hidden = false;
    menu.style.left = Math.min(window.innerWidth - menu.offsetWidth - 8, r.left) + "px";
    menu.style.top = (r.bottom + 4) + "px";
  }
  function openLibrary() {
    persistCurrent();
    var lb = $("library"); if (!lb) return;
    if ($("lib-openstart")) $("lib-openstart").checked = lib.openOnStart;
    if ($("lib-search")) $("lib-search").value = "";
    lb.hidden = false; syncNav(); renderLibrary();
  }
  function closeLibrary() { var lb = $("library"); if (lb) lb.hidden = true; var mm = $("lib-more"); if (mm) mm.hidden = true; }
  // ----- Thư mục lưu sổ / video (app desktop)
  var folders = { books: "", videos: "" };
  function loadFolders() { try { var f = JSON.parse(localStorage.getItem("vpvie.folders") || "null"); if (f) folders = f; } catch (e) {} }
  function saveFolders() { try { localStorage.setItem("vpvie.folders", JSON.stringify(folders)); } catch (e) {} }
  async function initFolders() {
    if (!window.VPDesktop || !window.VPDesktop.isApp) return;
    loadFolders();
    if (!folders.books || !folders.videos) { try { var d = await window.VPDesktop.defaultFolders(); folders.books = folders.books || d.books; folders.videos = folders.videos || d.videos; saveFolders(); } catch (e) {} }
    var sec = $("set-folders"); if (sec) sec.hidden = false;
    if ($("fold-books")) $("fold-books").value = folders.books || "";
    if ($("fold-videos")) $("fold-videos").value = folders.videos || "";
    function bind(pickId, openId, key, inputId) {
      if ($(pickId)) $(pickId).onclick = async function () { var p = await window.VPDesktop.pickFolder(); if (p) { folders[key] = p; saveFolders(); $(inputId).value = p; toast("Đã đổi thư mục."); } };
      if ($(openId)) $(openId).onclick = function () { window.VPDesktop.openFolder(folders[key]); };
    }
    bind("fold-books-pick", "fold-books-open", "books", "fold-books");
    bind("fold-videos-pick", "fold-videos-open", "videos", "fold-videos");
  }
  initFolders();
  function downloadBook() {
    var json = serialize(), name = "so-bai-giang-" + Date.now() + ".vpvie.json";
    if (window.VPDesktop && window.VPDesktop.isApp && folders.books) {
      window.VPDesktop.saveFile(folders.books, name, json, false).then(function (r) { toast(r.ok ? "Đã lưu sổ vào: " + r.path : "Lỗi lưu sổ."); });
      return;
    }
    var b = new Blob([json], { type: "application/json" }); var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "so-bai-giang.vpvie.json"; a.click();
  }
  function openBookFile() {
    var inp = document.createElement("input"); inp.type = "file";
    inp.accept = ".json,.pdf,.docx,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    inp.onchange = async function () {
      var f = inp.files[0]; if (!f) return;
      if (/\.(pdf|docx|doc)$/i.test(f.name)) { await importDocument(f); return; }
      try { loadBook(JSON.parse(await f.text())); scheduleSave(); closeLibrary(); toast("Đã mở sổ bài giảng."); }
      catch (e) { toast("Tệp không hợp lệ. Chọn sổ JSON, PDF hoặc Word (.docx)."); }
    };
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
    if ($("btn-license")) $("btn-license").hidden = !!st.active;
    if (st.active && badge) { var lt = badge.querySelector(".lic-txt"); if (lt) lt.textContent = (st.plan === "free" ? "Đã kích hoạt" : "Bản quyền " + st.plan.toUpperCase()); }
    if (note) {
      if (st.active) {
        var exp = st.expiry ? (" · hết hạn " + new Date(st.expiry * 1000).toLocaleDateString("vi-VN")) : " · vĩnh viễn";
        note.textContent = "✔ Đã kích hoạt" + (st.note ? " (" + st.note + ")" : "") + exp;
        note.className = "lic-state ok";
      } else { note.textContent = "Chưa kích hoạt — máy này đang dùng bản miễn phí."; note.className = "lic-state no"; }
    }
  }
  // ----- Màn hình khoá: phải nhập Key mới dùng được phần mềm
  function gateMsg(t, ok) { var m = $("gate-msg"); if (m) { m.textContent = t || ""; m.className = "lic-gate-msg" + (t ? (ok ? " ok" : " err") : ""); } }
  async function showGateIfLocked() {
    if (!window.VPLicense || !$("lic-gate")) return;
    await window.VPLicense.check();
    if (window.VPLicense.isActive()) { $("lic-gate").hidden = true; return; }
    $("gate-mid").value = await window.VPLicense.machineId();
    $("lic-gate").hidden = false;
  }
  if ($("gate-copy")) $("gate-copy").onclick = function () {
    var v = $("gate-mid").value; if (!v) return;
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(function () { toast("Đã chép Mã máy."); }, function () {});
    else { $("gate-mid").select(); document.execCommand("copy"); toast("Đã chép Mã máy."); }
  };
  if ($("gate-activate")) $("gate-activate").onclick = async function () {
    var key = $("gate-key") ? $("gate-key").value.trim() : "";
    if (!key) { gateMsg("Hãy dán Key kích hoạt.", false); return; }
    gateMsg("Đang kích hoạt…");
    var r = await window.VPLicense.activate(key);
    if (r.ok) { gateMsg("Kích hoạt thành công! Đang mở phần mềm…", true); setTimeout(function () { $("lic-gate").hidden = true; }, 700); refreshLicUI(); }
    else gateMsg(r.reason || "Key không hợp lệ.", false);
  };
  if ($("gate-key")) $("gate-key").addEventListener("keydown", function (e) { if (e.key === "Enter") $("gate-activate").click(); });

  if (window.VPLicense) {
    window.VPLicense.check().then(function () { refreshLicUI(); showGateIfLocked(); }).catch(function () {});
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
    if ($("lic-deactivate")) $("lic-deactivate").onclick = async function () {
      if (!confirm("Gỡ kích hoạt trên máy này?")) return;
      try { await window.VPLicense.deactivate(); refreshLicUI(); licMsg("Đã gỡ kích hoạt.", false); }
      catch (e) { licMsg("Không lưu được thay đổi: " + e.message, false); }
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
  var importingDocument = false;
  async function importDocument(file) {
    if (importingDocument) { toast("Đang nhập tài liệu. Vui lòng đợi hoàn tất."); return; }
    importingDocument = true;
    var doc = null, loadingTask = null, wrap = null;
    try {
      var pdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
      var word = /\.docx$/i.test(file.name);
      if (!pdf && !word) throw new Error("Hãy lưu tệp Word dạng .docx; định dạng .doc cũ chưa được hỗ trợ.");
      var data = await file.arrayBuffer(), images = [];
      toast(pdf ? "Đang mở PDF…" : "Đang mở Word…");
      if (pdf) {
        if (!window.pdfjsLib) throw new Error("Chưa tải được bộ đọc PDF.");
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/pdf.worker.min.js", document.baseURI).href;
        loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(data) });
        doc = await loadingTask.promise;
        for (var i = 1; i <= doc.numPages; i++) {
          var page = await doc.getPage(i), vp = page.getViewport({ scale: 2 });
          var oc = document.createElement("canvas"); oc.width = vp.width; oc.height = vp.height;
          await page.render({ canvasContext: oc.getContext("2d"), viewport: vp }).promise;
          images.push(oc.toDataURL("image/jpeg", 0.85)); page.cleanup(); oc.width = oc.height = 0;
        }
      } else {
        if (!window.mammoth || !window.html2canvas) throw new Error("Chưa tải được bộ đọc Word.");
        var converted = await window.mammoth.convertToHtml({ arrayBuffer: data });
        wrap = document.createElement("div");
        wrap.style.cssText = "position:absolute;left:0;top:0;z-index:-1;width:794px;padding:48px;background:#fff;font-family:'Times New Roman',serif;font-size:16px;line-height:1.5;color:#111";
        wrap.innerHTML = converted.value || "<p>(Tài liệu trống)</p>";
        document.body.appendChild(wrap);
        var cv = await window.html2canvas(wrap, { scale: 2, backgroundColor: "#fff" });
        images.push(cv.toDataURL("image/jpeg", 0.85));
      }
      hideDialog("dlg-settings"); closeLibrary();
      images.forEach(function (url, index) {
        if (index) addPage();
        setPageBg(url);
      });
      toast("Đã nhập " + images.length + " trang " + (pdf ? "PDF" : "Word") + ". Hãy viết lên đề.");
    } catch (e) {
      console.error("Document import failed:", e);
      toast("Không mở được tài liệu: " + (e.message || "Tệp hỏng hoặc không đúng định dạng."));
    } finally {
      if (wrap) wrap.remove();
      try { if (doc) await doc.destroy(); else if (loadingTask) await loadingTask.destroy(); }
      finally { importingDocument = false; }
    }
  }
  [["set-pdf", "imp-pdf"], ["set-docx", "imp-docx"]].forEach(function (ids) {
    $(ids[0]).onclick = function () { $(ids[1]).click(); };
    $(ids[1]).onchange = function () { var file = this.files[0]; this.value = ""; if (file) importDocument(file); };
  });

  // ----- Công cụ giảng dạy: rèm che & đèn rọi -----
  var teachMode = null, spotR = 120;
  function positionTeachLayer() {
    var layer = $("teach-layer"), b = $("board").getBoundingClientRect();
    layer.style.top = b.top + "px"; layer.style.left = b.left + "px"; layer.style.width = b.width + "px"; layer.style.height = b.height + "px";
  }
  function startTeach(mode) {
    teachMode = mode;
    var layer = $("teach-layer"), bar = $("teach-bar"), cur = $("curtain");
    layer.hidden = false; bar.hidden = false; positionTeachLayer();
    layer.classList.toggle("mode-spot", mode === "spotlight");
    layer.classList.toggle("mode-curtain", mode === "curtain");
    if (mode === "curtain") {
      cur.style.display = "block";
      cur.style.height = Math.round(($("board").clientHeight) * 0.55) + "px";
      $("teach-name").textContent = "Rèm che";
      $("teach-hint").textContent = "Kéo thanh để lộ dần nội dung";
    } else {
      cur.style.display = "none";
      $("teach-name").textContent = "Đèn rọi";
      $("teach-hint").textContent = "Di chuột để rọi · lăn chuột đổi cỡ";
      moveSpot($("board").clientWidth / 2, $("board").clientHeight / 2);
    }
  }
  function stopTeach() { teachMode = null; if ($("teach-layer")) $("teach-layer").hidden = true; if ($("teach-bar")) $("teach-bar").hidden = true; }
  function moveSpot(x, y) { var l = $("teach-layer"); if (l) l.style.background = "radial-gradient(circle " + spotR + "px at " + x + "px " + y + "px, rgba(0,0,0,0) 0, rgba(0,0,0,0) " + spotR + "px, rgba(15,18,28,.78) " + (spotR + 1) + "px)"; }
  if ($("teach-off")) $("teach-off").onclick = stopTeach;
  (function () {
    var layer = $("teach-layer"); if (!layer) return;
    layer.addEventListener("pointermove", function (e) { if (teachMode === "spotlight") { var r = layer.getBoundingClientRect(); moveSpot(e.clientX - r.left, e.clientY - r.top); } });
    layer.addEventListener("wheel", function (e) { if (teachMode === "spotlight") { e.preventDefault(); spotR = Math.max(50, Math.min(400, spotR - Math.sign(e.deltaY) * 16)); var r = layer.getBoundingClientRect(); moveSpot(e.clientX - r.left, e.clientY - r.top); } }, { passive: false });
    // Kéo rèm che
    var grip = $("curtain-grip"), cur = $("curtain"), dragging = false;
    if (grip) {
      grip.addEventListener("pointerdown", function (e) { dragging = true; grip.setPointerCapture(e.pointerId); e.preventDefault(); });
      grip.addEventListener("pointermove", function (e) { if (!dragging) return; var r = layer.getBoundingClientRect(); var hpx = Math.max(24, Math.min(r.height, e.clientY - r.top)); cur.style.height = hpx + "px"; });
      grip.addEventListener("pointerup", function () { dragging = false; });
    }
    // Esc để tắt
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && teachMode) stopTeach(); });
  })();

  // ----- Quay màn hình (screen recording) kèm micro — có thanh thiết lập & chọn vùng
  var mediaRec = null, recChunks = [], recMode = "region", recRAF = 0, recClean = null;
  function toggleRecord() {
    var btn = $("btn-record");
    if (mediaRec && mediaRec.state !== "inactive") { mediaRec.stop(); return; }   // đang quay -> dừng
    if (!$("rec-bar") || !$("rec-bar").hidden) { closeRecBar(); return; }          // đã mở -> đóng
    openRecBar();
  }
  function openRecBar() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { toast("Trình duyệt không hỗ trợ quay màn hình."); return; }
    $("rec-bar").hidden = false; $("btn-record").classList.add("active");
    setRecMode(recMode);
  }
  function closeRecBar() { if ($("rec-bar")) $("rec-bar").hidden = true; if ($("rec-region")) $("rec-region").hidden = true; if (!mediaRec || mediaRec.state === "inactive") $("btn-record").classList.remove("active"); }
  function setRecMode(m) {
    recMode = m;
    document.querySelectorAll("#rec-bar .rec-seg button").forEach(function (b) { b.classList.toggle("on", b.dataset.mode === m); });
    var rg = $("rec-region");
    if (m === "region") { var first = rg.hidden; rg.hidden = false; if (first) placeDefaultRegion(); else updateRegionSize(); }
    else rg.hidden = true;
  }
  function placeDefaultRegion() {
    var board = document.getElementById("board"), rg = $("rec-region");
    var w = board.clientWidth, h = board.clientHeight;
    var rw = Math.round(w * 0.86), rh = Math.round(h * 0.78);
    rg.style.left = Math.round((w - rw) / 2) + "px"; rg.style.top = Math.round((h - rh) / 2) + "px";
    rg.style.width = rw + "px"; rg.style.height = rh + "px";
    updateRegionSize();
  }
  function updateRegionSize() { var rg = $("rec-region"); var sz = rg.querySelector(".rec-size"); if (sz) sz.textContent = Math.round(rg.offsetWidth) + " × " + Math.round(rg.offsetHeight); }
  // Kéo/đổi cỡ khung vùng quay
  (function setupRegionDrag() {
    var rg = $("rec-region"); if (!rg) return;
    var board = document.getElementById("board");
    var drag = null;
    function down(e, type) {
      e.preventDefault(); e.stopPropagation();
      var r = rg.getBoundingClientRect(), b = board.getBoundingClientRect();
      drag = { type: type, sx: e.clientX, sy: e.clientY, left: r.left - b.left, top: r.top - b.top, w: r.width, h: r.height, bw: b.width, bh: b.height };
      rg.setPointerCapture && rg.setPointerCapture(e.pointerId);
    }
    rg.addEventListener("pointerdown", function (e) { if (e.target.classList.contains("rec-h")) return; down(e, "move"); });
    rg.querySelectorAll(".rec-h").forEach(function (h) { h.addEventListener("pointerdown", function (e) { down(e, h.classList[1]); }); });
    rg.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy, L = drag.left, T = drag.top, W = drag.w, H = drag.h;
      if (drag.type === "move") { L = drag.left + dx; T = drag.top + dy; }
      else {
        if (/w/.test(drag.type)) { L = drag.left + dx; W = drag.w - dx; }
        if (/e/.test(drag.type)) { W = drag.w + dx; }
        if (/n/.test(drag.type)) { T = drag.top + dy; H = drag.h - dy; }
        if (/s/.test(drag.type)) { H = drag.h + dy; }
      }
      W = Math.max(80, W); H = Math.max(60, H);
      L = Math.max(0, Math.min(drag.bw - W, L)); T = Math.max(0, Math.min(drag.bh - H, T));
      rg.style.left = L + "px"; rg.style.top = T + "px"; rg.style.width = W + "px"; rg.style.height = H + "px";
      updateRegionSize();
    });
    rg.addEventListener("pointerup", function () { drag = null; });
  })();
  if ($("rec-bar")) document.querySelectorAll("#rec-bar .rec-seg button").forEach(function (b) { b.onclick = function () { setRecMode(b.dataset.mode); }; });
  if ($("rec-cancel")) $("rec-cancel").onclick = function () { closeRecBar(); };
  if ($("rec-start")) $("rec-start").onclick = function () { var mic = $("rec-mic-tg") ? $("rec-mic-tg").checked : true; startRecording(recMode, mic); };

  async function startRecording(mode, useMic) {
    var btn = $("btn-record");
    // Toạ độ vùng (chế độ Vùng trang viết) tính theo viewport để cắt từ video
    var crop = null;
    if (mode === "region") { var rg = $("rec-region"), r = rg.getBoundingClientRect(); crop = { x: r.left, y: r.top, w: r.width, h: r.height }; }
    closeRecBar(); document.body.classList.add("rec-live");
    try {
      var disp = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true, preferCurrentTab: true });
      var micStream = null;
      if (useMic) { try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) {} }
      var recStream, cleanup = [];
      if (mode === "window") {
        recStream = disp;
        if (micStream) micStream.getAudioTracks().forEach(function (t) { recStream.addTrack(t); });
        cleanup.push(function () { disp.getTracks().forEach(function (t) { t.stop(); }); if (micStream) micStream.getTracks().forEach(function (t) { t.stop(); }); });
      } else {
        // Cắt vùng: vẽ từng khung hình của video màn hình vào canvas theo tỉ lệ viewport
        var vid = document.createElement("video"); vid.srcObject = disp; vid.muted = true; await vid.play().catch(function () {});
        var vw = vid.videoWidth || window.innerWidth, vh = vid.videoHeight || window.innerHeight;
        var sx = vw / window.innerWidth, sy = vh / window.innerHeight;
        var cw = Math.max(2, Math.round(crop.w * sx)), ch = Math.max(2, Math.round(crop.h * sy));
        var rc = document.createElement("canvas"); rc.width = cw; rc.height = ch; var rctx = rc.getContext("2d");
        var draw = function () { try { rctx.drawImage(vid, crop.x * sx, crop.y * sy, crop.w * sx, crop.h * sy, 0, 0, cw, ch); } catch (e) {} recRAF = requestAnimationFrame(draw); };
        draw();
        recStream = rc.captureStream(30);
        disp.getAudioTracks().forEach(function (t) { recStream.addTrack(t); });
        if (micStream) micStream.getAudioTracks().forEach(function (t) { recStream.addTrack(t); });
        cleanup.push(function () { cancelAnimationFrame(recRAF); disp.getTracks().forEach(function (t) { t.stop(); }); if (micStream) micStream.getTracks().forEach(function (t) { t.stop(); }); });
      }
      // Người dùng bấm "Dừng chia sẻ" của trình duyệt -> dừng luôn
      disp.getVideoTracks()[0].addEventListener("ended", function () { if (mediaRec && mediaRec.state !== "inactive") mediaRec.stop(); });
      recClean = function () { cleanup.forEach(function (f) { f(); }); recClean = null; };
      recChunks = []; mediaRec = new MediaRecorder(recStream, { mimeType: "video/webm" });
      mediaRec.ondataavailable = function (ev) { if (ev.data.size) recChunks.push(ev.data); };
      mediaRec.onstop = function () {
        if (recClean) recClean();
        document.body.classList.remove("rec-live"); btn.classList.remove("active");
        var blob = new Blob(recChunks, { type: "video/webm" }), name = "bai-giang-" + Date.now() + ".webm";
        if (window.VPDesktop && window.VPDesktop.isApp && folders.videos) {
          var fr = new FileReader();
          fr.onload = function () { var b64 = fr.result.split(",")[1]; window.VPDesktop.saveFile(folders.videos, name, b64, true).then(function (r) { toast(r.ok ? "Đã lưu video vào: " + r.path : "Lỗi lưu video."); }); };
          fr.readAsDataURL(blob); return;
        }
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
        toast("Đã lưu video bài giảng (.webm).");
      };
      mediaRec.start(); btn.classList.add("active");
      toast(mode === "region" ? "Đang quay vùng đã chọn… bấm ⏺ để dừng." : "Đang quay cả cửa sổ… bấm ⏺ để dừng.");
    } catch (e) { document.body.classList.remove("rec-live"); btn.classList.remove("active"); toast("Đã hủy quay màn hình."); }
  }

  loadSettings();
  resize();
  loadLocal();
  updatePageLabel();
  makeThumbs();
  if (lib.openOnStart) openLibrary();
  // expose cho kiểm thử
  window.__vp = { state: state, insertMath: insertMath, insertPlot: insertPlot, redraw: redraw, resize: resize, gotoPage: gotoPage, addPage: addPage, pages: function () { return pages; }, cur: function () { return cur; }, strokeLines: strokeLines, lib: function () { return lib; }, openLibrary: openLibrary, closeLibrary: closeLibrary, createBook: createBook };
})();
