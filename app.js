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
  preferences: null,
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
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  closeSettingsFooterBtn: document.getElementById('closeSettingsFooterBtn'),
  languageSelect: document.getElementById('languageSelect'),
  lightModeBtn: document.getElementById('lightModeBtn'),
  darkModeBtn: document.getElementById('darkModeBtn'),
  paletteOptions: document.getElementById('paletteOptions'),
  settingsSaveStatus: document.getElementById('settingsSaveStatus'),
  weekdayButtons: document.getElementById('weekdayButtons'),
  weekendButtons: document.getElementById('weekendButtons'),
  dayTitle: document.getElementById('dayTitle'),
  daySubtitle: document.getElementById('daySubtitle'),
  scheduleList: document.getElementById('scheduleList'),
  scheduleCount: document.getElementById('scheduleCount'),
  noteEditor: document.getElementById('noteEditor'),
  fontSelect: document.getElementById('fontSelect'),
  fontSizeSelect: document.getElementById('fontSizeSelect'),
  highlightBtn: document.getElementById('highlightBtn'),
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

const APP_VERSION = '3.01';
const DEFAULT_PREFERENCES = { language: 'es', theme: 'dark', palette: 'blue' };
const PALETTES = [
  { id:'blue', name:{es:'Azul suave',en:'Soft blue'}, colors:['#7aa7f8','#8f82e8'] },
  { id:'lavender', name:{es:'Lavanda',en:'Lavender'}, colors:['#9b8ce8','#c29bea'] },
  { id:'mint', name:{es:'Menta',en:'Mint'}, colors:['#65b9a4','#7fc8b0'] },
  { id:'peach', name:{es:'Durazno',en:'Peach'}, colors:['#e4a17d','#e5b27f'] },
  { id:'rose', name:{es:'Rosa',en:'Rose'}, colors:['#d98ba9','#c99bdc'] }
];

const I18N = {
  es: {
    'auth.eyebrow':'TU ORGANIZACIÓN PERSONAL','auth.subtitle':'Tus días, tus notas y tus pendientes, sincronizados en todos tus dispositivos.','auth.loginTab':'Iniciar sesión','auth.signupTab':'Crear cuenta','auth.name':'Nombre','auth.namePlaceholder':'Tu nombre','auth.email':'Correo electrónico','auth.emailPlaceholder':'tucorreo@email.com','auth.password':'Contraseña','auth.passwordPlaceholder':'Mínimo 6 caracteres','auth.submitLogin':'Entrar a Noti','auth.submitSignup':'Crear mi cuenta','auth.note':'Tus datos se guardan en tu cuenta de Noti y se sincronizan con Supabase.',
    'day.week':'Semana','day.weekend':'Fin de semana','day.sheet':'HOJA DEL DÍA','schedule.edit':'Editar horario','schedule.label':'HORARIO','schedule.title':'Asignaturas y actividades','notes.label':'NOTAS','notes.title':'Apuntes del día','drawing.label':'LIENZO','drawing.title':'Dibujo a mano alzada','drawing.color':'Color','drawing.size':'Grosor','drawing.clear':'Limpiar','footer':'Noti sincroniza tus datos con tu cuenta y mantiene una copia local para trabajar con mayor resiliencia.',
    'schedule.config':'CONFIGURACIÓN','schedule.modalTitle':'Editar horario','schedule.help':'Agrega las materias o actividades de este día. Puedes dejar filas vacías.','schedule.addBlock':'+ Agregar bloque','common.cancel':'Cancelar','common.save':'Guardar horario','common.done':'Listo',
    'settings.label':'PERSONALIZACIÓN','settings.title':'Ajustes','settings.language':'Idioma','settings.mode':'Modo de color','settings.light':'Claro','settings.dark':'Oscuro','settings.palette':'Paleta de colores','settings.saved':'Preferencias guardadas','settings.localOnly':'Preferencias guardadas localmente. Ejecuta la migración SQL para sincronizarlas entre dispositivos.','settings.saveError':'No se pudieron sincronizar las preferencias; quedaron guardadas localmente.',
    'auth.creating':'Creando tu cuenta…','auth.signingIn':'Iniciando sesión…','auth.created':'Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión.','auth.invalid':'Correo o contraseña incorrectos.','auth.unconfirmed':'Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.','auth.registered':'Ese correo ya tiene una cuenta. Prueba iniciando sesión.','auth.password6':'La contraseña debe tener al menos 6 caracteres.','auth.generic':'No se pudo completar la operación.','auth.loggedOut':'Sesión cerrada.','auth.loadError':'No se pudo cargar tu información. Revisa la conexión e inténtalo de nuevo.',
    'sync.synced':'Sincronizado','sync.connecting':'Conectando…','sync.saving':'Guardando…','sync.uploading':'Subiendo datos locales…','sync.updating':'Actualizando…','sync.limited':'Conexión limitada','sync.error':'Error de conexión','sync.localSaved':'Guardado local','sync.noteSaved':'Nota sincronizada','sync.scheduleSaved':'Horario sincronizado','sync.drawingSaved':'Dibujo sincronizado','sync.localMigrated':'Tus datos locales quedaron sincronizados','sync.scheduleLocal':'Horario guardado localmente; se sincronizará al reconectar.',
    'editor.placeholder':'Escribe aquí tus apuntes, tareas, ideas o recordatorios...','editor.font':'Tipografía','editor.size':'Tamaño del texto','editor.bold':'Negrita','editor.highlight':'Resaltador','editor.strike':'Tachado','editor.checklist':'Añadir checklist','editor.task':'Tarea pendiente','editor.highlightFixed':'Resaltado amarillo suave','editor.fontSize':'Tamaño',
    'day.mon':'Lunes','day.tue':'Martes','day.wed':'Miércoles','day.thu':'Jueves','day.fri':'Viernes','day.sat':'Sábado','day.sun':'Domingo','day.monShort':'Lun','day.tueShort':'Mar','day.wedShort':'Mié','day.thuShort':'Jue','day.friShort':'Vie','day.satShort':'Sáb','day.sunShort':'Dom',
    'day.weekSubtitle':'Horario universitario, pendientes y notas del día.','day.weekendSubtitle':'Pendientes personales, tareas y recordatorios del fin de semana.','schedule.empty':'No hay bloques programados. Usa <strong>Editar horario</strong> para agregar materias, horas o actividades.','schedule.editInline':'Editar','schedule.blocks':'bloques','schedule.block':'bloque',
    'schedule.time':'Hora','schedule.subject':'Materia o actividad','schedule.detail':'Aula / detalle','schedule.remove':'Eliminar','schedule.timePlaceholder':'08:00 - 10:00','schedule.subjectPlaceholder':'Materia / actividad','schedule.detailPlaceholder':'Aula / detalle','schedule.noTime':'Sin hora','schedule.noName':'Sin nombre',
    'drawing.eraser':'Borrador','drawing.pencil':'Lápiz','drawing.confirm':'¿Limpiar todo el dibujo de este día?','pwa.install':'Instalar app','pwa.installHint':'En Chrome: menú ⋮ → Instalar aplicación','pwa.installed':'Noti instalada','auth.logout':'Cerrar sesión','common.close':'Cerrar'
  },
  en: {
    'auth.eyebrow':'YOUR PERSONAL ORGANIZATION','auth.subtitle':'Your days, notes and tasks, synchronized across all your devices.','auth.loginTab':'Sign in','auth.signupTab':'Create account','auth.name':'Name','auth.namePlaceholder':'Your name','auth.email':'Email','auth.emailPlaceholder':'you@email.com','auth.password':'Password','auth.passwordPlaceholder':'At least 6 characters','auth.submitLogin':'Enter Noti','auth.submitSignup':'Create my account','auth.note':'Your data is stored in your Noti account and synchronized with Supabase.',
    'day.week':'Week','day.weekend':'Weekend','day.sheet':'DAY SHEET','schedule.edit':'Edit schedule','schedule.label':'SCHEDULE','schedule.title':'Subjects and activities','notes.label':'NOTES','notes.title':'Daily notes','drawing.label':'CANVAS','drawing.title':'Freehand drawing','drawing.color':'Color','drawing.size':'Size','drawing.clear':'Clear','footer':'Noti synchronizes your data with your account and keeps a local copy for resilience.',
    'schedule.config':'CONFIGURATION','schedule.modalTitle':'Edit schedule','schedule.help':'Add subjects or activities for this day. You can leave rows empty.','schedule.addBlock':'+ Add block','common.cancel':'Cancel','common.save':'Save schedule','common.done':'Done',
    'settings.label':'PERSONALIZATION','settings.title':'Settings','settings.language':'Language','settings.mode':'Color mode','settings.light':'Light','settings.dark':'Dark','settings.palette':'Color palette','settings.saved':'Preferences saved','settings.localOnly':'Preferences saved locally. Run the SQL migration to sync them across devices.','settings.saveError':'Preferences could not be synchronized; they were saved locally.',
    'auth.creating':'Creating your account…','auth.signingIn':'Signing in…','auth.created':'Account created. Check your email to confirm your account, then sign in.','auth.invalid':'Incorrect email or password.','auth.unconfirmed':'Your email has not been confirmed yet. Check your inbox.','auth.registered':'That email already has an account. Try signing in.','auth.password6':'Password must be at least 6 characters.','auth.generic':'The operation could not be completed.','auth.loggedOut':'Signed out.','auth.loadError':'Could not load your information. Check your connection and try again.',
    'sync.synced':'Synchronized','sync.connecting':'Connecting…','sync.saving':'Saving…','sync.uploading':'Uploading local data…','sync.updating':'Updating…','sync.limited':'Limited connection','sync.error':'Connection error','sync.localSaved':'Saved locally','sync.noteSaved':'Note synchronized','sync.scheduleSaved':'Schedule synchronized','sync.drawingSaved':'Drawing synchronized','sync.localMigrated':'Your local data is now synchronized','sync.scheduleLocal':'Schedule saved locally; it will sync when you reconnect.',
    'editor.placeholder':'Write your notes, tasks, ideas or reminders here...','editor.font':'Font','editor.size':'Text size','editor.bold':'Bold','editor.highlight':'Highlighter','editor.strike':'Strikethrough','editor.checklist':'Add checklist','editor.task':'Pending task','editor.highlightFixed':'Soft yellow highlight','editor.fontSize':'Size',
    'day.mon':'Monday','day.tue':'Tuesday','day.wed':'Wednesday','day.thu':'Thursday','day.fri':'Friday','day.sat':'Saturday','day.sun':'Sunday','day.monShort':'Mon','day.tueShort':'Tue','day.wedShort':'Wed','day.thuShort':'Thu','day.friShort':'Fri','day.satShort':'Sat','day.sunShort':'Sun',
    'day.weekSubtitle':'University schedule, tasks and notes for the day.','day.weekendSubtitle':'Personal tasks, to-dos and reminders for the weekend.','schedule.empty':'No scheduled blocks. Use <strong>Edit schedule</strong> to add subjects, times or activities.','schedule.editInline':'Edit','schedule.blocks':'blocks','schedule.block':'block',
    'schedule.time':'Time','schedule.subject':'Subject or activity','schedule.detail':'Room / detail','schedule.remove':'Remove','schedule.timePlaceholder':'08:00 - 10:00','schedule.subjectPlaceholder':'Subject / activity','schedule.detailPlaceholder':'Room / detail','schedule.noTime':'No time','schedule.noName':'No name',
    'drawing.eraser':'Eraser','drawing.pencil':'Pencil','drawing.confirm':'Clear the entire drawing for this day?','pwa.install':'Install app','pwa.installHint':'In Chrome: menu ⋮ → Install app','pwa.installed':'Noti installed','auth.logout':'Sign out','common.close':'Close'
  }
};

let preferences = { ...DEFAULT_PREFERENCES };
let preferencesLoadedFromCloud = false;

function t(key, vars = {}) {
  let value = I18N[preferences.language]?.[key] ?? I18N.es[key] ?? key;
  Object.entries(vars).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, replacement); });
  return value;
}

function normalizePreferences(value) {
  const next = { ...DEFAULT_PREFERENCES, ...(value || {}) };
  if (!['es','en'].includes(next.language)) next.language = 'es';
  if (!['dark','light'].includes(next.theme)) next.theme = 'dark';
  if (!PALETTES.some(p => p.id === next.palette)) next.palette = 'blue';
  return next;
}

function applyPreferences() {
  preferences = normalizePreferences(preferences);
  document.documentElement.lang = preferences.language;
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.dataset.palette = preferences.palette;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = preferences.theme === 'light' ? '#f5f7fb' : '#080b10';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  els.noteEditor.dataset.placeholder = t('editor.placeholder');
  els.fontSelect.title = t('editor.font');
  els.fontSizeSelect.title = t('editor.size');
  els.highlightBtn.title = `${t('editor.highlight')} (${t('editor.highlightFixed')})`;
  els.highlightBtn.setAttribute('aria-label', t('editor.highlight'));
  els.eraserBtn.title = drawing.erasing ? t('drawing.pencil') : t('drawing.eraser');
  els.clearCanvasBtn.title = t('drawing.clear');
  els.installBtn.title = t('pwa.install');
  els.installBtn.setAttribute('aria-label', t('pwa.install'));
  els.logoutBtn.title = t('auth.logout');
  els.logoutBtn.setAttribute('aria-label', t('auth.logout'));
  document.querySelectorAll('[aria-label="Cerrar"]').forEach(el => el.setAttribute('aria-label', t('common.close')));
  els.noteEditor.setAttribute('aria-label', t('notes.title'));
  els.canvas.setAttribute('aria-label', t('drawing.title'));
  document.querySelector('.toolbar')?.setAttribute('aria-label', t('notes.title'));
  document.querySelector('.day-strip')?.setAttribute('aria-label', t('day.sheet'));
  document.querySelector('.color-picker')?.setAttribute('title', t('drawing.color'));
  document.querySelector('.size-control')?.setAttribute('title', t('drawing.size'));
  els.settingsBtn.title = t('settings.title');
  renderSettingsControls();
  renderAll({ preserveEditor:true });
}

function renderSettingsControls() {
  els.languageSelect.value = preferences.language;
  els.lightModeBtn.classList.toggle('active', preferences.theme === 'light');
  els.darkModeBtn.classList.toggle('active', preferences.theme === 'dark');
  els.paletteOptions.innerHTML = PALETTES.map(p => `
    <button class="palette-option ${preferences.palette === p.id ? 'active' : ''}" type="button" data-palette="${p.id}" title="${escapeAttr(p.name[preferences.language])}">
      <span class="palette-swatch" style="background:linear-gradient(90deg,${p.colors[0]},${p.colors[1]})"></span>
      <span class="palette-name">${escapeHtml(p.name[preferences.language])}</span>
    </button>`).join('');
  els.paletteOptions.querySelectorAll('[data-palette]').forEach(btn => btn.addEventListener('click', () => changePreferences({ palette: btn.dataset.palette })));
}

async function changePreferences(patch) {
  preferences = normalizePreferences({ ...preferences, ...patch });
  applyPreferences();
  saveLocalPreferences();
  els.settingsSaveStatus.textContent = t('settings.saved');
  try {
    await saveCloudPreferences();
  } catch (error) {
    els.settingsSaveStatus.textContent = t('settings.localOnly');
    console.warn('No se pudieron guardar preferencias en Supabase:', error.message);
  }
}

function saveLocalPreferences() {
  if (!user) return;
  const local = loadLocalState();
  local.preferences = preferences;
  localStorage.setItem(userStorageKey(), JSON.stringify(local));
  state.preferences = preferences;
}

async function saveCloudPreferences() {
  if (!user) return;
  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Usuario';
  const { error } = await supabaseClient.from('profiles').upsert({ id:user.id, display_name:displayName, settings:preferences }, { onConflict:'id' });
  if (error) throw error;
  preferencesLoadedFromCloud = true;
}

async function loadPreferencesFromCloud() {
  preferencesLoadedFromCloud = false;
  const { data, error } = await supabaseClient.from('profiles').select('display_name, settings').eq('id', user.id).maybeSingle();
  if (error) {
    // Compatible with an existing database that has not received the new settings column yet.
    if (/settings|column|schema/i.test(error.message || '')) return;
    throw error;
  }
  if (data?.settings) {
    preferences = normalizePreferences(data.settings);
    preferencesLoadedFromCloud = true;
  }
  if (data?.display_name) user.display_name = data.display_name;
}

function openSettings() {
  els.settingsModal.classList.remove('hidden');
  els.settingsSaveStatus.textContent = '';
  renderSettingsControls();
}
function closeSettings() { els.settingsModal.classList.add('hidden'); }

function fillFontSizes() {
  els.fontSizeSelect.innerHTML = '';
  for (let size=10; size<=48; size++) {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = `${size}px`;
    els.fontSizeSelect.appendChild(option);
  }
  els.fontSizeSelect.value = '16';
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
      preferences: saved.preferences || null,
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
  element.textContent = t('sync.saving');
}

function markSaved(element = els.saveStatus) {
  element.textContent = t('sync.synced');
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
  els.authSubmit.textContent = signup ? t('auth.submitSignup') : t('auth.submitLogin');
  els.authPassword.autocomplete = signup ? 'new-password' : 'current-password';
  showAuthMessage('');
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const name = els.authName.value.trim();

  els.authSubmit.disabled = true;
  showAuthMessage(authMode === 'signup' ? t('auth.creating') : t('auth.signingIn'));

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
        showAuthMessage(t('auth.created'), 'success');
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
  const msg = error?.message || t('auth.generic');
  if (/invalid login credentials/i.test(msg)) return t('auth.invalid');
  if (/email not confirmed/i.test(msg)) return t('auth.unconfirmed');
  if (/user already registered/i.test(msg)) return t('auth.registered');
  if (/password/i.test(msg) && /6/i.test(msg)) return t('auth.password6');
  return msg;
}

async function bootstrapUser(authUser) {
  user = authUser;
  els.authScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  const displayName = authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Usuario';
  els.welcomeLine.textContent = displayName;
  setSyncStatus(t('sync.connecting'), 'loading');

  initialLocalSnapshot = loadLocalState();
  state = cloneDefault();
  initialized = false;
  preferences = normalizePreferences(initialLocalSnapshot.preferences || DEFAULT_PREFERENCES);

  await ensureProfile(displayName);
  await loadPreferencesFromCloud().catch(error => console.warn('No se pudieron cargar preferencias:', error.message));
  applyPreferences();
  if (!preferencesLoadedFromCloud) {
    saveLocalPreferences();
    await saveCloudPreferences().catch(error => console.warn('No se pudieron inicializar preferencias en Supabase:', error.message));
  }
  await loadCloudState();
  await setupRealtime();

  renderAll();
  initialized = true;
  setSyncStatus(t('sync.synced'), 'success');
}

async function ensureProfile(displayName) {
  const local = loadLocalState();
  const payload = { id:user.id, display_name:displayName };
  const { error } = await supabaseClient.from('profiles').upsert(payload, { onConflict:'id' });
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
  cloud.preferences = preferences;

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
    state.preferences = preferences;
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
  setSyncStatus(t('sync.uploading'), 'loading');
  const daysWithData = DAYS.filter(day =>
    (state.notes[day.id] || '') || (state.drawings[day.id] || '') || (state.schedules[day.id] || []).length
  );
  for (const day of daysWithData) {
    if (state.notes[day.id] || state.fonts[day.id]) await upsertNote(day.id, state.notes[day.id] || '', state.fonts[day.id] || 'system', false);
    if (state.drawings[day.id] !== undefined) await upsertDrawing(day.id, state.drawings[day.id] || '', false);
    await replaceSchedules(day.id, state.schedules[day.id] || [], false);
  }
  saveLocalState();
  showToastFn(t('sync.localMigrated'));
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
      subject: row.subject || '',
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
  if (toast) showToastFn(t('sync.scheduleSaved'));
}

async function setupRealtime() {
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient
    .channel(`noti-user-${user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drawings', filter: `user_id=eq.${user.id}` }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules', filter: `user_id=eq.${user.id}` }, handleRemoteChange)
    .subscribe(status => {
      if (status === 'SUBSCRIBED') setSyncStatus(t('sync.synced'), 'success');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncStatus(t('sync.limited'), 'warning');
    });
}

function handleRemoteChange(payload) {
  if (!initialized) return;
  // A local write will also produce a realtime event; the next full reload keeps local and cloud consistent.
  refreshCurrentCloudState(false).catch(error => {
    console.warn('No se pudo refrescar sincronización:', error.message);
    setSyncStatus(t('sync.limited'), 'warning');
  });
}

async function refreshCurrentCloudState(showStatus = true) {
  if (showStatus) setSyncStatus(t('sync.updating'), 'loading');
  const selected = state.selectedDay;
  const local = { ...state };
  await loadCloudState();
  state.selectedDay = selected;
  renderAll();
  if (showStatus) setSyncStatus(t('sync.synced'), 'success');
  else setSyncStatus(t('sync.synced'), 'success');
  if (local.selectedDay !== selected) state.selectedDay = selected;
}

function scheduleFor(dayId) { return state.schedules[dayId] || []; }

function dayName(dayId) { return t(`day.${dayId}`); }
function dayShort(dayId) { return t(`day.${dayId}Short`); }

function formatDaySubtitle(dayId) {
  return ['sat','sun'].includes(dayId) ? t('day.weekendSubtitle') : t('day.weekSubtitle');
}

function renderDayButtons() {
  const make = day => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `day-btn ${state.selectedDay === day.id ? 'active' : ''}`;
    btn.innerHTML = `<span class="short">${dayShort(day.id)}</span><span class="date">${dayName(day.id)}</span>`;
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
  els.scheduleCount.textContent = `${rows.length} ${rows.length === 1 ? t('schedule.block') : t('schedule.blocks')}`;
  if (!rows.length) {
    els.scheduleList.innerHTML = `<div class="empty-state">${t('schedule.empty')}</div>`;
    return;
  }
  els.scheduleList.innerHTML = rows.map((row, i) => `
    <div class="schedule-row">
      <div class="schedule-time">${escapeHtml(row.time || t('schedule.noTime'))}</div>
      <div>
        <div class="schedule-subject">${escapeHtml(row.subject || t('schedule.noName'))}</div>
        ${row.meta ? `<div class="schedule-meta">${escapeHtml(row.meta)}</div>` : ''}
      </div>
      <button class="tool-btn schedule-edit-inline" data-edit-index="${i}" type="button">${t('schedule.editInline')}</button>
    </div>
  `).join('');
  els.scheduleList.querySelectorAll('[data-edit-index]').forEach(btn => {
    btn.addEventListener('click', () => openScheduleModal(Number(btn.dataset.editIndex)));
  });
}

function renderNote(preserveEditor = false) {
  const html = state.notes[state.selectedDay] || '';
  if (!preserveEditor) els.noteEditor.innerHTML = html;
  const savedFont = state.fonts[state.selectedDay] || 'system';
  els.fontSelect.value = savedFont;
  applyFont(savedFont);
  if (!preserveEditor) markSaved();
}

const FONT_CLASSES = ['font-system','font-serif','font-mono','font-arial','font-helvetica','font-times','font-garamond','font-trebuchet','font-verdana','font-courier'];
function applyFont(font) {
  els.noteEditor.classList.remove(...FONT_CLASSES);
  els.noteEditor.classList.add(`font-${font}`);
}

function applySelectedFont(font) {
  const selection = window.getSelection();
  if (selection && selection.rangeCount && !selection.isCollapsed && els.noteEditor.contains(selection.anchorNode)) {
    els.noteEditor.focus();
    document.execCommand('fontName', false, font === 'system' ? 'Inter' : fontFamilyForCommand(font));
  } else {
    applyFont(font);
  }
  state.fonts[state.selectedDay] = font;
  saveCurrentNote(false);
}

function fontFamilyForCommand(font) {
  return {
    serif:'Georgia', mono:'Consolas', arial:'Arial', helvetica:'Helvetica Neue', times:'Times New Roman', garamond:'Garamond', trebuchet:'Trebuchet MS', verdana:'Verdana', courier:'Courier New'
  }[font] || 'Inter';
}

function applyTextSize(size) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed || !els.noteEditor.contains(selection.anchorNode)) {
    showToastFn(preferences.language === 'es' ? 'Selecciona el texto al que quieres aplicar el tamaño.' : 'Select the text you want to resize.');
    return;
  }
  els.noteEditor.focus();
  document.execCommand('fontSize', false, '7');
  els.noteEditor.querySelectorAll('font[size="7"]').forEach(node => {
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;
    span.innerHTML = node.innerHTML;
    node.replaceWith(span);
  });
  saveCurrentNote(false);
}

function applyHighlight() {
  els.noteEditor.focus();
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || selection.isCollapsed || !els.noteEditor.contains(selection.anchorNode)) {
    showToastFn(preferences.language === 'es' ? 'Selecciona el texto que quieres resaltar.' : 'Select the text you want to highlight.');
    return;
  }
  document.execCommand('hiliteColor', false, '#fff1a8');
  els.highlightBtn.classList.add('active');
  saveCurrentNote(false);
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
    if (showToast) showToastFn(t('sync.noteSaved'));
  } catch (error) {
    setSyncStatus(t('sync.limited'), 'warning');
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
  els.drawingStatus.textContent = t('sync.saving');
  try {
    await upsertDrawing(state.selectedDay, data, false);
    els.drawingStatus.textContent = t('sync.synced');
    if (showToast) showToastFn(t('sync.drawingSaved'));
  } catch (error) {
    setSyncStatus(t('sync.limited'), 'warning');
    els.drawingStatus.textContent = t('sync.localSaved');
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
  els.eraserBtn.textContent = next ? '✎ ' + t('drawing.pencil') : '⌫ ' + t('drawing.eraser');
  els.eraserBtn.title = next ? t('drawing.pencil') : t('drawing.eraser');
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
    <input class="time-input" aria-label="${t('schedule.time')}" placeholder="${t('schedule.timePlaceholder')}" value="${escapeAttr(row.time)}">
    <input class="subject-input" aria-label="${t('schedule.subject')}" placeholder="${t('schedule.subjectPlaceholder')}" value="${escapeAttr(row.subject)}">
    <input class="meta-input" aria-label="${t('schedule.detail')}" placeholder="${t('schedule.detailPlaceholder')}" value="${escapeAttr(row.meta)}">
    <button class="tool-btn remove-row" type="button" title="${t('schedule.remove')}">×</button>
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
  setSyncStatus(t('sync.saving'), 'loading');
  try {
    await replaceSchedules(state.selectedDay, result);
    renderSchedule();
    closeModal();
    setSyncStatus(t('sync.synced'), 'success');
  } catch (error) {
    renderSchedule();
    closeModal();
    setSyncStatus(t('sync.limited'), 'warning');
    showToastFn(t('sync.scheduleLocal'));
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
  row.innerHTML = `<input type="checkbox"><span contenteditable="true">${t('editor.task')}</span>`;
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

function renderAll(options = {}) {
  const day = DAYS.find(d => d.id === state.selectedDay) || DAYS[0];
  els.dayTitle.textContent = dayName(day.id);
  els.daySubtitle.textContent = formatDaySubtitle(day.id);
  renderDayButtons();
  renderSchedule();
  renderNote(Boolean(options.preserveEditor));
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
  showAuthMessage(t('auth.loggedOut'));
}

// Auth events
els.loginTab.addEventListener('click', () => setAuthMode('login'));
els.signupTab.addEventListener('click', () => setAuthMode('signup'));
els.authForm.addEventListener('submit', handleAuthSubmit);
els.logoutBtn.addEventListener('click', handleLogout);
els.settingsBtn.addEventListener('click', openSettings);
els.closeSettingsBtn.addEventListener('click', closeSettings);
els.closeSettingsFooterBtn.addEventListener('click', closeSettings);
els.settingsModal.addEventListener('click', ev => { if (ev.target.dataset.closeSettings) closeSettings(); });
els.languageSelect.addEventListener('change', () => changePreferences({ language: els.languageSelect.value }));
els.lightModeBtn.addEventListener('click', () => changePreferences({ theme:'light' }));
els.darkModeBtn.addEventListener('click', () => changePreferences({ theme:'dark' }));

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
els.fontSelect.addEventListener('change', () => applySelectedFont(els.fontSelect.value));
els.fontSizeSelect.addEventListener('change', () => applyTextSize(Number(els.fontSizeSelect.value)));
els.highlightBtn.addEventListener('click', applyHighlight);
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
  if (confirm(t('drawing.confirm'))) await clearCanvas();
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
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { closeModal(); closeSettings(); } });

// PWA install flow
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installBtn.style.display = 'block';
});
els.installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) {
    showToastFn(t('pwa.installHint'));
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});
window.addEventListener('appinstalled', () => {
  showToastFn(t('pwa.installed'));
  els.installBtn.style.display = 'none';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

window.addEventListener('resize', () => {
  if (!els.appScreen.classList.contains('hidden')) renderCanvas();
});

async function init() {
  fillFontSizes();
  preferences = normalizePreferences({ ...DEFAULT_PREFERENCES, ...(loadLocalState().preferences || {}) });
  applyPreferences();
  setAuthMode('login');
  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.user) {
    try {
      await bootstrapUser(data.session.user);
    } catch (error) {
      console.error(error);
      setSyncStatus(t('sync.error'), 'warning');
      showAuthMessage(t('auth.loadError'), 'error');
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
