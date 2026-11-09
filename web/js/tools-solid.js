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
    } else if (kind === "lapphuong") {
      // Hình lập phương: như hình hộp nhưng các mặt vuông
      var e = s * 0.78, o2 = e * 0.5, p2 = -e * 0.5;
      var gA = P(cx - e, cy + e), gB = P(cx + e, cy + e), gC = P(cx + e, cy - e), gD = P(cx - e, cy - e);
      var hA = P(gA[0] + o2, gA[1] + p2), hB = P(gB[0] + o2, gB[1] + p2), hC = P(gC[0] + o2, gC[1] + p2), hD = P(gD[0] + o2, gD[1] + p2);
      segs.push(seg(gA[0], gA[1], gB[0], gB[1]), seg(gB[0], gB[1], gC[0], gC[1]), seg(gC[0], gC[1], gD[0], gD[1]), seg(gD[0], gD[1], gA[0], gA[1]));
      segs.push(seg(hB[0], hB[1], hC[0], hC[1]), seg(hC[0], hC[1], hD[0], hD[1]));
      segs.push(seg(hA[0], hA[1], hB[0], hB[1], true), seg(hA[0], hA[1], hD[0], hD[1], true));
      segs.push(seg(gB[0], gB[1], hB[0], hB[1]), seg(gC[0], gC[1], hC[0], hC[1]), seg(gD[0], gD[1], hD[0], hD[1]), seg(gA[0], gA[1], hA[0], hA[1], true));
    } else if (kind === "chop-para" || kind === "chop-para-sa") {
      // Chóp đáy hình bình hành ABCD, đỉnh S (SA⊥đáy nếu -sa)
      var qA = P(cx - W, cy + H), qB = P(cx + W * 0.45, cy + H), qC = P(cx + W * 0.45 + ox, cy + H + oy), qD = P(cx - W + ox, cy + H + oy);
      var qS = (kind === "chop-para-sa") ? P(qA[0], qA[1] - s * 1.25) : P(cx + ox * 0.2, cy - s);
      segs.push(seg(qA[0], qA[1], qB[0], qB[1]), seg(qB[0], qB[1], qC[0], qC[1]), seg(qC[0], qC[1], qD[0], qD[1], true), seg(qD[0], qD[1], qA[0], qA[1], true));
      segs.push(seg(qS[0], qS[1], qA[0], qA[1]), seg(qS[0], qS[1], qB[0], qB[1]), seg(qS[0], qS[1], qC[0], qC[1]), seg(qS[0], qS[1], qD[0], qD[1], true));
      if (kind === "chop-para-sa") { var m = 10; segs.push(seg(qA[0], qA[1] - m, qA[0] + m, qA[1] - m), seg(qA[0] + m, qA[1] - m, qA[0] + m, qA[1])); }  // ký hiệu góc vuông
      lab("A", qA[0] - 14, qA[1] + 6); lab("B", qB[0] + 6, qB[1] + 6); lab("C", qC[0] + 6, qC[1] + 2); lab("D", qD[0] - 14, qD[1]); lab("S", qS[0] - 4, qS[1] - 6);
    } else if (kind === "chop-thang") {
      // Chóp đáy hình thang ABCD
      var rA = P(cx - W, cy + H), rB = P(cx + W, cy + H), rC = P(cx + W * 0.5 + ox, cy + H + oy), rD = P(cx - W * 0.5 + ox, cy + H + oy);
      var rS = P(cx + ox * 0.3, cy - s);
      segs.push(seg(rA[0], rA[1], rB[0], rB[1]), seg(rB[0], rB[1], rC[0], rC[1]), seg(rC[0], rC[1], rD[0], rD[1], true), seg(rD[0], rD[1], rA[0], rA[1], true));
      segs.push(seg(rS[0], rS[1], rA[0], rA[1]), seg(rS[0], rS[1], rB[0], rB[1]), seg(rS[0], rS[1], rC[0], rC[1]), seg(rS[0], rS[1], rD[0], rD[1], true));
      lab("A", rA[0] - 14, rA[1] + 6); lab("B", rB[0] + 6, rB[1] + 6); lab("C", rC[0] + 6, rC[1] + 2); lab("D", rD[0] - 12, rD[1]); lab("S", rS[0] - 4, rS[1] - 6);
    } else if (kind === "chop3-sa") {
      // Chóp tam giác SABC, SA⊥đáy
      var uA = P(cx - W * 0.7, cy + H), uB = P(cx + W, cy + H), uC = P(cx + ox, cy + H + oy), uS = P(uA[0], uA[1] - s * 1.25);
      segs.push(seg(uA[0], uA[1], uB[0], uB[1]), seg(uB[0], uB[1], uC[0], uC[1]), seg(uC[0], uC[1], uA[0], uA[1], true));
      segs.push(seg(uS[0], uS[1], uA[0], uA[1]), seg(uS[0], uS[1], uB[0], uB[1]), seg(uS[0], uS[1], uC[0], uC[1], true));
      var mm = 10; segs.push(seg(uA[0], uA[1] - mm, uA[0] + mm, uA[1] - mm), seg(uA[0] + mm, uA[1] - mm, uA[0] + mm, uA[1]));
      lab("A", uA[0] - 14, uA[1] + 6); lab("B", uB[0] + 6, uB[1] + 6); lab("C", uC[0] + 6, uC[1]); lab("S", uS[0] - 4, uS[1] - 6);
    } else if (kind === "batdien") {
      // Bát diện đều: 6 đỉnh (trên, dưới, 4 quanh "xích đạo")
      var T = P(cx, cy - s), Bt = P(cx, cy + s);
      var L = P(cx - W, cy), R = P(cx + W, cy), Fr = P(cx - ox * 0.6, cy + oy * 0.6 + s * 0.18), Bk = P(cx + ox * 0.6, cy - oy * 0.6 - s * 0.18);
      // cạnh ngoài (thấy)
      segs.push(seg(T[0], T[1], L[0], L[1]), seg(T[0], T[1], R[0], R[1]), seg(T[0], T[1], Fr[0], Fr[1]));
      segs.push(seg(Bt[0], Bt[1], L[0], L[1]), seg(Bt[0], Bt[1], R[0], R[1]), seg(Bt[0], Bt[1], Fr[0], Fr[1]));
      segs.push(seg(L[0], L[1], Fr[0], Fr[1]), seg(Fr[0], Fr[1], R[0], R[1]));
      // đỉnh sau + cạnh khuất (đứt)
      segs.push(seg(T[0], T[1], Bk[0], Bk[1], true), seg(Bt[0], Bt[1], Bk[0], Bk[1], true), seg(L[0], L[1], Bk[0], Bk[1], true), seg(Bk[0], Bk[1], R[0], R[1], true));
    }
    // Additional textbook solids, in the same oblique projection as existing figures.
    function edge(a, b, hidden) { segs.push(seg(a[0], a[1], b[0], b[1], hidden)); }
    function prism(base, top) {
      base.forEach(function (a, i) {
        var j = (i + 1) % base.length;
        edge(a, base[j], i >= base.length - 2);
        edge(top[i], top[j], false);
        edge(a, top[i], i === base.length - 1);
      });
    }
    if (kind === "langtru-xien" || kind === "langtru-para" || kind === "chop-cut" || kind === "plane") {
      var base = [[cx-W,cy+H],[cx+W*.55,cy+H],[cx+W+ox*.3,cy+H+oy],[cx-W+ox,cy+H+oy]];
      if (kind === "langtru-xien") base.splice(2,1);
      if (kind === "plane") base.forEach(function(a,i){edge(a,base[(i+1)%base.length]);});
      else {
        var top = base.map(function(a) {
          return kind === "chop-cut" ? [cx+(a[0]-cx)*.48, cy-s+(a[1]-cy-H)*.48] : [a[0]+s*.4,a[1]-s*1.5];
        });
        prism(base,top);
      }
    } else if (kind === "non-cut" || kind === "tru-cut") {
      var rt = kind === "non-cut" ? W*.48 : W;
      ell.push({cx:cx,cy:cy-H,rx:rt,ry:rt*.32});
      ell.push({cx:cx,cy:cy+H,rx:W,ry:W*.32,a0:0,a1:Math.PI});
      ell.push({cx:cx,cy:cy+H,rx:W,ry:W*.32,a0:Math.PI,a1:Math.PI*2,dashed:true});
      if (kind === "tru-cut") {
        // An oblique plane cuts the cylinder: tilted upper ellipse.
        ell[0].rot = -.28;
        edge([cx-W,cy+H],[cx-rt*Math.cos(.28),cy-H+rt*Math.sin(.28)]);
        edge([cx+W,cy+H],[cx+rt*Math.cos(.28),cy-H-rt*Math.sin(.28)]);
      } else { edge([cx-W,cy+H],[cx-rt,cy-H]); edge([cx+W,cy+H],[cx+rt,cy-H]); }
    } else if (kind === "nem1" || kind === "nem2") {
      var face = [[cx-W,cy+H],[cx+W,cy+H],[cx-W,cy-H]];
      if (kind === "nem2") face[2]=[cx+W*.3,cy-H];
      prism(face,face.map(function(a){return [a[0]+ox,a[1]+oy];}));
    } else if (kind === "chom-cau") {
      var radius=s, cut=cy+s*.2, angle=Math.asin(.2), rx=radius*Math.cos(angle);
      ell.push({cx:cx,cy:cy,rx:radius,ry:radius,a0:Math.PI-angle,a1:Math.PI*2+angle});
      ell.push({cx:cx,cy:cut,rx:rx,ry:rx*.25,a0:0,a1:Math.PI});
      ell.push({cx:cx,cy:cut,rx:rx,ry:rx*.25,a0:Math.PI,a1:Math.PI*2,dashed:true});
    }
    return { type: "solid", segs: segs, ellipses: ell, labels: labels, color: color, size: w };
  }
  global.VPSolid = { make: make };
})(window);
