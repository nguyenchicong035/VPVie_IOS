// VPVie – Cấp phép theo máy (License theo Mã máy).
// Cơ chế: ký số bất đối xứng ECDSA P-256 (Web Crypto, chạy offline, không cần mạng).
//  - Máy tính ra "Mã máy" (vân tay trình duyệt + phần cứng, băm SHA-256).
//  - Người phát hành dùng KHOÁ RIÊNG (chỉ mình giữ) ký ra key gắn với đúng Mã máy.
//  - App chỉ nhúng KHOÁ CÔNG KHAI để kiểm tra chữ ký → không ai giả mạo được key.
// Khoá công khai công bố ra app là an toàn; ai xem mã nguồn cũng không ký được key.
(function () {
  "use strict";

  // === Khoá công khai của VPVie (SPKI, base64url). Thay bằng khoá của bạn khi tự phát hành. ===
  var PUBKEY_SPKI_B64URL = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESxiHdNT7DPa3mjwhc4DKeS7-LvWt2mtmiiBXCp07Ocfw6i_ldz4quXg1jGLM7vq1dQmQDGMAmyBgUihOxZD38w";

  var STORE = "vpvie.license";       // key đã kích hoạt (localStorage)
  var SALT = "VPVie-machine-v1";      // trộn vào vân tay
  var _mid = null, _status = { active: false, plan: "free", reason: "chưa kích hoạt" };

  // ---- Tiện ích mã hoá ----
  function b64urlToBytes(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var bin = atob(s), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a;
  }
  function bytesToB64url(a) {
    var s = ""; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function utf8(s) { return new TextEncoder().encode(s); }
  async function sha256(bytes) { return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); }
  function hex(a) { var s = ""; for (var i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, "0"); return s; }

  // ---- Vân tay máy → Mã máy ----
  function canvasFp() {
    try {
      var c = document.createElement("canvas"); c.width = 200; c.height = 50;
      var g = c.getContext("2d"); if (!g) return "";
      g.textBaseline = "top"; g.font = "16px 'Arial'"; g.fillStyle = "#069"; g.fillText("VPVie 🧮∑∫", 2, 2);
      g.strokeStyle = "rgba(120,16,32,.7)"; g.beginPath(); g.arc(60, 25, 18, 0, 6.28); g.stroke();
      return c.toDataURL();
    } catch (e) { return ""; }
  }
  function signals() {
    var n = navigator, s = screen;
    return [
      SALT, n.userAgent || "", n.platform || "", n.language || "",
      (n.languages || []).join(","), n.hardwareConcurrency || "", n.deviceMemory || "",
      n.maxTouchPoints || "", s.width + "x" + s.height, s.colorDepth || "",
      (new Date().getTimezoneOffset()), Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      canvasFp()
    ].join("|");
  }
  // Mã máy dạng "VPV-XXXX-XXXX-XXXX" (4 nhóm chữ-số, dễ đọc/đọc qua điện thoại)
  async function computeMachineId() {
    if (_mid) return _mid;
    var h = hex(await sha256(utf8(signals())));
    var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = "";
    for (var i = 0; i < 12; i++) out += A[parseInt(h.substr(i * 2, 2), 16) % A.length];
    _mid = "VPV-" + out.substr(0, 4) + "-" + out.substr(4, 4) + "-" + out.substr(8, 4);
    return _mid;
  }

  // ---- Kiểm tra key ----
  // Định dạng key: "VPL1.<base64url(payload JSON)>.<base64url(sig r||s 64 byte)>"
  //   payload = { m:"<mã máy>", p:"<gói>", e:<hạn: epoch giây, 0 = vĩnh viễn>, n:"<ghi chú>" }
  var _pubPromise = null;
  function pubKey() {
    if (!_pubPromise) _pubPromise = crypto.subtle.importKey(
      "spki", b64urlToBytes(PUBKEY_SPKI_B64URL),
      { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return _pubPromise;
  }
  async function verifyKey(keyStr, machineId) {
    keyStr = (keyStr || "").trim();
    var parts = keyStr.split(".");
    if (parts.length !== 3 || parts[0] !== "VPL1") return { ok: false, reason: "Key sai định dạng" };
    var payloadBytes, data, sig;
    try {
      payloadBytes = b64urlToBytes(parts[1]);
      data = JSON.parse(new TextDecoder().decode(payloadBytes));
      sig = b64urlToBytes(parts[2]);
    } catch (e) { return { ok: false, reason: "Key hỏng" }; }
    var good;
    try {
      good = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, await pubKey(), sig, payloadBytes);
    } catch (e) { good = false; }
    if (!good) return { ok: false, reason: "Chữ ký không hợp lệ (key không phải do VPVie cấp)" };
    if (data.m && data.m !== machineId) return { ok: false, reason: "Key này cấp cho máy khác (" + data.m + ")" };
    if (data.e && data.e > 0 && Date.now() / 1000 > data.e) return { ok: false, reason: "Key đã hết hạn" };
    return { ok: true, data: data };
  }

  // ---- API công khai ----
  async function machineId() { return computeMachineId(); }
  function status() { return _status; }
  function isPro() { return _status.active && _status.plan !== "free"; }
  function isActive() { return _status.active; }

  async function check() {
    var mid = await computeMachineId();
    var saved = null; try { saved = localStorage.getItem(STORE); } catch (e) {}
    if (!saved) { _status = { active: false, plan: "free", reason: "chưa kích hoạt", mid: mid }; return _status; }
    var r = await verifyKey(saved, mid);
    if (r.ok) _status = { active: true, plan: r.data.p || "pro", expiry: r.data.e || 0, note: r.data.n || "", mid: mid };
    else _status = { active: false, plan: "free", reason: r.reason, mid: mid };
    return _status;
  }

  // Kích hoạt qua máy chủ (hướng C): xử lý cả key nhiều máy + đếm số máy.
  async function activateOnline(keyStr, mid) {
    try {
      var res = await fetch("./api/activate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license: keyStr.trim(), machine: mid }),
      });
      var d = {}; try { d = await res.json(); } catch (e) {}
      if (res.ok && d.ok) return { ok: true, used: d.used, maxm: d.maxm, plan: d.plan, expiry: d.expiry };
      return { ok: false, reason: d.error || "Máy chủ từ chối kích hoạt", server: true, used: d.used, maxm: d.maxm };
    } catch (e) { return { ok: false, offline: true }; }
  }

  async function activate(keyStr) {
    var mid = await computeMachineId();
    var local = await verifyKey(keyStr, mid);
    var isMulti = local.ok && local.data && local.data.id;   // key nhiều máy
    // Thử kích hoạt qua máy chủ trước
    var on = await activateOnline(keyStr, mid);
    if (on.ok) {
      try { localStorage.setItem(STORE, keyStr.trim()); } catch (e) {}
      _status = { active: true, plan: on.plan || (local.data && local.data.p) || "pro", expiry: on.expiry || (local.data && local.data.e) || 0, note: (local.data && local.data.n) || "", mid: mid, used: on.used, maxm: on.maxm };
      return { ok: true, data: local.data || {}, used: on.used, maxm: on.maxm };
    }
    if (on.server) return { ok: false, reason: on.reason };   // máy chủ từ chối (vượt số máy, thu hồi…)
    // Máy chủ không phản hồi: key nhiều máy BẮT BUỘC online; key gắn-máy thì kiểm cục bộ
    if (isMulti) return { ok: false, reason: "Key này cần máy chủ để kích hoạt (hiện không kết nối được)." };
    if (!local.ok) return local;
    try { localStorage.setItem(STORE, keyStr.trim()); } catch (e) {}
    _status = { active: true, plan: local.data.p || "pro", expiry: local.data.e || 0, note: local.data.n || "", mid: mid };
    return { ok: true, data: local.data };
  }
  function deactivate() { try { localStorage.removeItem(STORE); } catch (e) {} _status = { active: false, plan: "free", reason: "đã gỡ kích hoạt" }; }

  // Thông tin gửi kèm request AI (để máy chủ kiểm bản quyền nếu bật).
  function creds() {
    var key = ""; try { key = localStorage.getItem(STORE) || ""; } catch (e) {}
    return { license: key, machine: _mid || "" };
  }
  window.VPLicense = { machineId: machineId, status: status, isPro: isPro, isActive: isActive, check: check, activate: activate, deactivate: deactivate, verifyKey: verifyKey, creds: creds };
})();
