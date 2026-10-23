const template = new URLSearchParams(window.location.search).get("template");
const hash = "index.html#order" + (template ? "?template=" + encodeURIComponent(template) : "");
window.location.replace(hash);
