// VPVie – Bảng tính + Hỏi Excel. Lưới ô có công thức thật; hỏi tiếng Việt -> tính & ghi công thức.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var ROWS = 40, COLS = 12;
  var data = {};                 // "r:c" -> raw
  var E = window.SheetEngine;
  function getRaw(r, c) { return data[r + ":" + c] || ""; }
  var engine = E.make(getRaw);
  var sel = { r: 0, c: 0 };

  function fmt(o) {
    if (!o) return "";
    if (o.t === "num") { var v = o.v; if (typeof v !== "number") return v; if (!isFinite(v)) return "#∞"; var r = Math.round(v * 1e9) / 1e9; return ("" + r).replace(".", ","); }
    return o.v;
  }

  var grid = $("grid");
  function build() {
    var h = '<table class="xl"><thead><tr><th class="corner"></th>';
    for (var c = 0; c < COLS; c++) h += '<th data-c="' + c + '">' + E.idxToCol(c) + "</th>";
    h += "</tr></thead><tbody>";
    for (var r = 0; r < ROWS; r++) {
      h += '<tr><th class="rownum">' + (r + 1) + "</th>";
      for (var c2 = 0; c2 < COLS; c2++) h += '<td><input class="cell" data-r="' + r + '" data-c="' + c2 + '" /></td>';
      h += "</tr>";
    }
    h += "</tbody></table>";
    grid.innerHTML = h;
    grid.querySelectorAll("input.cell").forEach(function (inp) {
      inp.addEventListener("focus", function () { var r = +inp.dataset.r, c = +inp.dataset.c; sel = { r: r, c: c }; inp.value = getRaw(r, c); $("fx").value = getRaw(r, c); markSel(); });
      inp.addEventListener("input", function () { data[inp.dataset.r + ":" + inp.dataset.c] = inp.value; $("fx").value = inp.value; });
      inp.addEventListener("blur", function () { recompute(); });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); var r = +inp.dataset.r; var nx = grid.querySelector('input[data-r="' + (r + 1) + '"][data-c="' + inp.dataset.c + '"]'); recompute(); if (nx) nx.focus(); } });
    });
    recompute();
  }
  function markSel() { grid.querySelectorAll("input.cell").forEach(function (i) { i.classList.toggle("sel", +i.dataset.r === sel.r && +i.dataset.c === sel.c); }); }
  function recompute() {
    engine.clear();
    var active = document.activeElement;
    grid.querySelectorAll("input.cell").forEach(function (inp) {
      if (inp === active) return;
      var r = +inp.dataset.r, c = +inp.dataset.c;
      inp.value = (getRaw(r, c) === "") ? "" : fmt(engine.compute(r, c));
    });
    scheduleSave();
  }
  $("fx").addEventListener("input", function () { data[sel.r + ":" + sel.c] = this.value; });
  $("fx").addEventListener("change", function () { recompute(); });

  // Lưu
  var t = null; function scheduleSave() { clearTimeout(t); t = setTimeout(function () { try { localStorage.setItem("vpvie.sheet", JSON.stringify(data)); } catch (e) {} }, 500); }
  try { var sv = localStorage.getItem("vpvie.sheet"); if (sv) data = JSON.parse(sv); } catch (e) {}

  // CSV
  $("csv-in").onclick = function () { $("csv-file").click(); };
  $("csv-file").onchange = function () { var f = this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { loadCSV(rd.result); }; rd.readAsText(f); this.value = ""; };
  function loadCSV(txt) {
    data = {}; var lines = txt.replace(/\r/g, "").split("\n");
    lines.forEach(function (ln, r) { if (r >= ROWS) return; var cells = parseCSVLine(ln); cells.forEach(function (v, c) { if (c < COLS && v !== "") data[r + ":" + c] = v; }); });
    build();
  }
  function parseCSVLine(ln) { var out = [], cur = "", q = false; for (var i = 0; i < ln.length; i++) { var ch = ln[i]; if (q) { if (ch === '"' && ln[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else { if (ch === '"') q = true; else if (ch === "," || ch === ";" || ch === "\t") { out.push(cur); cur = ""; } else cur += ch; } } out.push(cur); return out; }
  $("csv-out").onclick = function () {
    var ua = usedArea(); var rows = [];
    for (var r = 0; r <= ua.maxR; r++) { var row = []; for (var c = 0; c <= ua.maxC; c++) { var o = engine.compute(r, c); var v = getRaw(r, c) === "" ? "" : fmt(o); if (/[",;\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"'; row.push(v); } rows.push(row.join(",")); }
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + rows.join("\n")], { type: "text/csv" })); a.download = "bangtinh.csv"; a.click();
  };
  $("row-add").onclick = function () { ROWS += 10; build(); };
  $("col-add").onclick = function () { COLS += 4; build(); };

  function usedArea() { var maxR = 0, maxC = 0; Object.keys(data).forEach(function (k) { var p = k.split(":"); maxR = Math.max(maxR, +p[0]); maxC = Math.max(maxC, +p[1]); }); return { maxR: maxR, maxC: maxC }; }

  // ---- Hỏi Excel (rule-based tiếng Việt)
  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim(); }
  function headers(range) {
    var hs = [];
    for (var c = range.c0; c <= range.c1; c++) { var o = engine.compute(range.r0, c); hs.push({ c: c, name: (o.t === "text" ? o.v : "" + o.v) || E.idxToCol(c) }); }
    return hs;
  }
  function parseRange(txt) {
    var m = /([A-Z]+)(\d+)\s*:\s*([A-Z]+)(\d+)/i.exec(txt || "");
    if (m) return { r0: +m[2] - 1, c0: E.colToIdx(m[1].toUpperCase()), r1: +m[4] - 1, c1: E.colToIdx(m[3].toUpperCase()) };
    var ua = usedArea(); return { r0: 0, c0: 0, r1: ua.maxR, c1: ua.maxC };
  }
  function findCol(hs, req) { var best = null; hs.forEach(function (h) { var n = norm(h.name); if (n && norm(req).indexOf(n) >= 0 && (!best || n.length > norm(best.name).length)) best = h; }); return best; }
  function agg(req) {
    var q = norm(req);
    if (/(trung binh|binh quan|\btb\b)/.test(q)) return { fn: "AVERAGE", vi: "Trung bình" };
    if (/(dem|so dong|bao nhieu dong|so ban ghi)/.test(q)) return { fn: "COUNT", vi: "Đếm" };
    if (/(lon nhat|cao nhat|max)/.test(q)) return { fn: "MAX", vi: "Lớn nhất" };
    if (/(nho nhat|thap nhat|min)/.test(q)) return { fn: "MIN", vi: "Nhỏ nhất" };
    if (/(tong|cong)/.test(q)) return { fn: "SUM", vi: "Tổng" };
    return { fn: "SUM", vi: "Tổng" };
  }
  function colData(range, c) { var a = []; for (var r = range.r0 + 1; r <= range.r1; r++) { var o = engine.compute(r, c); a.push(o.t === "num" ? o.v : null); } return a; }
  var FN = { SUM: function (a) { return a.reduce(function (s, x) { return s + (x || 0); }, 0); }, AVERAGE: function (a) { var n = a.filter(function (x) { return typeof x === "number"; }); return n.length ? n.reduce(function (s, x) { return s + x; }, 0) / n.length : 0; }, COUNT: function (a) { return a.filter(function (x) { return typeof x === "number"; }).length; }, MAX: function (a) { var n = a.filter(function (x) { return typeof x === "number"; }); return n.length ? Math.max.apply(0, n) : 0; }, MIN: function (a) { var n = a.filter(function (x) { return typeof x === "number"; }); return n.length ? Math.min.apply(0, n) : 0; } };

  $("ask-btn").onclick = function () { $("ask-panel").classList.toggle("show"); };
  $("ask-run").onclick = function () {
    var req = $("ask-text").value.trim(); if (!req) return;
    var range = parseRange($("ask-range").value.trim());
    var hs = headers(range);
    var A = agg(req);
    var groupMatch = /theo\s+(.+)$/i.exec(req); var group = null;
    if (groupMatch) group = findCol(hs, "theo " + groupMatch[1]) || findCol(hs, groupMatch[1]);
    // cột mục tiêu = header khớp (bỏ cột group)
    var reqNoGroup = groupMatch ? req.slice(0, groupMatch.index) : req;
    var target = findCol(hs, reqNoGroup) || findCol(hs, req);
    if (A.fn !== "COUNT" && !target) { showResult("Không tìm thấy cột phù hợp trong yêu cầu. Các cột: " + hs.map(function (h) { return h.name; }).join(", "), ""); return; }
    var colLetter = target ? E.idxToCol(target.c) : null;
    var r1 = range.r0 + 2, r2 = range.r1 + 1;
    var out, formula, rows = [];
    if (group) {
      var gLetter = E.idxToCol(group.c);
      var seen = {}, order = [];
      for (var r = range.r0 + 1; r <= range.r1; r++) { var gv = (function () { var o = engine.compute(r, group.c); return o.t === "num" ? "" + o.v : o.v; })(); if (gv === "" ) continue; if (!(gv in seen)) { seen[gv] = []; order.push(gv); } var tv = target ? engine.compute(r, target.c) : { t: "num", v: 1 }; seen[gv].push(tv.t === "num" ? tv.v : null); }
      order.forEach(function (g) { rows.push({ k: g, v: FN[A.fn](seen[g]) }); });
      formula = A.fn === "COUNT" ? '=COUNTIF(' + gLetter + r1 + ":" + gLetter + r2 + ', "…")' : "=" + (A.fn === "SUM" ? "SUMIF" : A.fn === "AVERAGE" ? "AVERAGEIF" : A.fn + "IFS") + "(" + gLetter + r1 + ":" + gLetter + r2 + ', "…", ' + colLetter + r1 + ":" + colLetter + r2 + ")";
      out = A.vi + " " + (target ? target.name : "số dòng") + " theo " + group.name;
    } else {
      var arr = target ? colData(range, target.c) : colData(range, range.c0);
      var val = A.fn === "COUNT" ? arr.filter(function (x) { return x !== null; }).length : FN[A.fn](arr);
      rows.push({ k: "", v: val });
      formula = "=" + A.fn + "(" + (colLetter || E.idxToCol(range.c0)) + r1 + ":" + (colLetter || E.idxToCol(range.c0)) + r2 + ")";
      out = A.vi + " của cột “" + (target ? target.name : "") + "”";
    }
    writeResult(out, rows, formula, group);
    showResult(out + (rows.length === 1 ? " = " + fmtNum(rows[0].v) : ""), formula, rows, group);
  };
  function fmtNum(v) { return ("" + (Math.round(v * 1000) / 1000)).replace(".", ","); }
  function writeResult(title, rows, formula, group) {
    var ua = usedArea(); var c0 = ua.maxC + 2, r0 = 0;
    data[r0 + ":" + c0] = title;
    if (group) { data[(r0 + 1) + ":" + c0] = group.name; data[(r0 + 1) + ":" + (c0 + 1)] = "Kết quả"; rows.forEach(function (x, i) { data[(r0 + 2 + i) + ":" + c0] = x.k; data[(r0 + 2 + i) + ":" + (c0 + 1)] = "" + x.v; }); }
    else { data[(r0 + 1) + ":" + c0] = "Kết quả"; data[(r0 + 1) + ":" + (c0 + 1)] = "" + rows[0].v; }
    data[(r0 + rows.length + 2) + ":" + c0] = "Công thức:"; data[(r0 + rows.length + 2) + ":" + (c0 + 1)] = "'" + formula;
    if (c0 + 1 >= COLS) { COLS = c0 + 2; }
    build();
  }
  function showResult(title, formula, rows, group) {
    var el = $("ask-result"); var h = "<div class='ar-title'>" + title + "</div>";
    if (formula) h += "<div class='ar-fx'>" + formula + "</div>";
    if (rows && rows.length > 1) { h += "<table class='ar-tbl'><tr><th>" + (group ? group.name : "") + "</th><th>Kết quả</th></tr>"; rows.forEach(function (x) { h += "<tr><td>" + x.k + "</td><td>" + fmtNum(x.v) + "</td></tr>"; }); h += "</table>"; }
    h += "<div class='ar-note'>Đã ghi kết quả + công thức vào bảng (bên phải dữ liệu).</div>";
    el.innerHTML = h;
  }

  build();
})();
