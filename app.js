const SUPABASE_URL = 'https://ueyakwaxvotartkcnyhj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_GHLYL_7tgXlpsgB5b7rl5Q_qQ_a-Eai';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const DAYS = [
  { id: 'mon', db: 1, name: 'Lunes', short: 'Lun' },
  { id: 'tue', db: 2, name: 'Martes', short: 'Mar' },
  { id: 'wed', db: 3, name: 'Miércoles', short: 'Mié' },
  { id: 'thu', db: 4, name: 'Jueves', short: 'Jue' },
  { id: 'fri', db: 5, name: 'Viernes', short: 'Vie' },
  { id: 'sat', db: 6, name: 'Sábado', short: 'Sáb' },
  { id: 'sun', db: 7, name: 'Domingo', short: 'Dom' }
];

const DEFAULT_STATE = {
  selectedDay: 'mon',
  notes: {},
  drawings: {},
  fonts: {},
  schedules: Object.fromEntries(DAYS.map(d => [d.id, []]))
};

let user = null;
let state = cloneDefault();
let realtimeChannel = null;
let deferredInstallPrompt = null;
let drawing = { active:false, erasing:false, lastX:0, lastY:0, dpr:1 };
let initialized = false;
let authMode = 'login';
let initialLocalSnapshot = null;
let cloudSnapshotExists = false;

const els = {
  authScreen: document.getElementById('authScreen'),
  appScreen: document.getElementById('appScreen'),
  authForm: document.getElementById('authForm'),
  authName: document.getElementById('authName'),
  nameField: document.getElementById('nameField'),
  authEmail: document.getElementById('authEmail'),
  authPassword: document.getElementById('authPassword'),
  authSubmit: document.getElementById('authSubmit'),
  authMessage: document.getElementById('authMessage'),
  loginTab: document.getElementById('loginTab'),
  signupTab: document.getElementById('signupTab'),
  welcomeLine: document.getElementById('welcomeLine'),
  syncStatus: document.getElementById('syncStatus'),
  drawingStatus: document.getElementById('drawingStatus'),
  logoutBtn: document.getElementById('logoutBtn'),
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

function userStorageKey() {
  return user ? `noti-v2:${user.id}` : 'noti-v2:guest';
}

function loadLocalState() {
  try {
    let raw = localStorage.getItem(userStorageKey());
    // Import the data from the original Noti 1.0 build once, after the user logs in.
    if (!raw && user) {
      const legacyRaw = localStorage.getItem('noti-v1');
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        const migrated = {
          ...cloneDefault(),
          ...legacy,
          notes: legacy.notes || {},
          drawings: legacy.drawings || {},
          fonts: {},
          schedules: { ...cloneDefault().schedules, ...(legacy.schedules || {}) }
        };
        DAYS.forEach(day => {
          migrated.fonts[day.id] = localStorage.getItem(`font:${day.id}`) || 'system';
        });
        localStorage.setItem(userStorageKey(), JSON.stringify(migrated));
        return migrated;
      }
    }
    if (!raw) return cloneDefault();
    const saved = JSON.parse(raw);
    return {
      ...cloneDefault(),
      ...saved,
      notes: saved.notes || {},
      drawings: saved.drawings || {},
      fonts: saved.fonts || {},
      schedules: { ...cloneDefault().schedules, ...(saved.schedules || {}) }
    };
  } catch {
    return cloneDefault();
  }
}

function saveLocalState() {
  if (!user) return;
  localStorage.setItem(userStorageKey(), JSON.stringify(state));
}

function setSyncStatus(text, mode = '') {
  els.syncStatus.textContent = text;
  els.syncStatus.className = `sync-badge ${mode}`.trim();
}

function markSaving(element = els.saveStatus) {
  element.textContent = 'Guardando…';
}

function markSaved(element = els.saveStatus) {
  element.textContent = 'Sincronizado';
}

function showAuthMessage(message, type = '') {
  els.authMessage.textContent = message;
  els.authMessage.className = `auth-message ${type}`.trim();
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  els.loginTab.classList.toggle('active', !signup);
  els.signupTab.classList.toggle('active', signup);
  els.nameField.classList.toggle('hidden', !signup);
  els.authName.required = signup;
  els.authSubmit.textContent = signup ? 'Crear mi cuenta' : 'Entrar a Noti';
  els.authPassword.autocomplete = signup ? 'new-password' : 'current-password';
  showAuthMessage('');
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const name = els.authName.value.trim();

  els.authSubmit.disabled = true;
  showAuthMessage(authMode === 'signup' ? 'Creando tu cuenta…' : 'Iniciando sesión…');

  try {
    if (authMode === 'signup') {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } }
      });
      if (error) throw error;
      if (data.session) {
        await bootstrapUser(data.user);
      } else {
        showAuthMessage('Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión.', 'success');
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await bootstrapUser(data.user);
    }
  } catch (error) {
    showAuthMessage(humanAuthError(error), 'error');
  } finally {
    els.authSubmit.disabled = false;
  }
}

function humanAuthError(error) {
  const msg = error?.message || 'No se pudo completar la operación.';
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.';
  if (/user already registered/i.test(msg)) return 'Ese correo ya tiene una cuenta. Prueba iniciando sesión.';
  if (/password/i.test(msg) && /6/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  return msg;
}

async function bootstrapUser(authUser) {
  user = authUser;
  els.authScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  const displayName = authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Usuario';
  els.welcomeLine.textContent = `Hola, ${displayName}`;
  setSyncStatus('Conectando…', 'loading');

  initialLocalSnapshot = loadLocalState();
  state = cloneDefault();
  initialized = false;

  await ensureProfile(displayName);
  await loadCloudState();
  await setupRealtime();

  renderAll();
  initialized = true;
  setSyncStatus('Sincronizado', 'success');
}

async function ensureProfile(displayName) {
  const { error } = await supabaseClient
    .from('profiles')
    .upsert({ id: user.id, display_name: displayName }, { onConflict: 'id' });
  if (error) console.warn('No se pudo actualizar profile:', error.message);
}

function emptyStateForCloud() {
  return cloneDefault();
}

async function loadCloudState() {
  const [notesRes, drawingsRes, scheduleRes] = await Promise.all([
    supabaseClient.from('notes').select('day_of_week, title, content, font_family').eq('user_id', user.id),
    supabaseClient.from('drawings').select('day_of_week, drawing_data').eq('user_id', user.id),
    supabaseClient.from('schedules').select('id, day_of_week, start_time, end_time, subject, room, teacher, color, position').eq('user_id', user.id).order('position', { ascending: true }).order('start_time', { ascending: true })
  ]);

  for (const result of [notesRes, drawingsRes, scheduleRes]) {
    if (result.error) throw result.error;
  }

  const cloud = emptyStateForCloud();

  (notesRes.data || []).forEach(row => {
    const day = DAYS.find(d => d.db === row.day_of_week);
    if (!day) return;
    cloud.notes[day.id] = row.content || '';
    cloud.fonts[day.id] = row.font_family || 'system';
  });

  (drawingsRes.data || []).forEach(row => {
    const day = DAYS.find(d => d.db === row.day_of_week);
    if (!day) return;
    cloud.drawings[day.id] = row.drawing_data || '';
  });

  (scheduleRes.data || []).forEach(row => {
    const day = DAYS.find(d => d.db === row.day_of_week);
    if (!day) return;
    if (!cloud.schedules[day.id]) cloud.schedules[day.id] = [];
    const time = row.start_time && row.end_time ? `${String(row.start_time).slice(0,5)} - ${String(row.end_time).slice(0,5)}` : (row.start_time ? String(row.start_time).slice(0,5) : '');
    cloud.schedules[day.id].push({ id: row.id, time, subject: row.subject || '', meta: row.room || row.teacher ? [row.room, row.teacher].filter(Boolean).join(' · ') : '', room: row.room || '', teacher: row.teacher || '', color: row.color || '' });
  });

  cloudSnapshotExists = Object.values(cloud.notes).some(Boolean)
    || Object.values(cloud.drawings).some(Boolean)
    || Object.values(cloud.schedules).some(arr => arr.length);

  if (!cloudSnapshotExists && hasLocalData(initialLocalSnapshot)) {
    state = initialLocalSnapshot;
    await migrateLocalToCloud();
  } else {
    state = cloud;
    state.selectedDay = initialLocalSnapshot?.selectedDay || 'mon';
    saveLocalState();
  }
}

function hasLocalData(candidate) {
  if (!candidate) return false;
  return Object.values(candidate.notes || {}).some(Boolean)
    || Object.values(candidate.drawings || {}).some(Boolean)
    || Object.values(candidate.schedules || {}).some(arr => Array.isArray(arr) && arr.length);
}

async function migrateLocalToCloud() {
  setSyncStatus('Subiendo datos locales…', 'loading');
  const daysWithData = DAYS.filter(day =>
    (state.notes[day.id] || '') || (state.drawings[day.id] || '') || (state.schedules[day.id] || []).length
  );
  for (const day of daysWithData) {
    if (state.notes[day.id] || state.fonts[day.id]) await upsertNote(day.id, state.notes[day.id] || '', state.fonts[day.id] || 'system', false);
    if (state.drawings[day.id] !== undefined) await upsertDrawing(day.id, state.drawings[day.id] || '', false);
    await replaceSchedules(day.id, state.schedules[day.id] || [], false);
  }
  saveLocalState();
  showToast('Tus datos locales quedaron sincronizados');
}

function parseTimeRange(time) {
  const parts = String(time || '').split('-').map(v => v.trim());
  const start = parts[0] || null;
  const end = parts[1] || null;
  return { start_time: /^\d{1,2}:\d{2}$/.test(start || '') ? normalizeTime(start) : null, end_time: /^\d{1,2}:\d{2}$/.test(end || '') ? normalizeTime(end) : null };
}

function normalizeTime(value) {
  const [h, m] = value.split(':').map(Number);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
}

async function upsertNote(dayId, content, font, toast = true) {
  const day = DAYS.find(d => d.id === dayId);
  if (!day) return;
  const payload = { user_id: user.id, day_of_week: day.db, title: null, content, font_family: font || 'system' };
  const { error } = await supabaseClient.from('notes').upsert(payload, { onConflict: 'user_id,day_of_week' });
  if (error) throw error;
  state.notes[dayId] = content;
  state.fonts[dayId] = font || 'system';
  saveLocalState();
  if (toast) markSaved();
}

async function upsertDrawing(dayId, drawingData, toast = true) {
  const day = DAYS.find(d => d.id === dayId);
  if (!day) return;
  const payload = { user_id: user.id, day_of_week: day.db, drawing_data: drawingData || null };
  const { error } = await supabaseClient.from('drawings').upsert(payload, { onConflict: 'user_id,day_of_week' });
  if (error) throw error;
  state.drawings[dayId] = drawingData || '';
  saveLocalState();
  if (toast) markSaved(els.drawingStatus);
}

async function replaceSchedules(dayId, rows, toast = true) {
  const day = DAYS.find(d => d.id === dayId);
  if (!day) return;
  const { error: deleteError } = await supabaseClient.from('schedules').delete().eq('user_id', user.id).eq('day_of_week', day.db);
  if (deleteError) throw deleteError;

  const payload = rows.map((row, index) => {
    const parsed = parseTimeRange(row.time);
    const metaParts = String(row.meta || '').split(' · ');
    const room = row.room ?? metaParts[0] ?? '';
    const teacher = row.teacher ?? metaParts[1] ?? '';
    return {
      user_id: user.id,
      day_of_week: day.db,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      subject: row.subject || 'Sin nombre',
      room,
      teacher,
      color: row.color || null,
      position: index
    };
  });

  if (payload.length) {
    const { error: insertError } = await supabaseClient.from('schedules').insert(payload);
    if (insertError) throw insertError;
  }

  state.schedules[dayId] = rows;
  saveLocalState();
  if (toast) showToast('Horario sincronizado');
}

async function setupRealtime() {
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient
    .channel(`noti-user-${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drawings', filter: `user_id=eq.${user.id}` }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules', filter: `user_id=eq.${user.id}` }, handleRemoteChange)
    .subscribe(status => {
      if (status === 'SUBSCRIBED') setSyncStatus('Sincronizado', 'success');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncStatus('Conexión limitada', 'warning');
    });
}

function handleRemoteChange(payload) {
  if (!initialized) return;
  // A local write will also produce a realtime event; the next full reload keeps local and cloud consistent.
  refreshCurrentCloudState(false).catch(error => {
    console.warn('No se pudo refrescar sincronización:', error.message);
    setSyncStatus('Conexión limitada', 'warning');
  });
}

async function refreshCurrentCloudState(showStatus = true) {
  if (showStatus) setSyncStatus('Actualizando…', 'loading');
  const selected = state.selectedDay;
  const local = { ...state };
  await loadCloudState();
  state.selectedDay = selected;
  renderAll();
  if (showStatus) setSyncStatus('Sincronizado', 'success');
  else setSyncStatus('Sincronizado', 'success');
  if (local.selectedDay !== selected) state.selectedDay = selected;
}

function scheduleFor(dayId) { return state.schedules[dayId] || []; }

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

async function selectDay(dayId) {
  if (dayId === state.selectedDay) return;
  await flushCurrentLocalEdits();
  state.selectedDay = dayId;
  renderAll();
}

function renderSchedule() {
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
  const savedFont = state.fonts[state.selectedDay] || 'system';
  els.fontSelect.value = savedFont;
  applyFont(savedFont);
  markSaved();
}

function applyFont(font) {
  els.noteEditor.classList.remove('font-system','font-serif','font-mono');
  els.noteEditor.classList.add(`font-${font}`);
}

async function saveCurrentNote(showToast = false) {
  if (!user) return;
  const content = els.noteEditor.innerHTML;
  const font = els.fontSelect.value;
  state.notes[state.selectedDay] = content;
  state.fonts[state.selectedDay] = font;
  saveLocalState();
  markSaving();
  try {
    await upsertNote(state.selectedDay, content, font, false);
    markSaved();
    if (showToast) showToastFn('Nota sincronizada');
  } catch (error) {
    setSyncStatus('Conexión limitada', 'warning');
    els.saveStatus.textContent = 'Guardado local';
    console.warn('No se pudo guardar nota:', error.message);
  }
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

async function saveDrawing(showToast = false) {
  if (!user) return;
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
  const data = small.toDataURL('image/webp', 0.72);
  state.drawings[state.selectedDay] = data;
  saveLocalState();
  els.drawingStatus.textContent = 'Guardando…';
  try {
    await upsertDrawing(state.selectedDay, data, false);
    els.drawingStatus.textContent = 'Sincronizado';
    if (showToast) showToastFn('Dibujo sincronizado');
  } catch (error) {
    setSyncStatus('Conexión limitada', 'warning');
    els.drawingStatus.textContent = 'Guardado local';
    console.warn('No se pudo guardar dibujo:', error.message);
  }
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

async function clearCanvas() {
  const ctx = els.canvas.getContext('2d');
  const rect = els.canvas.getBoundingClientRect();
  ctx.fillStyle = '#070a0e';
  ctx.fillRect(0,0,rect.width,rect.height);
  state.drawings[state.selectedDay] = '';
  saveLocalState();
  await saveDrawing();
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

async function saveSchedule() {
  const result = [...els.scheduleRows.querySelectorAll('.schedule-form-row')]
    .map(row => ({
      time: row.querySelector('.time-input').value.trim(),
      subject: row.querySelector('.subject-input').value.trim(),
      meta: row.querySelector('.meta-input').value.trim()
    }))
    .filter(r => r.time || r.subject || r.meta);
  state.schedules[state.selectedDay] = result;
  saveLocalState();
  setSyncStatus('Guardando…', 'loading');
  try {
    await replaceSchedules(state.selectedDay, result);
    renderSchedule();
    closeModal();
    setSyncStatus('Sincronizado', 'success');
  } catch (error) {
    renderSchedule();
    closeModal();
    setSyncStatus('Conexión limitada', 'warning');
    showToastFn('Horario guardado localmente; se sincronizará al reconectar.');
    console.warn('No se pudo guardar horario:', error.message);
  }
}

function showToastFn(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToastFn.timer);
  showToastFn.timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
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
    if (els.noteEditor.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(row);
      range.setStartAfter(row);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      els.noteEditor.appendChild(row);
    }
  } else {
    els.noteEditor.appendChild(row);
  }
  saveCurrentNote(true);
}

async function flushCurrentLocalEdits() {
  if (!user) return;
  await Promise.allSettled([saveCurrentNote(false), saveDrawing(false)]);
}

function renderAll() {
  const day = DAYS.find(d => d.id === state.selectedDay) || DAYS[0];
  els.dayTitle.textContent = day.name;
  els.daySubtitle.textContent = formatDaySubtitle(day.id);
  renderDayButtons();
  renderSchedule();
  renderNote();
  requestAnimationFrame(renderCanvas);
}

async function handleLogout() {
  await flushCurrentLocalEdits();
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = null;
  await supabaseClient.auth.signOut();
  user = null;
  initialized = false;
  els.appScreen.classList.add('hidden');
  els.authScreen.classList.remove('hidden');
  els.authForm.reset();
  setAuthMode('login');
  showAuthMessage('Sesión cerrada.');
}

// Auth events
els.loginTab.addEventListener('click', () => setAuthMode('login'));
els.signupTab.addEventListener('click', () => setAuthMode('signup'));
els.authForm.addEventListener('submit', handleAuthSubmit);
els.logoutBtn.addEventListener('click', handleLogout);

// Text editor events
els.noteEditor.addEventListener('input', () => {
  markSaving();
  clearTimeout(els.noteEditor.saveTimer);
  els.noteEditor.saveTimer = setTimeout(() => saveCurrentNote(false), 500);
});
document.querySelectorAll('[data-command]').forEach(btn => {
  btn.addEventListener('click', () => {
    els.noteEditor.focus();
    document.execCommand(btn.dataset.command, false, null);
    saveCurrentNote(false);
  });
});
els.fontSelect.addEventListener('change', () => {
  applyFont(els.fontSelect.value);
  saveCurrentNote(false);
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
els.clearCanvasBtn.addEventListener('click', async () => {
  if (confirm('¿Limpiar todo el dibujo de este día?')) await clearCanvas();
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
    showToastFn('En Chrome: menú ⋮ → Instalar aplicación');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});
window.addEventListener('appinstalled', () => {
  showToastFn('Noti instalada');
  els.installBtn.style.display = 'none';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

window.addEventListener('resize', () => {
  if (!els.appScreen.classList.contains('hidden')) renderCanvas();
});

async function init() {
  setAuthMode('login');
  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.user) {
    try {
      await bootstrapUser(data.session.user);
    } catch (error) {
      console.error(error);
      setSyncStatus('Error de conexión', 'warning');
      showAuthMessage('No se pudo cargar tu información. Revisa la conexión e inténtalo de nuevo.', 'error');
      els.appScreen.classList.add('hidden');
      els.authScreen.classList.remove('hidden');
    }
  }
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session && user) {
      user = null;
      initialized = false;
      if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
      realtimeChannel = null;
      els.appScreen.classList.add('hidden');
      els.authScreen.classList.remove('hidden');
      setAuthMode('login');
    }
  });
}

init();
