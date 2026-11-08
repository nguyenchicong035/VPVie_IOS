const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../web/js/oxyz-math.js");
const M = globalThis.VPOxyzMath;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const vector = (a, b) => a.forEach((x, i) => near(x, b[i]));
test("vector products and angle", () => {
  vector(M.cross([2, -1, 3], [1, 4, -2]), [-10, 7, 9]);
  near(M.dot([2, -1, 3], [1, 4, -2]), -8);
  near(M.angle([1, 0, 0], [0, 1, 0]), 90);
  assert.throws(() => M.angle([0, 0, 0], [1, 0, 0]));
});
test("projection, reflection, distance and scale invariance", () => {
  const m = [4, 5, 6],
    p = [1, 2, 2, -6],
    r = M.projection(m, p);
  near(r.distance, 20 / 3);
  near(M.dot(p.slice(0, 3), r.h) + p[3], 0);
  vector(M.mul(M.add(m, r.mirror), 0.5), r.h);
  vector(M.projection(m, M.mul(p, -7)).h, r.h);
  near(M.norm(M.cross(M.sub(m, r.h), p.slice(0, 3))), 0);
});
test("line-plane intersection, contained and parallel cases", () => {
  const a = [1, 0, -1],
    u = [1, 2, 3],
    p = [1, 1, 1, -6],
    r = M.linePlane(a, u, p);
  vector(r.point, [2, 2, 2]);
  near(M.dot(p.slice(0, 3), r.point) + p[3], 0);
  assert.equal(
    M.linePlane([0, 0, 0], [1, 0, 0], [0, 0, 1, 0]).relation,
    "contained",
  );
  assert.equal(
    M.linePlane([0, 0, 1], [1, 0, 0], [0, 0, 1, 0]).relation,
    "parallel",
  );
  assert.throws(() => M.linePlane(a, [0, 0, 0], p));
});
test("plane intersection satisfies both equations", () => {
  const p = [1, -1, 2, -4],
    q = [2, 1, -1, 2],
    r = M.planes(p, q);
  for (const t of [-10, 0, 10]) {
    const x = M.add(r.a, M.mul(r.u, t));
    near(M.dot(p.slice(0, 3), x) + p[3], 0);
    near(M.dot(q.slice(0, 3), x) + q[3], 0);
  }
  assert.equal(M.planes(p, M.mul(p, -2)).relation, "coincident");
  assert.equal(M.planes([0, 0, 1, 0], [0, 0, 1, 2]).relation, "parallel");
  assert.throws(() => M.plane([0, 0, 0, 2]));
});
test("common perpendicular meets each line at right angles", () => {
  const a = [-1, 0, 1],
    u = [1, 1, 0],
    b = [0, 0, -1],
    v = [0, 1, 1],
    r = M.commonPerpendicular(a, u, b, v),
    hk = M.sub(r.k, r.h);
  near(M.dot(hk, u), 0);
  near(M.dot(hk, v), 0);
  near(M.norm(M.cross(M.sub(r.h, a), u)), 0);
  near(M.norm(M.cross(M.sub(r.k, b), v)), 0);
  assert.ok(r.distance > 0);
  assert.throws(() => M.commonPerpendicular(a, u, b, u));
});
test("sphere-plane circle, tangent, disjoint", () => {
  const r = M.spherePlane([0, 0, 1], 2, [0, 0, 1, 0]);
  vector(r.center, [0, 0, 0]);
  near(r.radius, Math.sqrt(3));
  assert.equal(M.spherePlane([0, 0, 2], 2, [0, 0, 1, 0]).relation, "tangent");
  assert.equal(M.spherePlane([0, 0, 3], 2, [0, 0, 1, 0]).relation, "disjoint");
  assert.throws(() => M.spherePlane([0, 0, 0], -1, [0, 0, 1, 0]));
});
