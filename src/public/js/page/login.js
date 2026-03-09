function showToast(msg, type) {
  var c = document.getElementById("toast-container");
  var el = document.createElement("div");
  el.textContent = msg;
  var bgColor =
    type === "error" ? "#7f1d1d" : type === "success" ? "#14532d" : "#1f2937";
  var borderColor =
    type === "error" ? "#dc2626" : type === "success" ? "#16a34a" : "#4b5563";
  var textColor =
    type === "error" ? "#fca5a5" : type === "success" ? "#86efac" : "#e5e7eb";
  el.style.cssText =
    "background:" +
    bgColor +
    ";border:1px solid " +
    borderColor +
    ";color:" +
    textColor +
    ";padding:0.75rem 1rem;border-radius:0.75rem;font-size:0.875rem;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.5);opacity:0;transition:opacity 0.3s;max-width:20rem;";
  c.appendChild(el);
  requestAnimationFrame(function () {
    el.style.opacity = "1";
  });
  setTimeout(function () {
    el.style.opacity = "0";
    setTimeout(function () {
      el.remove();
    }, 300);
  }, 3500);
}

document.body.addEventListener("showLoginToast", function (evt) {
  var d = evt.detail;
  if (d && d.message) showToast(d.message, d.type || "error");
});
