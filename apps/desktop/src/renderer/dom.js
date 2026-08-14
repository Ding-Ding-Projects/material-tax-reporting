'use strict';

/**
 * Small shared helpers for the renderer.
 *
 * The renderer never gains network access and never injects untrusted markup:
 * every value that reaches the document goes through `escapeHtml`, or is set
 * as text content, or is built as a real element.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

/** Builds an element with attributes, dataset entries and children. */
export function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'text') { node.textContent = String(value); continue; }
    if (name === 'html') { node.innerHTML = String(value); continue; }
    if (name === 'dataset') { Object.assign(node.dataset, value); continue; }
    if (name === 'onClick') { node.addEventListener('click', value); continue; }
    if (name === 'onInput') { node.addEventListener('input', value); continue; }
    if (name === 'onChange') { node.addEventListener('change', value); continue; }
    if (name === 'onKeyDown') { node.addEventListener('keydown', value); continue; }
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

let lastFocused = null;

function rememberFocus() {
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

function restoreFocus() {
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  lastFocused = null;
}

/**
 * The in-app replacement for a blocking browser confirmation. It resolves to
 * true only when the person chooses the confirming action.
 */
export function confirmDialog({ title, body, confirmLabel = 'Continue', cancelLabel = 'Cancel', destructive = false, requireTyped = null }) {
  rememberFocus();
  const dialog = $('#app-dialog');
  $('#app-dialog-title').textContent = title;
  const content = $('#app-dialog-content');
  content.replaceChildren(el('p', { text: body }));
  const typedWrap = $('#app-dialog-typed');
  const typedInput = $('#app-dialog-typed-input');
  const typedLabel = $('#app-dialog-typed-label');
  typedWrap.classList.toggle('hidden', !requireTyped);
  typedInput.value = '';
  if (requireTyped) typedLabel.textContent = `Type ${requireTyped} to confirm`;
  const confirmButton = $('#app-dialog-confirm');
  confirmButton.textContent = confirmLabel;
  confirmButton.classList.toggle('danger', destructive);
  $('#app-dialog-cancel').textContent = cancelLabel;
  return new Promise((resolve) => {
    const finish = (value) => {
      dialog.close();
      confirmButton.removeEventListener('click', onConfirm);
      $('#app-dialog-cancel').removeEventListener('click', onCancel);
      restoreFocus();
      resolve(value);
    };
    const onConfirm = (event) => {
      event.preventDefault();
      if (requireTyped && typedInput.value !== requireTyped) {
        typedInput.setAttribute('aria-invalid', 'true');
        typedInput.focus();
        return;
      }
      finish(true);
    };
    const onCancel = (event) => { event.preventDefault(); finish(false); };
    confirmButton.addEventListener('click', onConfirm);
    $('#app-dialog-cancel').addEventListener('click', onCancel);
    dialog.showModal();
    (requireTyped ? typedInput : confirmButton).focus();
  });
}

/** The in-app replacement for a blocking browser prompt. */
export function promptDialog({ title, body, label, value = '', maxLength = 200, confirmLabel = 'Save' }) {
  rememberFocus();
  const dialog = $('#app-dialog');
  $('#app-dialog-title').textContent = title;
  const input = el('input', { id: 'app-dialog-prompt-input', maxlength: String(maxLength), value, autocomplete: 'off' });
  $('#app-dialog-content').replaceChildren(
    el('p', { text: body }),
    el('label', { for: 'app-dialog-prompt-input' }, [label, input]),
  );
  $('#app-dialog-typed').classList.add('hidden');
  const confirmButton = $('#app-dialog-confirm');
  confirmButton.textContent = confirmLabel;
  confirmButton.classList.remove('danger');
  $('#app-dialog-cancel').textContent = 'Cancel';
  return new Promise((resolve) => {
    const finish = (result) => {
      dialog.close();
      confirmButton.removeEventListener('click', onConfirm);
      $('#app-dialog-cancel').removeEventListener('click', onCancel);
      restoreFocus();
      resolve(result);
    };
    const onConfirm = (event) => { event.preventDefault(); finish(input.value); };
    const onCancel = (event) => { event.preventDefault(); finish(null); };
    confirmButton.addEventListener('click', onConfirm);
    $('#app-dialog-cancel').addEventListener('click', onCancel);
    dialog.showModal();
    input.focus();
  });
}

/** Keeps keyboard focus inside one container while it is open. */
export function trapFocus(container, onEscape) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const handler = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onEscape(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...container.querySelectorAll(selector)].filter((node) => node.offsetParent !== null || node === document.activeElement);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

/** Announces a message to assistive technology without moving focus. */
export function announce(message) {
  const region = $('#live-region');
  if (!region) return;
  region.textContent = '';
  window.requestAnimationFrame(() => { region.textContent = message; });
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} bytes`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(1)} ${units[unit]}`;
}
