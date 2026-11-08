// Máy tính khoa học HIỂN THỊ TỰ NHIÊN (kiểu fx-580: phân số/căn/lũy thừa như SGK).
// Tính bằng math.js, hiển thị bằng KaTeX. Không dùng thương hiệu thương mại.
(function (global) {
  "use strict";

  function build(body) {
    body.innerHTML = "";
    var st = { expr: "", ans: 0, mem: 0, deg: true, shift: false, sd: "auto" };

    var root = document.createElement("div"); root.className = "fx";
    // Màn hình
    var scr = document.createElement("div"); scr.className = "fx-screen";
    var topRow = document.createElement("div"); topRow.className = "fx-status";
    var badge = document.createElement("span"); badge.className = "fx-badge";
    topRow.appendChild(badge);
    var exprEl = document.createElement("div"); exprEl.className = "fx-expr";
    var resEl = document.createElement("div"); resEl.className = "fx-res";
    scr.appendChild(topRow); scr.appendChild(exprEl); scr.appendChild(resEl);
    root.appendChild(scr);

    // Bàn phím: mỗi phím [nhãn, loại, giá trị, lớp]
    // loại: ins (chèn), cmd (lệnh)
    var KEYS = [
      ["SHIFT", "cmd", "shift", "k-shift"], ["x⁻¹", "ins", "^(-1)", ""], ["DEG/RAD", "cmd", "deg", "k-mode"], ["DEL", "cmd", "del", "k-del"], ["AC", "cmd", "ac", "k-ac"],
      ["x²", "ins", "^2", ""], ["x³", "ins", "^3", ""], ["xⁿ", "ins", "^(", ""], ["√", "ins", "sqrt(", ""], ["ⁿ√", "ins", "nthRoot(", ""],
      ["sin", "ins", "sin(", ""], ["cos", "ins", "cos(", ""], ["tan", "ins", "tan(", ""], ["sin⁻¹", "ins", "asin(", ""], ["cos⁻¹", "ins", "acos(", ""],
      ["log", "ins", "log10(", ""], ["ln", "ins", "log(", ""], ["10ˣ", "ins", "10^(", ""], ["eˣ", "ins", "e^(", ""], ["tan⁻¹", "ins", "atan(", ""],
      ["(", "ins", "(", ""], [")", "ins", ")", ""], ["a/b", "ins", "/", ""], ["π", "ins", "pi", ""], ["e", "ins", "e", ""],
      ["x!", "ins", "!", ""], ["%", "ins", "/100", ""], ["Ans", "ins", "Ans", ""], ["M+", "cmd", "mplus", ""], ["RCL", "ins", "M", ""],
      ["7", "ins", "7", "k-num"], ["8", "ins", "8", "k-num"], ["9", "ins", "9", "k-num"], ["×", "ins", "*", "k-op"], ["÷", "ins", "/", "k-op"],
      ["4", "ins", "4", "k-num"], ["5", "ins", "5", "k-num"], ["6", "ins", "6", "k-num"], ["+", "ins", "+", "k-op"], ["−", "ins", "-", "k-op"],
      ["1", "ins", "1", "k-num"], ["2", "ins", "2", "k-num"], ["3", "ins", "3", "k-num"], ["×10ˣ", "ins", "*10^(", "k-op"], ["S⇔D", "cmd", "sd", ""],
      ["0", "ins", "0", "k-num"], [".", "ins", ".", "k-num"], ["(-)", "ins", "-", "k-num"], ["Ans=", "ins", "Ans", "k-num"], ["=", "cmd", "eq", "k-eq"],
    ];

    var pad = document.createElement("div"); pad.className = "fx-pad";
    KEYS.forEach(function (k) {
      var b = document.createElement("button"); b.type = "button";
      b.className = "fx-key " + (k[3] || "");
      b.innerHTML = k[0];
      b.onclick = function () { k[1] === "ins" ? ins(k[2]) : cmd(k[2]); };
      pad.appendChild(b);
    });
    root.appendChild(pad);
    body.appendChild(root);

    function ins(t) { st.expr += t; render(); }
    function cmd(c) {
      if (c === "del") st.expr = st.expr.slice(0, -1);
      else if (c === "ac") { st.expr = ""; resEl.textContent = ""; }
      else if (c === "deg") st.deg = !st.deg;
      else if (c === "sd") { st.sd = st.sd === "dec" ? "auto" : "dec"; }
      else if (c === "shift") st.shift = !st.shift;
      else if (c === "eq") { compute(true); return; }
      else if (c === "mplus") { var r = evaluate(st.expr); if (r.ok) st.mem += r.value; }
      render();
    }

    function scope() {
      var d = st.deg, toR = function (x) { return d ? x * Math.PI / 180 : x; }, fromR = function (x) { return d ? x * 180 / Math.PI : x; };
      return {
        Ans: st.ans, M: st.mem, pi: Math.PI, e: Math.E,
        sin: function (x) { return Math.sin(toR(x)); }, cos: function (x) { return Math.cos(toR(x)); }, tan: function (x) { return Math.tan(toR(x)); },
        asin: function (x) { return fromR(Math.asin(x)); }, acos: function (x) { return fromR(Math.acos(x)); }, atan: function (x) { return fromR(Math.atan(x)); },
      };
    }
    function evaluate(expr) {
      if (!expr.trim()) return { ok: false };
      try { return { ok: true, value: global.math.evaluate(expr, scope()) }; }
      catch (e) { return { ok: false, err: e }; }
    }
    function fmt(v) {
      if (typeof v === "number") {
        if (st.sd !== "dec") {
          try {
            var fr = global.math.fraction(v);
            if (fr.d !== 1 && Math.abs(fr.n) < 1e6 && fr.d < 1e6) return global.math.format(fr, { fraction: "ratio" });
          } catch (e) {}
        }
        return global.math.format(v, { precision: 12 });
      }
      return global.math.format(v, { precision: 12 });
    }
    function render() {
      badge.textContent = st.deg ? "DEG" : "RAD";
      // hiển thị tự nhiên
      try {
        var tex = st.expr ? global.math.parse(st.expr).toTex({ parenthesis: "auto" }) : "0";
        global.katex.render(tex, exprEl, { throwOnError: false, displayMode: false });
      } catch (e) { exprEl.textContent = st.expr || "0"; }
      var r = evaluate(st.expr);
      resEl.textContent = r.ok ? "= " + fmt(r.value) : "";
    }
    function compute(store) {
      var r = evaluate(st.expr);
      if (r.ok) { if (store) st.ans = typeof r.value === "number" ? r.value : st.ans; resEl.textContent = "= " + fmt(r.value); }
      else resEl.textContent = "Lỗi cú pháp";
    }
    render();
  }

  global.VPSci = { build: build };
})(window);
