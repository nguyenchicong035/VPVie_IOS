// Kết xuất công thức (KaTeX) và vẽ đồ thị (function-plot) vào lớp phủ trên bảng.
(function (global) {
  "use strict";

  function renderMath(el, latex, displayMode) {
    try {
      global.katex.render(latex, el, {
        throwOnError: false,
        displayMode: !!displayMode,
        // KaTeX 0.16.11 does not provide \dddot. Keep the original LaTeX
        // in saved books and expand it only when rendering, including nested bases.
        macros: { "\\dddot": "\\overset{\\cdots}{#1}" }
      });
      return true;
    } catch (e) {
      el.textContent = latex;
      return false;
    }
  }

  // Chuẩn hóa phương trình người dùng gõ -> biểu thức theo x cho function-plot.
  function toFx(expr) {
    let s = (expr || "").trim();
    s = s.replace(/^\s*y\s*=\s*/i, "").replace(/^\s*f\s*\(\s*x\s*\)\s*=\s*/i, "");
    s = s.replace(/\^/g, "^"); // function-plot hiểu ^
    return s;
  }

  function plot(el, expr, width, height) {
    el.innerHTML = "";
    const fx = toFx(expr);
    try {
      global.functionPlot({
        target: el,
        width: width || 360,
        height: height || 260,
        grid: true,
        data: [{ fn: fx, color: "#1F6FEB" }],
      });
      return true;
    } catch (e) {
      el.textContent = "Không vẽ được: " + expr;
      return false;
    }
  }

  global.VPMathPlot = { renderMath, plot, toFx };
})(window);
