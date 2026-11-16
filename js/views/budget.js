/* =========================================================================
   budget.js · Vista "Resumen": balance del mes + gestión de ingresos
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var Store = App.Store;
  var UI = App.UI;
  var $ = Utils.$;

  var editingId = null; // id del ingreso en edición (null = modo "nuevo")

  /* --- Tarjetas de balance ----------------------------------------------- */

  /** Devuelve el color de la barra según cuánto presupuesto se consumió. */
  function progressColor(pct) {
    if (pct <= 60) return '#10b981';   // verde  · vas bien
    if (pct <= 85) return '#f59e0b';   // ámbar  · atención
    if (pct <= 100) return '#f97316';  // naranja · queda poco
    return '#e11d48';                  // rojo   · te pasaste
  }

  function renderBalance(month) {
    var available = Store.availableTotal();
    var spent = Store.spentInMonth(month);
    var budget = Store.budgetInMonth(month);
    var remaining = Utils.round2(budget - spent);
    var count = Store.expensesInMonth(month).length;

    $('stat-available').textContent = Utils.money(available);
    $('stat-available').classList.toggle('value-negative', available < 0);

    $('stat-spent').textContent = Utils.money(spent);
    $('stat-spent-count').textContent = count === 1
      ? '1 movimiento registrado'
      : count + ' movimientos registrados';

    $('stat-remaining').textContent = Utils.money(remaining);
    $('stat-remaining').classList.toggle('value-negative', remaining < 0);

    var progress = $('stat-progress');
    var pctLabel = $('stat-progress-pct');
    var hint = $('stat-progress-hint');
    hint.classList.remove('hint-danger', 'hint-warn');

    if (budget <= 0) {
      progress.style.width = '0%';
      progress.style.backgroundColor = '';
      pctLabel.textContent = '—';
      hint.textContent = 'Sin presupuesto registrado para este mes. Cargá tu ingreso mensual.';
      return;
    }

    var pct = (spent / budget) * 100;
    progress.style.width = Utils.clamp(pct, 0, 100) + '%';
    progress.style.backgroundColor = progressColor(pct);
    pctLabel.textContent = Math.round(pct) + '%';

    if (remaining < 0) {
      hint.textContent = 'Te pasaste del presupuesto por ' + Utils.money(Math.abs(remaining)) + '.';
      hint.classList.add('hint-danger');
    } else if (pct <= 85) {
      hint.textContent = 'Te quedan ' + Utils.money(remaining) + ' de ' + Utils.money(budget) + '.';
    } else {
      hint.textContent = 'Ojo: te quedan solo ' + Utils.money(remaining) + ' para lo que resta del mes.';
      hint.classList.add('hint-warn');
    }
  }

  /* --- Listado de ingresos ----------------------------------------------- */

  function emptyState(message) {
    return '<li class="empty-state">' + Utils.escapeHtml(message) + '</li>';
  }

  function renderIncomeList(month) {
    var list = $('income-list');
    var incomes = Store.incomesInMonth(month).slice().sort(function (a, b) {
      return a.date < b.date ? 1 : -1; // más recientes primero
    });

    $('incomes-total').textContent = Utils.money(Store.budgetInMonth(month));

    if (!incomes.length) {
      list.innerHTML = emptyState('Todavía no registraste ingresos en este mes.');
      return;
    }

    list.innerHTML = incomes.map(function (income) {
      return '' +
        '<li class="row" data-id="' + Utils.escapeHtml(income.id) + '">' +
          '<span class="row-icon bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">💰</span>' +
          '<div class="min-w-0 flex-1">' +
            '<p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">' + Utils.escapeHtml(income.concept) + '</p>' +
            '<p class="truncate text-xs text-slate-400 dark:text-slate-500">' + Utils.formatDate(income.date) +
              (income.note ? ' · ' + Utils.escapeHtml(income.note) : '') + '</p>' +
          '</div>' +
          '<span class="row-amount text-emerald-600 dark:text-emerald-400">+ ' + Utils.money(income.amount) + '</span>' +
          '<div class="flex gap-1">' +
            '<button type="button" class="icon-btn" data-action="edit" title="Editar" aria-label="Editar">✎</button>' +
            '<button type="button" class="icon-btn danger" data-action="delete" title="Eliminar" aria-label="Eliminar">🗑</button>' +
          '</div>' +
        '</li>';
    }).join('');
  }

  /* --- Formulario -------------------------------------------------------- */

  function resetForm() {
    editingId = null;
    $('income-form').reset();
    $('income-date').value = Utils.todayISO();
    $('income-form-title').textContent = 'Registrar ingreso';
    $('income-submit').textContent = '＋ Agregar ingreso';
    $('income-cancel-edit').classList.add('hidden');
  }

  function startEdit(id) {
    var income = Store.incomes().filter(function (i) { return i.id === id; })[0];
    if (!income) return;

    editingId = id;
    $('income-concept').value = income.concept;
    $('income-amount').value = income.amount;
    $('income-date').value = income.date;
    $('income-note').value = income.note || '';
    $('income-form-title').textContent = 'Editar ingreso';
    $('income-submit').textContent = '✓ Guardar cambios';
    $('income-cancel-edit').classList.remove('hidden');
    $('income-concept').focus();
  }

  function bind() {
    $('income-form').addEventListener('submit', function (ev) {
      ev.preventDefault();

      var amount = parseFloat($('income-amount').value);
      if (!(amount > 0)) { UI.toast('Ingresá un monto mayor a 0.', 'error'); return; }

      var data = {
        concept: $('income-concept').value.trim() || 'Ingreso',
        amount: amount,
        date: $('income-date').value || Utils.todayISO(),
        note: $('income-note').value.trim()
      };

      if (editingId) {
        Store.updateIncome(editingId, data);
        UI.toast('Ingreso actualizado.', 'success');
      } else {
        Store.addIncome(data);
        UI.toast('Ingreso registrado.', 'success');
      }
      resetForm();
    });

    $('income-cancel-edit').addEventListener('click', resetForm);

    // Delegación de eventos para editar/eliminar dentro de la lista.
    $('income-list').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var id = btn.closest('[data-id]').getAttribute('data-id');

      if (btn.getAttribute('data-action') === 'edit') {
        startEdit(id);
      } else {
        UI.confirm({
          title: '¿Eliminar este ingreso?',
          message: 'Esta acción no se puede deshacer.',
          confirmLabel: 'Eliminar',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          if (editingId === id) resetForm();
          Store.removeIncome(id);
          UI.toast('Ingreso eliminado.', 'info');
        });
      }
    });
  }

  function render() {
    var month = App.ui.month;
    renderBalance(month);
    renderIncomeList(month);
  }

  App.Budget = {
    init: function () {
      $('income-date').value = Utils.todayISO();
      bind();
    },
    render: render,
    resetForm: resetForm
  };
})(window.App);
