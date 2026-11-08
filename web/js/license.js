// VPVie — BẢN WEB (GitHub Pages): MIỄN PHÍ, luôn kích hoạt, KHÔNG BAO GIỜ HẾT HẠN.
// Không cần Key, không gọi máy chủ. (Bản desktop dùng license.js riêng có kiểm bản quyền.)
(function () {
  "use strict";
  var _status = { active: true, plan: "pro", expiry: 0, note: "", reason: "" };

  async function machineId() { return "VPV-WEB-FREE-0000"; }
  function status() { return _status; }
  function isPro() { return true; }
  function isActive() { return true; }
  async function check() { return _status; }
  async function activate() { return { ok: true, data: {} }; }       // nếu có bấm "Kích hoạt" cũng báo thành công
  function deactivate() { /* bản web luôn mở, không gỡ */ }
  async function verifyKey() { return { ok: true, data: {} }; }
  function creds() { return { license: "", machine: "" }; }

  // Ẩn nút/khung kích hoạt trên bản web cho gọn (không cần dùng).
  function hideLicUI() {
    ["btn-license", "lic-gate"].forEach(function (id) {
      var el = document.getElementById(id); if (el) { el.hidden = true; el.style.display = "none"; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hideLicUI);
  else hideLicUI();
  setTimeout(hideLicUI, 0); setTimeout(hideLicUI, 400);

  window.VPLicense = {
    machineId: machineId, status: status, isPro: isPro, isActive: isActive,
    check: check, activate: activate, deactivate: deactivate, verifyKey: verifyKey, creds: creds
  };
})();
