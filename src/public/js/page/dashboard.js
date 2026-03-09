var titleMap = {
  links: "Manage Links",
  analytics: "Analytics Dashboard",
  settings: "Application Settings",
  users: "User Management",
  logs: "Activity Logs",
  profile: "My Profile",
};

function activateTab(name) {
  document.querySelectorAll("[data-tab]").forEach(function (el) {
    el.classList.toggle("active", el.dataset.tab === name);
    document.getElementById("panel").scrollTo({
      top: 0,
      behavior: "smooth",
    });
    var title = titleMap[name] || "Admin Dashboard";
    document.title =
      title +
      " - " +
      document.querySelector('meta[property="app_name"]').content;
  });
}

var toastContainer = (function () {
  var c = document.createElement("div");
  c.className =
    "fixed top-4 right-4 z-[100] flex flex-col gap-2.5 items-end pointer-events-none";
  document.body.appendChild(c);
  return c;
})();

var _toastIcons = {
  success:
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>',
  error:
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>',
  info: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
};
var _toastColors = {
  success: {
    wrap: "bg-gray-900 border border-green-800/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)] shadow-green-900/20",
    icon: "bg-green-900/50 text-green-400",
    label: "text-green-400",
    progress: "bg-green-500",
  },
  error: {
    wrap: "bg-gray-900 border border-red-800/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)] shadow-red-900/20",
    icon: "bg-red-900/50 text-red-400",
    label: "text-red-400",
    progress: "bg-red-500",
  },
  info: {
    wrap: "bg-gray-900 border border-blue-800/60 shadow-[0_8px_32px_rgba(0,0,0,0.5)] shadow-blue-900/20",
    icon: "bg-blue-900/50 text-blue-400",
    label: "text-blue-400",
    progress: "bg-blue-400",
  },
};
var _toastLabels = { success: "Berhasil", error: "Error", info: "Info" };

function showToast(msg, type) {
  var t = type === "success" || type === "error" ? type : "info";
  var c = _toastColors[t];
  var el = document.createElement("div");
  el.className =
    "toast-item pointer-events-auto w-80 sm:w-96 rounded-2xl relative overflow-hidden flex items-start gap-3 p-4 " +
    c.wrap;
  el.innerHTML =
    '<div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ' +
    c.icon +
    '">' +
    (_toastIcons[t] || _toastIcons.info) +
    "</div>" +
    '<div class="flex-1 min-w-0 pt-0.5">' +
    '<p class="text-xs font-bold uppercase tracking-widest ' +
    c.label +
    '">' +
    (_toastLabels[t] || "Info") +
    "</p>" +
    '<p class="text-sm text-gray-200 mt-1 break-words leading-relaxed">' +
    msg +
    "</p>" +
    "</div>" +
    '<button type="button" onclick="closeToast(this.closest(\'.toast-item\'))" class="flex-shrink-0 text-gray-600 hover:text-gray-300 transition-colors mt-0.5" aria-label="Tutup">' +
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>' +
    "</button>" +
    '<div class="toast-progress absolute bottom-0 left-0 h-0.5 rounded-full ' +
    c.progress +
    '"></div>';
  toastContainer.appendChild(el);
  var timer = setTimeout(function () {
    _dismissToast(el);
  }, 3500);
  el.dataset.timerId = String(timer);
}

function _dismissToast(el) {
  if (!el || !el.parentNode) return;
  el.classList.add("toast-hide");
  setTimeout(function () {
    if (el.parentNode) el.remove();
  }, 350);
}

function closeToast(el) {
  if (!el) return;
  var timer = Number(el.dataset.timerId);
  if (timer) clearTimeout(timer);
  _dismissToast(el);
}

document.body.addEventListener("showToast", function (evt) {
  var d = evt.detail;
  if (d && d.message) showToast(d.message, d.type || "info");
});

function showConfirmModal(opts) {
  document.getElementById("confirm-modal-title").textContent =
    opts.title || "Konfirmasi";
  document.getElementById("confirm-modal-message").textContent =
    opts.message || "Apakah Anda yakin?";
  var ok = document.getElementById("confirm-modal-ok");
  ok.textContent = opts.confirmText || "Konfirmasi";
  ok.className =
    "px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors " +
    (opts.okClass || "bg-red-700 hover:bg-red-600");
  ok.onclick = function () {
    closeConfirmModal();
    if (opts.onConfirm) opts.onConfirm();
  };
  document.getElementById("confirm-modal").classList.remove("hidden");
}

function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.add("hidden");
}

function confirmDeleteUrl(id, shortcode) {
  showConfirmModal({
    title: "Hapus Shortlink",
    message:
      'Yakin ingin menghapus "/' +
      shortcode +
      '"? Semua data analytics akan ikut terhapus secara permanen dan tidak dapat dikembalikan.',
    confirmText: "Ya, Hapus",
    onConfirm: function () {
      var el = document.getElementById("del-url-" + id);
      if (el) htmx.trigger(el, "confirmed");
    },
  });
}

function confirmDeleteUser(id, username) {
  showConfirmModal({
    title: "Hapus Pengguna",
    message:
      'Yakin ingin menghapus pengguna "' +
      username +
      '"? Tindakan ini tidak dapat dibatalkan.',
    confirmText: "Ya, Hapus",
    onConfirm: function () {
      var el = document.getElementById("del-user-" + id);
      if (el) htmx.trigger(el, "confirmed");
    },
  });
}

function confirmResetAnalytics(urlId, shortcode) {
  showConfirmModal({
    title: "Reset Analytics",
    message:
      'Reset semua data analytics untuk "/' +
      shortcode +
      '"? Data klik, IP, dan riwayat akses akan dihapus permanen dan tidak dapat dipulihkan.',
    confirmText: "Ya, Reset",
    okClass: "bg-yellow-700 hover:bg-yellow-600",
    onConfirm: function () {
      var el = document.getElementById("reset-analytics-" + urlId);
      if (el) htmx.trigger(el, "confirmed");
    },
  });
}

document.addEventListener("htmx:pushedIntoHistory", function () {
  var map = {
    "/admin/links": "links",
    "/admin/analytics": "analytics",
    "/admin/settings": "settings",
    "/admin/users": "users",
    "/admin/logs": "logs",
    "/admin/profile": "profile",
  };
  var p = window.location.pathname;
  var t = map[p] || (p.startsWith("/admin/analytics/") ? "analytics" : null);
  if (t) activateTab(t);
});
