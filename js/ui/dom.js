// Minimal DOM helpers: element creation, delegation, modals, toasts.
import { esc } from '../core/util.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(html) {
  const t = document.createElement('template'); t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Delegate clicks/changes on [data-act] elements to handler functions. */
export function bindActions(root, handlers, events = ['click']) {
  for (const type of events) {
    root.addEventListener(type, (e) => {
      const t = e.target.closest('[data-act]');
      if (!t || !root.contains(t)) return;
      if (type === 'click' && (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'button'))) return;
      if (type === 'change' && !['SELECT', 'INPUT', 'TEXTAREA'].includes(t.tagName)) return;
      const fn = handlers[t.dataset.act];
      if (fn) { fn(t, e); }
    });
  }
}

let modalStack = [];
export function modal({ title = '', body = '', foot = [], wide = false, xwide = false, onAction, onClose, closable = true, cls = '' }) {
  const root = document.getElementById('modal-root');
  const back = el(`<div class="modal-back"><div class="modal ${wide ? 'wide' : ''} ${xwide ? 'xwide' : ''} ${cls}" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${title}</h3>${closable ? '<button class="btn ghost sm" data-act="__close" aria-label="Close">✕</button>' : ''}</div>
    <div class="modal-body scroll"></div>
    ${foot.length ? `<div class="modal-foot">${foot.map((b) => `<button class="btn ${b.cls || ''}" data-act="${b.act}" ${b.disabled ? 'disabled' : ''}>${b.label}</button>`).join('')}</div>` : ''}
  </div></div>`);
  const bodyEl = back.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  const api = {
    el: back, body: bodyEl,
    close: () => { if (!back.isConnected) return; back.remove(); modalStack = modalStack.filter((m) => m !== api); onClose?.(); },
    setTitle: (t) => { back.querySelector('.modal-head h3').innerHTML = t; },
  };
  back.addEventListener('click', (e) => {
    if (e.target === back && closable) { api.close(); return; }
    const t = e.target.closest('[data-act]'); if (!t || !back.contains(t)) return;
    if (t.dataset.act === '__close') { api.close(); return; }
    onAction?.(t.dataset.act, t, api, e);
  });
  root.appendChild(back); modalStack.push(api);
  setTimeout(() => back.querySelector('[autofocus]')?.focus(), 30);
  return api;
}
export function topModal() { return modalStack[modalStack.length - 1]; }
export function closeTopModal() { const m = topModal(); if (m) { m.close(); return true; } return false; }
export function anyModalOpen() { return modalStack.length > 0; }

export function confirmBox(text, { ok = 'Confirm', cancel = 'Cancel', danger = false, title = 'Confirm' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({ title, body: `<p style="margin:0;line-height:1.5">${text}</p>`, foot: [{ label: cancel, act: 'no' }, { label: ok, act: 'yes', cls: danger ? 'danger' : 'primary' }],
      onAction: (a) => { done = true; m.close(); resolve(a === 'yes'); }, onClose: () => { if (!done) resolve(false); } });
  });
}

let toastsEnabled = () => true;
export function setToastFilter(fn) { toastsEnabled = fn; }
export function toast(text, { level = 'info', title = '', duration = 5000, onClick, kind = 'general' } = {}) {
  if (!toastsEnabled(kind, level)) return null;
  const box = document.getElementById('toasts'); if (!box) return null;
  const t = el(`<div class="toast ${level}">${title ? `<div class="t-title">${esc(title)}</div>` : ''}<div>${esc(text)}</div></div>`);
  t.addEventListener('click', () => { onClick?.(); t.remove(); });
  box.prepend(t);
  while (box.children.length > 4) box.lastElementChild.remove();
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, duration);
  return t;
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => { const f = inp.files[0]; if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(f); };
    inp.click();
  });
}
