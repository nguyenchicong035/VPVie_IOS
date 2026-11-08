// Máy tính khoa học + máy tính đồ thị (có thanh trượt tham số). Dùng math.js và function-plot (nguồn mở).
(function (global) {
  "use strict";
  var FUNCS = ["sin", "cos", "tan", "cot", "asin", "acos", "atan", "sqrt", "log", "ln", "exp", "abs", "pi", "e", "x"];

  function buildSciCalc(body) {
    body.innerHTML = "";
    var wrap = document.createElement("div"); wrap.className = "calc";
    var disp = document.createElement("input"); disp.className = "calc-disp"; disp.placeholder = "Nhập biểu thức…";
    var out = document.createElement("div"); out.className = "calc-out"; out.textContent = "= ";
    wrap.appendChild(disp); wrap.appendChild(out);
    var keys = ["7","8","9","/","sqrt(","4","5","6","*","^","1","2","3","-","(","0",".","=","+",")"];
    var pad = document.createElement("div"); pad.className = "calc-pad";
    keys.forEach(function (k) {
      var b = document.createElement("button"); b.textContent = k; b.type = "button";
      b.onclick = function () {
        if (k === "=") { evalIt(); return; }
        disp.value += k; disp.focus(); evalIt();
      };
      pad.appendChild(b);
    });
    var row = document.createElement("div"); row.className = "calc-fns";
    ["sin(","cos(","tan(","log(","ln(","π","C"].forEach(function (f) {
      var b = document.createElement("button"); b.textContent = f.replace("(",""); b.type = "button";
      b.onclick = function () { if (f === "C") { disp.value = ""; out.textContent = "= "; } else disp.value += (f === "π" ? "pi" : f); disp.focus(); evalIt(); };
      row.appendChild(b);
    });
    wrap.appendChild(row); wrap.appendChild(pad);
    function evalIt() {
      var s = disp.value.replace(/ln\(/g, "log(").replace(/π/g, "pi");
      if (!s.trim()) { out.textContent = "= "; return; }
      try { out.textContent = "= " + global.math.format(global.math.evaluate(s), { precision: 10 }); }
      catch (e) { out.textContent = "= …"; }
    }
    disp.oninput = evalIt;
    body.appendChild(wrap);
  }

  function detectParams(expr) {
    var toks = (expr.match(/[a-zA-Z]+/g) || []);
    var ps = [];
    toks.forEach(function (t) { if (FUNCS.indexOf(t) < 0 && t.length === 1 && t !== "x" && t !== "y" && t !== "e" && ps.indexOf(t) < 0) ps.push(t); });
    return ps;
  }

  function buildGraph(body, expr0, opts) {
    body.innerHTML = "";
    opts = opts || {};
    var GW = Math.max(220, Math.round(opts.w || 380)), GH = Math.max(160, Math.round(opts.h || 300));
    var expr = (expr0 || "x^2").replace(/^\s*y\s*=\s*/i, "");
    var cap = document.createElement("div"); cap.className = "ov-cap"; cap.textContent = "Máy tính đồ thị";
    var inp = document.createElement("input"); inp.className = "calc-disp"; inp.value = expr;
    var sliders = document.createElement("div"); sliders.className = "sliders";
    var graph = document.createElement("div"); graph.className = "graph";
    body.appendChild(cap); body.appendChild(inp); body.appendChild(sliders); body.appendChild(graph);
    var vals = {};

    function buildSliders() {
      var ps = detectParams(inp.value);
      Object.keys(vals).forEach(function (k) { if (ps.indexOf(k) < 0) delete vals[k]; });
      sliders.innerHTML = "";
      ps.forEach(function (p) {
        if (!(p in vals)) vals[p] = 1;
        var row = document.createElement("label"); row.className = "slider";
        var name = document.createElement("span"); name.textContent = p + " = ";
        var num = document.createElement("b"); num.textContent = vals[p];
        var r = document.createElement("input"); r.type = "range"; r.min = -10; r.max = 10; r.step = 0.1; r.value = vals[p];
        r.oninput = function () { vals[p] = parseFloat(r.value); num.textContent = vals[p]; render(); };
        row.appendChild(name); row.appendChild(num); row.appendChild(r);
        sliders.appendChild(row);
      });
    }
    function substituted() {
      var s = inp.value.replace(/^\s*y\s*=\s*/i, "");
      Object.keys(vals).forEach(function (p) { s = s.replace(new RegExp("\\b" + p + "\\b", "g"), "(" + vals[p] + ")"); });
      return s;
    }
    function render() {
      try {
        if (global.VPGrapher) global.VPGrapher.draw(graph, substituted(), { w: GW, h: GH });
        else global.functionPlot({ target: graph, width: GW, height: GH, grid: true, data: [{ fn: substituted(), color: "#1F6FEB" }] });
      } catch (e) { graph.textContent = "Không vẽ được."; }
    }
    inp.oninput = function () { buildSliders(); render(); };
    buildSliders(); render();
  }

  global.VPCalc = { buildSciCalc: buildSciCalc, buildGraph: buildGraph };
})(window);
