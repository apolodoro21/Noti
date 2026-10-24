/* Noti 0.5.0 — calendario real, espacio diario y horarios recurrentes.
   Basado en Noti 3.0 (mismo Supabase, auth, preferencias, i18n y editor). */
const SUPABASE_URL = 'https://ueyakwaxvotartkcnyhj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_GHLYL_7tgXlpsgB5b7rl5Q_qQ_a-Eai'; // clave pública (anon): la seguridad la imponen las políticas RLS
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const C = window.NotiCore;
const APP_VERSION = '0.5.0';
const CANVAS_W = 1600, CANVAS_H = 1200;           // superficie lógica fija: el dibujo es idéntico en cualquier dispositivo
const EXPORT_W = 1200, EXPORT_H = 900;

const DAYS = [
  { id: 'mon', db: 1 }, { id: 'tue', db: 2 }, { id: 'wed', db: 3 }, { id: 'thu', db: 4 },
  { id: 'fri', db: 5 }, { id: 'sat', db: 6 }, { id: 'sun', db: 7 }
];
const dayIdOf = iso => DAYS[C.dbWeekday(iso) - 1].id;

let user = null;
let state = newState();
let realtimeChannel = null;
let deferredInstallPrompt = null;
let initialized = false;
let authMode = 'login';
let currentDate = null;        // fecha cargada en el espacio diario
let wsOpen = false, wsPushed = false, savedRange = null;
let flushing = false, flushTimer = null, syncFailed = false;
const drawing = { active:false, erasing:false, lastX:0, lastY:0, dirty:false, hasInk:false, token:0, colorTouched:false, timer:null };

function newState() {
  const today = C.todayISO();
  const d = C.parseISO(today);
  return { selectedDate: today, viewYear: d.getFullYear(), viewMonth: d.getMonth(), followToday: true,
    notes: {}, drawings: {}, drawingIndex: {}, items: [], exceptions: [], queue: [],
    legacy: { notes:{}, drawings:{}, fonts:{} }, legacyImport: {}, cloudReady: true };
}

const $ = id => document.getElementById(id);
const els = {};
['authScreen','appScreen','authForm','authName','nameField','authEmail','authPassword','authSubmit','authMessage','loginTab','signupTab',
 'welcomeLine','syncStatus','drawingStatus','logoutBtn','settingsBtn','settingsModal','closeSettingsBtn','closeSettingsFooterBtn','languageSelect',
 'lightModeBtn','darkModeBtn','paletteOptions','settingsSaveStatus','dayTitle','daySubtitle','scheduleList','scheduleCount','noteEditor','fontSelect',
 'fontSizeSelect','highlightBtn','checklistBtn','saveStatus','brushColor','brushSize','brushSizeValue','eraserBtn','clearCanvasBtn','installBtn',
 'scheduleModal','closeModalBtn','toast','calTitle','calGrid','calWeekdays','calPrev','calNext','calToday','authUsername','usernameField','grayModeBtn','styleOptions','editScheduleBtn',
 'workspace','wsBack','wsWeekday','wsDate','wsPrevDay','wsNextDay','wsSchedule','wsStage','canvasWrap','notePanel','noteRestore','legacyBanner',
 'modeWrite','modeDraw','textTools','drawTools','centerNoteBtn','migrationBanner','versionBadge',
 'scopeBox','kindBox','schSubject','schMeta','schStart','schEnd','weekdaysBox','weekdayChips','rangeBox','schStartDate','schEndDate','singleBox',
 'schSingleDate','schError','deleteScheduleBtn','cancelScheduleBtn','saveScheduleBtn','modalTitle','modalDateLabel'
].forEach(id => { els[id] = $(id); });
els.canvas = $('drawingCanvas');
els.versionBadge.textContent = `v${APP_VERSION}`;

const DEFAULT_PREFERENCES = { language: 'es', theme: 'dark', palette: 'blue', appStyle: 'soft' };
const APP_STYLES = ['square', 'soft', 'glass', 'bold'];
const UPCOMING_DAYS = 7;   // ventana de «Próximas actividades» (reservada: ver CAMBIOS_0.5.0.md)
const PALETTES = [
  { id:'blue', name:{es:'Azul suave',en:'Soft blue'}, colors:['#7aa7f8','#8f82e8'] },
  { id:'lavender', name:{es:'Lavanda',en:'Lavender'}, colors:['#9b8ce8','#c29bea'] },
  { id:'mint', name:{es:'Menta',en:'Mint'}, colors:['#65b9a4','#7fc8b0'] },
  { id:'peach', name:{es:'Durazno',en:'Peach'}, colors:['#e4a17d','#e5b27f'] },
  { id:'rose', name:{es:'Rosa',en:'Rose'}, colors:['#d98ba9','#c99bdc'] },
  { id:'coral', name:{es:'Coral',en:'Coral'}, colors:['#ff5a4f','#ff9a3d'] },
  { id:'electric', name:{es:'Eléctrico',en:'Electric'}, colors:['#2f6bff','#00c2ff'] },
  { id:'white', name:{es:'Blanco',en:'White'}, colors:['#ffffff','#d9dee7'] }
];

const I18N = {
  es: {
    'auth.eyebrow':'Tus Notas Rápidas','auth.subtitle':'Tus días, tus notas y tus pendientes, sincronizados en todos tus dispositivos.','auth.loginTab':'Iniciar sesión','auth.signupTab':'Crear cuenta','auth.name':'Nombre','auth.namePlaceholder':'Tu nombre','auth.email':'Correo electrónico','auth.emailPlaceholder':'tucorreo@email.com','auth.password':'Contraseña','auth.passwordPlaceholder':'Mínimo 6 caracteres','auth.submitLogin':'Entrar a Noti','auth.submitSignup':'Crear mi cuenta','auth.note':'Tus datos se guardan en tu cuenta de Noti y se sincronizan con Supabase.',
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
    'auth.eyebrow':'YOUR QUICKLY NOTES','auth.subtitle':'Your days, notes and tasks, synchronized across all your devices.','auth.loginTab':'Sign in','auth.signupTab':'Create account','auth.name':'Name','auth.namePlaceholder':'Your name','auth.email':'Email','auth.emailPlaceholder':'you@email.com','auth.password':'Password','auth.passwordPlaceholder':'At least 6 characters','auth.submitLogin':'Enter Noti','auth.submitSignup':'Create my account','auth.note':'Your data is stored in your Noti account and synchronized with Supabase.',
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


// ---- Traducciones nuevas de 0.5.0 (se fusionan con las de 3.0) ----
const I18N_V4 = {
  es: {
    'cal.label':'CALENDARIO','cal.today':'Hoy','cal.prev':'Mes anterior','cal.next':'Mes siguiente','cal.legendNote':'Nota','cal.legendDraw':'Dibujo','cal.legendSched':'Horario',
    'ws.open':'Abrir día','ws.back':'Calendario','ws.backAria':'Volver al calendario','ws.write':'Escribir','ws.draw':'Dibujar','ws.center':'Centrar nota','ws.uncenter':'Devolver nota al lienzo','ws.prevDay':'Día anterior','ws.nextDay':'Día siguiente','ws.schedule':'Horario del día','ws.addChip':'+ Actividad',
    'schedule.add':'+ Actividad','sch.newTitle':'Nueva actividad','sch.editTitle':'Editar actividad','sch.scope':'¿A qué ocurrencias se aplica?','sch.scopeOne':'Solo esta fecha','sch.scopeFollowing':'Esta y las siguientes','sch.scopeSeries':'Toda la serie',
    'sch.recurring':'Se repite cada semana','sch.single':'Solo una fecha','sch.from':'Desde','sch.to':'Hasta','sch.days':'Días de la semana','sch.startDate':'Fecha de inicio','sch.endDate':'Fecha de fin (opcional)','sch.date':'Fecha','sch.delete':'Eliminar','sch.save':'Guardar',
    'sch.errSubject':'Escribe el nombre de la actividad.','sch.errDays':'Selecciona al menos un día de la semana.','sch.errRange':'La fecha de fin no puede ser anterior a la de inicio.','sch.errDate':'Selecciona una fecha válida.','sch.errTime':'La hora final debe ser posterior a la inicial.',
    'sch.saved':'Actividad guardada','sch.deleted':'Actividad eliminada','sch.deleteConfirmSeries':'¿Eliminar toda la serie, incluidas las fechas pasadas?','sch.deleteConfirmFollowing':'¿Eliminar esta fecha y las siguientes? Las anteriores se conservan.','sch.deleteConfirmSingle':'¿Eliminar esta actividad?',
    'sch.tagSingle':'Fecha única','sch.tagChanged':'Modificada solo hoy','sch.tagRepeats':'Semanal',
    'legacy.note':'Hay una nota de Noti 3.0 guardada para los {day}.','legacy.drawing':'Hay un dibujo de Noti 3.0 guardado para los {day}.','legacy.importNote':'Importar nota aquí','legacy.importDrawing':'Importar dibujo aquí','legacy.imported':'Importado a esta fecha',
    'sync.pending':'Pendiente de sincronizar','sync.offlineQueued':'Sin conexión: tus cambios están guardados y se enviarán al reconectar.','sync.storageFull':'El almacenamiento del navegador está lleno; este dibujo solo se conserva en la nube.',
    'sync.migrationNeeded':'Falta ejecutar SUPABASE_MIGRACION_0.5.0.sql en Supabase. Mientras tanto Noti guarda todo en este dispositivo y lo subirá cuando la migración esté aplicada.',
    'drawing.loading':'Cargando…','notes.selectSize':'Selecciona el texto al que quieres aplicar el tamaño.','notes.selectHighlight':'Selecciona el texto que quieres resaltar.','day.fullDate':'{weekday}, {date}'
  },
  en: {
    'cal.label':'CALENDAR','cal.today':'Today','cal.prev':'Previous month','cal.next':'Next month','cal.legendNote':'Note','cal.legendDraw':'Drawing','cal.legendSched':'Schedule',
    'ws.open':'Open day','ws.back':'Calendar','ws.backAria':'Back to calendar','ws.write':'Write','ws.draw':'Draw','ws.center':'Center note','ws.uncenter':'Return note to canvas','ws.prevDay':'Previous day','ws.nextDay':'Next day','ws.schedule':'Day schedule','ws.addChip':'+ Activity',
    'schedule.add':'+ Activity','sch.newTitle':'New activity','sch.editTitle':'Edit activity','sch.scope':'Which occurrences does this apply to?','sch.scopeOne':'Only this date','sch.scopeFollowing':'This and following','sch.scopeSeries':'Entire series',
    'sch.recurring':'Repeats weekly','sch.single':'Single date','sch.from':'From','sch.to':'To','sch.days':'Days of the week','sch.startDate':'Start date','sch.endDate':'End date (optional)','sch.date':'Date','sch.delete':'Delete','sch.save':'Save',
    'sch.errSubject':'Enter the activity name.','sch.errDays':'Select at least one weekday.','sch.errRange':'The end date cannot be before the start date.','sch.errDate':'Select a valid date.','sch.errTime':'The end time must be after the start time.',
    'sch.saved':'Activity saved','sch.deleted':'Activity deleted','sch.deleteConfirmSeries':'Delete the entire series, including past dates?','sch.deleteConfirmFollowing':'Delete this date and the following ones? Earlier dates are kept.','sch.deleteConfirmSingle':'Delete this activity?',
    'sch.tagSingle':'Single date','sch.tagChanged':'Changed for this date','sch.tagRepeats':'Weekly',
    'legacy.note':'There is a Noti 3.0 note saved for {day}.','legacy.drawing':'There is a Noti 3.0 drawing saved for {day}.','legacy.importNote':'Import note here','legacy.importDrawing':'Import drawing here','legacy.imported':'Imported into this date',
    'sync.pending':'Pending sync','sync.offlineQueued':'Offline: your changes are saved and will be sent when you reconnect.','sync.storageFull':'Browser storage is full; this drawing is only kept in the cloud.',
    'sync.migrationNeeded':'SUPABASE_MIGRACION_0.5.0.sql has not been run in Supabase yet. Meanwhile Noti keeps everything on this device and will upload it once the migration is applied.',
    'drawing.loading':'Loading…','notes.selectSize':'Select the text you want to resize.','notes.selectHighlight':'Select the text you want to highlight.','day.fullDate':'{weekday}, {date}'
  }
};
const I18N_V5 = {
  es: { 'auth.email':'Correo o usuario','auth.emailPlaceholder':'Usuario o tucorreo@email.com','auth.username':'Nombre de usuario','auth.usernamePlaceholder':'usuario','auth.empty':'Escribe tu usuario o correo y tu contraseña.','auth.userNotFound':'Usuario no encontrado.','auth.wrongPassword':'Contraseña incorrecta.','auth.network':'No se pudo comprobar el usuario. Revisa tu conexión e inténtalo de nuevo.','auth.usernameInvalid':'El usuario debe tener 3–20 caracteres (letras, números, _ . -), sin espacios ni @.','auth.usernameTaken':'Ese nombre de usuario ya está en uso.','auth.emailNeeded':'Para crear una cuenta escribe un correo válido.','auth.rateLimit':'Se alcanzó el límite de envío de correos. Espera unos minutos e inténtalo otra vez.','welcome':'Hola, {name}','settings.gray':'Gris tenue','settings.style':'Temas de App','style.square':'Cuadrado','style.soft':'Bordes suaves','style.glass':'Glass','style.bold':'Bold minimalista','schedule.next':'Próxima','legacy.skip':'No importar' },
  en: { 'auth.email':'Email or username','auth.emailPlaceholder':'Username or you@email.com','auth.username':'Username','auth.usernamePlaceholder':'username','auth.empty':'Enter your username or email and your password.','auth.userNotFound':'User not found.','auth.wrongPassword':'Incorrect password.','auth.network':'Could not check the username. Check your connection and try again.','auth.usernameInvalid':'Username must be 3–20 characters (letters, digits, _ . -), no spaces or @.','auth.usernameTaken':'That username is already taken.','auth.emailNeeded':'Enter a valid email to create an account.','auth.rateLimit':'Email sending limit reached. Wait a few minutes and try again.','welcome':'Hi, {name}','settings.gray':'Soft gray','settings.style':'App themes','style.square':'Square','style.soft':'Soft edges','style.glass':'Glass','style.bold':'Bold minimal','schedule.next':'Next','legacy.skip':'Do not import' }
};
['es','en'].forEach(l => Object.assign(I18N[l], I18N_V4[l], I18N_V5[l]));

let preferences = { ...DEFAULT_PREFERENCES };
let preferencesLoadedFromCloud = false;

function t(key, vars = {}) {
  let value = I18N[preferences.language]?.[key] ?? I18N.es[key] ?? key;
  Object.entries(vars).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, replacement); });
  return value;
}
const locale = () => preferences.language === 'en' ? 'en-US' : 'es-CO';
const dayName = id => t(`day.${id}`);
const dayShort = id => t(`day.${id}Short`);
function fmtLong(iso) {
  const d = C.parseISO(iso);
  return new Intl.DateTimeFormat(locale(), { day:'numeric', month:'long', year:'numeric' }).format(d);
}
function fmtFull(iso) { return t('day.fullDate', { weekday: dayName(dayIdOf(iso)), date: fmtLong(iso) }); }

function normalizePreferences(value) {
  const v = value || {}, next = { ...DEFAULT_PREFERENCES };
  ['language', 'theme', 'palette', 'appStyle'].forEach(k => { if (v[k] !== undefined) next[k] = v[k]; });
  if (!['es','en'].includes(next.language)) next.language = 'es';
  if (!['dark','light','gray'].includes(next.theme)) next.theme = 'dark';
  if (!PALETTES.some(p => p.id === next.palette)) next.palette = 'blue';
  if (!APP_STYLES.includes(next.appStyle)) next.appStyle = 'soft';
  return next;
}

function applyPreferences() {
  preferences = normalizePreferences(preferences);
  document.documentElement.lang = preferences.language;
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.dataset.palette = preferences.palette;
  document.documentElement.dataset.style = preferences.appStyle;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = preferences.theme === 'light' ? '#f5f7fb' : preferences.theme === 'gray' ? '#2b2f36' : '#080b10';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  els.noteEditor.dataset.placeholder = t('editor.placeholder');
  els.fontSelect.title = t('editor.font');
  els.fontSizeSelect.title = t('editor.size');
  els.highlightBtn.title = `${t('editor.highlight')} (${t('editor.highlightFixed')})`;
  els.highlightBtn.setAttribute('aria-label', t('editor.highlight'));
  els.eraserBtn.title = drawing.erasing ? t('drawing.pencil') : t('drawing.eraser');
  els.clearCanvasBtn.title = t('drawing.clear');
  els.installBtn.title = t('pwa.install'); els.installBtn.setAttribute('aria-label', t('pwa.install'));
  els.logoutBtn.title = t('auth.logout'); els.logoutBtn.setAttribute('aria-label', t('auth.logout'));
  els.settingsBtn.title = t('settings.title');
  document.querySelectorAll('[aria-label="Cerrar"]').forEach(el => el.setAttribute('aria-label', t('common.close')));
  [['calPrev','cal.prev'],['calNext','cal.next'],['wsPrevDay','ws.prevDay'],['wsNextDay','ws.nextDay'],['wsBack','ws.backAria']].forEach(([id, k]) => { els[id].title = t(k); els[id].setAttribute('aria-label', t(k)); });
  els.wsSchedule.setAttribute('aria-label', t('ws.schedule'));
  els.noteEditor.setAttribute('aria-label', t('notes.title'));
  els.canvas.setAttribute('aria-label', t('drawing.title'));
  document.querySelector('.color-picker')?.setAttribute('title', t('drawing.color'));
  document.querySelector('.size-control')?.setAttribute('title', t('drawing.size'));
  if (!drawing.colorTouched) els.brushColor.value = preferences.theme === 'light' ? '#172033' : '#e8edf2';
  setEraser(drawing.erasing);
  renderCenterBtn();
  renderSettingsControls();
  if (user) renderAll();
  setAuthMode(authMode, true);
  renderMigrationBanner();
}

function renderSettingsControls() {
  els.languageSelect.value = preferences.language;
  els.lightModeBtn.classList.toggle('active', preferences.theme === 'light');
  els.darkModeBtn.classList.toggle('active', preferences.theme === 'dark');
  els.grayModeBtn.classList.toggle('active', preferences.theme === 'gray');
  els.styleOptions.innerHTML = APP_STYLES.map(id => `<button class="palette-option style-option ${preferences.appStyle === id ? 'active' : ''}" type="button" data-style="${id}"><span class="style-swatch style-${id}"></span><span class="palette-name">${escapeHtml(t('style.' + id))}</span></button>`).join('');
  els.styleOptions.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => changePreferences({ appStyle: b.dataset.style })));
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
  try { await saveCloudPreferences(); }
  catch (error) { els.settingsSaveStatus.textContent = t('settings.localOnly'); console.warn('No se pudieron guardar preferencias en Supabase:', error.message); }
}
async function saveCloudPreferences() {   // merge atómico en el servidor: nunca reemplaza todo settings ni pisa decisiones de otro dispositivo
  if (!user) return;
  const { error } = await supabaseClient.rpc('noti_merge_settings', { p_patch: normalizePreferences(preferences), p_legacy: {} });
  if (error) throw error;
  preferencesLoadedFromCloud = true;
}
async function loadPreferencesFromCloud() {
  preferencesLoadedFromCloud = false;
  const { data, error } = await supabaseClient.from('profiles').select('display_name, settings').eq('id', user.id).maybeSingle();
  if (error) { if (/settings|column|schema/i.test(error.message || '')) return; throw error; }
  if (data?.settings && Object.keys(data.settings).length) { preferences = normalizePreferences(data.settings); preferencesLoadedFromCloud = true; }
  if (data?.display_name) user.display_name = data.display_name;
  state.legacyImport = C.mergeLegacy(data?.settings?.legacyImport, state.legacyImport);
}
function openSettings() { els.settingsModal.classList.remove('hidden'); els.settingsSaveStatus.textContent = ''; renderSettingsControls(); }
function closeSettings() { els.settingsModal.classList.add('hidden'); }

function fillFontSizes() {
  els.fontSizeSelect.innerHTML = '';
  for (let size = 10; size <= 48; size++) {
    const option = document.createElement('option');
    option.value = String(size); option.textContent = `${size}px`;
    els.fontSizeSelect.appendChild(option);
  }
  els.fontSizeSelect.value = '16';
}

// ---- Almacenamiento local ----
// noti-v4:<uid>  → notas, índice de dibujos, horarios, excepciones, cola pendiente, preferencias
// noti-v4d:<uid>:<fecha> → un dibujo (separado para no reescribir un JSON enorme en cada trazo)
// noti-v2:<uid> y noti-v1 → datos de Noti 3.0/1.0 (solo lectura; nunca se borran)
const userKey = () => `noti-v4:${user ? user.id : 'guest'}`;
const legacyKey = () => `noti-v2:${user ? user.id : 'guest'}`;
const drawingKey = date => `noti-v4d:${user.id}:${date}`;

function readJSON(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function loadLocalPreferences() {
  return readJSON('noti-prefs-last') || (user && (readJSON(userKey())?.preferences || readJSON(legacyKey())?.preferences)) || null;
}
function saveLocalPreferences() {
  try { localStorage.setItem('noti-prefs-last', JSON.stringify(preferences)); } catch {}
  if (!user) return;
  const local = readJSON(userKey()) || {};
  local.preferences = preferences;
  try { localStorage.setItem(userKey(), JSON.stringify(local)); } catch {}
}
function loadLocalState() {
  const s = newState();
  const saved = readJSON(userKey());
  if (saved) {
    s.notes = saved.notes || {}; s.drawingIndex = saved.drawingIndex || {};
    s.items = saved.items || []; s.exceptions = saved.exceptions || []; s.queue = saved.queue || []; s.legacyImport = saved.legacyImport || {};
  }
  // Datos de Noti 3.0 (por día de la semana) para el aviso de importación
  const l2 = readJSON(legacyKey()) || readJSON('noti-v1');
  if (l2) {
    DAYS.forEach(d => {
      if (l2.notes?.[d.id]) s.legacy.notes[d.id] = l2.notes[d.id];
      if (l2.drawings?.[d.id]) s.legacy.drawings[d.id] = l2.drawings[d.id];
      if (l2.fonts?.[d.id]) s.legacy.fonts[d.id] = l2.fonts[d.id];
    });
  }
  return s;
}
function saveLocal() {
  if (!user) return;
  const prev = readJSON(userKey()) || {};
  const { notes, drawingIndex, items, exceptions, queue, legacyImport } = state;
  try { localStorage.setItem(userKey(), JSON.stringify({ ...prev, notes, drawingIndex, items, exceptions, queue, legacyImport, preferences })); }
  catch (e) { console.warn('No se pudo guardar localmente:', e.message); }
}
function getLocalDrawing(date) {
  if (state.drawings[date] !== undefined) return state.drawings[date];
  try { const v = localStorage.getItem(drawingKey(date)); if (v !== null) { state.drawings[date] = v; return v; } } catch {}
  return undefined;
}
function setLocalDrawing(date, data) {
  state.drawings[date] = data;
  try { data ? localStorage.setItem(drawingKey(date), data) : localStorage.removeItem(drawingKey(date)); }
  catch { showToastFn(t('sync.storageFull')); }
}

function setSyncStatus(text, mode = '') { els.syncStatus.textContent = text; els.syncStatus.className = `sync-badge ${mode}`.trim(); }
function showAuthMessage(message, type = '') { els.authMessage.textContent = message; els.authMessage.className = `auth-message ${type}`.trim(); }
function setAuthMode(mode, keepMessage = false) {
  authMode = mode;
  const signup = mode === 'signup';
  els.loginTab.classList.toggle('active', !signup);
  els.signupTab.classList.toggle('active', signup);
  els.nameField.classList.toggle('hidden', !signup);
  els.usernameField.classList.toggle('hidden', !signup); els.authUsername.required = signup;
  els.authName.required = signup;
  els.authSubmit.textContent = signup ? t('auth.submitSignup') : t('auth.submitLogin');
  els.authPassword.autocomplete = signup ? 'new-password' : 'current-password';
  if (!keepMessage) showAuthMessage('');
}

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;
const authErr = key => Object.assign(new Error(t(key)), { noti: true });
async function emailPorUsuario(username) {
  const { data, error } = await supabaseClient.rpc('email_por_usuario', { p_username: username });
  if (error) throw authErr('auth.network');     // error de comunicación ≠ usuario inexistente
  return data || null;
}
async function iniciarSesion(entrada, password) {
  entrada = (entrada || '').trim();
  if (!entrada || !password) throw authErr('auth.empty');
  const viaUsername = !entrada.includes('@');
  const email = viaUsername ? await emailPorUsuario(entrada) : entrada;
  if (!email) throw authErr('auth.userNotFound');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { if (viaUsername && /invalid login credentials/i.test(error.message || '')) throw authErr('auth.wrongPassword'); throw error; }  // por correo no se afirma cuál falló
  return data.user;
}
async function registrar(email, password, name, username) {
  if (!email.includes('@')) throw authErr('auth.emailNeeded');
  if (!USERNAME_RE.test(username)) throw authErr('auth.usernameInvalid');
  if (await emailPorUsuario(username)) throw authErr('auth.usernameTaken');   // solo UX; la unicidad real la impone el índice único + trigger
  const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { display_name: name || username, username } } });
  if (error) throw error;
  return data;
}
async function handleAuthSubmit(event) {
  event.preventDefault();
  if (els.authSubmit.disabled) return;
  const email = els.authEmail.value.trim(), password = els.authPassword.value, name = els.authName.value.trim(), username = els.authUsername.value.trim();
  els.authSubmit.disabled = true;
  showAuthMessage(authMode === 'signup' ? t('auth.creating') : t('auth.signingIn'));
  try {
    if (authMode === 'signup') {
      const data = await registrar(email, password, name, username);
      if (data.session) await bootstrapUser(data.user); else showAuthMessage(t('auth.created'), 'success');
    } else await bootstrapUser(await iniciarSesion(email, password));
  } catch (error) { showAuthMessage(humanAuthError(error), 'error'); }
  finally { els.authSubmit.disabled = false; }
}
function humanAuthError(error) {
  const msg = error?.message || t('auth.generic');
  if (error?.noti) return msg;
  if (/invalid login credentials/i.test(msg)) return t('auth.invalid');
  if (/email not confirmed/i.test(msg)) return t('auth.unconfirmed');
  if (/rate limit/i.test(msg)) return t('auth.rateLimit');
  if (/user already registered/i.test(msg)) return t('auth.registered');
  if (/profiles_username|username|database error saving new user/i.test(msg)) return t('auth.usernameTaken');
  if (/password/i.test(msg) && /6/i.test(msg)) return t('auth.password6');
  return msg;
}
async function renderWelcome() {   // prioridad: profiles.username → metadata.username → display_name → parte local del correo
  if (!user) return;
  if (user.username === undefined) { user.username = null; try { const { data } = await supabaseClient.from('profiles').select('username').eq('id', user.id).maybeSingle(); user.username = data?.username || null; } catch {} }
  const raw = user.username || user.user_metadata?.username || user.user_metadata?.display_name || user.display_name || user.email?.split('@')[0] || 'Usuario';
  els.welcomeLine.textContent = t('welcome', { name: raw.charAt(0).toUpperCase() + raw.slice(1) });
}

function showToastFn(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToastFn.timer);
  showToastFn.timer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c === 'x' ? r : (r&3|8)).toString(16); }));

// =====================  CAPA DE DATOS (nube + cola local)  =====================
const rowToItem = r => ({ id:r.id, kind:r.kind, subject:r.subject||'', room:r.room||'', teacher:r.teacher||'', color:r.color||'',
  start_time:C.normTime(r.start_time), end_time:C.normTime(r.end_time), weekdays:(r.weekdays||[]).map(Number),
  start_date:r.start_date||null, end_date:r.end_date||null, single_date:r.single_date||null, position:r.position||0, legacy_schedule_id:r.legacy_schedule_id||null });
const itemToRow = i => ({ id:i.id, user_id:user.id, kind:i.kind, subject:i.subject||'', room:i.room||'', teacher:i.teacher||'', color:i.color||null,
  start_time:i.start_time ? `${i.start_time}:00` : null, end_time:i.end_time ? `${i.end_time}:00` : null,
  weekdays:i.kind === 'single' ? [] : i.weekdays, start_date:i.start_date||null, end_date:i.end_date||null, single_date:i.kind === 'single' ? i.single_date : null,
  position:i.position||0, legacy_schedule_id:i.legacy_schedule_id||null, updated_at:new Date().toISOString() });
const rowToEx = r => ({ item_id:r.item_id, occurrence_date:r.occurrence_date, action:r.action,
  subject:r.subject ?? null, room:r.room ?? null, teacher:r.teacher ?? null, start_time:r.start_time ? C.normTime(r.start_time) : null, end_time:r.end_time ? C.normTime(r.end_time) : null });
const exToRow = e => ({ item_id:e.item_id, occurrence_date:e.occurrence_date, user_id:user.id, action:e.action,
  subject:e.subject ?? null, room:e.room ?? null, teacher:e.teacher ?? null,
  start_time:e.start_time ? `${e.start_time}:00` : null, end_time:e.end_time ? `${e.end_time}:00` : null, updated_at:new Date().toISOString() });

const isMissingTable = e => !!e && (/PGRST205|42P01/.test(e.code || '') || /schema cache|does not exist|could not find the table/i.test(e.message || ''));
const isQueued = key => state.queue.some(q => q.key === key);

function renderMigrationBanner() {
  const show = !!user && !state.cloudReady;
  els.migrationBanner.classList.toggle('hidden', !show);
  els.migrationBanner.textContent = show ? t('sync.migrationNeeded') : '';
}

async function ensureProfile(displayName) {
  const { error } = await supabaseClient.from('profiles').upsert({ id:user.id, display_name:displayName }, { onConflict:'id' });
  if (error) console.warn('No se pudo actualizar profile:', error.message);
}

async function bootstrapUser(authUser) {
  user = authUser;
  els.authScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  const displayName = authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Usuario';
  els.welcomeLine.textContent = displayName; user.username = undefined;
  setSyncStatus(t('sync.connecting'), 'loading');

  state = loadLocalState();           // primero lo local: la app es usable aunque no haya red
  initialized = false;
  preferences = normalizePreferences(loadLocalPreferences() || DEFAULT_PREFERENCES);
  applyPreferences();

  await ensureProfile(displayName);
  await loadPreferencesFromCloud().catch(e => console.warn('No se pudieron cargar preferencias:', e.message));
  applyPreferences(); renderWelcome();
  if (!preferencesLoadedFromCloud) {
    saveLocalPreferences();
    await saveCloudPreferences().catch(e => console.warn('No se pudieron inicializar preferencias en Supabase:', e.message));
  }
  try { await loadCloudState(); }
  catch (error) { console.warn('Carga de nube incompleta; se usa la copia local:', error.message); setSyncStatus(navigator.onLine ? t('sync.limited') : t('sync.localSaved'), 'warning'); }
  await setupRealtime().catch(e => console.warn('Realtime no disponible:', e.message));
  initialized = true;
  renderAll();
  await flushQueue();
  if (state.cloudReady && !state.queue.length) setSyncStatus(t('sync.synced'), 'success');
}

function overlayQueue(items, exceptions) {
  for (const op of state.queue) {
    if (op.type === 'item') { const it = state.items.find(i => i.id === op.id); if (it) { const k = items.findIndex(i => i.id === op.id); k >= 0 ? items[k] = it : items.push(it); } }
    if (op.type === 'item-delete') { items = items.filter(i => i.id !== op.id); exceptions = exceptions.filter(e => e.item_id !== op.id); }
    if (op.type === 'ex') { const e = state.exceptions.find(x => x.item_id === op.item_id && x.occurrence_date === op.date); if (e) { const k = exceptions.findIndex(x => x.item_id === op.item_id && x.occurrence_date === op.date); k >= 0 ? exceptions[k] = e : exceptions.push(e); } }
    if (op.type === 'ex-delete') exceptions = exceptions.filter(x => !(x.item_id === op.item_id && x.occurrence_date === op.date));
  }
  return { items, exceptions };
}

async function loadLegacyFromCloud() {
  const uid = user.id;
  const [ln, ld, ls] = await Promise.all([
    supabaseClient.from('notes').select('day_of_week, content, font_family').eq('user_id', uid),
    supabaseClient.from('drawings').select('day_of_week, drawing_data').eq('user_id', uid),
    supabaseClient.from('schedules').select('id, day_of_week, start_time, end_time, subject, room, teacher, color, position').eq('user_id', uid)
  ]);
  (ln.data || []).forEach(r => { const d = DAYS.find(x => x.db === r.day_of_week); if (d && r.content) { state.legacy.notes[d.id] = r.content; state.legacy.fonts[d.id] = r.font_family || 'system'; } });
  (ld.data || []).forEach(r => { const d = DAYS.find(x => x.db === r.day_of_week); if (d && r.drawing_data) state.legacy.drawings[d.id] = r.drawing_data; });
  return ls.error ? [] : (ls.data || []);
}

async function loadCloudState() {
  const uid = user.id;
  const from = tb => supabaseClient.from(tb);
  const [n, d, si, se] = await Promise.all([
    from('notes_by_date').select('note_date, content, font_family').eq('user_id', uid),
    from('drawings_by_date').select('drawing_date, updated_at').eq('user_id', uid),
    from('schedule_items').select('*').eq('user_id', uid),
    from('schedule_exceptions').select('*').eq('user_id', uid)
  ]);
  const failed = [n, d, si, se].find(r => r.error);
  if (failed) {
    if (isMissingTable(failed.error)) { state.cloudReady = false; renderMigrationBanner(); await loadLegacyFromCloud().catch(() => {}); scheduleRetry(); return; }
    throw failed.error;
  }
  state.cloudReady = true;
  renderMigrationBanner();

  const notes = {};
  (n.data || []).forEach(r => { notes[r.note_date] = { content:r.content || '', font:r.font_family || 'system' }; });
  const prevIdx = state.drawingIndex, idx = {};
  (d.data || []).forEach(r => { idx[r.drawing_date] = r.updated_at || 'cloud'; });
  for (const op of state.queue) {
    if (op.type === 'note' && state.notes[op.date]) notes[op.date] = state.notes[op.date];
    if (op.type === 'drawing') { if (state.drawingIndex[op.date]) idx[op.date] = state.drawingIndex[op.date]; else delete idx[op.date]; }
  }
  // Un dibujo cambiado en otro dispositivo invalida la copia local de esta fecha
  Object.keys(idx).forEach(date => { if (prevIdx[date] && prevIdx[date] !== idx[date] && !isQueued('drawing:' + date)) invalidateDrawing(date); });
  Object.keys(prevIdx).forEach(date => { if (!idx[date] && !isQueued('drawing:' + date)) invalidateDrawing(date); });

  const merged = overlayQueue((si.data || []).map(rowToItem), (se.data || []).map(rowToEx));
  state.notes = notes; state.drawingIndex = idx; state.items = merged.items; state.exceptions = merged.exceptions;

  const legacySchedules = await loadLegacyFromCloud().catch(() => []);
  migrateLegacySchedules(legacySchedules);
  saveLocal();
}

function invalidateDrawing(date) { delete state.drawings[date]; try { localStorage.removeItem(drawingKey(date)); } catch {} }

// Red de seguridad: si algún horario de Noti 3.0 no fue copiado por el SQL, se copia aquí (idempotente por legacy_schedule_id).
function migrateLegacySchedules(rows) {
  const known = new Set(state.items.map(i => i.legacy_schedule_id).filter(Boolean));
  rows.forEach((r, idx) => {
    if (!(r.day_of_week >= 1 && r.day_of_week <= 7) || known.has(String(r.id))) return;
    const item = { id:uuid(), kind:'recurring', subject:r.subject || '', room:r.room || '', teacher:r.teacher || '', color:r.color || '',
      start_time:C.normTime(r.start_time), end_time:C.normTime(r.end_time), weekdays:[r.day_of_week], start_date:null, end_date:null, single_date:null,
      position:r.position ?? idx, legacy_schedule_id:String(r.id) };
    state.items.push(item);
    enqueue({ key:'item:' + item.id, type:'item', id:item.id });
  });
}

// ---- Cola de sincronización: nada se pierde si falla la red ----
function enqueue(op) {
  const i = state.queue.findIndex(q => q.key === op.key);
  if (i >= 0) state.queue[i] = op; else state.queue.push(op);   // se reemplaza EN SU LUGAR para conservar el orden (items antes que sus excepciones)
  saveLocal();
  refreshStatuses();
  flushQueue();
}

async function runOp(op) {
  const db = supabaseClient;
  const now = new Date().toISOString();
  let res;
  if (op.type === 'legacy') {   // va DESPUÉS de la op de nota/dibujo en la cola: solo se envía si el contenido ya se guardó en el destino
    const e = state.legacyImport[op.id]; if (!e) return;
    res = await db.rpc('noti_merge_settings', { p_patch: {}, p_legacy: { [op.id]: e } });
  } else if (op.type === 'note') {
    const n = state.notes[op.date]; if (!n) return;
    res = await db.from('notes_by_date').upsert({ user_id:user.id, note_date:op.date, content:n.content, font_family:n.font || 'system', updated_at:now }, { onConflict:'user_id,note_date' });
  } else if (op.type === 'drawing') {
    const data = getLocalDrawing(op.date) || null;
    res = await db.from('drawings_by_date').upsert({ user_id:user.id, drawing_date:op.date, drawing_data:data, updated_at:state.drawingIndex[op.date] || now }, { onConflict:'user_id,drawing_date' });
  } else if (op.type === 'item') {
    const it = state.items.find(i => i.id === op.id); if (!it) return;
    res = it.legacy_schedule_id
      ? await db.from('schedule_items').upsert(itemToRow(it), { onConflict:'user_id,legacy_schedule_id', ignoreDuplicates:false })
      : await db.from('schedule_items').upsert(itemToRow(it), { onConflict:'id' });
  } else if (op.type === 'item-delete') {
    res = await db.from('schedule_items').delete().eq('id', op.id).eq('user_id', user.id);
  } else if (op.type === 'ex') {
    const e = state.exceptions.find(x => x.item_id === op.item_id && x.occurrence_date === op.date); if (!e) return;
    res = await db.from('schedule_exceptions').upsert(exToRow(e), { onConflict:'item_id,occurrence_date' });
  } else if (op.type === 'ex-delete') {
    res = await db.from('schedule_exceptions').delete().eq('item_id', op.item_id).eq('occurrence_date', op.date).eq('user_id', user.id);
  }
  if (res?.error) throw res.error;
}

async function flushQueue() {
  if (flushing || !user) return;
  if (!state.queue.length) { refreshStatuses(); return; }
  if (!state.cloudReady) { refreshStatuses(); scheduleRetry(); return; }
  flushing = true;
  try {
    while (state.queue.length) {
      const op = state.queue[0];
      try { await runOp(op); }
      catch (e) {
        if (isMissingTable(e)) { state.cloudReady = false; renderMigrationBanner(); throw e; }
        if (e.code === '23505' || e.code === '23503') { console.warn('Operación descartada por conflicto permanente:', op.key, e.message); if (state.queue[0] === op) state.queue.shift(); saveLocal(); continue; }
        throw e;
      }
      if (state.queue[0] === op) state.queue.shift();
      saveLocal();
      refreshStatuses();
    }
    syncFailed = false; setSyncStatus(t('sync.synced'), 'success');
  } catch (e) {
    syncFailed = true; console.warn('Sincronización pendiente:', e.message);
    setSyncStatus(navigator.onLine ? t('sync.limited') : t('sync.localSaved'), 'warning');
    scheduleRetry();
  } finally { flushing = false; refreshStatuses(); }
}
function scheduleRetry() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(async () => { if (!user) return; if (!state.cloudReady) await loadCloudState().catch(() => {}); flushQueue(); }, 20000);
}

// ---- Realtime ----
async function setupRealtime() {
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  const f = `user_id=eq.${user.id}`;
  realtimeChannel = supabaseClient.channel(`noti-user-${user.id}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'notes_by_date', filter:f }, onRemoteNote)
    .on('postgres_changes', { event:'*', schema:'public', table:'drawings_by_date', filter:f }, onRemoteDrawing)
    .on('postgres_changes', { event:'*', schema:'public', table:'schedule_items', filter:f }, onRemoteSchedule)
    .on('postgres_changes', { event:'*', schema:'public', table:'schedule_exceptions', filter:f }, onRemoteSchedule)
    .subscribe(status => {
      if (status === 'SUBSCRIBED' && !state.queue.length) setSyncStatus(t('sync.synced'), 'success');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncStatus(t('sync.limited'), 'warning');
    });
}
function afterRemote(date) { renderCalendar(); renderAgenda(); if (wsOpen && date === currentDate) { syncEditorFromState(); renderLegacyBanner(); } }
function onRemoteNote(p) {
  if (!initialized) return;
  if (p.eventType === 'DELETE') { const d = p.old?.note_date; if (d && !isQueued('note:' + d)) { delete state.notes[d]; saveLocal(); afterRemote(d); } return; }
  const row = p.new, d = row.note_date;
  if (isQueued('note:' + d)) return;                                  // tus cambios locales pendientes mandan
  const cur = state.notes[d];
  if (cur && cur.content === (row.content || '') && cur.font === (row.font_family || 'system')) return;   // eco de tu propio guardado
  if (wsOpen && d === currentDate && document.activeElement === els.noteEditor) return;                    // no pisar lo que estás escribiendo
  state.notes[d] = { content:row.content || '', font:row.font_family || 'system' };
  saveLocal(); afterRemote(d);
}
function onRemoteDrawing(p) {
  if (!initialized) return;
  const d = (p.new?.drawing_date) || (p.old?.drawing_date); if (!d || isQueued('drawing:' + d)) return;
  if (p.eventType === 'DELETE') delete state.drawingIndex[d];
  else { if (state.drawingIndex[d] === p.new.updated_at) return; state.drawingIndex[d] = p.new.updated_at || 'cloud'; }
  invalidateDrawing(d); saveLocal(); renderCalendar();
  if (wsOpen && d === currentDate && !drawing.active && !drawing.dirty) loadDrawing(d);
}
async function onRemoteSchedule() {
  if (!initialized) return;
  const [si, se] = await Promise.all([supabaseClient.from('schedule_items').select('*').eq('user_id', user.id), supabaseClient.from('schedule_exceptions').select('*').eq('user_id', user.id)]);
  if (si.error || se.error) return;
  const m = overlayQueue(si.data.map(rowToItem), se.data.map(rowToEx));
  state.items = m.items; state.exceptions = m.exceptions; saveLocal(); renderAll();
}
async function refreshCloud() {
  if (!user || !initialized) return;
  await flushQueue();
  try { await loadCloudState(); renderAll(); if (wsOpen) syncEditorFromState(); } catch (e) { console.warn('Refresco omitido:', e.message); }
}

// =====================  CALENDARIO, AGENDA Y HORARIOS  =====================
const noteHasContent = html => !!html && (html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0 || /<input/i.test(html));
const occurrencesFor = iso => C.resolveForDate(state.items, state.exceptions, iso);

function renderAll() { renderCalendar(); renderAgenda(); if (wsOpen) { renderWsHeader(); renderWsSchedule(); } }

function renderCalendar() {
  const today = C.todayISO();
  const title = new Intl.DateTimeFormat(locale(), { month:'long', year:'numeric' }).format(new Date(state.viewYear, state.viewMonth, 1));
  els.calTitle.textContent = title.charAt(0).toUpperCase() + title.slice(1);
  const sep = () => { const s = document.createElement('div'); s.className = 'cal-sep'; return s; };

  const head = [];
  DAYS.forEach((d, i) => { if (i === 5) head.push(sep()); const c = document.createElement('div'); c.className = 'cal-wd'; c.textContent = dayShort(d.id); head.push(c); });
  els.calWeekdays.replaceChildren(...head);

  const cells = [];
  C.monthGrid(state.viewYear, state.viewMonth).forEach(cell => {
    if (cell.weekday === 6) cells.push(sep());
    const note = noteHasContent(state.notes[cell.iso]?.content), draw = !!state.drawingIndex[cell.iso], sched = occurrencesFor(cell.iso).length > 0;
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.iso = cell.iso;
    b.className = `cal-cell${cell.inMonth ? '' : ' out'}${cell.iso === today ? ' today' : ''}${cell.iso === state.selectedDate ? ' selected' : ''}`;
    if (cell.iso === today) b.setAttribute('aria-current', 'date');
    const info = [note && t('cal.legendNote'), draw && t('cal.legendDraw'), sched && t('cal.legendSched')].filter(Boolean).join(', ');
    b.setAttribute('aria-label', fmtFull(cell.iso) + (info ? ` — ${info}` : ''));
    b.innerHTML = `<span class="num">${cell.day}</span><span class="dots" aria-hidden="true">${note ? '<i class="dot dot-note"></i>' : ''}${draw ? '<i class="dot dot-draw"></i>' : ''}${sched ? '<i class="dot dot-sched"></i>' : ''}</span>`;
    b.addEventListener('click', () => onCellClick(cell.iso, b));
    cells.push(b);
  });
  els.calGrid.replaceChildren(...cells);
}

function onCellClick(iso, el) {   // primer toque selecciona; segundo sobre la misma fecha abre (ratón, táctil y teclado Enter/Espacio)
  if (iso === state.selectedDate) { openWorkspace(iso, el); return; }
  state.selectedDate = iso; setViewToDate(iso); renderCalendar(); renderAgenda();
  els.calGrid.querySelector(`[data-iso="${iso}"]`)?.focus({ preventScroll:true });
}
function shiftMonth(n) {
  const m = C.addMonths(state.viewYear, state.viewMonth, n);
  state.viewYear = m.year; state.viewMonth = m.month; state.followToday = false;
  renderCalendar();
}
function goToday() {
  const today = C.todayISO(), d = C.parseISO(today);
  state.viewYear = d.getFullYear(); state.viewMonth = d.getMonth(); state.selectedDate = today; state.followToday = true;
  renderAll();
}
function setViewToDate(iso) { const d = C.parseISO(iso); state.viewYear = d.getFullYear(); state.viewMonth = d.getMonth(); }

// La fecha "de hoy" sigue al calendario real: se recalcula a medianoche local y al volver a la app.
let midnightTimer = null;
function scheduleMidnight() {
  clearTimeout(midnightTimer);
  const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  midnightTimer = setTimeout(() => { onDayRollover(); scheduleMidnight(); }, next - now);
}
let lastToday = C.todayISO();
function onDayRollover() {
  const today = C.todayISO(); if (today === lastToday) return;
  const wasSelectedToday = state.selectedDate === lastToday;
  lastToday = today;
  if (state.followToday) { setViewToDate(today); }
  if (wasSelectedToday && !wsOpen) state.selectedDate = today;
  if (user) renderAll();
}

function renderAgenda() {
  const iso = state.selectedDate, id = dayIdOf(iso);
  els.dayTitle.textContent = fmtFull(iso);
  els.daySubtitle.textContent = ['sat', 'sun'].includes(id) ? t('day.weekendSubtitle') : t('day.weekSubtitle');
  renderScheduleList(els.scheduleList, els.scheduleCount, iso);
}

function metaOf(o) { return [o.room, o.teacher].filter(Boolean).join(' · '); }
function renderScheduleList(listEl, countEl, iso) {
  const rows = occurrencesFor(iso);
  const nxt = rows.find(r => r.start_time);   // en vez de contar bloques: la próxima clase del día
  countEl.textContent = nxt ? `${t('schedule.next')}: ${nxt.start_time} · ${nxt.subject}` : ''; countEl.classList.toggle('hidden', !nxt);
  if (!rows.length) { listEl.innerHTML = `<div class="empty-state">${t('schedule.empty')}</div>`; return; }
  listEl.innerHTML = rows.map((o, i) => `
    <div class="schedule-row">
      <div class="schedule-time">${escapeHtml(C.timeRangeLabel(o.start_time, o.end_time) || t('schedule.noTime'))}</div>
      <div>
        <div class="schedule-subject">${escapeHtml(o.subject || t('schedule.noName'))}</div>
        ${metaOf(o) ? `<div class="schedule-meta">${escapeHtml(metaOf(o))}</div>` : ''}
        ${(o.kind === 'single' || o.overridden) ? `<div class="tags">${o.kind === 'single' ? `<span class="tag">${t('sch.tagSingle')}</span>` : ''}${o.overridden ? `<span class="tag">${t('sch.tagChanged')}</span>` : ''}</div>` : ''}
      </div>
      <button class="tool-btn schedule-edit-inline" data-edit="${i}" type="button">${t('schedule.editInline')}</button>
    </div>`).join('');
  listEl.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openScheduleModal(rows[Number(btn.dataset.edit)])));
}

// ---- Modal de actividad (nueva / editar) ----
let sch = null;   // { date, occ, item, kind, weekdays:Set }

function renderWeekdayChips() {
  const parts = [];
  DAYS.forEach((d, i) => {
    if (i === 5) parts.push('<span class="chip-sep" aria-hidden="true"></span>');
    parts.push(`<button type="button" class="chip" data-wd="${d.db}" aria-pressed="${sch.weekdays.has(d.db)}">${dayShort(d.id)}</button>`);
  });
  els.weekdayChips.innerHTML = parts.join('');
  els.weekdayChips.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    const n = Number(b.dataset.wd); sch.weekdays.has(n) ? sch.weekdays.delete(n) : sch.weekdays.add(n);
    b.setAttribute('aria-pressed', String(sch.weekdays.has(n)));
  }));
}
function scopeValue() { return (document.querySelector('input[name="scope"]:checked') || {}).value || 'series'; }
function setKind(kind) {
  sch.kind = kind;
  els.kindBox.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('active', b.dataset.kind === kind));
  updateScheduleFormUI();
}
function updateScheduleFormUI() {
  const editing = !!sch.item, rec = sch.kind === 'recurring';
  const scope = editing && rec ? scopeValue() : 'series';
  els.scopeBox.classList.toggle('hidden', !(editing && rec));
  els.kindBox.classList.toggle('hidden', editing);
  els.weekdaysBox.classList.toggle('hidden', !rec || scope === 'one');
  els.rangeBox.classList.toggle('hidden', !rec || scope === 'one');
  els.singleBox.classList.toggle('hidden', rec);
  els.schStartDate.disabled = editing && scope === 'following';
  if (editing && scope === 'following') els.schStartDate.value = sch.date;
  else if (editing && scope === 'series') els.schStartDate.value = sch.item.start_date || '';
}
function openScheduleModal(occ = null) {
  const date = wsOpen && currentDate ? currentDate : state.selectedDate;
  const item = occ ? state.items.find(i => i.id === occ.item_id) : null;
  if (occ && !item) return;
  sch = { date, occ, item, kind: item ? item.kind : 'recurring', weekdays: new Set(item?.weekdays?.length ? item.weekdays : [C.dbWeekday(date)]) };
  els.modalTitle.textContent = item ? t('sch.editTitle') : t('sch.newTitle');
  els.modalDateLabel.textContent = fmtLong(date).toUpperCase();
  els.schSubject.value = occ ? occ.subject : '';
  els.schMeta.value = occ ? metaOf(occ) : '';
  els.schStart.value = occ ? occ.start_time : '';
  els.schEnd.value = occ ? occ.end_time : '';
  els.schStartDate.value = item ? (item.start_date || '') : date;
  els.schEndDate.value = item ? (item.end_date || '') : '';
  els.schSingleDate.value = item && item.kind === 'single' ? item.single_date : date;
  document.querySelector('input[name="scope"][value="one"]').checked = true;
  els.schError.textContent = '';
  els.deleteScheduleBtn.classList.toggle('hidden', !item);
  renderWeekdayChips();
  setKind(sch.kind);
  els.scheduleModal.classList.remove('hidden');
  els.schSubject.focus({ preventScroll: true });
}
function closeModal() { els.scheduleModal.classList.add('hidden'); sch = null; }

function readScheduleForm() {
  const subject = els.schSubject.value.trim();
  const meta = els.schMeta.value.trim();
  const origMeta = sch.occ ? metaOf(sch.occ) : '';
  let room, teacher;
  if (sch.occ && meta === origMeta) { room = sch.occ.room; teacher = sch.occ.teacher; }
  else { const p = meta.split(' · ').map(s => s.trim()); room = p[0] || ''; teacher = p[1] || ''; }
  return { subject, room, teacher, start_time: C.normTime(els.schStart.value), end_time: C.normTime(els.schEnd.value) };
}

function queueItem(item) { const k = state.items.findIndex(i => i.id === item.id); k >= 0 ? state.items[k] = item : state.items.push(item); enqueue({ key:'item:' + item.id, type:'item', id:item.id }); }
function queueException(e) {
  const k = state.exceptions.findIndex(x => x.item_id === e.item_id && x.occurrence_date === e.occurrence_date);
  k >= 0 ? state.exceptions[k] = e : state.exceptions.push(e);
  enqueue({ key:`ex:${e.item_id}|${e.occurrence_date}`, type:'ex', item_id:e.item_id, date:e.occurrence_date });
}
function dropException(itemId, date) {
  state.exceptions = state.exceptions.filter(x => !(x.item_id === itemId && x.occurrence_date === date));
  enqueue({ key:`ex:${itemId}|${date}`, type:'ex-delete', item_id:itemId, date });
}
function deleteItem(item) {
  state.items = state.items.filter(i => i.id !== item.id);
  state.exceptions = state.exceptions.filter(e => e.item_id !== item.id);
  state.queue = state.queue.filter(q => !(q.key.startsWith('ex:' + item.id + '|')));   // las excepciones caen en cascada en la BD
  enqueue({ key:'item:' + item.id, type:'item-delete', id:item.id });
}

function saveSchedule() {
  const f = readScheduleForm(), err = k => { els.schError.textContent = t(k); };
  const item = sch.item, date = sch.date;
  const scope = item && sch.kind === 'recurring' ? scopeValue() : 'series';
  if (!f.subject) return err('sch.errSubject');
  if (f.start_time && f.end_time && f.end_time <= f.start_time) return err('sch.errTime');
  const weekdays = [...sch.weekdays].sort();
  let startDate = els.schStartDate.value || null, endDate = els.schEndDate.value || null, singleDate = els.schSingleDate.value;
  if (sch.kind === 'recurring' && scope !== 'one') {
    if (!weekdays.length) return err('sch.errDays');
    if (startDate && !C.isISO(startDate) || endDate && !C.isISO(endDate)) return err('sch.errDate');
    if (startDate && endDate && endDate < startDate) return err('sch.errRange');
  }
  if (sch.kind === 'single' && !C.isISO(singleDate)) return err('sch.errDate');

  if (!item) {
    queueItem(sch.kind === 'single'
      ? { id:uuid(), kind:'single', ...f, color:'', weekdays:[], start_date:null, end_date:null, single_date:singleDate, position:state.items.length, legacy_schedule_id:null }
      : { id:uuid(), kind:'recurring', ...f, color:'', weekdays, start_date:startDate, end_date:endDate, single_date:null, position:state.items.length, legacy_schedule_id:null });
  } else if (item.kind === 'single') {
    queueItem({ ...item, ...f, single_date:singleDate });
  } else if (scope === 'one') {
    // Solo se guardan los campos que cambian respecto a la serie; así el resto sigue heredando de ella.
    const diff = {}; let changed = false;
    ['subject', 'room', 'teacher', 'start_time', 'end_time'].forEach(k => { if ((f[k] || '') !== (item[k] || '')) { diff[k] = f[k] || null; changed = true; } });
    if (changed) queueException({ item_id:item.id, occurrence_date:date, action:'override', subject:null, room:null, teacher:null, start_time:null, end_time:null, ...diff });
    else if (state.exceptions.some(x => x.item_id === item.id && x.occurrence_date === date)) dropException(item.id, date);
  } else if (scope === 'following') {
    const split = C.splitSeries(item, date, { ...f, weekdays, end_date:endDate }, uuid());
    if (!split) queueItem({ ...item, ...f, weekdays, end_date:endDate });    // no hay historial previo: equivale a la serie completa
    else {
      queueItem(split.closed); queueItem({ ...split.fresh, position:item.position });
      // Las modificaciones puntuales de fechas futuras siguen a la nueva serie
      state.exceptions.filter(e => e.item_id === item.id && e.occurrence_date >= date).forEach(e => { dropException(item.id, e.occurrence_date); queueException({ ...e, item_id:split.fresh.id }); });
    }
  } else {
    queueItem({ ...item, ...f, weekdays, start_date:startDate, end_date:endDate });
  }
  afterScheduleChange(t('sch.saved'));
}

function deleteSchedule() {
  const item = sch.item, date = sch.date; if (!item) return;
  const scope = item.kind === 'recurring' ? scopeValue() : 'single';
  const msg = scope === 'series' ? t('sch.deleteConfirmSeries') : scope === 'following' ? t('sch.deleteConfirmFollowing') : scope === 'single' ? t('sch.deleteConfirmSingle') : null;
  if (msg && !confirm(msg)) return;
  if (scope === 'single' || scope === 'series') deleteItem(item);
  else if (scope === 'one') queueException({ item_id:item.id, occurrence_date:date, action:'skip', subject:null, room:null, teacher:null, start_time:null, end_time:null });
  else {
    if (item.start_date && date <= item.start_date) deleteItem(item);
    else {
      queueItem({ ...item, end_date:C.addDays(date, -1) });
      state.exceptions.filter(e => e.item_id === item.id && e.occurrence_date >= date).forEach(e => dropException(item.id, e.occurrence_date));
    }
  }
  afterScheduleChange(t('sch.deleted'));
}
function afterScheduleChange(msg) { closeModal(); renderAll(); showToastFn(msg); }

// =====================  ESPACIO DE TRABAJO DIARIO  =====================
function setOrigin(el) {
  const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
  const x = r && r.width ? r.left + r.width / 2 : window.innerWidth / 2, y = r && r.height ? r.top + r.height / 2 : window.innerHeight / 3;
  document.documentElement.style.setProperty('--ox', `${Math.round(x)}px`);
  document.documentElement.style.setProperty('--oy', `${Math.round(y)}px`);
}
function openWorkspace(iso, originEl) {
  if (wsOpen) return;
  setViewToDate(iso); state.selectedDate = iso;
  renderCalendar(); renderAgenda();
  setOrigin(originEl || els.calGrid.querySelector('.selected') || els.calGrid);
  wsOpen = true;
  els.workspace.inert = false; els.workspace.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ws-open');
  try { history.pushState({ noti:'ws' }, ''); wsPushed = true; } catch { wsPushed = false; }
  setMode('write');
  loadDay(iso);
  syncViewport();
  setTimeout(() => els.wsBack.focus({ preventScroll:true }), 60);
}
let closing = false;
async function closeWorkspace() {
  if (!wsOpen || closing) return;
  closing = true;
  try {
    await flushDay();
    wsOpen = false; currentDate = null;
    renderAll();                                           // actualiza los indicadores del calendario
    setOrigin(els.calGrid.querySelector('.selected'));
    document.body.classList.remove('ws-open');
    els.workspace.inert = true; els.workspace.setAttribute('aria-hidden', 'true');
    els.workspace.style.height = ''; els.workspace.style.top = '';
    els.calGrid.querySelector('.selected')?.focus({ preventScroll:true });
  } finally { closing = false; }
}
function requestCloseWorkspace() {
  if (wsPushed) { wsPushed = false; try { history.back(); return; } catch {} }
  closeWorkspace();
}
async function changeDay(delta) {
  await flushDay();
  const iso = C.addDays(currentDate, delta);
  setViewToDate(iso); loadDay(iso); renderCalendar();
}
function loadDay(iso) {
  currentDate = iso; state.selectedDate = iso;
  renderWsHeader(); renderWsSchedule(); renderAgenda();
  loadNoteIntoEditor(); renderLegacyBanner(); loadDrawing(iso); refreshStatuses();
  els.calGrid.querySelectorAll('.cal-cell').forEach(c => c.classList.toggle('selected', c.dataset.iso === iso));
}
function renderWsHeader() {
  if (!currentDate) return;
  els.wsWeekday.textContent = dayName(dayIdOf(currentDate)) + (currentDate === C.todayISO() ? ` · ${t('cal.today')}` : '');
  els.wsDate.textContent = fmtLong(currentDate);
}
function renderWsSchedule() {
  if (!currentDate) return;
  const rows = occurrencesFor(currentDate);
  els.wsSchedule.innerHTML = rows.map((o, i) => `<button class="ws-chip" type="button" data-i="${i}"><b>${escapeHtml(o.start_time || '··:··')}</b><span>${escapeHtml(o.subject || t('schedule.noName'))}</span></button>`).join('')
    + `<button class="ws-chip add" type="button" data-add="1">${t('ws.addChip')}</button>`;
  els.wsSchedule.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => openScheduleModal(rows[Number(b.dataset.i)])));
  els.wsSchedule.querySelector('[data-add]').addEventListener('click', () => openScheduleModal());
}

function syncViewport() {
  const vv = window.visualViewport;
  if (vv && wsOpen) { els.workspace.style.height = vv.height + 'px'; els.workspace.style.top = vv.offsetTop + 'px'; }
  layoutCanvas();
}
function setMode(mode) {
  els.workspace.dataset.mode = mode;
  els.modeWrite.classList.toggle('active', mode === 'write'); els.modeWrite.setAttribute('aria-pressed', String(mode === 'write'));
  els.modeDraw.classList.toggle('active', mode === 'draw'); els.modeDraw.setAttribute('aria-pressed', String(mode === 'draw'));
  els.textTools.classList.toggle('hidden', mode !== 'write');
  els.drawTools.classList.toggle('hidden', mode !== 'draw');
  els.noteRestore.classList.toggle('hidden', mode !== 'draw');
  if (mode === 'draw') { commitNoteNow(); if (document.activeElement === els.noteEditor) els.noteEditor.blur(); }
  requestAnimationFrame(layoutCanvas);
}
function renderCenterBtn() {
  const on = els.workspace.classList.contains('centered');
  els.centerNoteBtn.setAttribute('aria-pressed', String(on));
  els.centerNoteBtn.classList.toggle('active', on);
  els.centerNoteBtn.title = on ? t('ws.uncenter') : t('ws.center');
  els.centerNoteBtn.setAttribute('aria-label', els.centerNoteBtn.title);
}
function toggleCenter() { els.workspace.classList.toggle('centered'); renderCenterBtn(); }

// ---- Estado de guardado ----
let noteTimer = null;
function setStat(el, kind) {
  el.textContent = kind === 'saving' ? t('sync.saving') : kind === 'pending' ? t('sync.pending') : t('sync.synced');
  el.classList.toggle('ok', kind === 'saved'); el.classList.toggle('busy', kind === 'saving');
}
function refreshStatuses() {
  if (!currentDate) return;
  const net = navigator.onLine && state.cloudReady && !syncFailed;
  setStat(els.saveStatus, noteTimer ? 'saving' : isQueued('note:' + currentDate) ? (net ? 'saving' : 'pending') : 'saved');
  setStat(els.drawingStatus, drawing.dirty ? 'saving' : isQueued('drawing:' + currentDate) ? (net ? 'saving' : 'pending') : 'saved');
}

// ---- Notas ----
function loadNoteIntoEditor() {
  const n = state.notes[currentDate];
  els.noteEditor.innerHTML = n?.content || '';
  const font = n?.font || 'system';
  els.fontSelect.value = font; applyFont(font);
}
function syncEditorFromState() {
  if (!wsOpen || document.activeElement === els.noteEditor) return;
  const n = state.notes[currentDate], html = n?.content || '';
  if (els.noteEditor.innerHTML !== html) els.noteEditor.innerHTML = html;
  const font = n?.font || 'system'; els.fontSelect.value = font; applyFont(font);
}
const FONT_CLASSES = ['font-system','font-serif','font-mono','font-arial','font-helvetica','font-times','font-garamond','font-trebuchet','font-verdana','font-courier'];
function applyFont(font) { els.noteEditor.classList.remove(...FONT_CLASSES); els.noteEditor.classList.add(`font-${font}`); }
function fontFamilyForCommand(font) {
  return { serif:'Georgia', mono:'Consolas', arial:'Arial', helvetica:'Helvetica Neue', times:'Times New Roman', garamond:'Garamond', trebuchet:'Trebuchet MS', verdana:'Verdana', courier:'Courier New' }[font] || 'Inter';
}
function commitNote(date, content, font) {
  const prev = state.notes[date];
  state.notes[date] = { content, font };
  if (!prev && !noteHasContent(content)) { refreshStatuses(); return; }   // nota vacía y nueva: no se crea fila
  saveLocal();
  enqueue({ key:'note:' + date, type:'note', date });
}
function commitNoteNow() {
  clearTimeout(noteTimer); noteTimer = null;
  if (!currentDate) return;
  commitNote(currentDate, els.noteEditor.innerHTML, els.fontSelect.value);
  renderCalendar();
}
function scheduleNoteSave() {
  setStat(els.saveStatus, 'saving');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(commitNoteNow, 500);
}

// Selección: se recuerda para que los controles del dock no la pierdan
document.addEventListener('selectionchange', () => {
  const s = window.getSelection();
  if (s && s.rangeCount && els.noteEditor.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
});
function restoreSelection() {
  const live = window.getSelection();
  if (live && live.rangeCount && els.noteEditor.contains(live.anchorNode)) { els.noteEditor.focus({ preventScroll:true }); return; }   // la selección viva sigue siendo válida
  els.noteEditor.focus({ preventScroll:true });
  if (savedRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
}
function hasTextSelection() { const s = window.getSelection(); return s && s.rangeCount && !s.isCollapsed && els.noteEditor.contains(s.anchorNode); }

function applySelectedFont(font) {
  restoreSelection();
  if (hasTextSelection()) document.execCommand('fontName', false, font === 'system' ? 'Inter' : fontFamilyForCommand(font));
  else applyFont(font);
  commitNoteNow();
}
function applyTextSize(size) {
  restoreSelection();
  if (!hasTextSelection()) { showToastFn(t('notes.selectSize')); return; }
  document.execCommand('styleWithCSS', false, false);   // el resaltador activa el modo CSS; sin esto fontSize no generaba <font size=7>
  document.execCommand('fontSize', false, '7');
  els.noteEditor.querySelectorAll('font[size="7"], span[style*="xxx-large"]').forEach(node => {
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`; span.innerHTML = node.innerHTML; node.replaceWith(span);
  });
  commitNoteNow();
}
function applyHighlight() {
  restoreSelection();
  if (!hasTextSelection()) { showToastFn(t('notes.selectHighlight')); return; }
  document.execCommand('hiliteColor', false, '#fff1a8');
  commitNoteNow();
}
function insertChecklist() {
  restoreSelection();
  const row = document.createElement('div');
  row.className = 'check-item';
  row.innerHTML = `<input type="checkbox"><span contenteditable="true">${t('editor.task')}</span>`;
  const sel = window.getSelection();
  if (sel && sel.rangeCount && els.noteEditor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    const range = sel.getRangeAt(0); range.deleteContents(); range.insertNode(row);
    range.setStartAfter(row); range.collapse(true); sel.removeAllRanges(); sel.addRange(range);
  } else els.noteEditor.appendChild(row);
  commitNoteNow();
}

// ---- Importar datos de Noti 3.0 (notas/dibujos por día de la semana), siempre a petición ----
function renderLegacyBanner() {
  if (!currentDate) return;
  const id = dayIdOf(currentDate), box = els.legacyBanner, parts = [];
  const lNote = state.legacy.notes[id], lDraw = state.legacy.drawings[id], skip = k => `<button class="tool-btn" data-skip="${k}" type="button">${t('legacy.skip')}</button>`;
  const noteHere = noteHasContent(state.notes[currentDate]?.content) || noteHasContent(els.noteEditor.innerHTML);
  if (noteHasContent(lNote) && !noteHere && C.legacyPending(state.legacyImport, 'note', id)) parts.push(`<span>${escapeHtml(t('legacy.note', { day: dayName(id).toLowerCase() }))}</span><button class="tool-btn" data-import="note" type="button">${t('legacy.importNote')}</button>${skip('note')}`);
  if (lDraw && !state.drawingIndex[currentDate] && !drawing.hasInk && C.legacyPending(state.legacyImport, 'drawing', id)) parts.push(`<span>${escapeHtml(t('legacy.drawing', { day: dayName(id).toLowerCase() }))}</span><button class="tool-btn" data-import="drawing" type="button">${t('legacy.importDrawing')}</button>${skip('drawing')}`);
  box.classList.toggle('hidden', !parts.length);
  box.innerHTML = parts.join('');
  box.querySelectorAll('[data-import]').forEach(b => b.addEventListener('click', () => { b.disabled = true; b.dataset.import === 'note' ? importLegacyNote() : importLegacyDrawing(); }));
  box.querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => { markLegacy(b.dataset.skip, 'skipped'); renderLegacyBanner(); }));
}
function markLegacy(kind, status) {   // 'imported' | 'skipped' — se guarda en profiles.settings.legacyImport vía cola (reintenta sin duplicar)
  const id = dayIdOf(currentDate), next = C.legacyMark(state.legacyImport, kind, id, status, currentDate);
  if (next === state.legacyImport) return;
  state.legacyImport = next; saveLocal();
  enqueue({ key: 'legacy:' + C.legacyId(kind, id), type: 'legacy', id: C.legacyId(kind, id) });
}
function importLegacyNote() {
  const id = dayIdOf(currentDate), font = state.legacy.fonts[id] || 'system';
  els.noteEditor.innerHTML = state.legacy.notes[id] || '';
  els.fontSelect.value = font; applyFont(font);
  commitNoteNow(); markLegacy('note', 'imported'); renderLegacyBanner(); showToastFn(t('legacy.imported'));
}
async function importLegacyDrawing() {
  const src = state.legacy.drawings[dayIdOf(currentDate)]; if (!src) return;
  const img = await loadImage(src).catch(() => null); if (!img) return;
  const tmp = document.createElement('canvas'); tmp.width = CANVAS_W; tmp.height = CANVAS_H;
  const tc = tmp.getContext('2d'), s = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
  tc.drawImage(img, (CANVAS_W - img.width * s) / 2, (CANVAS_H - img.height * s) / 2, img.width * s, img.height * s);
  // Noti 3.0 pintaba el fondo oscuro dentro de la imagen; se vuelve transparente para que funcione en modo claro.
  const id = tc.getImageData(0, 0, CANVAS_W, CANVAS_H), px = id.data;
  for (let i = 0; i < px.length; i += 4) if (px[i] < 22 && px[i + 1] < 26 && px[i + 2] < 30) px[i + 3] = 0;
  tc.putImageData(id, 0, 0);
  const ctx = els.canvas.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H); ctx.drawImage(tmp, 0, 0);
  drawing.hasInk = true; drawing.dirty = true; saveDrawingNow(); markLegacy('drawing', 'imported'); renderLegacyBanner(); showToastFn(t('legacy.imported'));
}
const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// ---- Lienzo (superficie lógica fija 1600×1200; transparente: flota sobre el espacio de trabajo) ----
function layoutCanvas() {
  const w = els.wsStage.clientWidth, h = els.wsStage.clientHeight; if (!w || !h) return;   // clientWidth ignora el zoom de la transición
  const s = Math.min((w - 4) / CANVAS_W, (h - 4) / CANVAS_H);
  els.canvas.style.width = Math.max(80, Math.floor(CANVAS_W * s)) + 'px';
  els.canvas.style.height = Math.max(60, Math.floor(CANVAS_H * s)) + 'px';
}
async function loadDrawing(date) {
  const token = ++drawing.token;
  clearTimeout(drawing.timer); drawing.dirty = false; drawing.hasInk = false;
  const ctx = els.canvas.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  let data = getLocalDrawing(date);
  if (data === undefined && state.drawingIndex[date] && state.cloudReady && navigator.onLine) {
    els.drawingStatus.textContent = t('drawing.loading');
    try {
      const { data: row, error } = await supabaseClient.from('drawings_by_date').select('drawing_data').eq('user_id', user.id).eq('drawing_date', date).maybeSingle();
      if (error) throw error;
      data = row?.drawing_data || '';
      try { data ? localStorage.setItem(drawingKey(date), data) : null; } catch {}
      state.drawings[date] = data;
    } catch (e) { console.warn('No se pudo cargar el dibujo:', e.message); }
  }
  if (token !== drawing.token || currentDate !== date) return;
  if (data) {
    const img = await loadImage(data).catch(() => null);
    if (img && token === drawing.token) { ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H); drawing.hasInk = true; }
  }
  renderLegacyBanner(); refreshStatuses();
}
function commitDrawing(date, data) {
  const had = !!state.drawingIndex[date];
  if (!data && !had) return;
  setLocalDrawing(date, data);
  if (data) state.drawingIndex[date] = new Date().toISOString(); else delete state.drawingIndex[date];
  saveLocal();
  enqueue({ key:'drawing:' + date, type:'drawing', date });
}
function saveDrawingNow() {
  clearTimeout(drawing.timer);
  if (!drawing.dirty || !currentDate) return;
  const o = document.createElement('canvas'); o.width = EXPORT_W; o.height = EXPORT_H;
  o.getContext('2d').drawImage(els.canvas, 0, 0, EXPORT_W, EXPORT_H);
  drawing.dirty = false;
  commitDrawing(currentDate, drawing.hasInk ? o.toDataURL('image/webp', 0.8) : '');
  renderCalendar();
}
function pointerPos(ev) {
  const r = els.canvas.getBoundingClientRect();
  return { x:(ev.clientX - r.left) * CANVAS_W / r.width, y:(ev.clientY - r.top) * CANVAS_H / r.height, k:CANVAS_W / r.width };
}
function beginDraw(ev) {
  if (els.workspace.dataset.mode !== 'draw') return;
  ev.preventDefault(); els.canvas.setPointerCapture?.(ev.pointerId);
  const p = pointerPos(ev); drawing.active = true; drawing.lastX = p.x; drawing.lastY = p.y; drawTo(p.x, p.y, p.x, p.y, p.k);
}
function moveDraw(ev) { if (!drawing.active) return; ev.preventDefault(); const p = pointerPos(ev); drawTo(drawing.lastX, drawing.lastY, p.x, p.y, p.k); drawing.lastX = p.x; drawing.lastY = p.y; }
function endDraw() {
  if (!drawing.active) return;
  drawing.active = false; drawing.dirty = true; if (!drawing.erasing) drawing.hasInk = true;
  setStat(els.drawingStatus, 'saving'); clearTimeout(drawing.timer); drawing.timer = setTimeout(saveDrawingNow, 600);
}
function drawTo(x1, y1, x2, y2, k) {
  const ctx = els.canvas.getContext('2d');
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Number(els.brushSize.value) * k;
  ctx.globalCompositeOperation = drawing.erasing ? 'destination-out' : 'source-over';
  ctx.strokeStyle = els.brushColor.value;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function setEraser(next) {
  drawing.erasing = next;
  els.eraserBtn.classList.toggle('active', next);
  els.eraserBtn.textContent = next ? '✎ ' + t('drawing.pencil') : '⌫ ' + t('drawing.eraser');
  els.eraserBtn.title = next ? t('drawing.pencil') : t('drawing.eraser');
  els.eraserBtn.style.width = 'auto'; els.eraserBtn.style.padding = '0 12px';
}
function clearCanvas() {
  els.canvas.getContext('2d').clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawing.hasInk = false; drawing.dirty = true; saveDrawingNow(); renderLegacyBanner();
}
async function flushDay() {
  if (!user || !currentDate) return;
  if (noteTimer) commitNoteNow();
  if (drawing.dirty) saveDrawingNow();
}

// =====================  EVENTOS  =====================
els.loginTab.addEventListener('click', () => setAuthMode('login'));
els.signupTab.addEventListener('click', () => setAuthMode('signup'));
els.authForm.addEventListener('submit', handleAuthSubmit);
els.logoutBtn.addEventListener('click', handleLogout);
async function handleLogout() {
  if (wsOpen) { wsPushed = false; await closeWorkspace(); }
  await flushQueue();
  clearTimeout(flushTimer);
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = null;
  await supabaseClient.auth.signOut();
  user = null; initialized = false; state = newState();
  els.appScreen.classList.add('hidden'); els.authScreen.classList.remove('hidden');
  els.authForm.reset(); setAuthMode('login'); showAuthMessage(t('auth.loggedOut'));
}
els.settingsBtn.addEventListener('click', openSettings);
els.closeSettingsBtn.addEventListener('click', closeSettings);
els.closeSettingsFooterBtn.addEventListener('click', closeSettings);
els.settingsModal.addEventListener('click', ev => { if (ev.target.dataset.closeSettings) closeSettings(); });
els.languageSelect.addEventListener('change', () => changePreferences({ language: els.languageSelect.value }));
els.lightModeBtn.addEventListener('click', () => changePreferences({ theme:'light' }));
els.darkModeBtn.addEventListener('click', () => changePreferences({ theme:'dark' }));
els.grayModeBtn.addEventListener('click', () => changePreferences({ theme:'gray' }));

// Calendario
els.calPrev.addEventListener('click', () => shiftMonth(-1));
els.calNext.addEventListener('click', () => shiftMonth(1));
els.calToday.addEventListener('click', goToday);
els.editScheduleBtn.addEventListener('click', () => openScheduleModal());

// Espacio diario
els.wsBack.addEventListener('click', requestCloseWorkspace);
els.wsPrevDay.addEventListener('click', () => changeDay(-1));
els.wsNextDay.addEventListener('click', () => changeDay(1));
els.modeWrite.addEventListener('click', () => setMode('write'));
els.modeDraw.addEventListener('click', () => setMode('draw'));
els.noteRestore.addEventListener('click', () => setMode('write'));
els.centerNoteBtn.addEventListener('click', toggleCenter);
$('wsDock').addEventListener('mousedown', ev => { if (ev.target.closest('button')) ev.preventDefault(); });   // los botones no quitan el foco/selección del editor
els.noteEditor.addEventListener('input', () => { scheduleNoteSave(); if (!els.legacyBanner.classList.contains('hidden')) renderLegacyBanner(); });
els.noteEditor.addEventListener('change', ev => {       // el estado de un checkbox no se serializa en innerHTML: se refleja como atributo
  if (ev.target.type === 'checkbox') { ev.target.toggleAttribute('checked', ev.target.checked); scheduleNoteSave(); }
});
els.noteEditor.addEventListener('blur', () => { if (noteTimer) commitNoteNow(); });
document.querySelectorAll('[data-command]').forEach(btn => btn.addEventListener('click', () => { restoreSelection(); document.execCommand(btn.dataset.command, false, null); commitNoteNow(); }));
els.fontSelect.addEventListener('change', () => applySelectedFont(els.fontSelect.value));
els.fontSizeSelect.addEventListener('change', () => applyTextSize(Number(els.fontSizeSelect.value)));
els.highlightBtn.addEventListener('click', applyHighlight);
els.checklistBtn.addEventListener('click', insertChecklist);

// Lienzo
els.canvas.width = CANVAS_W; els.canvas.height = CANVAS_H; layoutCanvas();
els.canvas.addEventListener('pointerdown', beginDraw);
els.canvas.addEventListener('pointermove', moveDraw);
els.canvas.addEventListener('pointerup', endDraw);
els.canvas.addEventListener('pointercancel', endDraw);
els.brushSize.addEventListener('input', () => els.brushSizeValue.textContent = els.brushSize.value);
els.brushColor.addEventListener('input', () => { drawing.colorTouched = true; setEraser(false); });
els.eraserBtn.addEventListener('click', () => setEraser(!drawing.erasing));
els.clearCanvasBtn.addEventListener('click', () => { if (confirm(t('drawing.confirm'))) clearCanvas(); });

// Modal de actividad
els.kindBox.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => setKind(b.dataset.kind)));
document.querySelectorAll('input[name="scope"]').forEach(r => r.addEventListener('change', updateScheduleFormUI));
els.saveScheduleBtn.addEventListener('click', saveSchedule);
els.deleteScheduleBtn.addEventListener('click', deleteSchedule);
els.cancelScheduleBtn.addEventListener('click', closeModal);
els.closeModalBtn.addEventListener('click', closeModal);
els.scheduleModal.addEventListener('click', ev => { if (ev.target.dataset.closeModal) closeModal(); });

document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (!els.scheduleModal.classList.contains('hidden')) closeModal();
  else if (!els.settingsModal.classList.contains('hidden')) closeSettings();
  else if (wsOpen) requestCloseWorkspace();
});
window.addEventListener('popstate', () => { if (wsOpen) { wsPushed = false; closeWorkspace(); } });
window.addEventListener('resize', () => { if (wsOpen) syncViewport(); });
window.visualViewport?.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('scroll', syncViewport);
window.addEventListener('pagehide', () => { flushDay(); });
document.addEventListener('visibilitychange', () => {
  if (!user) return;
  if (document.hidden) flushDay(); else { onDayRollover(); refreshCloud(); }
});
window.addEventListener('online', () => { if (user) { refreshStatuses(); refreshCloud(); } });
window.addEventListener('offline', () => { if (user) { setSyncStatus(t('sync.localSaved'), 'warning'); refreshStatuses(); } });

// PWA
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; els.installBtn.style.display = 'block'; });
els.installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) { showToastFn(t('pwa.installHint')); return; }
  deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null;
});
window.addEventListener('appinstalled', () => { showToastFn(t('pwa.installed')); els.installBtn.style.display = 'none'; });
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });   // nueva versión → recarga única
  window.addEventListener('load', () => navigator.serviceWorker.register(`sw.js?v=${APP_VERSION}`, { updateViaCache:'none' }).then(reg => reg.update()).catch(() => {}));
}

async function init() {
  fillFontSizes();
  preferences = normalizePreferences({ ...DEFAULT_PREFERENCES, ...(loadLocalPreferences() || {}) });
  applyPreferences();
  setAuthMode('login');
  scheduleMidnight();
  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.user) {
    try { await bootstrapUser(data.session.user); }
    catch (error) {
      console.error(error);
      setSyncStatus(t('sync.error'), 'warning');
      showAuthMessage(t('auth.loadError'), 'error');
      els.appScreen.classList.add('hidden'); els.authScreen.classList.remove('hidden');
    }
  }
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (!session && user) {
      user = null; initialized = false;
      if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
      realtimeChannel = null;
      document.body.classList.remove('ws-open'); wsOpen = false; els.workspace.inert = true;
      els.appScreen.classList.add('hidden'); els.authScreen.classList.remove('hidden'); setAuthMode('login');
    }
  });
}
init();
