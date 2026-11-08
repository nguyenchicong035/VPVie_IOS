// Analytic geometry shared by the Oxyz editor and its tests. No rendering dependencies.
(function (root) {
  "use strict";
  const EPS = 1e-9;
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const mul = (a, k) => a.map((x) => x * k);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (a) => Math.hypot(...a);
  function unit(a) {
    const n = norm(a);
    if (n < EPS) throw Error("Vectơ phải khác vectơ không.");
    return mul(a, 1 / n);
  }
  function plane(p) {
    const n = p.slice(0, 3),
      len = norm(n);
    if (len < EPS) throw Error("A, B, C không được đồng thời bằng 0.");
    return [...mul(n, 1 / len), p[3] / len];
  }
  function angle(a, b) {
    return (
      (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) /
      Math.PI
    );
  }
  function projection(m, p) {
    p = plane(p);
    const n = p.slice(0, 3),
      signed = dot(n, m) + p[3],
      h = sub(m, mul(n, signed));
    return { h, mirror: sub(mul(h, 2), m), distance: Math.abs(signed) };
  }
  function linePlane(a, u, p) {
    unit(u);
    p = plane(p);
    const n = p.slice(0, 3),
      den = dot(n, u),
      num = dot(n, a) + p[3];
    if (Math.abs(den) < EPS)
      return {
        relation: Math.abs(num) < EPS ? "contained" : "parallel",
        angle: 0,
      };
    const t = -num / den;
    return {
      relation: "intersect",
      t,
      point: add(a, mul(u, t)),
      angle: (Math.asin(Math.min(1, Math.abs(den) / norm(u))) * 180) / Math.PI,
    };
  }
  function planes(p, q) {
    p = plane(p);
    q = plane(q);
    const n = p.slice(0, 3),
      m = q.slice(0, 3),
      u = cross(n, m),
      den = dot(u, u),
      deg = Math.min(angle(n, m), 180 - angle(n, m));
    if (den < EPS * EPS)
      return {
        relation:
          Math.abs(p[3] - q[3] * (dot(n, m) > 0 ? 1 : -1)) < EPS
            ? "coincident"
            : "parallel",
        angle: deg,
      };
    const a = mul(cross(sub(mul(n, q[3]), mul(m, p[3])), u), 1 / den);
    return { relation: "intersect", a, u: unit(u), angle: deg };
  }
  function commonPerpendicular(a, u, b, v) {
    u = unit(u);
    v = unit(v);
    const w = sub(a, b),
      c = dot(u, v),
      d = dot(u, w),
      e = dot(v, w),
      den = 1 - c * c;
    if (Math.abs(den) < EPS)
      throw Error(
        "Hai đường thẳng song song: không có đường vuông góc chung duy nhất.",
      );
    const s = (c * e - d) / den,
      t = (e - c * d) / den,
      h = add(a, mul(u, s)),
      k = add(b, mul(v, t));
    return { h, k, distance: norm(sub(h, k)) };
  }
  function spherePlane(c, r, p) {
    if (!(r > 0)) throw Error("Bán kính phải lớn hơn 0.");
    const pr = projection(c, p);
    if (pr.distance > r + EPS) return { relation: "disjoint", center: pr.h };
    return {
      relation: Math.abs(pr.distance - r) < EPS ? "tangent" : "circle",
      center: pr.h,
      radius: Math.sqrt(Math.max(0, r * r - pr.distance * pr.distance)),
      normal: plane(p).slice(0, 3),
    };
  }
  function basis(n) {
    const z = unit(n),
      u = unit(cross(z, Math.abs(z[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0]));
    return [u, cross(z, u)];
  }
  root.VPOxyzMath = {
    EPS,
    add,
    sub,
    mul,
    dot,
    cross,
    norm,
    unit,
    plane,
    angle,
    projection,
    linePlane,
    planes,
    commonPerpendicular,
    spherePlane,
    basis,
  };
})(typeof window === "undefined" ? globalThis : window);
