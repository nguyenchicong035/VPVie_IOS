(function () {
  "use strict";

  var scriptUrl = document.currentScript && document.currentScript.src;
  var appRoot = scriptUrl ? new URL("../", scriptUrl) : new URL("./", location.href);
  var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var installPrompt = null;

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(new URL("sw.js", appRoot), { scope: appRoot.pathname }).catch(function (error) {
        console.warn("Không thể đăng ký chế độ ngoại tuyến:", error);
      });
    });
  }

  function makeInstallUI() {
    if (standalone || document.getElementById("pwa-install")) return;
    var button = document.createElement("button");
    button.id = "pwa-install";
    button.className = "pwa-install";
    button.type = "button";
    button.textContent = "Cài ứng dụng";
    button.setAttribute("aria-label", "Cài VPVie vào màn hình chính");

    var panel = document.createElement("div");
    panel.id = "pwa-install-panel";
    panel.className = "pwa-install-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "pwa-install-title");
    panel.innerHTML = '<div class="pwa-install-card"><button class="pwa-install-close" type="button" aria-label="Đóng">×</button>' +
      '<div class="pwa-install-icon">VP</div><h2 id="pwa-install-title">Cài VPVie trên thiết bị</h2>' +
      (isiOS
        ? '<ol><li>Mở trang này bằng <strong>Safari</strong>.</li><li>Nhấn nút <strong>Chia sẻ</strong> <span class="share-symbol">□↑</span>.</li><li>Chọn <strong>Thêm vào màn hình chính</strong>, rồi nhấn <strong>Thêm</strong>.</li></ol><p>VPVie sẽ mở độc lập toàn màn hình từ biểu tượng trên màn hình chính.</p>'
        : '<p>Nhấn “Cài đặt” để thêm VPVie vào thiết bị và mở như một ứng dụng độc lập.</p><button class="pwa-install-confirm" type="button">Cài đặt</button>') +
      '</div>';

    function close() { panel.classList.remove("show"); }
    button.addEventListener("click", function () {
      if (installPrompt && !isiOS) {
        installPrompt.prompt();
        installPrompt.userChoice.finally(function () { installPrompt = null; button.hidden = true; });
      } else {
        panel.classList.add("show");
      }
    });
    panel.addEventListener("click", function (event) { if (event.target === panel) close(); });
    panel.querySelector(".pwa-install-close").addEventListener("click", close);
    var confirm = panel.querySelector(".pwa-install-confirm");
    if (confirm) confirm.addEventListener("click", function () {
      close();
      if (installPrompt) installPrompt.prompt();
    });
    document.body.appendChild(button);
    document.body.appendChild(panel);
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installPrompt = event;
    makeInstallUI();
  });
  window.addEventListener("appinstalled", function () {
    var button = document.getElementById("pwa-install");
    if (button) button.hidden = true;
  });
  document.addEventListener("DOMContentLoaded", function () {
    if (isiOS && !standalone) makeInstallUI();
    if (standalone) document.documentElement.classList.add("pwa-standalone");
  });
})();
