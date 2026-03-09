/* ── UA Parsing ─────────────────────────────────────────── */
function parseUA(ua) {
  if (!ua) return { device: "—", browser: "—", os: "—" };

  var device = "Desktop";
  if (/mobile/i.test(ua) && !/tablet|ipad/i.test(ua)) device = "Mobile";
  else if (/tablet|ipad/i.test(ua)) device = "Tablet";

  var browser = "Tidak diketahui";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser/i.test(ua)) browser = "Samsung";
  else if (/ucbrowser/i.test(ua)) browser = "UC Browser";
  else if (/chrome\/\d/i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/firefox\/\d/i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/msie|trident/i.test(ua)) browser = "IE";

  var os = "Tidak diketahui";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua) && !/iphone|ipad/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone/i.test(ua)) os = "iOS";
  else if (/ipad/i.test(ua)) os = "iPadOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/cros/i.test(ua)) os = "ChromeOS";

  return { device: device, browser: browser, os: os };
}

function initClicksUAParser() {
  var table = document.getElementById("clicks-table");
  if (!table) return;
  var rows = table.querySelectorAll("tbody tr[data-ua]");
  rows.forEach(function (row) {
    var encoded = row.getAttribute("data-ua") || "";
    var ua = "";
    try { ua = decodeURIComponent(encoded); } catch (_) { ua = encoded; }
    var parsed = parseUA(ua);
    var devCell = row.querySelector(".ua-device");
    var brCell = row.querySelector(".ua-browser");
    var osCell = row.querySelector(".ua-os");
    if (devCell) devCell.textContent = parsed.device;
    if (brCell) brCell.textContent = parsed.browser;
    if (osCell) osCell.textContent = parsed.os;
  });
}

/* ── Sort Icons ─────────────────────────────────────────── */
var SVG_SORT_NEUTRAL = '<svg class="w-3 h-3 text-gray-600 inline ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>';
var SVG_SORT_ASC = '<svg class="w-3 h-3 text-red-400 inline ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>';
var SVG_SORT_DESC = '<svg class="w-3 h-3 text-red-400 inline ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>';

function renderSortIcons(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var sortInput = container.querySelector('input[name="sort"]');
  var sortVal = (sortInput && sortInput.value) || "";
  var parts = sortVal.split(":");
  var curField = parts[0] || "";
  var curDir = parts[1] || "desc";
  container.querySelectorAll(".sort-icon[data-field]").forEach(function (span) {
    var field = span.getAttribute("data-field");
    if (field === curField) {
      span.innerHTML = curDir === "asc" ? SVG_SORT_ASC : SVG_SORT_DESC;
    } else {
      span.innerHTML = SVG_SORT_NEUTRAL;
    }
  });
}

function initSortIcons() {
  renderSortIcons("url-list");
  renderSortIcons("users-section");
}

document.addEventListener("DOMContentLoaded", function () {
  initSortIcons();
  initClicksUAParser();
});

document.addEventListener("htmx:afterSwap", function (e) {
  var target = e.target || (e.detail && e.detail.target);
  if (!target) return;
  var id = target.id || "";
  if (id === "url-list" || target.querySelector && target.querySelector("#url-list")) {
    renderSortIcons("url-list");
  }
  if (id === "users-section" || target.querySelector && target.querySelector("#users-section")) {
    renderSortIcons("users-section");
  }
  if (id === "panel" || target.querySelector && target.querySelector("#clicks-table")) {
    initClicksUAParser();
  }
});

/* ── Filters ─────────────────────────────────────────────── */
function submitUrlFilterForm() {
  var form = document.getElementById("url-filter-form");
  if (!form) return;
  var pageInput = form.querySelector("[name='page']");
  if (pageInput) pageInput.value = "1";
  htmx.trigger(form, "submit");
}

function submitUsersFilterForm() {
  var form = document.getElementById("users-filter-form");
  if (!form) return;
  var pageInput = form.querySelector("[name='page']");
  if (pageInput) pageInput.value = "1";
  htmx.trigger(form, "submit");
}

function setUrlSort(field) {
  var form = document.getElementById("url-filter-form");
  if (!form) return;
  var sortInput = form.querySelector("[name='sort']");
  var current = (sortInput && sortInput.value) || "createdAt:desc";
  var parts = current.split(":");
  var curField = parts[0];
  var curDir = parts[1] || "desc";
  var newDir =
    curField === field ? (curDir === "asc" ? "desc" : "asc") : "desc";
  if (sortInput) sortInput.value = field + ":" + newDir;
  var pageInput = form.querySelector("[name='page']");
  if (pageInput) pageInput.value = "1";
  htmx.trigger(form, "submit");
}

function setUsersSort(field) {
  var form = document.getElementById("users-filter-form");
  if (!form) return;
  var sortInput = form.querySelector("[name='sort']");
  var current = (sortInput && sortInput.value) || "createdAt:asc";
  var parts = current.split(":");
  var curField = parts[0];
  var curDir = parts[1] || "asc";
  var newDir = curField === field ? (curDir === "asc" ? "desc" : "asc") : "asc";
  if (sortInput) sortInput.value = field + ":" + newDir;
  var pageInput = form.querySelector("[name='page']");
  if (pageInput) pageInput.value = "1";
  htmx.trigger(form, "submit");
}

function changeClicksLimit(newLimit, urlId) {
  htmx.ajax(
    "GET",
    "/admin/analytics/" + urlId + "?clicksPage=1&clicksLimit=" + newLimit,
    {
      target: "#panel",
      swap: "innerHTML",
      select: "#analytics-detail",
    },
  );
}

async function toggleUrlActive(id, isActive, checkbox) {
  checkbox.disabled = true;
  try {
    var resp = await fetch("/admin/urls/" + id + "/toggle", {
      method: "PATCH",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "isActive=" + (isActive ? "true" : "false"),
    });
    if (resp.ok) {
      var triggerHeader = resp.headers.get("HX-Trigger");
      if (triggerHeader) {
        try {
          var triggers = JSON.parse(triggerHeader);
          if (triggers.showToast) {
            showToast(triggers.showToast.message, triggers.showToast.type);
          }
        } catch (_) {}
      }
    } else {
      checkbox.checked = !isActive;
      showToast("Gagal mengubah status shortlink.", "error");
    }
  } catch (_) {
    checkbox.checked = !isActive;
    showToast("Gagal mengubah status shortlink.", "error");
  } finally {
    checkbox.disabled = false;
  }
}

function copyShortUrl(url) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(
      function () {
        showToast("URL berhasil disalin ke clipboard!", "success");
      },
      function () {
        _fallbackCopy(url);
      },
    );
  } else {
    _fallbackCopy(url);
  }
}

function _fallbackCopy(url) {
  var ta = document.createElement("textarea");
  ta.value = url;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
    showToast("URL berhasil disalin!", "success");
  } catch (_) {
    showToast("Gagal menyalin URL.", "error");
  }
  document.body.removeChild(ta);
}
