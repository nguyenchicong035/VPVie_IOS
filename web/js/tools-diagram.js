// Sơ đồ Vật lí & Sinh học (SVG): mạch điện, sơ đồ lực, phả hệ, phân tử ADN.
(function (global) {
  "use strict";
  var NV = "#1F3D55";

  function arrow(x1, y1, x2, y2, label, color) {
    color = color || "#C21807";
    var ang = Math.atan2(y2 - y1, x2 - x1), h = 10, w = 5;
    var ax = x2 - h * Math.cos(ang), ay = y2 - h * Math.sin(ang);
    var p1x = ax - w * Math.sin(ang), p1y = ay + w * Math.cos(ang);
    var p2x = ax + w * Math.sin(ang), p2y = ay - w * Math.cos(ang);
    var s = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="2.3"/>';
    s += '<polygon points="' + x2 + ',' + y2 + ' ' + p1x.toFixed(1) + ',' + p1y.toFixed(1) + ' ' + p2x.toFixed(1) + ',' + p2y.toFixed(1) + '" fill="' + color + '"/>';
    if (label) s += '<text x="' + (x2 + 8 * Math.cos(ang)).toFixed(0) + '" y="' + (y2 + 8 * Math.sin(ang)).toFixed(0) + '" font-size="15" font-style="italic" font-weight="600" fill="' + color + '">' + label + '</text>';
    return s;
  }
  function svg(w, h, inner) { return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="background:#fff">' + inner + '</svg>'; }
  function txt(x, y, t, sz, it) { return '<text x="' + x + '" y="' + y + '" font-size="' + (sz || 13) + '" fill="' + NV + '"' + (it ? ' font-style="italic"' : '') + '>' + t + '</text>'; }

  // ---------- MẠCH ĐIỆN ----------
  function circuitSeries() {
    var g = '<g fill="none" stroke="' + NV + '" stroke-width="2.5" stroke-linecap="round">';
    g += '<path d="M50,50 H82"/><path d="M118,50 H163"/><path d="M207,50 H250"/><path d="M250,50 V82"/><path d="M250,108 V140"/><path d="M250,140 H168"/><path d="M132,140 H50"/><path d="M50,140 V50"/></g>';
    // công tắc K
    g += '<circle cx="82" cy="50" r="2.6" fill="' + NV + '"/><circle cx="118" cy="50" r="2.6" fill="' + NV + '"/><line x1="82" y1="50" x2="114" y2="37" stroke="' + NV + '" stroke-width="2.5"/>' + txt(92, 30, "K");
    // điện trở R (hình chữ nhật)
    g += '<rect x="163" y="42" width="44" height="16" fill="#fff" stroke="' + NV + '" stroke-width="2.5"/>' + txt(178, 34, "R");
    // nguồn E
    g += '<line x1="132" y1="140" x2="146" y2="140" stroke="' + NV + '" stroke-width="2.5"/><line x1="158" y1="140" x2="168" y2="140" stroke="' + NV + '" stroke-width="2.5"/>';
    g += '<line x1="146" y1="126" x2="146" y2="154" stroke="' + NV + '" stroke-width="2"/><line x1="158" y1="132" x2="158" y2="148" stroke="' + NV + '" stroke-width="5"/>' + txt(138, 172, "E, r");
    // bóng đèn Đ
    g += '<circle cx="250" cy="95" r="13" fill="#fff" stroke="' + NV + '" stroke-width="2.5"/><line x1="241" y1="86" x2="259" y2="104" stroke="' + NV + '" stroke-width="2"/><line x1="259" y1="86" x2="241" y2="104" stroke="' + NV + '" stroke-width="2"/>' + txt(266, 99, "Đ");
    return svg(300, 185, g);
  }
  function circuitParallel() {
    var g = '<g fill="none" stroke="' + NV + '" stroke-width="2.5" stroke-linecap="round">';
    g += '<path d="M70,45 H230"/><path d="M70,150 H230"/>';          // 2 thanh ray
    g += '<path d="M70,150 V110"/><path d="M70,78 V45"/>';           // nhánh trái (nguồn)
    g += '<path d="M130,45 V82"/><path d="M130,108 V150"/>';         // nhánh đèn 1
    g += '<path d="M190,45 V82"/><path d="M190,108 V150"/>';         // nhánh đèn 2
    g += '<path d="M230,45 V150"/></g>';                              // phải
    // nguồn trên nhánh trái
    g += '<line x1="62" y1="94" x2="78" y2="94" stroke="' + NV + '" stroke-width="5"/><line x1="58" y1="108" x2="82" y2="108" stroke="' + NV + '" stroke-width="2"/>' + txt(30, 102, "E");
    // 2 bóng đèn
    ["130", "190"].forEach(function (x) { x = +x; g += '<circle cx="' + x + '" cy="95" r="13" fill="#fff" stroke="' + NV + '" stroke-width="2.5"/><line x1="' + (x - 9) + '" y1="86" x2="' + (x + 9) + '" y2="104" stroke="' + NV + '" stroke-width="2"/><line x1="' + (x + 9) + '" y1="86" x2="' + (x - 9) + '" y2="104" stroke="' + NV + '" stroke-width="2"/>'; });
    g += txt(120, 175, "Đ₁") + txt(180, 175, "Đ₂");
    return svg(300, 190, g);
  }

  // ---------- SƠ ĐỒ LỰC ----------
  function hatch(x1, y, x2) { var s = ''; for (var x = x1 + 6; x < x2; x += 15) s += '<line x1="' + x + '" y1="' + y + '" x2="' + (x - 10) + '" y2="' + (y + 11) + '" stroke="#9aa7b4" stroke-width="1.4"/>'; return s; }
  function forceNgang() {
    var cx = 150, cy = 130, g = '';
    g += '<line x1="30" y1="150" x2="270" y2="150" stroke="' + NV + '" stroke-width="2.5"/>' + hatch(30, 150, 270);
    g += '<rect x="115" y="110" width="70" height="40" fill="#E6F0FB" stroke="' + NV + '" stroke-width="2"/>';
    g += arrow(cx, cy, cx, 202, "P") + arrow(cx, cy, cx, 64, "N", "#1A7F37") + arrow(cx, cy, 244, cy, "F", "#1F6FEB") + arrow(cx, cy, 58, cy, "Fₘₛ", "#E08A1E");
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="2.5" fill="' + NV + '"/>';
    return svg(300, 212, g);
  }
  function forceTreo() {
    var cx = 150, g = '';
    g += '<line x1="60" y1="40" x2="240" y2="40" stroke="' + NV + '" stroke-width="2.5"/>' + hatch(60, 28, 240).replace(/y1="28"/g, 'y1="40"').replace(/y2="39"/g, 'y2="28"');
    g += '<line x1="' + cx + '" y1="40" x2="' + cx + '" y2="120" stroke="' + NV + '" stroke-width="2"/>';
    g += '<rect x="125" y="120" width="50" height="40" fill="#E6F0FB" stroke="' + NV + '" stroke-width="2"/>';
    g += arrow(cx, 120, cx, 60, "T", "#1A7F37") + arrow(cx, 140, cx, 205, "P");
    return svg(300, 215, g);
  }
  function forceNghieng() {
    var g = '';
    g += '<path d="M40,170 H250 V60 Z" fill="#EEF3F7" stroke="' + NV + '" stroke-width="2.5"/>' + hatch(40, 170, 250);
    // góc α
    g += '<path d="M90,170 A50,50 0 0,1 72,153" fill="none" stroke="' + NV + '" stroke-width="1.4"/>' + txt(96, 164, "α");
    var cx = 150, cy = 112;
    // hộp trên dốc (xoay theo độ dốc ~ -27.6°)
    g += '<g transform="translate(' + cx + ',' + cy + ') rotate(-27.6)"><rect x="-26" y="-20" width="52" height="30" fill="#E6F0FB" stroke="' + NV + '" stroke-width="2"/></g>';
    g += arrow(cx, cy, cx, 192, "P") + arrow(cx, cy, 122, 59, "N", "#1A7F37") + arrow(cx, cy, 203, 84, "Fₘₛ", "#E08A1E");
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="2.5" fill="' + NV + '"/>';
    return svg(300, 205, g);
  }

  // ---------- PHẢ HỆ ----------
  function sq(x, y, fill) { return '<rect x="' + (x - 13) + '" y="' + (y - 13) + '" width="26" height="26" fill="' + (fill ? NV : "#fff") + '" stroke="' + NV + '" stroke-width="2"/>'; }
  function ci(x, y, fill) { return '<circle cx="' + x + '" cy="' + y + '" r="14" fill="' + (fill ? NV : "#fff") + '" stroke="' + NV + '" stroke-width="2"/>'; }
  function pedigree() {
    var g = '<g fill="none" stroke="' + NV + '" stroke-width="2">';
    g += '<line x1="83" y1="45" x2="117" y2="45"/>';             // hôn phối I
    g += '<line x1="100" y1="45" x2="100" y2="80"/>';           // xuống đời II
    g += '<line x1="60" y1="80" x2="190" y2="80"/>';            // thanh anh em
    g += '<line x1="60" y1="80" x2="60" y2="110"/><line x1="125" y1="80" x2="125" y2="110"/><line x1="190" y1="80" x2="190" y2="110"/></g>';
    g += sq(70, 45) + ci(130, 45);                              // bố mẹ
    g += ci(60, 123) + sq(125, 123, true) + ci(190, 123);      // con (1 bị bệnh)
    // chú thích
    g += sq(40, 170) + txt(58, 175, "Nam") + ci(110, 170) + txt(128, 175, "Nữ");
    g += sq(180, 170, true) + txt(198, 175, "Bị bệnh");
    return svg(300, 195, g);
  }

  // ---------- ADN ----------
  function dna() {
    var H = 240, g = '', cx = 110, amp = 36, base = ["A", "T", "G", "C"], colL = { A: "#C21807", T: "#E08A1E", G: "#1F6FEB", C: "#1A7F37" };
    var left = '', right = '';
    for (var y = 20; y <= H - 20; y += 4) {
      var s = Math.sin(y / 26), xl = cx - amp * s, xr = cx + amp * s;
      left += (y === 20 ? "M" : "L") + xl.toFixed(1) + "," + y + " ";
      right += (y === 20 ? "M" : "L") + xr.toFixed(1) + "," + y + " ";
    }
    g += '<path d="' + left + '" fill="none" stroke="#51606c" stroke-width="3"/><path d="' + right + '" fill="none" stroke="#51606c" stroke-width="3"/>';
    for (var k = 0, yy = 34; yy <= H - 30; yy += 22, k++) {
      var ss = Math.sin(yy / 26), xl2 = cx - amp * ss, xr2 = cx + amp * ss;
      if (Math.abs(xr2 - xl2) < 10) continue; // bỏ chỗ bắt chéo
      var pair = k % 2 ? ["G", "C"] : ["A", "T"];
      g += '<line x1="' + xl2.toFixed(1) + '" y1="' + yy + '" x2="' + xr2.toFixed(1) + '" y2="' + yy + '" stroke="' + colL[pair[0]] + '" stroke-width="5"/>';
      g += '<text x="' + (cx - amp - 14) + '" y="' + (yy + 4) + '" font-size="11" fill="' + colL[pair[0]] + '">' + pair[0] + '</text>';
      g += '<text x="' + (cx + amp + 6) + '" y="' + (yy + 4) + '" font-size="11" fill="' + colL[pair[1]] + '">' + pair[1] + '</text>';
    }
    g += txt(40, H - 6, "ADN: A–T, G–X", 12);
    return svg(220, H, g);
  }

  var VARIANTS = {
    circuit: [["noitiep", "Mạch nối tiếp", circuitSeries], ["songsong", "Mạch song song", circuitParallel]],
    force: [["ngang", "Mặt phẳng ngang", forceNgang], ["nghieng", "Mặt phẳng nghiêng", forceNghieng], ["treo", "Vật treo dây", forceTreo]],
    pedigree: [["ph", "Sơ đồ phả hệ", pedigree]],
    dna: [["adn", "Phân tử ADN", dna]]
  };

  function build(body, kind, data) {
    body.innerHTML = "";
    var vs = VARIANTS[kind]; if (!vs) return;
    data = data || {}; data.v = data.v || vs[0][0];
    var host = document.createElement("div"); host.className = "dg-svg";
    function draw() { var v = vs.filter(function (x) { return x[0] === data.v; })[0] || vs[0]; host.innerHTML = v[2](); }
    if (vs.length > 1) {
      var sel = document.createElement("select"); sel.className = "dg-sel";
      vs.forEach(function (v) { var o = document.createElement("option"); o.value = v[0]; o.textContent = v[1]; if (v[0] === data.v) o.selected = true; sel.appendChild(o); });
      sel.onchange = function () { data.v = sel.value; draw(); if (data._save) data._save(); };
      body.appendChild(sel);
    }
    body.appendChild(host); draw();
  }

  global.VPDiagram = { build: build };
})(window);
