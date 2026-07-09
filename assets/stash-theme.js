/*
  stash 共通配色テーマ制御（黒＝dark 既定 / 淡い白＝light）
  index.html と reports/*.html で共有。<head> で同期読み込みして
  描画前に data-theme を適用することでちらつきを防ぐ。
  - 保存先: localStorage["stash-theme"]（"dark" | "light"）
  - 右上のフローティング・スイッチ（.theme-switch）を自動生成し結線する。
    ページ側に .theme-switch が既にあればそれを利用する。
  同じキーを共有するため、index で選んだ色は各レポートにも引き継がれる。
*/
(function () {
  "use strict";

  var KEY = "stash-theme";
  var root = document.documentElement;

  function storedTheme() {
    try {
      var s = localStorage.getItem(KEY);
      if (s === "light" || s === "dark") return s;
    } catch (e) {}
    return "dark"; // 既定は黒
  }

  function applyTheme(theme) {
    var t = theme === "light" ? "light" : "dark";
    root.setAttribute("data-theme", t);
    try { localStorage.setItem(KEY, t); } catch (e) {}

    var btns = document.querySelectorAll(".theme-switch [data-theme-value]");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-theme-value") === t;
      btns[i].classList.toggle("is-active", on);
      btns[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  // 1) 描画前に即適用（<head> 同期読み込み前提）。
  applyTheme(storedTheme());

  // 2) DOM 準備後にスイッチを用意して結線する。
  function setup() {
    var mount = document.querySelector(".theme-switch");
    if (!mount) {
      mount = document.createElement("div");
      mount.className = "theme-switch";
      document.body.appendChild(mount);
    }
    if (!mount.querySelector("[data-theme-value]")) {
      mount.setAttribute("role", "group");
      mount.setAttribute("aria-label", "配色テーマを選択（黒 / 白）");
      mount.innerHTML =
        '<button type="button" data-theme-value="dark">黒</button>' +
        '<button type="button" data-theme-value="light">白</button>';
    }
    mount.addEventListener("click", function (e) {
      var target = e.target;
      var btn = target && target.closest ? target.closest("[data-theme-value]") : null;
      if (btn) applyTheme(btn.getAttribute("data-theme-value"));
    });
    applyTheme(storedTheme()); // ボタンの選択状態を同期
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
