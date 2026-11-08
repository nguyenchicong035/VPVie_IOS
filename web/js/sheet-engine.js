// Engine công thức bảng tính (tự viết, nguồn mở): tham chiếu ô/vùng, hàm SUM/AVERAGE/COUNT/MAX/MIN/IF…
(function (global) {
  "use strict";
  function colToIdx(s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n - 1; }
  function idxToCol(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function cellRC(ref) { var m = /^([A-Z]+)(\d+)$/.exec(ref); return { c: colToIdx(m[1]), r: parseInt(m[2], 10) - 1 }; }

  // getRaw(r,c) -> chuỗi gốc trong ô; trả về object engine để tính.
  function makeEngine(getRaw, rows, cols) {
    var cache = {}, stack = {};
    function num(v) { return typeof v === "number" ? v : (v === "" || v == null ? 0 : (isFinite(parseFloat(v)) ? parseFloat(v) : 0)); }

    function compute(r, c) {
      var key = r + ":" + c;
      if (key in cache) return cache[key];
      if (stack[key]) return { t: "err", v: "#VÒNG" };
      stack[key] = 1;
      var raw = (getRaw(r, c) || "").toString();
      var out;
      if (raw.charAt(0) === "=") {
        try { out = { t: "num", v: evalExpr(raw.slice(1)) }; if (typeof out.v === "string") out.t = "text"; }
        catch (e) { out = { t: "err", v: "#LỖI" }; }
      } else if (raw.trim() !== "" && isFinite(parseFloat(raw)) && /^-?[\d.,]+%?$/.test(raw.trim())) {
        var t = raw.trim(); var pct = t.indexOf("%") >= 0; var n = parseFloat(t.replace(/,/g, "").replace("%", "")); out = { t: "num", v: pct ? n / 100 : n };
      } else out = { t: "text", v: raw };
      delete stack[key]; cache[key] = out; return out;
    }
    function cellVal(ref) { var rc = cellRC(ref); if (rc.r < 0 || rc.c < 0) return 0; var o = compute(rc.r, rc.c); return o.t === "num" ? o.v : (o.t === "text" ? o.v : NaN); }
    function rangeVals(a, b) {
      var A = cellRC(a), B = cellRC(b), out = [];
      for (var r = Math.min(A.r, B.r); r <= Math.max(A.r, B.r); r++) for (var c = Math.min(A.c, B.c); c <= Math.max(A.c, B.c); c++) { var o = compute(r, c); out.push(o.t === "num" ? o.v : (o.t === "text" && o.v !== "" ? o.v : null)); }
      return out;
    }

    var FUN = {
      SUM: function (a) { return a.reduce(function (s, x) { return s + num(x); }, 0); },
      AVERAGE: function (a) { var n = a.filter(function (x) { return typeof x === "number"; }); return n.length ? n.reduce(function (s, x) { return s + x; }, 0) / n.length : 0; },
      AVG: function (a) { return FUN.AVERAGE(a); },
      COUNT: function (a) { return a.filter(function (x) { return typeof x === "number"; }).length; },
      COUNTA: function (a) { return a.filter(function (x) { return x !== null && x !== ""; }).length; },
      MAX: function (a) { var n = a.filter(function (x) { return typeof x === "number"; }); return n.length ? Math.max.apply(0, n) : 0; },
      MIN: function (a) { var n = a.filter(function (x) { return typeof x === "number"; }); return n.length ? Math.min.apply(0, n) : 0; },
      ROUND: function (a) { var d = a[1] || 0, m = Math.pow(10, d); return Math.round(num(a[0]) * m) / m; },
      ABS: function (a) { return Math.abs(num(a[0])); }, SQRT: function (a) { return Math.sqrt(num(a[0])); },
      IF: function (a) { return a[0] ? a[1] : a[2]; }, AND: function (a) { return a.every(Boolean); }, OR: function (a) { return a.some(Boolean); },
    };

    function evalExpr(src) {
      var pos = 0; var s = src;
      function ws() { while (/\s/.test(s[pos])) pos++; }
      function expr() { var v = term(); ws(); while (s[pos] === "+" || s[pos] === "-") { var op = s[pos++]; var r = term(); v = op === "+" ? num(v) + num(r) : num(v) - num(r); ws(); } return v; }
      function term() { var v = factor(); ws(); while (s[pos] === "*" || s[pos] === "/") { var op = s[pos++]; var r = factor(); v = op === "*" ? num(v) * num(r) : num(v) / num(r); ws(); } return v; }
      function factor() { var v = unary(); ws(); while (s[pos] === "^") { pos++; v = Math.pow(num(v), num(unary())); ws(); } return v; }
      function unary() { ws(); if (s[pos] === "-") { pos++; return -num(unary()); } if (s[pos] === "+") { pos++; return unary(); } return primary(); }
      function primary() {
        ws();
        if (s[pos] === "(") { pos++; var v = compare(); ws(); if (s[pos] === ")") pos++; return v; }
        var m = /^[A-Z]+[0-9]+/.exec(s.slice(pos));
        if (/[A-Za-z]/.test(s[pos])) {
          var nm = /^[A-Za-z]+/.exec(s.slice(pos))[0]; var up = nm.toUpperCase();
          if (s[pos + nm.length] === "(" || (/\s*\(/).test(s.slice(pos + nm.length))) {
            pos += nm.length; ws(); pos++; // '('
            var args = []; ws();
            if (s[pos] !== ")") { do { args.push(arg()); ws(); } while (s[pos] === "," && pos++); }
            ws(); if (s[pos] === ")") pos++;
            var flat = []; args.forEach(function (x) { Array.isArray(x) ? flat.push.apply(flat, x) : flat.push(x); });
            if (FUN[up]) return FUN[up](Array.isArray(args[0]) || args.length !== 1 ? flat : [args[0]].concat(flat.slice(1)));
            throw new Error("fn");
          }
          // tham chiếu ô hoặc vùng
          var ref = m ? m[0] : null;
          if (ref) {
            pos += ref.length; ws();
            if (s[pos] === ":") { pos++; var r2 = /^[A-Z]+[0-9]+/.exec(s.slice(pos))[0]; pos += r2.length; return rangeVals(ref, r2); }
            return cellVal(ref);
          }
        }
        var numm = /^-?[0-9]*\.?[0-9]+/.exec(s.slice(pos)); if (numm) { pos += numm[0].length; return parseFloat(numm[0]); }
        if (s[pos] === '"') { pos++; var str = ""; while (s[pos] && s[pos] !== '"') str += s[pos++]; pos++; return str; }
        throw new Error("parse");
      }
      function arg() { return compare(); }
      function compare() { var v = expr(); ws(); var op = s.slice(pos, pos + 2); if (op === ">=" || op === "<=" || op === "<>") { pos += 2; var r = expr(); return op === ">=" ? num(v) >= num(r) : op === "<=" ? num(v) <= num(r) : v != r; } if (s[pos] === ">" || s[pos] === "<" || s[pos] === "=") { var o = s[pos++]; var r2 = expr(); return o === ">" ? num(v) > num(r2) : o === "<" ? num(v) < num(r2) : v == r2; } return v; }
      return compare();
    }

    return { compute: compute, clear: function () { cache = {}; stack = {}; } };
  }

  global.SheetEngine = { make: makeEngine, colToIdx: colToIdx, idxToCol: idxToCol, cellRC: cellRC };
})(window);
