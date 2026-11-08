// Công cụ môn tự nhiên: Bảng tuần hoàn (Hoá) + cân bằng phương trình hoá học.
(function (global) {
  "use strict";
  // sym,Z,mass,period,group,category  (cat: alkali,alkaline,trans,post,metalloid,nonmetal,halogen,noble,lan,act)
  var EL = [
    ["H",1,1.008,1,1,"nonmetal"],["He",2,4.003,1,18,"noble"],
    ["Li",3,6.94,2,1,"alkali"],["Be",4,9.012,2,2,"alkaline"],["B",5,10.81,2,13,"metalloid"],["C",6,12.011,2,14,"nonmetal"],["N",7,14.007,2,15,"nonmetal"],["O",8,15.999,2,16,"nonmetal"],["F",9,18.998,2,17,"halogen"],["Ne",10,20.180,2,18,"noble"],
    ["Na",11,22.990,3,1,"alkali"],["Mg",12,24.305,3,2,"alkaline"],["Al",13,26.982,3,13,"post"],["Si",14,28.085,3,14,"metalloid"],["P",15,30.974,3,15,"nonmetal"],["S",16,32.06,3,16,"nonmetal"],["Cl",17,35.45,3,17,"halogen"],["Ar",18,39.948,3,18,"noble"],
    ["K",19,39.098,4,1,"alkali"],["Ca",20,40.078,4,2,"alkaline"],["Sc",21,44.956,4,3,"trans"],["Ti",22,47.867,4,4,"trans"],["V",23,50.942,4,5,"trans"],["Cr",24,51.996,4,6,"trans"],["Mn",25,54.938,4,7,"trans"],["Fe",26,55.845,4,8,"trans"],["Co",27,58.933,4,9,"trans"],["Ni",28,58.693,4,10,"trans"],["Cu",29,63.546,4,11,"trans"],["Zn",30,65.38,4,12,"trans"],["Ga",31,69.723,4,13,"post"],["Ge",32,72.630,4,14,"metalloid"],["As",33,74.922,4,15,"metalloid"],["Se",34,78.971,4,16,"nonmetal"],["Br",35,79.904,4,17,"halogen"],["Kr",36,83.798,4,18,"noble"],
    ["Rb",37,85.468,5,1,"alkali"],["Sr",38,87.62,5,2,"alkaline"],["Y",39,88.906,5,3,"trans"],["Zr",40,91.224,5,4,"trans"],["Nb",41,92.906,5,5,"trans"],["Mo",42,95.95,5,6,"trans"],["Tc",43,98,5,7,"trans"],["Ru",44,101.07,5,8,"trans"],["Rh",45,102.91,5,9,"trans"],["Pd",46,106.42,5,10,"trans"],["Ag",47,107.87,5,11,"trans"],["Cd",48,112.41,5,12,"trans"],["In",49,114.82,5,13,"post"],["Sn",50,118.71,5,14,"post"],["Sb",51,121.76,5,15,"metalloid"],["Te",52,127.60,5,16,"metalloid"],["I",53,126.90,5,17,"halogen"],["Xe",54,131.29,5,18,"noble"],
    ["Cs",55,132.91,6,1,"alkali"],["Ba",56,137.33,6,2,"alkaline"],["La",57,138.91,9,3,"lan"],["Ce",58,140.12,9,4,"lan"],["Pr",59,140.91,9,5,"lan"],["Nd",60,144.24,9,6,"lan"],["Pm",61,145,9,7,"lan"],["Sm",62,150.36,9,8,"lan"],["Eu",63,151.96,9,9,"lan"],["Gd",64,157.25,9,10,"lan"],["Tb",65,158.93,9,11,"lan"],["Dy",66,162.50,9,12,"lan"],["Ho",67,164.93,9,13,"lan"],["Er",68,167.26,9,14,"lan"],["Tm",69,168.93,9,15,"lan"],["Yb",70,173.05,9,16,"lan"],["Lu",71,174.97,9,17,"lan"],["Hf",72,178.49,6,4,"trans"],["Ta",73,180.95,6,5,"trans"],["W",74,183.84,6,6,"trans"],["Re",75,186.21,6,7,"trans"],["Os",76,190.23,6,8,"trans"],["Ir",77,192.22,6,9,"trans"],["Pt",78,195.08,6,10,"trans"],["Au",79,196.97,6,11,"trans"],["Hg",80,200.59,6,12,"trans"],["Tl",81,204.38,6,13,"post"],["Pb",82,207.2,6,14,"post"],["Bi",83,208.98,6,15,"post"],["Po",84,209,6,16,"post"],["At",85,210,6,17,"halogen"],["Rn",86,222,6,18,"noble"],
    ["Fr",87,223,7,1,"alkali"],["Ra",88,226,7,2,"alkaline"],["Ac",89,227,10,3,"act"],["Th",90,232.04,10,4,"act"],["Pa",91,231.04,10,5,"act"],["U",92,238.03,10,6,"act"],["Np",93,237,10,7,"act"],["Pu",94,244,10,8,"act"],["Am",95,243,10,9,"act"],["Cm",96,247,10,10,"act"],["Bk",97,247,10,11,"act"],["Cf",98,251,10,12,"act"],["Es",99,252,10,13,"act"],["Fm",100,257,10,14,"act"],["Md",101,258,10,15,"act"],["No",102,259,10,16,"act"],["Lr",103,262,10,17,"act"],["Rf",104,267,7,4,"trans"],["Db",105,268,7,5,"trans"],["Sg",106,269,7,6,"trans"],["Bh",107,270,7,7,"trans"],["Hs",108,269,7,8,"trans"],["Mt",109,278,7,9,"trans"],["Ds",110,281,7,10,"trans"],["Rg",111,282,7,11,"trans"],["Cn",112,285,7,12,"trans"],["Nh",113,286,7,13,"post"],["Fl",114,289,7,14,"post"],["Mc",115,290,7,15,"post"],["Lv",116,293,7,16,"post"],["Ts",117,294,7,17,"halogen"],["Og",118,294,7,18,"noble"]
  ];
  var CATCOL = { alkali:"#F6C7B6", alkaline:"#F7E0B0", trans:"#F6D7E3", post:"#CFE6DF", metalloid:"#D9E4C3", nonmetal:"#CFE3FB", halogen:"#BFE3F2", noble:"#E6D4F2", lan:"#F3D9B0", act:"#EBC9C9" };
  var CATVN = { alkali:"Kim loại kiềm", alkaline:"Kiềm thổ", trans:"Kim loại chuyển tiếp", post:"Kim loại", metalloid:"Á kim", nonmetal:"Phi kim", halogen:"Halogen", noble:"Khí hiếm", lan:"Lantan", act:"Actini" };

  function buildPTable(body) {
    body.innerHTML = "";
    var cap = document.createElement("div"); cap.className = "ov-cap"; cap.textContent = "Bảng tuần hoàn các nguyên tố";
    var grid = document.createElement("div"); grid.className = "ptable";
    var info = document.createElement("div"); info.className = "pt-info"; info.textContent = "Bấm vào một nguyên tố để xem chi tiết.";
    EL.forEach(function (e) {
      var d = document.createElement("div"); d.className = "pt-cell"; d.style.background = CATCOL[e[5]] || "#eee";
      d.style.gridColumn = e[4]; d.style.gridRow = e[3];
      d.innerHTML = '<span class="pt-z">' + e[1] + '</span><span class="pt-sym">' + e[0] + '</span>';
      d.onclick = function () { info.innerHTML = '<b>' + e[0] + '</b> · ' + e[1] + ' · M=' + e[2] + ' · ' + CATVN[e[5]] + ' · Chu kì ' + (e[3] > 8 ? (e[5] === "lan" ? 6 : 7) : e[3]) + ', Nhóm ' + (e[3] > 8 ? "—" : e[4]); };
      grid.appendChild(d);
    });
    body.appendChild(cap); body.appendChild(grid); body.appendChild(info);
  }

  // ----- Cân bằng phương trình hoá học bằng đại số tuyến tính (hệ số nguyên nhỏ nhất)
  function parseFormula(f) {
    f = (f || "").replace(/\s/g, ""); var L = f.length, stack = [{}], i = 0;
    function add(sym, n) { var top = stack[stack.length - 1]; top[sym] = (top[sym] || 0) + n; }
    function isLo(c) { return c >= "a" && c <= "z"; }
    function isUp(c) { return c >= "A" && c <= "Z"; }
    function isD(c) { return c >= "0" && c <= "9"; }
    while (i < L) {
      var ch = f[i];
      if (ch === "(" || ch === "[") { stack.push({}); i++; }
      else if (ch === ")" || ch === "]") {
        i++; var num = ""; while (i < L && isD(f[i])) num += f[i++]; var mult = num ? parseInt(num, 10) : 1;
        var grp = stack.pop(), top = stack[stack.length - 1];
        for (var k in grp) top[k] = (top[k] || 0) + grp[k] * mult;
      } else if (isUp(ch)) {
        var sym = ch; i++; while (i < L && isLo(f[i])) sym += f[i++];
        var num2 = ""; while (i < L && isD(f[i])) num2 += f[i++]; add(sym, num2 ? parseInt(num2, 10) : 1);
      } else i++;
    }
    return stack[0];
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  function balance(eq) {
    var sides = eq.split(/=|->|→|⟶/); if (sides.length !== 2) throw new Error("Cần dấu = giữa hai vế");
    var left = sides[0].split("+").map(function (s) { return s.trim(); }).filter(Boolean);
    var right = sides[1].split("+").map(function (s) { return s.trim(); }).filter(Boolean);
    var species = left.concat(right), comps = species.map(parseFormula);
    var elems = {}; comps.forEach(function (c) { for (var k in c) elems[k] = 1; });
    var E = Object.keys(elems), n = species.length;
    // ma trận E x n: trái dương, phải âm
    var A = E.map(function (el) { return comps.map(function (c, j) { return (c[el] || 0) * (j < left.length ? 1 : -1); }); });
    // nghiệm không tầm thường bằng khử Gauss hữu tỉ -> cho hệ số cuối = 1 rồi quy đồng
    var coef = solveNull(A, n);
    if (!coef) throw new Error("Không cân bằng được");
    return { left: left, right: right, coef: coef };
  }
  // tìm vector null nguyên nhỏ nhất của A (m x n)
  function solveNull(A, n) {
    var m = A.length, M = A.map(function (r) { return r.map(Number); }), row = 0, piv = [];
    for (var col = 0; col < n && row < m; col++) {
      var sel = -1; for (var r = row; r < m; r++) if (Math.abs(M[r][col]) > 1e-9) { sel = r; break; }
      if (sel < 0) continue;
      var tmp = M[row]; M[row] = M[sel]; M[sel] = tmp;
      var pv = M[row][col]; for (var c = 0; c < n; c++) M[row][c] /= pv;
      for (var r2 = 0; r2 < m; r2++) if (r2 !== row) { var f = M[r2][col]; if (Math.abs(f) > 1e-12) for (var c2 = 0; c2 < n; c2++) M[r2][c2] -= f * M[row][c2]; }
      piv.push(col); row++;
    }
    var free = []; for (var j = 0; j < n; j++) if (piv.indexOf(j) < 0) free.push(j);
    if (free.length !== 1) return null;
    var fcol = free[0], x = new Array(n).fill(0); x[fcol] = 1;
    for (var k = 0; k < piv.length; k++) x[piv[k]] = -M[k][fcol];
    // quy về số nguyên: nhân mẫu số rồi chia GCD
    var dens = x.map(function (v) { return denom(v); }), L = dens.reduce(function (a, b) { return a * b / gcd(a, b); }, 1);
    var ints = x.map(function (v) { return Math.round(v * L); });
    var g = ints.reduce(function (a, b) { return gcd(a, b); }, 0);
    ints = ints.map(function (v) { return v / g; });
    if (ints[0] < 0) ints = ints.map(function (v) { return -v; });
    return ints;
  }
  function denom(x, lim) { lim = lim || 1e6; if (Math.abs(x - Math.round(x)) < 1e-9) return 1; for (var d = 2; d <= lim; d++) if (Math.abs(x * d - Math.round(x * d)) < 1e-9) return d; return 1; }

  function buildChem(body) {
    body.innerHTML = "";
    var cap = document.createElement("div"); cap.className = "ov-cap"; cap.textContent = "Cân bằng phương trình hoá học";
    var inp = document.createElement("input"); inp.className = "calc-disp"; inp.value = "Fe + O2 = Fe2O3"; inp.placeholder = "VD: Al + HCl = AlCl3 + H2";
    var out = document.createElement("div"); out.className = "chem-out";
    function run() {
      try {
        var b = balance(inp.value);
        var f = function (arr, off) { return arr.map(function (s, i) { var c = b.coef[off + i]; return (c === 1 ? "" : c) + s; }).join(" + "); };
        out.innerHTML = f(b.left, 0) + " &rarr; " + f(b.right, b.left.length);
      } catch (e) { out.textContent = e.message || "Lỗi"; }
    }
    inp.oninput = run; body.appendChild(cap); body.appendChild(inp); body.appendChild(out); run();
  }

  global.VPScience = { buildPTable: buildPTable, buildChem: buildChem, balance: balance };
})(window);
