// Hình học không gian: chóp, hình hộp/lập phương, lăng trụ, trụ, nón, cầu.
// Vẽ kiểu hình chiếu xiên; nét khuất là nét ĐỨT (như sách giáo khoa).
(function (global) {
  "use strict";
  function seg(x1, y1, x2, y2, d) { return { x1: x1, y1: y1, x2: x2, y2: y2, dashed: !!d }; }

  // off = hướng chiều sâu (lên phải)
  function make(kind, cx, cy, s, color, w) {
    var ox = s * 0.55, oy = -s * 0.42, segs = [], ell = [], labels = [];
    var W = s, H = s * 0.62;
    function P(x, y) { return [x, y]; }
    function lab(t, x, y) { labels.push({ t: t, x: x, y: y }); }

    if (kind === "chop4") {
      var A = P(cx - W, cy + H), B = P(cx + W, cy + H), C = P(cx + W + ox, cy + H + oy), D = P(cx - W + ox, cy + H + oy);
      var S = P(cx + ox * 0.5, cy - s);
      segs.push(seg(A[0], A[1], B[0], B[1]), seg(B[0], B[1], C[0], C[1]), seg(C[0], C[1], D[0], D[1], true), seg(D[0], D[1], A[0], A[1], true));
      segs.push(seg(S[0], S[1], A[0], A[1]), seg(S[0], S[1], B[0], B[1]), seg(S[0], S[1], C[0], C[1]), seg(S[0], S[1], D[0], D[1], true));
      lab("A", A[0] - 14, A[1] + 6); lab("B", B[0] + 6, B[1] + 6); lab("C", C[0] + 6, C[1] + 2); lab("D", D[0] - 14, D[1]); lab("S", S[0] - 4, S[1] - 6);
    } else if (kind === "chop3") {
      var a = P(cx - W, cy + H), b = P(cx + W, cy + H), c = P(cx + ox, cy + H + oy), s3 = P(cx, cy - s);
      segs.push(seg(a[0], a[1], b[0], b[1]), seg(b[0], b[1], c[0], c[1]), seg(c[0], c[1], a[0], a[1], true));
      segs.push(seg(s3[0], s3[1], a[0], a[1]), seg(s3[0], s3[1], b[0], b[1]), seg(s3[0], s3[1], c[0], c[1], true));
      lab("A", a[0] - 14, a[1] + 6); lab("B", b[0] + 6, b[1] + 6); lab("C", c[0] + 6, c[1]); lab("S", s3[0] - 4, s3[1] - 6);
    } else if (kind === "hop") {
      var fA = P(cx - W, cy + H), fB = P(cx + W, cy + H), fC = P(cx + W, cy - H), fD = P(cx - W, cy - H);
      var bA = P(fA[0] + ox, fA[1] + oy), bB = P(fB[0] + ox, fB[1] + oy), bC = P(fC[0] + ox, fC[1] + oy), bD = P(fD[0] + ox, fD[1] + oy);
      segs.push(seg(fA[0], fA[1], fB[0], fB[1]), seg(fB[0], fB[1], fC[0], fC[1]), seg(fC[0], fC[1], fD[0], fD[1]), seg(fD[0], fD[1], fA[0], fA[1]));
      segs.push(seg(bB[0], bB[1], bC[0], bC[1]), seg(bC[0], bC[1], bD[0], bD[1]));
      segs.push(seg(bA[0], bA[1], bB[0], bB[1], true), seg(bA[0], bA[1], bD[0], bD[1], true));
      segs.push(seg(fB[0], fB[1], bB[0], bB[1]), seg(fC[0], fC[1], bC[0], bC[1]), seg(fD[0], fD[1], bD[0], bD[1]), seg(fA[0], fA[1], bA[0], bA[1], true));
    } else if (kind === "langtru") {
      var tA = P(cx - W, cy + H), tB = P(cx + W, cy + H), tC = P(cx, cy - H);
      var uA = P(tA[0] + ox, tA[1] + oy), uB = P(tB[0] + ox, tB[1] + oy), uC = P(tC[0] + ox, tC[1] + oy);
      segs.push(seg(tA[0], tA[1], tB[0], tB[1]), seg(tB[0], tB[1], tC[0], tC[1]), seg(tC[0], tC[1], tA[0], tA[1]));
      segs.push(seg(uB[0], uB[1], uC[0], uC[1]), seg(uC[0], uC[1], uA[0], uA[1], true), seg(uA[0], uA[1], uB[0], uB[1], true));
      segs.push(seg(tB[0], tB[1], uB[0], uB[1]), seg(tC[0], tC[1], uC[0], uC[1]), seg(tA[0], tA[1], uA[0], uA[1], true));
    } else if (kind === "tru") {
      ell.push({ cx: cx, cy: cy - H, rx: W, ry: W * 0.32 });                       // mặt trên
      ell.push({ cx: cx, cy: cy + H, rx: W, ry: W * 0.32, a0: 0, a1: Math.PI });    // đáy trước
      ell.push({ cx: cx, cy: cy + H, rx: W, ry: W * 0.32, a0: Math.PI, a1: Math.PI * 2, dashed: true }); // đáy sau khuất
      segs.push(seg(cx - W, cy - H, cx - W, cy + H), seg(cx + W, cy - H, cx + W, cy + H));
    } else if (kind === "non") {
      ell.push({ cx: cx, cy: cy + H, rx: W, ry: W * 0.32, a0: 0, a1: Math.PI });
      ell.push({ cx: cx, cy: cy + H, rx: W, ry: W * 0.32, a0: Math.PI, a1: Math.PI * 2, dashed: true });
      segs.push(seg(cx, cy - s, cx - W, cy + H), seg(cx, cy - s, cx + W, cy + H));
    } else if (kind === "cau") {
      ell.push({ cx: cx, cy: cy, rx: s * 0.85, ry: s * 0.85 });                      // đường tròn lớn
      ell.push({ cx: cx, cy: cy, rx: s * 0.85, ry: s * 0.28, a0: 0, a1: Math.PI });   // xích đạo trước
      ell.push({ cx: cx, cy: cy, rx: s * 0.85, ry: s * 0.28, a0: Math.PI, a1: Math.PI * 2, dashed: true });
    }
    return { type: "solid", segs: segs, ellipses: ell, labels: labels, color: color, size: w };
  }
  global.VPSolid = { make: make };
})(window);
