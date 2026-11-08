// Nhận dạng nét vẽ: Tesseract.js (nguồn mở, miễn phí, chạy trong trình duyệt) hoặc máy chủ (Ollama/Claude).
// Có tiền xử lý ảnh (nhị phân hoá Otsu + làm dày nét) và tinh chỉnh tham số để nhận chữ viết tay tiếng Việt tốt hơn.
(function (global) {
  "use strict";
  var worker = null, loading = null;
  // Bộ ký tự tiếng Việt + số + dấu toán cơ bản (giúp giảm ký tự rác)
  var VI = "AÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬEÈÉẺẼẸÊỀẾỂỄỆIÌÍỈĨỊOÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢUÙÚỦŨỤƯỪỨỬỮỰYỲÝỶỸỴĐ";
  var WHITE = VI + VI.toLowerCase() + "BCDFGHJKLMNPQRSTVWXZbcdfghjklmnpqrstvwxz0123456789.,:;?!()[]{}+-*/=<>%°^√π…'\"  \n";

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var has = Array.prototype.some.call(document.scripts, function (s) { return s.src.indexOf(src) >= 0; });
      if (has && global.Tesseract) return res();
      var el = document.createElement("script");
      el.src = src; el.onload = res; el.onerror = function () { rej(new Error("Không tải được " + src)); };
      document.head.appendChild(el);
    });
  }

  // ----- Tiền xử lý: xám hoá -> ngưỡng Otsu -> nhị phân -> làm dày nét (giãn nở)
  function preprocess(src, opts) {
    opts = opts || {};
    var w = src.width, h = src.height;
    var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    var c = cv.getContext("2d"); c.drawImage(src, 0, 0);
    var img = c.getImageData(0, 0, w, h), d = img.data, n = w * h;
    var gray = new Uint8Array(n), hist = new Array(256).fill(0), i, g;
    for (i = 0; i < n; i++) {
      g = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
      gray[i] = g; hist[g]++;
    }
    // Ngưỡng Otsu
    var sum = 0; for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0, wB = 0, wF = 0, maxV = 0, thr = 127, mB, mF, between;
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue; wF = n - wB; if (!wF) break;
      sumB += i * hist[i]; mB = sumB / wB; mF = (sum - sumB) / wF;
      between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxV) { maxV = between; thr = i; }
    }
    // Nhị phân: nét = đen (0), nền = trắng (255)
    var bin = new Uint8Array(n);
    for (i = 0; i < n; i++) bin[i] = gray[i] < thr - 6 ? 0 : 255;
    // Giãn nở nét (làm dày) để Tesseract bắt nét mảnh của bút cảm ứng
    var out = bin;
    if (opts.dilate !== false) {
      out = new Uint8Array(n); out.fill(255);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var dark = false;
        for (var dy = -1; dy <= 1 && !dark; dy++) for (var dx = -1; dx <= 1; dx++) {
          var yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue;
          if (bin[yy * w + xx] === 0) { dark = true; break; }
        }
        out[y * w + x] = dark ? 0 : 255;
      }
    }
    for (i = 0; i < n; i++) { var v = out[i]; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
    return cv;
  }

  async function getWorker(onStatus) {
    if (worker) return worker;
    if (loading) return loading;
    loading = (async function () {
      await loadScript("vendor/tesseract/tesseract.min.js");
      var w = await global.Tesseract.createWorker(["vie", "eng"], 1, {
        workerPath: "vendor/tesseract/worker.min.js",
        corePath: "vendor/tesseract/",
        langPath: "vendor/tesseract/lang",
        gzip: false,
        logger: function (m) { if (onStatus && m.status) onStatus(m.status + (m.progress ? " " + Math.round(m.progress * 100) + "%" : "")); },
      });
      worker = w; return w;
    })();
    return loading;
  }

  // ----- Hậu xử lý sang LaTeX cho công thức Toán (số mũ, chỉ số, phân số, ký hiệu, hàm)
  var UNI = { "√": "\\sqrt{}", "∫": "\\int ", "∬": "\\iint ", "∮": "\\oint ", "∑": "\\sum ", "∏": "\\prod ", "π": "\\pi ", "∞": "\\infty ", "≤": "\\le ", "≥": "\\ge ", "≠": "\\neq ", "≈": "\\approx ", "×": "\\times ", "÷": "\\div ", "±": "\\pm ", "∓": "\\mp ", "→": "\\to ", "∂": "\\partial ", "∇": "\\nabla ", "∈": "\\in ", "∉": "\\notin ", "⊂": "\\subset ", "∪": "\\cup ", "∩": "\\cap ", "∅": "\\varnothing ", "·": "\\cdot ", "∘": "\\circ ", "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "θ": "\\theta ", "λ": "\\lambda ", "μ": "\\mu ", "φ": "\\varphi ", "ω": "\\omega ", "Δ": "\\Delta ", "Ω": "\\Omega ", "°": "^{\\circ}" };
  var SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "ⁿ": "n", "⁺": "+", "⁻": "-" };
  var SUB = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "ₙ": "n" };
  function mathToLatex(t) {
    if (!t) return "";
    var s = t.replace(/\r/g, "").replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
    // căn: √x, sqrt(x), can(x)
    s = s.replace(/√\s*\(([^)]*)\)/g, "\\sqrt{$1}");
    s = s.replace(/√\s*([0-9A-Za-zÀ-ỹ]+)/g, "\\sqrt{$1}");
    s = s.replace(/\b(sqrt|can)\s*\(([^)]*)\)/gi, "\\sqrt{$2}");
    s = s.replace(/\b(sqrt|can)\s+([0-9A-Za-z]+)/gi, "\\sqrt{$2}");
    // ký hiệu Unicode
    s = s.replace(/[√∫∬∮∑∏π∞≤≥≠≈×÷±∓→⇒⇔∂∇∈∉⊂⊆∪∩∅∀∃·∘αβγδθλμσφωΔΩ°]/g, function (c) { return UNI[c] || c; });
    // toán tử ASCII thường gặp -> LaTeX
    s = s.replace(/<=/g, " \\le ").replace(/>=/g, " \\ge ").replace(/!=|=\/=/g, " \\ne ")
         .replace(/\+\/-|\+-/g, " \\pm ").replace(/-\+/g, " \\mp ")
         .replace(/<=>|<->/g, " \\Leftrightarrow ").replace(/=>/g, " \\Rightarrow ").replace(/->/g, " \\to ")
         .replace(/\binfty\b|\binfinity\b|\bvo\s*cuc\b/gi, " \\infty ")
         .replace(/\bintegral\b|\btich\s*phan\b/gi, " \\int ").replace(/\bsum\b|\btong\b/gi, " \\sum ");
    // tên Hy Lạp gõ chữ
    s = s.replace(/\b(alpha|beta|gamma|delta|theta|lambda|mu|nu|xi|rho|sigma|tau|phi|chi|psi|omega|pi|Delta|Omega|Sigma|Pi)\b/g, "\\$1 ");
    // chỉ số trên/dưới Unicode
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻]+/g, function (m) { return "^{" + m.split("").map(function (c) { return SUP[c] || c; }).join("") + "}"; });
    s = s.replace(/[₀₁₂₃₄₅₆₇₈₉ₙ]+/g, function (m) { return "_{" + m.split("").map(function (c) { return SUB[c] || c; }).join("") + "}"; });
    // mũ / chỉ số có dấu ^ _
    s = s.replace(/\^\s*\(([^)]*)\)/g, "^{$1}").replace(/_\s*\(([^)]*)\)/g, "_{$1}");
    s = s.replace(/\^\s*([0-9A-Za-z]+)/g, "^{$1}").replace(/_\s*([0-9A-Za-z]+)/g, "_{$1}");
    // lũy thừa viết tay: chữ thường liền số (x2 -> x^2), tránh HNO3/H2O (chữ hoa) -> giữ nguyên
    s = s.replace(/\b([a-z])(\d{1,2})\b/g, "$1^{$2}");
    s = s.replace(/(\))(\d{1,2})\b/g, "$1^{$2}");
    // phân số a/b -> \frac{a}{b}
    s = s.replace(/(\{[^{}]*\}|[0-9A-Za-z\)\]]+)\s*\/\s*(\{[^{}]*\}|[0-9A-Za-z\(\[]+)/g, "\\frac{$1}{$2}");
    // nhân * -> \cdot (sau phân số để không phá /)
    s = s.replace(/(?<=[0-9A-Za-z\)\}])\s*\*\s*(?=[0-9A-Za-z\(\\])/g, " \\cdot ");
    // vi phân dx, dy
    s = s.replace(/\bd([xyzt])\b/g, "\\,d$1");
    // tên hàm
    s = s.replace(/\b(sin|cos|tan|cot|sec|csc|log|ln|lim|max|min|exp|arcsin|arccos|arctan)\b/g, "\\$1 ");
    return s.replace(/\s+/g, " ").replace(/\s*([_^])\s*/g, "$1").trim();
  }

  // Dọn kết quả: bỏ ký tự rác, gộp khoảng trắng, sửa vài nhầm lẫn phổ biến của chữ viết tay
  function cleanText(t) {
    return (t || "").replace(/\r/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{2,}/g, "\n")
      .replace(/ *\n */g, "\n")
      .trim();
  }

  async function recognizeTesseract(imageSource, onStatus, opts) {
    opts = opts || {};
    var w = await getWorker(onStatus);
    if (onStatus) onStatus("đang xử lý ảnh…");
    var pre = preprocess(imageSource, opts);
    try {
      await w.setParameters({
        tessedit_pageseg_mode: opts.psm || "6",          // 6 = một khối văn bản đều
        preserve_interword_spaces: "1",
        tessedit_char_whitelist: opts.math ? "" : WHITE,  // chế độ toán: không giới hạn ký tự
      });
    } catch (e) {}
    var out = await w.recognize(pre);
    var text = cleanText(out.data.text);
    var conf = out.data.confidence || 0;
    var mathy = opts.math || (opts.mode === "auto" && looksMath(text));
    if (mathy) return { kind: "math", latex: mathToLatex(text) || text, text: "", confidence: Math.round(conf) };
    return { kind: "text", text: text, latex: "", confidence: Math.round(conf) };
  }
  // Đoán nội dung là công thức toán? (nhiều toán tử/ký hiệu, ít chữ cái tiếng Việt)
  function looksMath(t) {
    if (!t) return false;
    var ops = (t.match(/[=+\-*/^_<>≤≥≠∫∑√π∞()]|\\frac|\\sqrt|\\int/g) || []).length;
    var letters = (t.match(/[A-Za-zÀ-ỹ]/g) || []).length;
    return ops >= 2 && ops >= letters * 0.35;
  }

  async function recognizeServer(pngDataUrl, mode) {
    var res = await fetch("api/recognize", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ image: pngDataUrl, mode: mode || "auto" }, (window.VPLicense ? window.VPLicense.creds() : {}))),
    });
    var d = {}; try { d = await res.json(); } catch (e) { d = {}; }
    if (!res.ok || !d.ok) throw new Error(d.error || ("Lỗi máy chủ (" + res.status + ")"));
    return d;
  }

  global.VPRecognize = { recognizeTesseract: recognizeTesseract, recognizeServer: recognizeServer, preprocess: preprocess, mathToLatex: mathToLatex, looksMath: looksMath };
})(window);
