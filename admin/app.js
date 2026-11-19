const REPO = "Amaryt1/Mstoda";
const OWNER = "Amaryt1";
const BASE = "https://github.com/" + REPO;
const FEED = "https://raw.githubusercontent.com/" + REPO + "/main/apps.json";
const LIMIT = 40;
const $ = (id) => document.getElementById(id);
const state = { data: { apps: [], hiddenApps: [] }, section: "all", query: "", category: "", order: "order", page: 0, selected: new Set(), ready: false };
let pending = null;
let targetBundle = null;
let timer;

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.hidden = false;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { node.hidden = true; }, 6500);
}
function el(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) node.textContent = String(label);
  return node;
}
function onlyHTTPS(value) {
  try { const u = new URL(value); return u.protocol === "https:" ? u.href : null; }
  catch { return null; }
}
function summary(app, hidden) {
  const versions = Array.isArray(app.versions) ? app.versions : [];
  const latest = versions[0] || {};
  return { app, hidden, name: String(app.name || ""), bundle: String(app.bundleIdentifier || ""),
           version: String(latest.version || "بدون إصدار"), date: latest.date || "" };
}
function items() {
  const shown = (state.data.apps || []).map((app) => summary(app, false));
  const hidden = (state.data.hiddenApps || []).map((app) => summary(app, true));
  return shown.concat(hidden);
}
function matches(entry) {
  if (state.section === "published" && entry.hidden) return false;
  if (state.section === "hidden" && !entry.hidden) return false;
  if (state.category && (entry.app.category || "") !== state.category) return false;
  if (!state.query) return true;
  const text = [entry.name, entry.bundle, entry.app.developerName, entry.app.category]
    .filter(Boolean).join(" ").toLocaleLowerCase();
  return text.includes(state.query);
}
function sorted() {
  const result = items().filter(matches);
  if (state.order === "name") result.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  else if (state.order === "newest") result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  else result.sort((a, b) => (a.app.sortOrder ?? 1000000) - (b.app.sortOrder ?? 1000000) ||
                                     a.name.localeCompare(b.name, "ar"));
  return result;
}
function btn(label, action, entry, disabled = false) {
  const node = el("button", "", label);
  node.type = "button";
  node.dataset.action = action;
  node.dataset.bundle = entry.bundle;
  node.disabled = disabled;
  node.setAttribute("aria-label", label + " " + entry.name);
  return node;
}
function renderRow(entry) {
  const row = el("article", "app-row");
  const check = el("input");
  check.type = "checkbox";
  check.checked = state.selected.has(entry.bundle);
  check.setAttribute("aria-label", "تحديد " + entry.name);
  check.addEventListener("change", () => {
    check.checked ? state.selected.add(entry.bundle) : state.selected.delete(entry.bundle);
    renderBulk();
  });
  row.append(check);
  const img = el("img", "app-icon");
  img.alt = "";
  img.loading = "lazy";
  const url = onlyHTTPS(entry.app.iconURL);
  if (url) img.src = url;
  else img.style.background = "linear-gradient(140deg,#265779,#18334d)";
  img.addEventListener("error", () => { img.removeAttribute("src"); });
  row.append(img);
  const info = el("div");
  info.style.minWidth = "0";
  info.append(el("div", "app-title", entry.name || "تطبيق بلا اسم"));
  info.append(el("div", "app-meta", entry.version + " · " + (entry.app.category || "غير مصنف")));
  info.append(el("div", "app-id", entry.bundle));
  const badge = el("span", "tag" + (entry.hidden ? " hidden" : ""), entry.hidden ? "مخفي" : "منشور");
  badge.style.marginTop = "6px";
  info.append(badge);
  row.append(info);
  const actions = el("div", "row-actions");
  actions.append(btn("تعديل", "edit", entry));
  actions.append(btn("نسخ", "duplicate", entry));
  actions.append(btn(entry.hidden ? "إظهار" : "إخفاء", entry.hidden ? "show" : "hide", entry));
  if (!entry.hidden && state.order === "order") {
    actions.append(btn("↑", "up", entry));
    actions.append(btn("↓", "down", entry));
  }
  actions.append(btn("حذف", "delete", entry));
  row.append(actions);
  return row;
}
function renderBulk() {
  const count = state.selected.size;
  $("bulkBar").hidden = count === 0;
  $("selectedCount").textContent = count + " محدد";
}
function render() {
  const rows = sorted();
  const published = state.data.apps || [];
  const hidden = state.data.hiddenApps || [];
  $("statTotal").textContent = (published.length + hidden.length).toLocaleString("en-US");
  $("statPublished").textContent = published.length.toLocaleString("en-US");
  $("statHidden").textContent = hidden.length.toLocaleString("en-US");
  $("statMissing").textContent = published.filter((app) => !Array.isArray(app.screenshotURLs) || app.screenshotURLs.length < 5).length.toLocaleString("en-US");
  $("resultCount").textContent = rows.length.toLocaleString("en-US") + " نتيجة";
  const pages = Math.max(1, Math.ceil(rows.length / LIMIT));
  state.page = Math.min(state.page, pages - 1);
  const visible = rows.slice(state.page * LIMIT, state.page * LIMIT + LIMIT);
  const list = $("list");
  list.replaceChildren();
  if (!visible.length) list.append(el("div", "empty", state.ready ? "لا توجد تطبيقات مطابقة. جرّب تغيير البحث أو التصفية." : "جارٍ تحميل البيانات…"));
  else for (const entry of visible) list.append(renderRow(entry));
  $("pageInfo").textContent = "صفحة " + (state.page + 1) + " من " + pages;
  $("prevBtn").disabled = state.page === 0;
  $("nextBtn").disabled = state.page >= pages - 1;
  renderBulk();
}
function refreshCategories() {
  const categories = [...new Set(items().map((x) => x.app.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
  const current = $("categoryFilter").value;
  $("categoryFilter").replaceChildren(new Option("كل الفئات", ""));
  $("categoryOptions").replaceChildren();
  for (const cat of categories) {
    $("categoryFilter").add(new Option(cat, cat));
    const option = document.createElement("option");
    option.value = cat;
    $("categoryOptions").append(option);
  }
  $("categoryFilter").value = categories.includes(current) ? current : "";
}
async function loadData() {
  $("syncStatus").textContent = "جارٍ التحديث من GitHub…";
  try {
    const response = await fetch(FEED + "?t=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data.apps) || (data.hiddenApps && !Array.isArray(data.hiddenApps))) throw new Error("بنية apps.json غير مدعومة");
    state.data = { ...data, hiddenApps: data.hiddenApps || [] };
    state.ready = true;
    state.selected.clear();
    refreshCategories();
    render();
    $("syncStatus").textContent = "✓ متزامن مع GitHub";
  } catch (error) {
    $("syncStatus").textContent = "تعذّر تحميل البيانات";
    toast("تعذر قراءة apps.json: " + error.message);
    render();
  }
}
function formInput(name) { return $("editorForm").elements.namedItem(name); }
function openEditor(entry = null, duplicate = false) {
  $("editorForm").reset();
  targetBundle = entry && !duplicate ? entry.bundle : null;
  const app = entry ? entry.app : {};
  $("editorTitle").textContent = !entry || duplicate ? "إضافة تطبيق" : "تعديل " + entry.name;
  const names = ["name", "bundleIdentifier", "subtitle", "developerName", "category",
                 "localizedDescription", "iconURL", "bannerURL", "tintColor", "sortOrder"];
  for (const name of names) formInput(name).value = app[name] ?? "";
  formInput("screenshotURLs").value = (app.screenshotURLs || []).join("\n");
  formInput("visibility").value = duplicate || !entry ? "published" : (entry.hidden ? "hidden" : "published");
  $("visibilityLabel").hidden = !!targetBundle;
  const version = (app.versions || [])[0];
  $("existingRelease").textContent = version ?
    "آخر إصدار محفوظ: " + version.version + " — لإضافة إصدار جديد أدخل الإصدار ورابط IPA أدناه." :
    "لا يوجد إصدار محفوظ. نشر تطبيق جديد يحتاج رقم إصدار ورابط IPA.";
  if (duplicate && version) {
    formInput("version").value = version.version || "";
    formInput("downloadURL").value = version.downloadURL || "";
    formInput("releaseNotes").value = version.localizedDescription || "";
    formInput("bundleIdentifier").value = "";
    $("existingRelease").textContent = "نسخة جديدة: أدخل Bundle ID مختلفًا قبل حفظها.";
  }
  $("editorDialog").showModal();
}
function validateSecureLink(value, label) {
  if (value && !onlyHTTPS(value)) throw new Error(label + ": أدخل رابط HTTPS صالحًا");
}
function requestFromForm() {
  const fields = {};
  for (const name of ["name", "bundleIdentifier", "subtitle", "developerName", "category",
                       "localizedDescription", "iconURL", "bannerURL", "tintColor"]) {
    fields[name] = String(formInput(name).value).trim();
  }
  const order = String(formInput("sortOrder").value).trim();
  if (order !== "") fields.sortOrder = Number(order);
  const shots = String(formInput("screenshotURLs").value).split(/[\r\n]+/).map((x) => x.trim()).filter(Boolean);
  if (shots.length > 5) throw new Error("يمكن إضافة خمس صور شاشة كحد أقصى");
  for (const shot of shots) validateSecureLink(shot, "لقطات الشاشة");
  fields.screenshotURLs = shots;
  validateSecureLink(fields.iconURL, "الأيقونة");
  validateSecureLink(fields.bannerURL, "البنر");
  const version = String(formInput("version").value).trim();
  const downloadURL = String(formInput("downloadURL").value).trim();
  if (!!version !== !!downloadURL) throw new Error("أدخل رقم الإصدار ورابط IPA معًا");
  const release = version ? { version, downloadURL,
    localizedDescription: String(formInput("releaseNotes").value).trim() } : undefined;
  if (release) validateSecureLink(downloadURL, "رابط IPA");
  const hidden = formInput("visibility").value === "hidden";
  if (!targetBundle && !hidden && !release) throw new Error("لا يمكن نشر تطبيق جديد دون إصدار ورابط IPA");
  return { schema: 1, operation: targetBundle ? "update" : "add",
           ...(targetBundle ? { target: targetBundle } : { hidden }), fields,
           ...(release ? { release } : {}) };
}
function requestTitle(request) {
  return "AMARYT Admin: " + request.operation +
    (request.target ? " " + request.target : request.fields?.name ? " " + request.fields.name : " catalog");
}
function prepareRequest(request) {
  pending = request;
  const fence = String.fromCharCode(96).repeat(3);
  const body = "<!-- AMARYT_ADMIN_REQUEST_V1 -->\n" + fence + "json\n" +
               JSON.stringify(request, null, 2) + "\n" + fence;
  $("requestBody").value = body;
  const url = BASE + "/issues/new?title=" + encodeURIComponent(requestTitle(request)) +
              "&body=" + encodeURIComponent(body);
  $("requestWarning").hidden = url.length <= 5500;
  $("editorDialog").close();
  $("requestDialog").showModal();
}
function getEntry(bundle) { return items().find((x) => x.bundle === bundle); }
function confirmAction(entry, action) {
  const labels = { hide: "إخفاء", show: "إظهار", delete: "حذف", up: "تقديم", down: "تأخير" };
  if (action === "delete") {
    const response = window.prompt("لتأكيد الحذف النهائي من القائمة، اكتب اسم التطبيق كما هو:\n" + entry.name);
    if (response !== entry.name) { toast("أُلغي الحذف."); return; }
  } else if (action === "hide" || action === "show") {
    if (!window.confirm("تأكيد " + labels[action] + " التطبيق: " + entry.name + "؟")) return;
  }
  prepareRequest({ schema: 1, operation: action === "up" || action === "down" ? "move" : action,
                   target: entry.bundle,
                   ...((action === "up" || action === "down") ? { direction: action } : {}) });
}
function bulkAction(action) {
  const targets = [...state.selected];
  if (!targets.length) return;
  const request = { schema: 1, operation: action, targets };
  if (action === "bulk_category") {
    const category = window.prompt("اسم الفئة الجديدة للتطبيقات المحددة:");
    if (!category?.trim()) return;
    request.category = category.trim();
  } else if (action === "bulk_delete") {
    if (window.prompt("لحذف " + targets.length + " تطبيق من السجل، اكتب DELETE:") !== "DELETE") return;
  } else if (!window.confirm("تطبيق العملية على " + targets.length + " تطبيق؟")) return;
  prepareRequest(request);
}
function exportJSON() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a");
  link.href = url;
  link.download = "amaryt-apps-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
document.querySelectorAll("[data-section]").forEach((button) => {
  button.addEventListener("click", () => {
    state.section = button.dataset.section;
    state.page = 0;
    document.querySelectorAll("[data-section]").forEach((b) => b.classList.toggle("active", b === button));
    render();
  });
});
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(button.dataset.close).close()));
$("searchInput").addEventListener("input", (e) => { state.query = e.target.value.trim().toLocaleLowerCase(); state.page = 0; render(); });
$("categoryFilter").addEventListener("change", (e) => { state.category = e.target.value; state.page = 0; render(); });
$("orderFilter").addEventListener("change", (e) => { state.order = e.target.value; state.page = 0; render(); });
$("refreshBtn").addEventListener("click", loadData);
$("newAppBtn").addEventListener("click", () => openEditor());
$("exportBtn").addEventListener("click", exportJSON);
$("prevBtn").addEventListener("click", () => { state.page--; render(); });
$("nextBtn").addEventListener("click", () => { state.page++; render(); });
$("clearSelectionBtn").addEventListener("click", () => { state.selected.clear(); render(); });
$("bulkHideBtn").addEventListener("click", () => bulkAction("bulk_hide"));
$("bulkShowBtn").addEventListener("click", () => bulkAction("bulk_show"));
$("bulkDeleteBtn").addEventListener("click", () => bulkAction("bulk_delete"));
$("bulkCategoryBtn").addEventListener("click", () => bulkAction("bulk_category"));
$("list").addEventListener("click", (e) => {
  const button = e.target.closest("button[data-action]");
  if (!button) return;
  const entry = getEntry(button.dataset.bundle);
  if (!entry) return;
  if (button.dataset.action === "edit") openEditor(entry);
  else if (button.dataset.action === "duplicate") openEditor(entry, true);
  else confirmAction(entry, button.dataset.action);
});
$("editorForm").addEventListener("submit", (event) => {
  event.preventDefault();
  try { prepareRequest(requestFromForm()); }
  catch (error) { toast(error.message); }
});
$("copyRequestBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("requestBody").value); toast("تم نسخ الطلب. الصقه في متن GitHub Issue."); }
  catch { $("requestBody").focus(); $("requestBody").select(); toast("حدّد النص وانسخه يدويًا."); }
});
$("openRequestBtn").addEventListener("click", async () => {
  if (!pending) return;
  const title = "?title=" + encodeURIComponent(requestTitle(pending));
  const full = BASE + "/issues/new" + title + "&body=" + encodeURIComponent($("requestBody").value);
  if (full.length > 5500) {
    // Open synchronously from the click event so popup blockers do not
    // suppress the GitHub tab while we await clipboard permission.
    window.open(BASE + "/issues/new" + title, "_blank", "noopener");
    try { await navigator.clipboard.writeText($("requestBody").value); }
    catch { $("requestBody").focus(); $("requestBody").select(); }
    toast("لأن الطلب طويل، الصق نص الطلب المنسوخ في مربع وصف GitHub Issue ثم اضغط Submit.");
  } else {
    window.open(full, "_blank", "noopener");
    toast("راجع الطلب في GitHub واضغط Submit new issue. بعدها حدّث اللوحة لمشاهدة التغيير.");
  }
});
loadData();
