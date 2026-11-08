// Oxyz Studio: editable, serializable analytic 3D scenes, rendered offline on Canvas.
(function (global) {
  "use strict";
  const M = global.VPOxyzMath,
    colors = ["#e72228", "#21852a", "#086be9", "#6093d2", "#9b55ee", "#009e96"];
  const types = ["point", "vector", "line", "plane", "sphere", "polygon"];
  const titles = [
    "Điểm M(x,y,z)",
    "Vectơ u",
    "Đường thẳng",
    "Mặt phẳng",
    "Mặt cầu",
    "Đoạn / Đa giác",
  ];
  const svg = (paths) =>
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    paths +
    "</svg>";
  const icons = [
    svg(
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
    ),
    svg('<path d="M6 18 18 6M9 6h9v9"/>'),
    svg('<path d="M4 20 20 4"/>'),
    svg('<path d="m3 8 9-5 9 5-9 5-9-5Zm0 4 9 5 9-5M3 16l9 5 9-5"/>'),
    svg(
      '<circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="3" ry="8"/><path d="M4 12h16"/>',
    ),
    svg('<path d="m12 4 9 16H3Z"/>'),
  ];
  const axisIcon =
    '<svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V3m0 13h13M12 16l-8 8M9 6l3-3 3 3M22 13l3 3-3 3M4 20v4h4"/><circle cx="12" cy="16" r="1.6" fill="currentColor"/></svg>';
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmt = (x) => Number(x.toFixed(4)).toString(),
    vec = (a) => "(" + a.map(fmt).join("; ") + ")";
  const copy = (x) => JSON.parse(JSON.stringify(x));
  function defaults() {
    return {
      objects: [],
      camera: { yaw: 0.6, pitch: 0.38, zoom: 1, pan: [0, 0], view: "3d" },
      display: {
        grid: true,
        planes: false,
        guides: true,
        labels: true,
        auto: false,
        axes: true,
        length: 3.4,
        font: 17,
      },
    };
  }
  function equation(o) {
    if (o.type === "point") return vec(o.p);
    if (o.type === "vector") return vec(o.u);
    if (o.type === "line") return "X = " + vec(o.p) + " + t" + vec(o.u);
    if (o.type === "plane")
      return (
        o.coeff
          .slice(0, 3)
          .map((x, i) => fmt(x) + ["x", "y", "z"][i])
          .join(" + ") +
        " + " +
        fmt(o.coeff[3]) +
        " = 0"
      );
    if (o.type === "sphere") return "Tâm " + vec(o.p) + "; R = " + fmt(o.r);
    if (o.type === "circle") return "Tâm " + vec(o.p) + "; r = " + fmt(o.r);
    return o.points.map(vec).join(" → ");
  }
  function render(ctx, scene, w, h, editor) {
    const d = scene.display,
      c = scene.camera,
      L = d.length,
      scale = Math.min(w / (editor ? 12.5 : 8), h / 8.5) * c.zoom;
    const origin = [
      w * (editor ? 0.35 : 0.5) + c.pan[0] * scale,
      h * 0.5 + c.pan[1] * scale,
    ];
    function project(p) {
      let x, y, z;
      if (c.view === "xy") {
        [x, y, z] = [p[0], -p[1], p[2]];
      } else if (c.view === "xz") {
        [x, y, z] = [p[0], -p[2], p[1]];
      } else if (c.view === "yz") {
        [x, y, z] = [p[1], -p[2], p[0]];
      } else {
        // Oblique textbook Oxyz projection; rotate world coordinates before projection.
        const yaw = c.yaw - 0.6,
          pitch = c.pitch - 0.38,
          sy = Math.sin(yaw),
          cy = Math.cos(yaw),
          sp = Math.sin(pitch),
          cp = Math.cos(pitch);
        const a = cy * p[0] - sy * p[1],
          b = sy * p[0] + cy * p[1],
          v = cp * b - sp * p[2],
          t = sp * b + cp * p[2];
        x = -0.48 * a + 0.96 * v;
        y = 0.32 * a + 0.14 * v - t;
        z = 0.96 * a + 0.48 * v + 0.3744 * t;
      }
      return [origin[0] + x * scale, origin[1] + y * scale, z];
    }
    function path(pts, color, width, dash, fill) {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = project(p);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1;
      ctx.setLineDash(dash ? [5, 4] : []);
      if (fill) {
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    function label(t, p, color, offset) {
      if (!d.labels) return;
      const q = project(p);
      ctx.fillStyle = color;
      ctx.font =
        (offset ? "italic " : "") +
        (offset === "axis" || offset === "origin" ? d.font + 6 : d.font) +
        "px " +
        (offset ? "Georgia" : "Segoe UI");
      ctx.fillText(
        t,
        q[0] + (offset === "origin" ? -24 : 6),
        q[1] + (offset === "origin" ? 21 : -5),
      );
    }
    function arrow(a, b, color) {
      path([a, b], color, 1.3);
      const p = project(a),
        q = project(b),
        an = Math.atan2(q[1] - p[1], q[0] - p[0]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(
        q[0] - 10 * Math.cos(an - 0.3),
        q[1] - 10 * Math.sin(an - 0.3),
      );
      ctx.lineTo(q[0] - 7 * Math.cos(an), q[1] - 7 * Math.sin(an));
      ctx.lineTo(
        q[0] - 10 * Math.cos(an + 0.3),
        q[1] - 10 * Math.sin(an + 0.3),
      );
      ctx.closePath();
      ctx.fill();
    }
    function point(p, color, name) {
      if (d.guides) {
        path([p, [p[0], p[1], 0], [p[0], 0, 0]], color, 0.7, true);
        path(
          [
            [p[0], p[1], 0],
            [0, p[1], 0],
          ],
          color,
          0.7,
          true,
        );
      }
      const q = project(p);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(q[0], q[1], 3.5, 0, Math.PI * 2);
      ctx.fill();
      label(name, p, color);
    }
    function planePoints(coeff) {
      const p = M.plane(coeff),
        n = p.slice(0, 3),
        center = M.mul(n, -p[3]),
        [u, v] = M.basis(n);
      return [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([a, b]) =>
        M.add(center, M.add(M.mul(u, a * L * 0.7), M.mul(v, b * L * 0.7))),
      );
    }
    function circle(p, r, n, color) {
      const [u, v] = M.basis(n),
        pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i * Math.PI) / 48;
        pts.push(
          M.add(p, M.add(M.mul(u, r * Math.cos(a)), M.mul(v, r * Math.sin(a)))),
        );
      }
      path(pts, color, 1.4);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    if (d.grid) {
      const g = Math.floor(L);
      for (let i = -g; i <= g; i++) {
        path(
          [
            [i, -g, 0],
            [i, g, 0],
          ],
          "#e5e5e5",
          0.7,
        );
        path(
          [
            [-g, i, 0],
            [g, i, 0],
          ],
          "#e5e5e5",
          0.7,
        );
      }
    }
    const surfaces = [];
    if (d.planes)
      [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
      ].forEach((p, i) =>
        surfaces.push({ pts: planePoints(p), color: colors[i], alpha: "0b" }),
      );
    scene.objects
      .filter((o) => o.visible !== false)
      .forEach((o) => {
        if (o.type === "plane")
          surfaces.push({
            pts: planePoints(o.coeff),
            color: o.color,
            alpha: "28",
          });
        if (o.type === "polygon" && o.points.length > 2)
          surfaces.push({ pts: o.points, color: o.color, alpha: "20" });
      });
    surfaces
      .sort(
        (a, b) =>
          a.pts.reduce((s, p) => s + project(p)[2], 0) / a.pts.length -
          b.pts.reduce((s, p) => s + project(p)[2], 0) / b.pts.length,
      )
      .forEach((s) => path(s.pts, s.color, 1, false, s.color + s.alpha));
    if (d.axes) {
      for (let axis = 0; axis < 3; axis++) {
        const a = [0, 0, 0],
          b = [0, 0, 0];
        a[axis] = -L;
        b[axis] = L;
        path([a, [0, 0, 0]], colors[axis], 0.9, true);
        arrow([0, 0, 0], b, colors[axis]);
        label(["x", "y", "z"][axis], b, colors[axis], "axis");
        for (let i = -Math.floor(L); i <= L; i++) {
          if (!i) continue;
          const p = [0, 0, 0];
          p[axis] = i;
          const q = project(p);
          ctx.strokeStyle = colors[axis];
          ctx.beginPath();
          ctx.moveTo(q[0] - 3, q[1] - 2);
          ctx.lineTo(q[0] + 3, q[1] + 2);
          ctx.stroke();
          if (i % 2 === 0)
            label(String(i).replace("-", "−"), p, colors[axis], true);
        }
      }
      label("O", [0, 0, 0], "#333", "origin");
    }
    scene.objects
      .filter((o) => o.visible !== false)
      .forEach((o) => {
        const color = o.color || "#345";
        if (o.type === "point") point(o.p, color, o.name + " " + vec(o.p));
        else if (o.type === "vector") {
          arrow(o.p, M.add(o.p, o.u), color);
          label(o.name, M.add(o.p, o.u), color);
        } else if (o.type === "line") {
          const u = M.unit(o.u);
          path(
            [M.sub(o.p, M.mul(u, L * 1.8)), M.add(o.p, M.mul(u, L * 1.8))],
            color,
            1.6,
          );
          label(o.name + ": " + equation(o), o.p, color);
        } else if (o.type === "plane") {
          const n = M.plane(o.coeff);
          label(
            "(" + o.name + "): " + equation(o),
            M.mul(n.slice(0, 3), -n[3]),
            color,
          );
        } else if (o.type === "sphere") {
          for (const n of [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ])
            circle(o.p, o.r, n, color);
          point(o.p, color, o.name);
          label("R = " + fmt(o.r), M.add(o.p, [0, 0, o.r]), color);
        } else if (o.type === "circle") {
          circle(o.p, o.r, o.normal, color);
          label(o.name, o.p, color);
        } else if (o.type === "polygon") {
          path(
            o.closed ? [...o.points, o.points[0]] : o.points,
            color,
            1.6,
            o.dashed,
          );
          label(o.name, o.points[0], color);
        }
      });
    ctx.restore();
  }
  let host,
    scene,
    commit,
    tab = "objects",
    kind = "point",
    tool = 0,
    editing = -1,
    animation,
    last = 0,
    previousFocus;
  const $ = (s) => host.querySelector(s);
  function error(e) {
    $("#ox-error").textContent = e.message || e;
  }
  function paint() {
    if (!host) return;
    const cv = $("canvas"),
      r = cv.getBoundingClientRect(),
      ratio = devicePixelRatio || 1;
    cv.width = Math.round(r.width * ratio);
    cv.height = Math.round(r.height * ratio);
    const ctx = cv.getContext("2d");
    ctx.scale(ratio, ratio);
    render(ctx, scene, r.width, r.height, true);
    $("#ox-zoom").value = Math.round(scene.camera.zoom * 100) + "%";
  }
  function number(s) {
    if (!s.trim()) throw Error("Vui lòng nhập đủ các hệ số.");
    if (!/^[\d\s+\-*/().^a-zπ]+$/i.test(s))
      throw Error("Biểu thức số không hợp lệ.");
    const names = s.match(/[a-z]+/gi) || [];
    if (
      names.some(
        (n) => !["sqrt", "sin", "cos", "tan", "abs", "pi", "e"].includes(n),
      )
    )
      throw Error("Chỉ hỗ trợ số, phép toán, sqrt, sin, cos, tan, abs, pi, e.");
    const v = global.math
      ? global.math.evaluate(s.replace(/π/g, "pi"))
      : Number(s);
    if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e6)
      throw Error("Giá trị phải là số hữu hạn (|x| ≤ 1 000 000).");
    return v;
  }
  const values = (id) =>
    Array.from($("#" + id).querySelectorAll("input")).map((i) =>
      number(i.value),
    );
  function row(id, arr, label) {
    return (
      '<label class="ox-field"><span>' +
      label +
      '</span><div class="ox-fields" id="' +
      id +
      '">' +
      arr
        .map(
          (v, i) =>
            '<input aria-label="' +
            esc(label) +
            " — " +
            (i + 1) +
            '" value="' +
            esc(v) +
            '" inputmode="decimal">',
        )
        .join("") +
      "</div></label>"
    );
  }
  function object(type, name, data, color) {
    const o = {
      type,
      name,
      color: color || colors[types.indexOf(type)] || colors[2],
      visible: true,
      ...data,
    };
    validate(o);
    return o;
  }
  function validate(o) {
    if (o.type === "plane") M.plane(o.coeff);
    if (o.type === "line" || o.type === "vector") M.unit(o.u);
    if (o.type === "sphere" && !(o.r > 0))
      throw Error("Bán kính phải lớn hơn 0.");
    if (
      o.type === "polygon" &&
      (o.points.length < 2 || o.points.some((p) => p.length !== 3))
    )
      throw Error("Cần ít nhất hai điểm, mỗi điểm gồm ba tọa độ.");
  }
  function fitObjects() {
    let extent = scene.display.length;
    scene.objects.forEach((o) => {
      for (const p of [o.p, ...(o.points || [])].filter(Boolean))
        extent = Math.max(extent, M.norm(p) + (o.r || 0));
      if (o.u && o.p) extent = Math.max(extent, M.norm(M.add(o.p, o.u)));
    });
    if (extent > scene.display.length * 1.5)
      scene.camera.zoom = Math.min(
        scene.camera.zoom,
        Math.max(0.2, scene.display.length / extent),
      );
  }
  function append(objs) {
    scene.objects.push(...objs);
    fitObjects();
    paint();
    tabs();
  }
  function tabs() {
    host.querySelector('[data-tab="objects"]').textContent =
      "☷  Đối tượng (" + scene.objects.length + ")";
    host
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  }
  function panel() {
    tabs();
    const el = $(".ox-content");
    let html = "";
    if (tab === "objects") {
      html =
        '<div class="ox-section-title">DANH SÁCH TRONG KHÔNG GIAN <button data-action="add">＋ Thêm mới</button></div>';
      html += scene.objects.length
        ? scene.objects
            .map(
              (o, i) =>
                '<div class="ox-object"><input type="checkbox" aria-label="Hiện ' +
                esc(o.name) +
                '" data-visible="' +
                i +
                '" ' +
                (o.visible !== false ? "checked" : "") +
                '><div class="ox-object-text"><b style="color:' +
                esc(o.color) +
                '">' +
                esc(o.name) +
                "</b><small>" +
                esc(equation(o)) +
                "</small></div>" +
                (o.type === "circle"
                  ? ""
                  : '<button data-edit="' +
                    i +
                    '" aria-label="Sửa ' +
                    esc(o.name) +
                    '">✎</button>') +
                '<button data-delete="' +
                i +
                '" aria-label="Xóa ' +
                esc(o.name) +
                '">×</button></div>',
            )
            .join("")
        : '<div class="ox-empty">Chưa có đối tượng nào trong không gian Oxyz.<button data-action="add">+ Thêm đối tượng đầu tiên</button></div>';
      html +=
        '<form id="ox-command" class="ox-card ox-command"><label for="ox-command-input">Nhập lệnh (giao, hình chiếu, khoảng cách...)</label><div class="ox-command-row"><input id="ox-command-input" placeholder="Ví dụ: A = (1; 2; 3)"><button type="button" data-action="sqrt" title="Chèn căn bậc hai">√x</button><button>Thêm</button></div><details><summary>Cách gõ đối tượng</summary>A = (1; 2; 3)<br>u = vector(2; -1; 3)<br>P = plane(1; 1; 2; -6)<br>d = line(1; 0; -1; 1; 2; 3)<br>S = sphere(0; 0; 0; 2)<br>H = project(A; P)<br>I = intersect(d; P)<br>distance(A; P)<br>sqrt(2), 1/2 được dùng trong tọa độ.</details></form>';
    } else if (tab === "add") {
      html =
        '<div class="ox-section-title">CHỌN LOẠI ĐỐI TƯỢNG</div><div class="ox-types">' +
        types
          .map(
            (t, i) =>
              '<button data-kind="' +
              t +
              '" class="' +
              (kind === t ? "selected" : "") +
              '"><span style="color:' +
              colors[i] +
              '">' +
              icons[i] +
              "</span>" +
              titles[i] +
              "</button>",
          )
          .join("") +
        "</div>";
      const o = editing >= 0 ? scene.objects[editing] : null,
        idx = types.indexOf(kind),
        name = o ? o.name : ["M", "u", "d", "P", "S", "AB"][idx];
      html +=
        '<form id="ox-add" class="ox-card"><h3 style="color:' +
        colors[idx] +
        '">' +
        (o ? "SỬA " : "THÊM ") +
        titles[idx].toUpperCase() +
        (kind === "plane" ? " (P): AX + BY + CZ + D = 0" : "") +
        '</h3><div class="ox-fields"><label class="ox-field"><span>Tên ' +
        titles[idx].toLowerCase() +
        '</span><input id="ox-name" maxlength="40" value="' +
        esc(name) +
        '"></label><label class="ox-field"><span>Màu sắc</span><input type="color" id="ox-color" value="' +
        (o ? o.color : colors[idx]) +
        '"></label></div>';
      if (
        kind === "point" ||
        kind === "sphere" ||
        kind === "line" ||
        kind === "vector"
      )
        html += row(
          "ox-p",
          o ? o.p : kind === "point" ? [1, 2, 3] : [0, 0, 0],
          kind === "sphere"
            ? "Tâm I (x; y; z)"
            : "Tọa độ " +
                (kind === "line"
                  ? "điểm đi qua M₀"
                  : kind === "vector"
                    ? "điểm đặt"
                    : "điểm") +
                " (x; y; z)",
        );
      if (kind === "line" || kind === "vector")
        html += row(
          "ox-u",
          o ? o.u : [1, 2, 3],
          kind === "line"
            ? "Vectơ chỉ phương u (a; b; c)"
            : "Vectơ u (x; y; z)",
        );
      if (kind === "plane") {
        const cf = o ? o.coeff : [1, 1, 2, -6];
        html +=
          '<label class="ox-field"><span>Hệ số phương trình tổng quát (A, B, C, D):</span><div class="ox-fields" id="ox-coeff">' +
          cf
            .map(
              (v, i) =>
                '<label><span class="ox-coeff-label">' +
                ["Hệ số A (x)", "Hệ số B (y)", "Hệ số C (z)", "Hệ số tự do D"][
                  i
                ] +
                '</span><input aria-label="Hệ số ' +
                ["A", "B", "C", "D"][i] +
                '" value="' +
                v +
                '"></label>',
            )
            .join("") +
          "</div></label>";
      }
      if (kind === "sphere") html += row("ox-r", [o ? o.r : 2], "Bán kính R");
      if (kind === "polygon")
        html +=
          '<label class="ox-field"><span>Các đỉnh (x; y; z), mỗi dòng một điểm</span><textarea id="ox-points">' +
          (o
            ? o.points
            : [
                [0, 0, 0],
                [2, 0, 0],
                [0, 2, 0],
              ]
          )
            .map((p) => p.join("; "))
            .join("\n") +
          '</textarea></label><label class="ox-check">Nối kín đa giác<input id="ox-closed" type="checkbox" ' +
          (!o || o.closed ? "checked" : "") +
          "></label>";
      html +=
        '<button class="ox-primary">' +
        (o
          ? "Lưu thay đổi"
          : "Vẽ " +
            titles[idx].replace(" M(x,y,z)", "").replace(" u", "") +
            " " +
            (kind === "plane" ? "(P) " : "") +
            "lên Oxyz") +
        "</button></form>";
    } else {
      const toolTitles = [
        "⊙  1. Tác vụ Vectơ",
        "♢  2. Khoảng cách & Hình chiếu",
        "♧  3. Giao điểm & Giao tuyến",
        "∠  4. Góc & Vị trí tương đối",
      ];
      html =
        '<div class="ox-tools">' +
        toolTitles
          .map(
            (t, i) =>
              '<button data-tool-index="' +
              i +
              '" class="' +
              (tool === i ? "selected" : "") +
              '">' +
              t +
              "</button>",
          )
          .join("") +
        '</div><form id="ox-calculate" class="ox-card">';
      if (tool === 0)
        html +=
          "<h3>TÍCH VÔ HƯỚNG, CÓ HƯỚNG & GÓC</h3>" +
          row("ox-u", [2, -1, 3], "Vectơ u = (x₁; y₁; z₁)") +
          row("ox-v", [1, 4, -2], "Vectơ v = (x₂; y₂; z₂)") +
          '<button class="ox-primary">Tính toán & vẽ vectơ tích có hướng [u, v]</button>';
      if (tool === 1)
        html +=
          "<h3>KHOẢNG CÁCH & HÌNH CHIẾU VUÔNG GÓC</h3>" +
          row("ox-p", [4, 5, 6], "1. Điểm M(x₀; y₀; z₀):") +
          row(
            "ox-coeff",
            [1, 2, 2, -6],
            "2. Mặt phẳng (P): Ax + By + Cz + D = 0",
          ) +
          '<button class="ox-primary">Tính d(M, (P)), tìm hình chiếu H & điểm đối xứng M′</button>';
      if (tool === 2)
        html +=
          "<h3>GIAO ĐIỂM ĐƯỜNG THẲNG D & MẶT PHẲNG (P)</h3>" +
          row(
            "ox-p",
            [1, 0, -1],
            "Đường thẳng d qua M₀(x₀; y₀; z₀) và VTCP u(a; b; c):",
          ) +
          row("ox-u", [1, 2, 3], "Vectơ chỉ phương u:") +
          row(
            "ox-coeff",
            [1, 1, 1, -6],
            "Mặt phẳng (P): Ax + By + Cz + D = 0",
          ) +
          '<button class="ox-primary">Tìm giao điểm I = d ∩ (P) & góc (d, (P))</button>';
      if (tool === 3)
        html +=
          "<h3>HAI MẶT PHẲNG (P) & (Q): GÓC VÀ GIAO TUYẾN</h3>" +
          row(
            "ox-coeff",
            [1, -1, 2, -4],
            "Mặt phẳng (P): A₁x + B₁y + C₁z + D₁ = 0",
          ) +
          row(
            "ox-q",
            [2, 1, -1, 2],
            "Mặt phẳng (Q): A₂x + B₂y + C₂z + D₂ = 0",
          ) +
          '<button class="ox-primary">Tính góc ((P), (Q)) & tìm phương trình giao tuyến</button>';
      html += "</form>";
    }
    el.innerHTML =
      html +
      '<div id="ox-error" class="ox-error" role="alert"></div><div id="ox-result" aria-live="polite"></div>';
  }
  function result(s) {
    $("#ox-result").className = "ox-result";
    $("#ox-result").textContent = s;
  }
  function calculate() {
    let objs = [],
      text = "";
    if (tool === 0) {
      const u = values("ox-u"),
        v = values("ox-v"),
        cross = M.cross(u, v),
        angle = M.angle(u, v);
      objs = [
        object("vector", "u", { p: [0, 0, 0], u }),
        object("vector", "v", { p: [0, 0, 0], u: v }, colors[2]),
      ];
      if (M.norm(cross) > M.EPS)
        objs.push(
          object("vector", "[u, v]", { p: [0, 0, 0], u: cross }, colors[4]),
        );
      text =
        "u · v = " +
        fmt(M.dot(u, v)) +
        "\n[u, v] = " +
        vec(cross) +
        "\nGóc (u, v) = " +
        fmt(angle) +
        "°";
    }
    if (tool === 1) {
      const p = values("ox-p"),
        coeff = values("ox-coeff"),
        r = M.projection(p, coeff);
      objs = [
        object("plane", "P", { coeff }),
        object("point", "M", { p }),
        object("point", "H", { p: r.h }, colors[1]),
        object("point", "M′", { p: r.mirror }, colors[4]),
        object("polygon", "MH", { points: [p, r.h], dashed: true }),
      ];
      text =
        "d(M, (P)) = " +
        fmt(r.distance) +
        "\nH = " +
        vec(r.h) +
        "\nM′ = " +
        vec(r.mirror);
    }
    if (tool === 2) {
      const p = values("ox-p"),
        u = values("ox-u"),
        coeff = values("ox-coeff"),
        r = M.linePlane(p, u, coeff);
      objs = [object("plane", "P", { coeff }), object("line", "d", { p, u })];
      if (r.point) objs.push(object("point", "I", { p: r.point }));
      text = r.point
        ? "I = " + vec(r.point) + "\nGóc (d, (P)) = " + fmt(r.angle) + "°"
        : r.relation === "contained"
          ? "d nằm trong (P): vô số giao điểm."
          : "d song song (P): không có giao điểm.";
    }
    if (tool === 3) {
      const p = values("ox-coeff"),
        q = values("ox-q"),
        r = M.planes(p, q);
      objs = [
        object("plane", "P", { coeff: p }),
        object("plane", "Q", { coeff: q }, colors[4]),
      ];
      if (r.a) objs.push(object("line", "Δ", { p: r.a, u: r.u }, colors[0]));
      text =
        "Góc ((P), (Q)) = " +
        fmt(r.angle) +
        "°\n" +
        (r.a
          ? "Giao tuyến: X = " + vec(r.a) + " + t" + vec(r.u)
          : r.relation === "coincident"
            ? "Hai mặt phẳng trùng nhau."
            : "Hai mặt phẳng song song, không có giao tuyến.");
    }
    append(objs);
    result(text);
  }
  function addForm() {
    let data = {};
    if (["point", "line", "vector", "sphere"].includes(kind))
      data.p = values("ox-p");
    if (["line", "vector"].includes(kind)) data.u = values("ox-u");
    if (kind === "plane") data.coeff = values("ox-coeff");
    if (kind === "sphere") data.r = values("ox-r")[0];
    if (kind === "polygon") {
      data.points = $("#ox-points")
        .value.trim()
        .split("\n")
        .map((s) => s.replace(/[()]/g, "").split(/[;,]/).map(number));
      data.closed = $("#ox-closed").checked;
    }
    const name = $("#ox-name").value.trim();
    if (!name) throw Error("Vui lòng nhập tên đối tượng.");
    const o = object(kind, name, data, $("#ox-color").value);
    if (editing >= 0) scene.objects[editing] = o;
    else scene.objects.push(o);
    editing = -1;
    tab = "objects";
    panel();
    paint();
  }
  function command() {
    const str = $("#ox-command-input").value.trim(),
      match = str.match(/^(?:([^=]+?)\s*=\s*)?(?:(\w+)\s*)?\((.*)\)$/);
    if (!match) throw Error("Dùng cú pháp trong “Cách gõ đối tượng”.");
    const name = (match[1] || "M").trim(),
      fn = (match[2] || "point").toLowerCase(),
      args = match[3].split(/[;,]/).map((s) => s.trim());
    let o;
    if (["project", "distance", "intersect"].includes(fn)) {
      const a = scene.objects.find((o) => o.name === args[0]),
        b = scene.objects.find((o) => o.name === args[1]);
      if (!a || !b) throw Error("Không tìm thấy đối tượng được gọi tên.");
      if (fn === "intersect") {
        if (a.type !== "line" || b.type !== "plane")
          throw Error("intersect cần đường thẳng và mặt phẳng.");
        const r = M.linePlane(a.p, a.u, b.coeff);
        if (!r.point) throw Error("Không có giao điểm duy nhất.");
        o = object("point", name, { p: r.point });
      } else {
        if (a.type !== "point" || b.type !== "plane")
          throw Error("Lệnh cần một điểm và một mặt phẳng.");
        const r = M.projection(a.p, b.coeff);
        if (fn === "distance") {
          result("d(" + a.name + ", " + b.name + ") = " + fmt(r.distance));
          return;
        }
        o = object("point", name, { p: r.h });
      }
    } else {
      const a = args.map(number),
        counts = { point: 3, vector: 3, plane: 4, line: 6, sphere: 4 };
      if (a.length !== counts[fn])
        throw Error("Số hệ số không đúng với loại đối tượng.");
      o = object(
        fn,
        name,
        fn === "point"
          ? { p: a }
          : fn === "vector"
            ? { p: [0, 0, 0], u: a }
            : fn === "plane"
              ? { coeff: a }
              : fn === "line"
                ? { p: a.slice(0, 3), u: a.slice(3) }
                : { p: a.slice(0, 3), r: a[3] },
      );
    }
    append([o]);
    panel();
  }
  function preset(index) {
    const list = [],
      pt = (name, p) => list.push(object("point", name, { p })),
      pl = (name, coeff) => list.push(object("plane", name, { coeff })),
      line = (name, p, u) => list.push(object("line", name, { p, u })),
      seg = (name, points) =>
        list.push(object("polygon", name, { points, dashed: true }));
    if (index === 1) {
      const p = [1, 0, -1],
        u = [1, 2, 3],
        coeff = [1, 1, 1, -6];
      pl("P", coeff);
      line("d", p, u);
      pt("I", M.linePlane(p, u, coeff).point);
    }
    if (index === 2) {
      const p = [2, 2, 3],
        coeff = [1, 2, 2, -3],
        r = M.projection(p, coeff);
      pl("P", coeff);
      pt("M", p);
      pt("H", r.h);
      seg("MH", [p, r.h]);
    }
    if (index === 3) {
      const a = [-1, 0, 1],
        u = [1, 1, 0],
        b = [0, 0, -1],
        v = [0, 1, 1],
        r = M.commonPerpendicular(a, u, b, v);
      line("d₁", a, u);
      line("d₂", b, v);
      pt("H", r.h);
      pt("K", r.k);
      seg("HK ⟂ d₁, d₂", [r.h, r.k]);
    }
    if (index === 4) {
      const p = [0, 0, 1],
        coeff = [0, 0, 1, 0],
        r = M.spherePlane(p, 2, coeff);
      pl("P", coeff);
      list.push(
        object("sphere", "S", { p, r: 2 }),
        object(
          "circle",
          "S ∩ P",
          { p: r.center, r: r.radius, normal: r.normal },
          colors[0],
        ),
      );
    }
    if (index === 5) {
      const a = [2, 0, 0],
        b = [0, 2, 0],
        c = [0, 0, 0],
        d = [0, 0, 3];
      [
        ["A", a],
        ["B", b],
        ["C", c],
        ["D", d],
      ].forEach(([n, p]) => pt(n, p));
      pl("ABC", [0, 0, 1, 0]);
      list.push(object("polygon", "ABC", { points: [a, b, c], closed: true }));
      [
        [a, d],
        [b, d],
        [c, d],
      ].forEach((p, i) => seg(["AD", "BD", "CD"][i], p));
    }
    scene.objects = list;
    scene.camera = defaults().camera;
    tab = "objects";
    editing = -1;
    panel();
    viewButtons();
    paint();
  }
  function close(save) {
    const data = copy(scene);
    cancelAnimationFrame(animation);
    observer.disconnect();
    host.remove();
    host = null;
    previousFocus?.focus();
    if (save) commit(data);
  }
  let observer;
  function open(data, onCommit) {
    if (host) return;
    scene = copy(data || defaults());
    scene.display = { ...defaults().display, ...scene.display };
    scene.camera = { ...defaults().camera, ...scene.camera };
    commit = onCommit;
    previousFocus = document.activeElement;
    tab = "objects";
    editing = -1;
    host = document.createElement("section");
    host.className = "ox-studio";
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.setAttribute("aria-label", "Oxyz 3D Studio");
    host.innerHTML =
      '<header class="ox-header"><div class="ox-brand"><span class="ox-logo">' +
      axisIcon +
      '</span>Oxyz 3D Studio</div><div class="ox-quick">' +
      types
        .map(
          (t, i) =>
            '<button data-kind="' +
            t +
            '" style="color:' +
            colors[i] +
            '"><span>' +
            icons[i] +
            "</span>+ " +
            [
              "Điểm",
              "Vectơ",
              "Đường thẳng",
              "Mặt phẳng",
              "Mặt cầu",
              "Đoạn / Đa giác",
            ][i] +
            "</button>",
        )
        .join("") +
      '</div><select id="ox-preset" aria-label="Chọn mô hình mẫu"><option value="0">-- Chọn mô hình mẫu --</option>' +
      [
        "Mặt phẳng, đường thẳng và giao điểm",
        "Hình chiếu vuông góc từ M lên (P)",
        "Hai đường thẳng chéo nhau và đường vuông góc chung",
        "Mặt cầu (S) cắt mặt phẳng (P)",
        "Tứ diện ABCD và mặt phẳng ABC",
      ]
        .map(
          (s, i) =>
            '<option value="' +
            (i + 1) +
            '">' +
            (i + 1) +
            ". " +
            s +
            "</option>",
        )
        .join("") +
      '</select><button data-action="clear" class="ox-clear">♜ Xóa hết</button><button data-action="cancel">Hủy</button><button data-action="done" class="ox-primary">Xong</button></header><div class="ox-main"><aside class="ox-sidebar"><nav class="ox-tabs"><button data-tab="objects">☷ Đối tượng (0)</button><button data-tab="add">⊕ Thêm hình</button><button data-tab="tools">▣ Công cụ Oxyz</button></nav><div class="ox-content"></div><footer class="ox-footer"><span><b style="color:#e22">Ox:</b> Đỏ | <b style="color:#282">Oy:</b> Lá | <b style="color:#16e">Oz:</b> Dương</span><span>Chuột trái: Xoay | Phải: Kéo | Lăn: Zoom</span></footer></aside><main class="ox-stage"><canvas aria-label="Không gian tọa độ Oxyz"></canvas><div class="ox-controls"><section class="ox-card"><p class="ox-caption">GÓC NHÌN CAMERA</p><div class="ox-camera">' +
      [
        ["3d", "Góc 3D chuẩn"],
        ["xy", "Chiếu (Oxy)"],
        ["xz", "Chiếu (Oxz)"],
        ["yz", "Chiếu (Oyz)"],
      ]
        .map(([v, t]) => '<button data-view="' + v + '">' + t + "</button>")
        .join("") +
      '</div></section><section class="ox-card"><p class="ox-caption">HIỂN THỊ OXYZ</p>' +
      [
        ["grid", "Lưới tọa độ (Oxy)"],
        ["planes", "Mặt phẳng (Oxy, Oyz, Oxz)"],
        ["guides", "Đường gióng tọa độ điểm"],
        ["labels", "Hiện nhãn & phương trình"],
        ["auto", "Tự động xoay 3D"],
      ]
        .map(
          ([k, t]) =>
            '<label class="ox-check">' +
            t +
            '<input type="checkbox" data-display="' +
            k +
            '" ' +
            (scene.display[k] ? "checked" : "") +
            "></label>",
        )
        .join("") +
      '<details><summary>Trục, cỡ chữ, độ dài trục</summary><label>Hiện trục<input type="checkbox" data-display="axes" ' +
      (scene.display.axes ? "checked" : "") +
      '></label><label>Cỡ chữ<input type="number" min="10" max="30" data-number="font" value="' +
      scene.display.font +
      '"></label><label>Độ dài trục<input type="number" min="1" max="30" step="0.5" data-number="length" value="' +
      scene.display.length +
      '"></label></details></section></div><div class="ox-zoom"><button data-zoom="0.9" aria-label="Thu nhỏ">−</button><output id="ox-zoom">100%</output><button data-zoom="1.1" aria-label="Phóng to">+</button></div></main></div>';
    document.body.appendChild(host);
    panel();
    viewButtons();
    host.querySelector("button").focus();
    host.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try {
        if (b.dataset.tab) {
          tab = b.dataset.tab;
          editing = -1;
          panel();
        }
        if (b.dataset.kind) {
          kind = b.dataset.kind;
          tab = "add";
          editing = -1;
          panel();
        }
        if (b.dataset.toolIndex !== undefined) {
          tool = +b.dataset.toolIndex;
          panel();
        }
        if (b.dataset.edit !== undefined) {
          editing = +b.dataset.edit;
          kind = scene.objects[editing].type;
          if (!types.includes(kind))
            throw Error(
              "Đường tròn giao tuyến được tạo từ mô hình mẫu. Xóa và chọn lại mô hình để dựng lại.",
            );
          tab = "add";
          panel();
        }
        if (b.dataset.delete !== undefined) {
          scene.objects.splice(+b.dataset.delete, 1);
          panel();
          paint();
        }
        if (b.dataset.view) {
          scene.camera = { ...defaults().camera, view: b.dataset.view };
          scene.display.auto = false;
          host.querySelector('[data-display="auto"]').checked = false;
          viewButtons();
          paint();
        }
        if (b.dataset.zoom) zoom(+b.dataset.zoom);
        const a = b.dataset.action;
        if (a === "add") {
          tab = "add";
          editing = -1;
          panel();
        }
        if (a === "clear") {
          scene.objects = [];
          panel();
          paint();
        }
        if (a === "cancel") close(false);
        if (a === "done") close(true);
        if (a === "sqrt") {
          const input = $("#ox-command-input");
          input.setRangeText(
            "sqrt(2)",
            input.selectionStart,
            input.selectionEnd,
            "end",
          );
          input.focus();
        }
      } catch (err) {
        error(err);
      }
    });
    host.addEventListener("submit", (e) => {
      e.preventDefault();
      error("");
      try {
        if (e.target.id === "ox-add") addForm();
        if (e.target.id === "ox-calculate") calculate();
        if (e.target.id === "ox-command") command();
      } catch (err) {
        error(err);
      }
    });
    host.addEventListener("change", (e) => {
      const t = e.target;
      try {
        if (t.id === "ox-preset" && +t.value) preset(+t.value);
        if (t.dataset.visible !== undefined)
          scene.objects[+t.dataset.visible].visible = t.checked;
        if (t.dataset.display) {
          scene.display[t.dataset.display] = t.checked;
          if (t.dataset.display === "auto" && t.checked) {
            scene.camera.view = "3d";
            viewButtons();
          }
        }
        if (t.dataset.number) {
          const n = number(t.value);
          if (n < +t.min || n > +t.max)
            throw Error("Giá trị phải nằm trong " + t.min + "–" + t.max);
          scene.display[t.dataset.number] = n;
        }
        paint();
      } catch (err) {
        error(err);
      }
    });
    host.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Tab") {
        const focus = Array.from(
          host.querySelectorAll("button,input,select,textarea,summary"),
        ).filter((el) => el.getClientRects().length);
        const i = focus.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          focus.at(-1).focus();
        } else if (!e.shiftKey && i === focus.length - 1) {
          e.preventDefault();
          focus[0].focus();
        }
      }
    });
    const cv = $("canvas");
    let drag = null;
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    cv.addEventListener("pointerdown", (e) => {
      if (drag) return;
      cv.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, button: e.button, id: e.pointerId };
    });
    cv.addEventListener("pointermove", (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (drag.button === 2 || e.shiftKey) {
        const s =
          Math.min(cv.clientWidth / 12.5, cv.clientHeight / 8.5) *
          scene.camera.zoom;
        scene.camera.pan[0] += dx / s;
        scene.camera.pan[1] += dy / s;
      } else {
        scene.camera.view = "3d";
        scene.camera.yaw += dx * 0.008;
        scene.camera.pitch = Math.max(
          -1.5,
          Math.min(1.5, scene.camera.pitch + dy * 0.008),
        );
        viewButtons();
      }
      paint();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) =>
      cv.addEventListener(ev, () => (drag = null)),
    );
    cv.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        zoom(Math.exp(-e.deltaY * 0.001));
      },
      { passive: false },
    );
    observer = new ResizeObserver(paint);
    observer.observe($(".ox-stage"));
    last = 0;
    function tick(time) {
      if (!host) return;
      if (scene.display.auto && time - last > 30) {
        scene.camera.view = "3d";
        scene.camera.yaw += 0.008;
        paint();
        last = time;
      }
      animation = requestAnimationFrame(tick);
    }
    animation = requestAnimationFrame(tick);
    paint();
  }
  function viewButtons() {
    host
      .querySelectorAll("[data-view]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.view === scene.camera.view),
      );
  }
  function zoom(factor) {
    scene.camera.zoom = Math.max(0.2, Math.min(5, scene.camera.zoom * factor));
    paint();
  }
  global.VPOxyz = {
    defaults,
    open,
    render,
    drawItem(ctx, it) {
      ctx.save();
      ctx.translate(it.x, it.y);
      render(ctx, it.scene, it.w, it.h, false);
      ctx.restore();
    },
  };
})(window);
