// Reusable modal controller. Pages register a form HTML and a submit callback.
import { $ } from './utils.js';

let onSubmit = null;

export function openModal({ title, body, submitLabel = 'Lưu', onSubmit: cb }) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = '';
  if (typeof body === 'string') $('#modalBody').innerHTML = body;
  else $('#modalBody').appendChild(body);
  $('#modalSubmit').textContent = submitLabel;
  onSubmit = cb;
  $('#modal').hidden = false;
  // Focus the first input for keyboard users.
  const firstInput = $('#modalBody input, #modalBody select, #modalBody textarea');
  if (firstInput) firstInput.focus();
}

export function closeModal() {
  $('#modal').hidden = true;
  onSubmit = null;
}

document.addEventListener('click', e => {
  if (e.target.matches('[data-close]')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
});
$('#modalSubmit').addEventListener('click', () => {
  if (!onSubmit) return closeModal();
  const result = onSubmit();
  // Callback returns explicit false to keep the modal open (validation error).
  if (result !== false) closeModal();
});
