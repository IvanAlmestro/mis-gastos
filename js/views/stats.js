/* =========================================================================
   stats.js · Vista "Estadísticas": gráfico + tarjetas de diagnóstico
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var Store = App.Store;
  var $ = Utils.$;

  function emptyBox(message) {
    return '<p class="empty-state">' + Utils.escapeHtml(message) + '</p>';
  }

  /* --- Gráfico ----------------------------------------------------------- */

  function renderChart(totals) {
    var canvas = $('chart-categories');
    var empty = $('chart-empty');

    if (!App.Charts.isReady()) {
      App.Charts.destroy();
      canvas.style.display = 'none';
      empty.style.display = 'grid';
      empty.innerHTML = '<p class="text-sm text-slate-400 dark:text-slate-500">No se pudo cargar Chart.js. Revisá tu conexión a internet.</p>';
      return;
    }

    if (!totals.length) {
      App.Charts.destroy();
      canvas.style.display = 'none';
      empty.style.display = 'grid';
      empty.innerHTML = '<div><p class="text-3xl">🫙</p>' +
        '<p class="mt-2 text-sm font-medium text-slate-400 dark:text-slate-500">Todavía no hay gastos en este mes.</p></div>';
      return;
    }

    canvas.style.display = 'block';
    empty.style.display = 'none';

    var items = totals.map(function (t) {
      return { label: t.category.name, value: t.total, color: t.category.color };
    });
    App.Charts.render(canvas, items, App.ui.chartType);
  }

  /* --- Desglose numérico ------------------------------------------------- */

  function renderBreakdown(totals, totalSpent) {
    var list = $('category-breakdown');

    if (!totals.length) {
      list.innerHTML = '<li>' + emptyBox('Sin datos para mostrar.') + '</li>';
      return;
    }

    list.innerHTML = totals.map(function (t) {
      var pct = totalSpent ? (t.total / totalSpent * 100) : 0;
      return '<li>' +
        '<div class="flex items-center gap-2">' +
          '<span class="row-icon" style="height:1.75rem;width:1.75rem;font-size:.85rem;background:' +
            t.category.color + '1f;color:' + t.category.color + '">' + Utils.escapeHtml(t.category.icon) + '</span>' +
          '<span class="flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">' +
            Utils.escapeHtml(t.category.name) + '</span>' +
          '<span class="text-sm font-bold text-slate-800 dark:text-slate-100">' + Utils.money(t.total) + '</span>' +
        '</div>' +
        '<div class="mt-1.5 flex items-center gap-2 pl-9">' +
          '<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">' +
            '<div class="h-full rounded-full" style="width:' + Utils.clamp(pct, 0, 100) + '%;background:' +
              t.category.color + '"></div>' +
          '</div>' +
          '<span class="w-14 text-right text-xs font-semibold text-slate-400 dark:text-slate-500">' + pct.toFixed(1) + '%</span>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  /* --- Tarjetas de diagnóstico ------------------------------------------- */

  /** Top 3 de gastos individuales más grandes del mes. */
  function renderTopExpenses(month) {
    var container = $('diag-top');
    var top = Store.expensesInMonth(month).slice().sort(function (a, b) {
      return b.amount - a.amount;
    }).slice(0, 3);

    if (!top.length) {
      container.innerHTML = emptyBox('Sin gastos este mes.');
      return;
    }

    container.innerHTML = top.map(function (expense, index) {
      var cat = Store.categoryById(expense.categoryId);
      return '<li class="flex items-center gap-3">' +
        '<span class="grid h-6 w-6 flex-none place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">' +
          (index + 1) + '</span>' +
        '<div class="min-w-0 flex-1">' +
          '<p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">' +
            Utils.escapeHtml(expense.description) + '</p>' +
          '<p class="truncate text-xs text-slate-400 dark:text-slate-500">' + Utils.escapeHtml(cat.icon + ' ' + cat.name) +
            ' · ' + Utils.formatDateShort(expense.date) + '</p>' +
        '</div>' +
        '<span class="row-amount text-sm">' + Utils.money(expense.amount) + '</span>' +
      '</li>';
    }).join('');
  }

  /** Categoría con mayor cantidad de transacciones (gastos hormiga). */
  function renderFrequent(totals) {
    var container = $('diag-frequent');

    if (!totals.length) {
      container.innerHTML = emptyBox('Sin datos este mes.');
      return;
    }

    var top = totals.slice().sort(function (a, b) { return b.count - a.count; })[0];

    container.innerHTML =
      '<div class="flex items-center gap-3">' +
        '<span class="row-icon" style="height:3rem;width:3rem;font-size:1.4rem;background:' +
          top.category.color + '1f">' + Utils.escapeHtml(top.category.icon) + '</span>' +
        '<div>' +
          '<p class="text-sm font-bold text-slate-800 dark:text-slate-100">' + Utils.escapeHtml(top.category.name) + '</p>' +
          '<p class="text-xs text-slate-400 dark:text-slate-500">' + top.count +
            (top.count === 1 ? ' transacción' : ' transacciones') + ' · promedio ' +
            Utils.money(top.average) + '</p>' +
        '</div>' +
      '</div>' +
      '<p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">' +
        'Muchas compras pequeñas suman ' + Utils.money(top.total) +
        '. Revisá si podés recortar acá.</p>';
  }

  /** Categoría que consume el mayor porcentaje del presupuesto. */
  function renderImpact(month, totals) {
    var container = $('diag-impact');

    if (!totals.length) {
      container.innerHTML = emptyBox('Sin datos este mes.');
      return;
    }

    var top = totals[0];
    var budget = Store.budgetInMonth(month);
    var spent = Store.spentInMonth(month);
    var base = budget > 0 ? budget : spent;
    var pct = base > 0 ? (top.total / base * 100) : 0;
    var baseLabel = budget > 0 ? 'del presupuesto del mes' : 'del gasto total del mes';

    container.innerHTML =
      '<div class="flex items-center gap-3">' +
        '<span class="row-icon" style="height:3rem;width:3rem;font-size:1.4rem;background:' +
          top.category.color + '1f">' + Utils.escapeHtml(top.category.icon) + '</span>' +
        '<div>' +
          '<p class="text-sm font-bold text-slate-800 dark:text-slate-100">' + Utils.escapeHtml(top.category.name) + '</p>' +
          '<p class="text-xs text-slate-400 dark:text-slate-500">' + Utils.money(top.total) + ' · ' + pct.toFixed(1) + '% ' + baseLabel + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">' +
        '<div class="h-full rounded-full" style="width:' + Utils.clamp(pct, 0, 100) + '%;background:' +
          top.category.color + '"></div>' +
      '</div>' +
      '<p class="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">' +
        'Concentra la mayor parte de tu dinero: es la categoría con más margen de mejora.</p>';
  }

  /* --- Render ------------------------------------------------------------ */

  function render() {
    var month = App.ui.month;
    var totals = Store.categoryTotalsInMonth(month);
    var spent = Store.spentInMonth(month);

    renderChart(totals);
    renderBreakdown(totals, spent);
    renderTopExpenses(month);
    renderFrequent(totals);
    renderImpact(month, totals);
  }

  function bind() {
    $('btn-chart-doughnut').addEventListener('click', function () {
      App.ui.chartType = 'doughnut';
      $('btn-chart-doughnut').setAttribute('aria-pressed', 'true');
      $('btn-chart-bar').setAttribute('aria-pressed', 'false');
      render();
    });
    $('btn-chart-bar').addEventListener('click', function () {
      App.ui.chartType = 'bar';
      $('btn-chart-doughnut').setAttribute('aria-pressed', 'false');
      $('btn-chart-bar').setAttribute('aria-pressed', 'true');
      render();
    });
  }

  App.Stats = {
    init: bind,
    render: render
  };
})(window.App);
