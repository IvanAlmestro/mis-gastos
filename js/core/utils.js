/* =========================================================================
   utils.js · Funciones auxiliares puras (sin estado)
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var LOCALE = 'es-AR';
  var CURRENCY = 'ARS';

  var MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  /** Genera un identificador único y corto, ej: "exp_lz3k1a9f". */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /** Date -> "YYYY-MM-DD" (formato de los <input type="date">). */
  function toISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /** Fecha de hoy en formato ISO (zona horaria local, sin desfase UTC). */
  function todayISO() { return toISO(new Date()); }

  /** "YYYY-MM-DD" -> "YYYY-MM" (clave de mes). */
  function monthKeyOf(iso) { return String(iso || '').slice(0, 7); }

  /** Clave del mes actual, ej: "2026-11". */
  function currentMonthKey() { return todayISO().slice(0, 7); }

  /** "2026-11" -> "noviembre 2026". */
  function monthLabel(key) {
    if (!key) return '';
    var parts = key.split('-');
    var month = parseInt(parts[1], 10) - 1;
    return (MONTH_NAMES[month] || '') + ' ' + parts[0];
  }

  /** "2026-11-16" -> "16/11/2026". */
  function formatDate(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /** Fecha compacta y amable, ej: "16 nov". */
  function formatDateShort(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    var month = MONTH_NAMES[parseInt(p[1], 10) - 1] || '';
    return parseInt(p[2], 10) + ' ' + month.slice(0, 3);
  }

  /** Días desde hoy hasta la fecha indicada (negativo = ya pasó). */
  function daysUntil(iso) {
    if (!iso) return NaN;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var target = new Date(iso + 'T00:00:00');
    return Math.round((target - today) / 86400000);
  }

  /** Formatea un número como moneda, ej: "$ 12.500,50". */
  function money(value) {
    var n = Number(value) || 0;
    try {
      return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: CURRENCY,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(n);
    } catch (e) {
      return '$ ' + n.toFixed(2);
    }
  }

  /** Redondea a 2 decimales evitando errores de coma flotante. */
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  /** Suma un array usando un extractor opcional. */
  function sum(list, getValue) {
    return (list || []).reduce(function (acc, item) {
      return acc + (Number(getValue ? getValue(item) : item) || 0);
    }, 0);
  }

  /** Agrupa un array en un objeto { clave: [items] }. */
  function groupBy(list, getKey) {
    return (list || []).reduce(function (acc, item) {
      var key = getKey(item);
      (acc[key] = acc[key] || []).push(item);
      return acc;
    }, {});
  }

  /** Escapa texto para inyectarlo de forma segura como HTML. */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Limita un valor entre un mínimo y un máximo. */
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

  /** Retrasa la ejecución hasta que pasen `wait` ms sin nuevas llamadas. */
  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 200);
    };
  }

  /** Devuelve el mes anterior/siguiente a una clave "YYYY-MM". */
  function shiftMonthKey(key, delta) {
    var parts = key.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1 + delta, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  /** Descarga un texto como archivo (usado para el backup JSON). */
  function downloadFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** Atajo para document.getElementById. */
  function $(id) { return document.getElementById(id); }

  App.Utils = {
    uid: uid,
    toISO: toISO,
    todayISO: todayISO,
    monthKeyOf: monthKeyOf,
    currentMonthKey: currentMonthKey,
    monthLabel: monthLabel,
    shiftMonthKey: shiftMonthKey,
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    daysUntil: daysUntil,
    money: money,
    round2: round2,
    sum: sum,
    groupBy: groupBy,
    escapeHtml: escapeHtml,
    clamp: clamp,
    debounce: debounce,
    downloadFile: downloadFile,
    $: $,
    MONTH_NAMES: MONTH_NAMES
  };
})(window.App);
