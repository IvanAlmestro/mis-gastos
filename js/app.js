/* =========================================================================
   app.js · Arranque, navegación entre vistas y acciones globales
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var Store = App.Store;
  var UI = App.UI;
  var $ = Utils.$;

  var VIEWS = ['resumen', 'gastos', 'estadisticas', 'vencimientos'];

  /** Estado de interfaz (no se persiste: es solo de sesión). */
  var ui = {
    view: 'resumen',
    month: Utils.currentMonthKey(),
    search: '',
    category: 'all',
    chartType: 'doughnut',
    showPaidBills: true,
    theme: 'light' // lo actualiza App.Theme al arrancar
  };
  App.ui = ui;

  /* --- Cabecera: mes activo + alertas de vencimientos -------------------- */
  function renderHeader() {
    var label = Utils.monthLabel(ui.month);

    // Actualiza todas las etiquetas de mes repartidas por la interfaz.
    document.querySelectorAll('[data-month-label]').forEach(function (el) {
      el.textContent = label;
    });
    $('header-month-chip').textContent = label;

    // Badge de vencimientos que requieren atención (vencidos o por vencer).
    var attention = Store.bills().filter(function (bill) {
      if (bill.status === 'pagado') return false;
      return Utils.daysUntil(bill.dueDate) <= 5;
    }).length;

    var badge = $('bills-badge');
    if (attention > 0) {
      badge.textContent = attention;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /* --- Navegación -------------------------------------------------------- */
  function renderView() {
    VIEWS.forEach(function (view) {
      $('view-' + view).classList.toggle('hidden', view !== ui.view);
    });

    if (ui.view === 'resumen') App.Budget.render();
    else if (ui.view === 'gastos') App.Expenses.render();
    else if (ui.view === 'estadisticas') App.Stats.render();
    else if (ui.view === 'vencimientos') App.Bills.render();
  }

  function setView(view) {
    if (VIEWS.indexOf(view) < 0) return;
    ui.view = view;

    document.querySelectorAll('#tabs .tab').forEach(function (btn) {
      btn.setAttribute('aria-selected', String(btn.getAttribute('data-view') === view));
    });
    renderView();
  }

  function setMonth(monthKey) {
    ui.month = monthKey || Utils.currentMonthKey();
    $('month-picker').value = ui.month;
    renderHeader();
    renderView();
  }

  App.setView = setView;
  App.setMonth = setMonth;
  App.renderView = renderView;
  App.renderHeader = renderHeader;

  /* --- Eventos globales -------------------------------------------------- */
  function bind() {
    // Pestañas
    $('tabs').addEventListener('click', function (ev) {
      var tab = ev.target.closest('.tab');
      if (tab) setView(tab.getAttribute('data-view'));
    });

    // Navegación de meses
    $('month-prev').addEventListener('click', function () {
      setMonth(Utils.shiftMonthKey(ui.month, -1));
    });
    $('month-next').addEventListener('click', function () {
      setMonth(Utils.shiftMonthKey(ui.month, 1));
    });
    $('btn-today').addEventListener('click', function () {
      setMonth(Utils.currentMonthKey());
    });
    $('month-picker').addEventListener('change', function (ev) {
      setMonth(ev.target.value || Utils.currentMonthKey());
    });

    // Exportar backup
    $('btn-export').addEventListener('click', function () {
      Utils.downloadFile('backup-gastos-' + Utils.todayISO() + '.json', Store.exportJSON());
      UI.toast('Backup descargado.', 'success');
    });

    // Importar backup
    $('btn-import').addEventListener('click', function () {
      $('file-import').click();
    });
    $('file-import').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        UI.confirm({
          title: '¿Restaurar este backup?',
          message: 'Se reemplazarán todos los datos actuales por los del archivo seleccionado.',
          confirmLabel: 'Restaurar',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          var success = Store.importJSON(reader.result);
          UI.toast(success ? 'Backup restaurado correctamente.' : 'El archivo no es un backup válido.',
            success ? 'success' : 'error');
        });
      };
      reader.readAsText(file);
      ev.target.value = ''; // permite volver a elegir el mismo archivo
    });

    // Atajos de teclado: 1-4 cambian de vista y "D" alterna el tema.
    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.target && ev.target.matches && ev.target.matches('input, select, textarea')) return;

      if (ev.key === 'd' || ev.key === 'D') { App.Theme.toggle(); return; }

      var index = ['1', '2', '3', '4'].indexOf(ev.key);
      if (index >= 0) setView(VIEWS[index]);
    });

    // Cualquier cambio en el store re-renderiza la cabecera y la vista activa.
    Store.subscribe(function () {
      renderHeader();
      renderView();
    });
  }

  /* --- Arranque ---------------------------------------------------------- */
  function init() {
    Store.init();          // carga datos de localStorage
    App.Theme.init();      // aplica el tema claro/oscuro guardado
    App.Sync.init();       // sincronización opcional con Firebase (si está configurada)

    App.Budget.init();
    App.Expenses.init();
    App.Stats.init();
    App.Bills.init();

    bind();

    setMonth(Utils.currentMonthKey());
    setView('resumen');
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.App);
