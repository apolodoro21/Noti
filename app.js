const DAYS = [
  { id: 'mon', name: 'Lunes', short: 'Lun' },
  { id: 'tue', name: 'Martes', short: 'Mar' },
  { id: 'wed', name: 'Miércoles', short: 'Mié' },
  { id: 'thu', name: 'Jueves', short: 'Jue' },
  { id: 'fri', name: 'Viernes', short: 'Vie' },
  { id: 'sat', name: 'Sábado', short: 'Sáb' },
  { id: 'sun', name: 'Domingo', short: 'Dom' }
];

const STORAGE_KEY = 'noti-v1';
const DEFAULT_STATE = {
  selectedDay: 'mon',
  notes: {},
  drawings: {},
  schedules: Object.fromEntries(DAYS.slice(0,5).map(d => [d.id, []]))
};

let state = loadState();
let deferredInstallPrompt = null;
let drawing = { active:false, erasing:false, lastX:0, lastY:0, dpr:1 };

const els = {
  weekdayButtons: document.getElementById('weekdayButtons'),
  weekendButtons: document.getElementById('weekendButtons'),
  dayTitle: document.getElementById('dayTitle'),
  daySubtitle: document.getElementById('daySubtitle'),
  scheduleList: document.getElementById('scheduleList'),
  scheduleCount: document.getElementById('scheduleCount'),
  noteEditor: document.getElementById('noteEditor'),
  fontSelect: document.getElementById('fontSelect'),
  checklistBtn: document.getElementById('checklistBtn'),
  saveStatus: document.getElementById('saveStatus'),
  canvas: document.getElementById('drawingCanvas'),
  brushColor: document.getElementById('brushColor'),
  brushSize: document.getElementById('brushSize'),
  brushSizeValue: document.getElementById('brushSizeValue'),
  eraserBtn: document.getElementById('eraserBtn'),
  clearCanvasBtn: document.getElementById('clearCanvasBtn'),
  installBtn: document.getElementById('installBtn'),
  scheduleModal: document.getElementById('scheduleModal'),
  scheduleRows: document.getElementById('scheduleRows'),
  addScheduleRowBtn: document.getElementById('addScheduleRowBtn'),
  saveScheduleBtn: document.getElementById('saveScheduleBtn'),
  cancelScheduleBtn: document.getElementById('cancelScheduleBtn'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  toast: document.getElementById('toast')
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefault();
    const saved = JSON.parse(raw);
    return {
      ...cloneDefault(),
      ...saved,
      notes: saved.notes || {},
      drawings: saved.drawings || {},
      schedules: { ...DEFAULT_STATE.schedules, ...(saved.schedules || {}) }
    };
  } catch {
    return cloneDefault();
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.saveStatus.textContent = 'Guardado';
}

function scheduleFor(dayId) {
  return state.schedules[dayId] || [];
}

function formatDaySubtitle(dayId) {
  return ['sat','sun'].includes(dayId)
    ? 'Pendientes personales, tareas y recordatorios del fin de semana.'
    : 'Horario universitario, pendientes y notas del día.';
}

function renderDayButtons() {
  const make = day => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `day-btn ${state.selectedDay === day.id ? 'active' : ''}`;
    btn.innerHTML = `<span class="short">${day.short}</span><span class="date">${day.name}</span>`;
    btn.addEventListener('click', () => selectDay(day.id));
    return btn;
  };
  els.weekdayButtons.replaceChildren(...DAYS.slice(0,5).map(make));
  els.weekendButtons.replaceChildren(...DAYS.slice(5).map(make));
}

function selectDay(dayId) {
  if (dayId === state.selectedDay) return;
  saveCurrentNote();
  saveDrawing();
  state.selectedDay = dayId;
  renderAll();
}

function renderSchedule() {
  const day = DAYS.find(d => d.id === state.selectedDay);
  const rows = scheduleFor(state.selectedDay);
  els.scheduleCount.textContent = `${rows.length} ${rows.length === 1 ? 'bloque' : 'bloques'}`;
  if (!rows.length) {
    els.scheduleList.innerHTML = `<div class="empty-state">No hay bloques programados. Usa <strong>Editar horario</strong> para agregar materias, horas o actividades.</div>`;
    return;
  }
  els.scheduleList.innerHTML = rows.map((row, i) => `
    <div class="schedule-row">
      <div class="schedule-time">${escapeHtml(row.time || 'Sin hora')}</div>
      <div>
        <div class="schedule-subject">${escapeHtml(row.subject || 'Sin nombre')}</div>
        ${row.meta ? `<div class="schedule-meta">${escapeHtml(row.meta)}</div>` : ''}
      </div>
      <button class="tool-btn schedule-edit-inline" data-edit-index="${i}" type="button">Editar</button>
    </div>
  `).join('');
  els.scheduleList.querySelectorAll('[data-edit-index]').forEach(btn => {
    btn.addEventListener('click', () => openScheduleModal(Number(btn.dataset.editIndex)));
  });
}

function renderNote() {
  const html = state.notes[state.selectedDay] || '';
  els.noteEditor.innerHTML = html;
  const savedFont = localStorage.getItem(`font:${state.selectedDay}`) || 'system';
  els.fontSelect.value = savedFont;
  applyFont(savedFont);
}

function applyFont(font) {
  els.noteEditor.classList.remove('font-system','font-serif','font-mono');
  els.noteEditor.classList.add(`font-${font}`);
}

function saveCurrentNote() {
  state.notes[state.selectedDay] = els.noteEditor.innerHTML;
  localStorage.setItem(`font:${state.selectedDay}`, els.fontSelect.value);
  persist();
}

function renderCanvas() {
  const canvas = els.canvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  drawing.dpr = dpr;
  const old = state.drawings[state.selectedDay];
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle = '#070a0e';
  ctx.fillRect(0,0,rect.width,rect.height);
  if (old) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
    img.src = old;
  }
}

function saveDrawing() {
  const canvas = els.canvas;
  const small = document.createElement('canvas');
  const targetW = 1000;
  const rect = canvas.getBoundingClientRect();
  const ratio = targetW / Math.max(1, rect.width);
  small.width = targetW;
  small.height = Math.max(1, Math.round(rect.height * ratio));
  const sctx = small.getContext('2d');
  sctx.fillStyle = '#070a0e';
  sctx.fillRect(0,0,small.width,small.height);
  sctx.drawImage(canvas,0,0,small.width,small.height);
  state.drawings[state.selectedDay] = small.toDataURL('image/webp', 0.72);
  persist();
}

function pointerPos(ev) {
  const rect = els.canvas.getBoundingClientRect();
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
}

function beginDraw(ev) {
  ev.preventDefault();
  els.canvas.setPointerCapture?.(ev.pointerId);
  const p = pointerPos(ev);
  drawing.active = true;
  drawing.lastX = p.x;
  drawing.lastY = p.y;
  drawTo(p.x, p.y, p.x, p.y);
}

function moveDraw(ev) {
  if (!drawing.active) return;
  ev.preventDefault();
  const p = pointerPos(ev);
  drawTo(drawing.lastX, drawing.lastY, p.x, p.y);
  drawing.lastX = p.x;
  drawing.lastY = p.y;
}

function endDraw() {
  if (!drawing.active) return;
  drawing.active = false;
  saveDrawing();
}

function drawTo(x1,y1,x2,y2) {
  const ctx = els.canvas.getContext('2d');
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Number(els.brushSize.value);
  ctx.strokeStyle = drawing.erasing ? '#070a0e' : els.brushColor.value;
  ctx.globalCompositeOperation = drawing.erasing ? 'source-over' : 'source-over';
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
  ctx.restore();
}

function setEraser(next) {
  drawing.erasing = next;
  els.eraserBtn.classList.toggle('active', next);
  els.eraserBtn.textContent = next ? '✎ Lápiz' : '⌫ Borrador';
}

function clearCanvas() {
  const ctx = els.canvas.getContext('2d');
  const rect = els.canvas.getBoundingClientRect();
  ctx.fillStyle = '#070a0e';
  ctx.fillRect(0,0,rect.width,rect.height);
  state.drawings[state.selectedDay] = '';
  persist();
}

function openScheduleModal(editIndex = null) {
  const rows = scheduleFor(state.selectedDay);
  const working = editIndex === null
    ? [...rows, { time:'', subject:'', meta:'' }]
    : rows.map(r => ({...r}));
  els.scheduleRows.innerHTML = '';
  working.forEach(row => addScheduleFormRow(row));
  els.scheduleModal.classList.remove('hidden');
  els.scheduleModal.dataset.editIndex = editIndex === null ? '' : String(editIndex);
}

function addScheduleFormRow(row = {time:'',subject:'',meta:''}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'schedule-form-row';
  wrapper.innerHTML = `
    <input class="time-input" aria-label="Hora" placeholder="08:00 - 10:00" value="${escapeAttr(row.time)}">
    <input class="subject-input" aria-label="Materia o actividad" placeholder="Materia / actividad" value="${escapeAttr(row.subject)}">
    <input class="meta-input" aria-label="Detalle" placeholder="Aula / detalle" value="${escapeAttr(row.meta)}">
    <button class="tool-btn remove-row" type="button" title="Eliminar">×</button>
  `;
  wrapper.querySelector('.remove-row').addEventListener('click', () => wrapper.remove());
  els.scheduleRows.appendChild(wrapper);
}

function closeModal() { els.scheduleModal.classList.add('hidden'); }

function saveSchedule() {
  const result = [...els.scheduleRows.querySelectorAll('.schedule-form-row')]
    .map(row => ({
      time: row.querySelector('.time-input').value.trim(),
      subject: row.querySelector('.subject-input').value.trim(),
      meta: row.querySelector('.meta-input').value.trim()
    }))
    .filter(r => r.time || r.subject || r.meta);
  state.schedules[state.selectedDay] = result;
  persist();
  renderSchedule();
  closeModal();
  showToast('Horario guardado');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

function insertChecklist() {
  els.noteEditor.focus();
  const row = document.createElement('div');
  row.className = 'check-item';
  row.innerHTML = `<input type="checkbox"><span contenteditable="true">Tarea pendiente</span>`;
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(row);
    range.setStartAfter(row);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    els.noteEditor.appendChild(row);
  }
  saveCurrentNote();
}

function renderAll() {
  const day = DAYS.find(d => d.id === state.selectedDay);
  els.dayTitle.textContent = day.name;
  els.daySubtitle.textContent = formatDaySubtitle(day.id);
  renderDayButtons();
  renderSchedule();
  renderNote();
  requestAnimationFrame(renderCanvas);
}

// Text editor events
els.noteEditor.addEventListener('input', () => {
  els.saveStatus.textContent = 'Guardando…';
  clearTimeout(els.noteEditor.saveTimer);
  els.noteEditor.saveTimer = setTimeout(saveCurrentNote, 300);
});
document.querySelectorAll('[data-command]').forEach(btn => {
  btn.addEventListener('click', () => {
    els.noteEditor.focus();
    document.execCommand(btn.dataset.command, false, null);
    saveCurrentNote();
  });
});
els.fontSelect.addEventListener('change', () => {
  applyFont(els.fontSelect.value);
  localStorage.setItem(`font:${state.selectedDay}`, els.fontSelect.value);
  saveCurrentNote();
});
els.checklistBtn.addEventListener('click', insertChecklist);

// Drawing events
els.canvas.addEventListener('pointerdown', beginDraw);
els.canvas.addEventListener('pointermove', moveDraw);
els.canvas.addEventListener('pointerup', endDraw);
els.canvas.addEventListener('pointercancel', endDraw);
els.canvas.addEventListener('pointerleave', endDraw);
els.brushSize.addEventListener('input', () => els.brushSizeValue.textContent = els.brushSize.value);
els.eraserBtn.addEventListener('click', () => setEraser(!drawing.erasing));
els.clearCanvasBtn.addEventListener('click', () => {
  if (confirm('¿Limpiar todo el dibujo de este día?')) clearCanvas();
});

// Schedule modal

document.getElementById('editScheduleBtn').addEventListener('click', () => openScheduleModal());
els.addScheduleRowBtn.addEventListener('click', () => addScheduleFormRow());
els.saveScheduleBtn.addEventListener('click', saveSchedule);
els.cancelScheduleBtn.addEventListener('click', closeModal);
els.closeModalBtn.addEventListener('click', closeModal);
els.scheduleModal.addEventListener('click', (ev) => {
  if (ev.target.dataset.closeModal) closeModal();
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeModal(); });

// PWA install flow
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installBtn.style.display = 'block';
});
els.installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) {
    showToast('En Chrome: menú ⋮ → Agregar a pantalla principal');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});
window.addEventListener('appinstalled', () => {
  showToast('App instalada');
  els.installBtn.style.display = 'none';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

window.addEventListener('resize', () => renderCanvas());

renderAll();
