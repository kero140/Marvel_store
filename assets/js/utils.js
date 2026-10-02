export const $ = (s, root=document) => root.querySelector(s);
export const $$ = (s, root=document) => [...root.querySelectorAll(s)];

export function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
export function money(n) {
  return `${new Intl.NumberFormat("ar-EG",{maximumFractionDigits:0}).format(Number(n)||0)} جنيه`;
}
export function uid(prefix="id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
}
export function toast(message, type="ok") {
  const root = $("#toast-root");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
export function debounce(fn, wait=180) {
  let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args),wait); };
}
export function safeJSON(value, fallback={}) {
  try { return JSON.parse(value); } catch { return fallback; }
}
export function slugify(s="") {
  return s.toString().trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,"-").replace(/^-|-$/g,"").slice(0,50) || uid("item");
}
export function escapeWhatsApp(s="") {
  return String(s).replace(/[*_~`]/g,"");
}
