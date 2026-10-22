/* Noti core: lógica pura (fechas locales, calendario, recurrencia). Sin DOM ni red. */
(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');

  // Todas las fechas son 'YYYY-MM-DD' en HORA LOCAL (nunca toISOString, que usa UTC).
  function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parseISO(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); }
  function isISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && toISO(parseISO(s)) === s; }
  function todayISO(now) { return toISO(now || new Date()); }
  function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
  function addMonths(year, month, n) { const d = new Date(year, month + n, 1); return { year: d.getFullYear(), month: d.getMonth() }; }
  // 1 = lunes … 7 = domingo (igual que day_of_week en Supabase)
  function dbWeekday(iso) { const g = parseISO(iso).getDay(); return g === 0 ? 7 : g; }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  // Cuadrícula de 6 filas × 7 columnas (lunes primero). Altura estable entre meses.
  function monthGrid(year, month) {
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(year, month, 1 - offset + i);
      cells.push({ iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === month, weekday: ((d.getDay() + 6) % 7) + 1 });
    }
    return cells;
  }

  // ---- Horas ----
  function normTime(v) { // '8:5', '08:00:00' → '08:00'; inválido → ''
    const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) return '';
    const h = Number(m[1]), mi = Number(m[2]);
    return h > 23 || mi > 59 ? '' : `${pad(h)}:${pad(mi)}`;
  }
  function parseLegacyTime(text) { // '08:00 - 10:00'
    const p = String(text || '').split('-').map(s => s.trim());
    return { start: normTime(p[0]), end: normTime(p[1]) };
  }
  function timeRangeLabel(start, end) { return start && end ? `${start} - ${end}` : (start || ''); }

  // ---- Recurrencia ----
  // item: { id, kind:'recurring'|'single', weekdays:[1..7], start_date, end_date, single_date, subject, room, teacher, start_time, end_time, position }
  // exception: { item_id, occurrence_date, action:'skip'|'override', subject?, room?, teacher?, start_time?, end_time? }
  function occursOn(item, iso) {
    if (item.kind === 'single') return item.single_date === iso;
    if (item.start_date && iso < item.start_date) return false;
    if (item.end_date && iso > item.end_date) return false;
    return (item.weekdays || []).includes(dbWeekday(iso));
  }
  function resolveForDate(items, exceptions, iso) {
    const ex = new Map();
    (exceptions || []).forEach(e => ex.set(`${e.item_id}|${e.occurrence_date}`, e));
    const out = [];
    for (const item of items || []) {
      if (!occursOn(item, iso)) continue;
      const e = ex.get(`${item.id}|${iso}`);
      if (e && e.action === 'skip') continue;
      const o = { item_id: item.id, date: iso, kind: item.kind, overridden: false,
        subject: item.subject || '', room: item.room || '', teacher: item.teacher || '',
        start_time: item.start_time || '', end_time: item.end_time || '', color: item.color || '', position: item.position || 0 };
      if (e && e.action === 'override') {
        o.overridden = true;
        ['subject', 'room', 'teacher', 'start_time', 'end_time'].forEach(k => { if (e[k] !== undefined && e[k] !== null) o[k] = e[k]; });
      }
      out.push(o);
    }
    out.sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99') || a.position - b.position || a.subject.localeCompare(b.subject));
    return out;
  }

  // Dividir una serie en `iso`: la serie original termina el día anterior; la nueva empieza en `iso`.
  // Devuelve null si no hay historial previo que conservar (iso <= start_date): conviene editar la serie completa.
  function splitSeries(item, iso, changes, newId) {
    if (item.kind !== 'recurring') return null;
    if (item.start_date && iso <= item.start_date) return null;
    const closed = { ...item, end_date: addDays(iso, -1) };
    const fresh = { ...item, ...changes, id: newId, kind: 'recurring', start_date: iso, end_date: changes.end_date !== undefined ? changes.end_date : item.end_date, legacy_schedule_id: null };
    return { closed, fresh };
  }

  const api = { pad, toISO, parseISO, isISO, todayISO, addDays, addMonths, dbWeekday, isLeap, daysInMonth, monthGrid,
    normTime, parseLegacyTime, timeRangeLabel, occursOn, resolveForDate, splitSeries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NotiCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
