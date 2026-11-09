// Làm đẹp nét vẽ tay: nhận dạng nét nguệch ngoạc -> đường thẳng / tròn / elip / chữ nhật / tam giác.
// Thuần hình học, chạy ngay trên trình duyệt (không cần mạng).
(function (global) {
  "use strict";

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function pathLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    return L;
  }

  function bbox(pts) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of pts) {
      if (p.x < minx) minx = p.x; if (p.y < miny) miny = p.y;
      if (p.x > maxx) maxx = p.x; if (p.y > maxy) maxy = p.y;
    }
    return { minx, miny, maxx, maxy, w: maxx - minx, h: maxy - miny };
  }

  // Khoảng cách từ điểm p tới đoạn ab
  function distToSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  // Rút gọn Ramer–Douglas–Peucker -> các đỉnh góc
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    let dmax = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = distToSeg(pts[i], pts[0], pts[pts.length - 1]);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > eps) {
      const left = rdp(pts.slice(0, idx + 1), eps);
      const right = rdp(pts.slice(idx), eps);
      return left.slice(0, -1).concat(right);
    }
    return [pts[0], pts[pts.length - 1]];
  }

  function snapAngle(x1, y1, x2, y2) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const deg = ang * 180 / Math.PI;
    const tol = 8;
    // ngang
    if (Math.abs(deg) < tol || Math.abs(Math.abs(deg) - 180) < tol) { const y = (y1 + y2) / 2; return [x1, y, x2, y]; }
    // dọc
    if (Math.abs(Math.abs(deg) - 90) < tol) { const x = (x1 + x2) / 2; return [x, y1, x, y2]; }
    return [x1, y1, x2, y2];
  }

    // Đếm số góc "nhọn" trên một đường khép kín (ổn định hơn chỉ đếm điểm RDP):
  // lấy các đỉnh RDP rồi tính góc rẽ tại mỗi đỉnh, chỉ đếm đỉnh rẽ đủ gắt.
  function cornerVerts(pts, size) {
    var eps = size * 0.12;
    var v = rdp(pts, eps);
    // bỏ đỉnh đầu/cuối trùng nhau (nét khép kín)
    if (v.length > 2 && dist(v[0], v[v.length - 1]) < size * 0.22) v = v.slice(0, -1);
    if (v.length < 3) return v;
    // lọc đỉnh rẽ gắt (> ~30°); gộp đỉnh quá gần nhau
    var out = [];
    for (var i = 0; i < v.length; i++) {
      var a = v[(i - 1 + v.length) % v.length], b = v[i], c = v[(i + 1) % v.length];
      var a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
      var turn = Math.abs(a2 - a1); if (turn > Math.PI) turn = 2 * Math.PI - turn;
      if (turn > 0.52) out.push(b);        // ~30°
    }
    // gộp đỉnh gần nhau (< 14% cỡ)
    var merged = [];
    for (var j = 0; j < out.length; j++) {
      if (merged.length && dist(merged[merged.length - 1], out[j]) < size * 0.14) continue;
      merged.push(out[j]);
    }
    if (merged.length > 1 && dist(merged[0], merged[merged.length - 1]) < size * 0.14) merged = merged.slice(0, -1);
    return merged.length >= 3 ? merged : v;
  }

  // Trả về shape đã làm đẹp, hoặc null nếu nên giữ nguyên nét.
  function beautify(pts) {
    if (!pts || pts.length < 4) return null;
    const L = pathLength(pts);
    if (L < 24) return null;
    const bb = bbox(pts);
    const size = Math.max(bb.w, bb.h);
    if (size < 16) return null;
    const endGap = dist(pts[0], pts[pts.length - 1]);
    const straightness = endGap / L;
    const closed = endGap < size * 0.3;   // phải khép KÍN mới xét thành hình

    // Đường thẳng (nét mở, gần như thẳng)
    if (!closed && straightness > 0.82) {
      const [x1, y1, x2, y2] = snapAngle(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
      return { type: "line", x1, y1, x2, y2 };
    }
    // Nét MỞ, cong (chữ C, cung, sóng…) -> GIỮ NGUYÊN nét tay, KHÔNG ép thành tròn.
    if (!closed) return null;

    // Tâm & bán kính theo hộp bao; độ lệch so với elip (0 = tròn/elip hoàn hảo)
    const cx = (bb.minx + bb.maxx) / 2, cy = (bb.miny + bb.maxy) / 2;
    const rx = bb.w / 2, ry = bb.h / 2;
    let dev = 0;
    for (const p of pts) {
      const nx = (p.x - cx) / (rx || 1), ny = (p.y - cy) / (ry || 1);
      dev += Math.abs(Math.hypot(nx, ny) - 1);
    }
    dev /= pts.length;

    function roundShape() {
      if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.18) return { type: "circle", cx, cy, r: (rx + ry) / 2 };
      return { type: "ellipse", cx, cy, rx, ry };
    }

    // Hình KHÉP KÍN: đếm số góc để phân loại tam giác / tứ giác / đa giác / tròn.
    const corners = cornerVerts(pts, size);
    const n = corners.length;
    // Tròn/elip rõ: rất ít góc gắt mà bán kính đều
    if (dev < 0.12 && n >= 7) return roundShape();
    if (n === 3) return { type: "triangle", pts: corners.map(p => ({ x: p.x, y: p.y })) };
    if (n === 4) {
      // Gần chữ nhật thẳng trục -> nắn về chữ nhật bao; lệch trục -> giữ tứ giác.
      var axisLike = corners.every(function (p) {
        return Math.min(Math.abs(p.x - bb.minx), Math.abs(p.x - bb.maxx)) < size * 0.18 &&
               Math.min(Math.abs(p.y - bb.miny), Math.abs(p.y - bb.maxy)) < size * 0.18;
      });
      if (axisLike) return { type: "rect", x: bb.minx, y: bb.miny, w: bb.w, h: bb.h };
      return { type: "poly", pts: corners.map(p => ({ x: p.x, y: p.y })) };
    }
    if (n === 5 || n === 6) return { type: "poly", pts: corners.map(p => ({ x: p.x, y: p.y })) };
    // Còn lại: bán kính đều thì tròn/elip, không thì giữ nét.
    if (dev < 0.2) return roundShape();
    return null;
  }

  // ---------- NẮN NÉT CHỮ VIẾT TAY ----------
  // Làm mượt nét viết tay (giảm run tay, bớt nguệch ngoạc) NHƯNG GIỮ NGUYÊN là nét
  // chữ của người dùng — không đổi thành hình, không thành chữ đánh máy.
  function resampleEven(pts, step) {
    if (pts.length < 2) return pts.slice();
    var out = [pts[0]], prev = pts[0], acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = dist(prev, pts[i]);
      if (d < 1e-6) { continue; }
      while (acc + d >= step) {
        var t = (step - acc) / d;
        var np = { x: prev.x + t * (pts[i].x - prev.x), y: prev.y + t * (pts[i].y - prev.y), pr: pts[i].pr };
        out.push(np); prev = np; d = dist(prev, pts[i]); acc = 0;
      }
      acc += d; prev = pts[i];
    }
    var last = pts[pts.length - 1];
    if (dist(out[out.length - 1], last) > step * 0.3) out.push(last);
    return out;
  }
  // Làm trơn kiểu trung bình trượt, giữ nguyên 2 đầu nét
  function smoothPass(pts, w) {
    if (pts.length < 3) return pts;
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var sx = 0, sy = 0, n = 0;
      for (var j = -w; j <= w; j++) { var k = i + j; if (k < 0 || k >= pts.length) continue; sx += pts[k].x; sy += pts[k].y; n++; }
      out.push({ x: sx / n, y: sy / n, pr: pts[i].pr });
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // Nội suy Catmull-Rom cho đường cong trơn qua các điểm
  function catmullRom(pts, samples) {
    if (pts.length < 3) return pts.slice();
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      for (var s = 0; s < samples; s++) {
        var t = s / samples, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
          pr: p1.pr
        });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // Góc quặt tại điểm giữa b (0 = thẳng, càng lớn càng gãy)
  function turnAngle(a, b, c) {
    var a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
    var d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d; return d;
  }
  // Tách polyline tại các GÓC NHỌN cố ý -> nhiều đoạn; mỗi đoạn sẽ được làm mượt riêng,
  // nhờ đó góc giữ sắc (giống chữ viết), chỉ đoạn cong/run tay mới được bo mượt.
  function cornerSplit(pts, thresh) {
    if (pts.length < 3) return [pts.slice()];
    var segs = [], cur = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      cur.push(pts[i]);
      if (turnAngle(pts[i - 1], pts[i], pts[i + 1]) > thresh) { segs.push(cur); cur = [pts[i]]; }
    }
    cur.push(pts[pts.length - 1]); segs.push(cur);
    return segs;
  }
  // Nối các đoạn đã làm mượt, bỏ điểm trùng ở mối nối (giữ góc gãy)
  function joinSegs(list) {
    var out = [];
    list.forEach(function (seg, i) { out = out.concat(i === 0 ? seg : seg.slice(1)); });
    return out;
  }

  // strength: 1 nhẹ · 2 vừa · 3 mạnh · 4 rất mượt
  function refineInk(pts, strength) {
    if (!pts || pts.length < 4) return pts;
    strength = strength || 2;
    // RDP giữ NHẸ để không méo chữ; "corner" = ngưỡng góc được coi là góc nhọn cố ý
    // (giữ sắc). Ngưỡng nhỏ = giữ nhiều góc (giống chữ viết hơn, bớt mượt).
    // pre = số lần làm trơn ĐỦ MẠNH để xoá run tay trước khi tìm đỉnh (nếu không,
    // tremor bị nhầm thành góc). corner = ngưỡng góc (rad) coi là góc nhọn CỐ Ý — để
    // CAO (~1.2 ≈ 69°) nên chỉ giữ góc thật, đoạn cong vẫn bo mượt → giống chữ viết.
    var cfg = {
      1: { eps: 0.016, pre: 2, corner: 1.10, samples: 10 },
      2: { eps: 0.020, pre: 4, corner: 1.20, samples: 14 },
      3: { eps: 0.024, pre: 6, corner: 1.30, samples: 16 },
      4: { eps: 0.028, pre: 8, corner: 1.45, samples: 20 }
    }[strength] || { eps: 0.020, pre: 4, corner: 1.20, samples: 14 };
    var bb = bbox(pts), size = Math.max(bb.w, bb.h);
    if (size < 8) return pts;
    // 1) Resample đều để ổn định
    var step = Math.max(2, size * 0.02);
    var r = resampleEven(pts, step);
    if (r.length < 4) return pts;
    // 2) Làm trơn sơ bộ ĐỦ MẠNH (khử run tay) rồi rút gọn nhẹ lấy các đỉnh
    for (var a = 0; a < cfg.pre; a++) r = smoothPass(r, 1);
    var verts = rdp(r, size * cfg.eps);
    if (verts.length < 3) return catmullRom(verts, cfg.samples);
    // 3) Tách tại GÓC NHỌN cố ý -> mỗi đoạn con. PHÂN LOẠI từng đoạn:
    //    - gần thẳng  -> vẽ lại thành ĐƯỜNG THẲNG sạch (có snap ngang/dọc nhẹ)
    //    - cong       -> vẽ lại thành ĐƯỜNG CONG mượt
    // => chữ = tổ hợp nét thẳng + nét cong gọn gàng, trông như chữ viết.
    var segs = cornerSplit(verts, cfg.corner).map(function (seg) {
      if (seg.length <= 2) return seg;
      var endGap = dist(seg[0], seg[seg.length - 1]), L = pathLength(seg);
      var straightness = L > 0 ? endGap / L : 1;
      if (straightness > 0.92) {                        // ĐOẠN THẲNG
        var a0 = seg[0], b0 = seg[seg.length - 1];
        var sn = snapAngle(a0.x, a0.y, b0.x, b0.y);     // snap ngang/dọc nếu gần đúng
        return [{ x: sn[0], y: sn[1], pr: a0.pr }, { x: sn[2], y: sn[3], pr: b0.pr }];
      }
      var s = smoothPass(seg, 1);                       // ĐOẠN CONG -> làm mượt
      return catmullRom(s, cfg.samples);
    });
    var curve = joinSegs(segs);
    return curve.length >= 2 ? curve : pts;
  }

  global.VPBeautify = { beautify, bbox, pathLength, rdp, refineInk, resampleEven, smoothPass, catmullRom };
})(window);
