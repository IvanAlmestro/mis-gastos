/* =========================================================================
   expenses.js · Vista "Gastos": anotador rápido + historial
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var Store = App.Store;
  var UI = App.UI;
  var $ = Utils.$;

  var editingId = null; // id del gasto en edición

  /* --- Selects y chips de categorías ------------------------------------- */

  /** Rellena el <select> de categorías conservando la selección previa. */
  function fillCategorySelect(select, keepValue) {
    var previous = keepValue || select.value || 'otros';
    select.innerHTML = Store.categories().map(function (cat) {
      return '<option value="' + Utils.escapeHtml(cat.id) + '">' +
        Utils.escapeHtml(cat.icon + '  ' + cat.name) + '</option>';
    }).join('');
    // Restaura la selección si la categoría todavía existe.
    var exists = Store.categories().some(function (c) { return c.id === previous; });
    select.value = exists ? previous : 'otros';
  }

  function fillMethodSelect(select) {
    var previous = select.value;
    select.innerHTML = Store.paymentMethods().map(function (method) {
      return '<option value="' + Utils.escapeHtml(method) + '">' + Utils.escapeHtml(method) + '</option>';
    }).join('');
    if (Store.paymentMethods().indexOf(previous) >= 0) select.value = previous;
  }

  /** Dibuja los chips de categoría (selección rápida + gestión). */
  function renderCategoryChips() {
    var container = $('category-chips');
    var current = $('expense-category').value;

    var chips = Store.categories().map(function (cat) {
      var active = cat.id === current;
      var style = active
        ? 'background:' + cat.color + ';color:#fff'
        : 'background:' + cat.color + '1f;color:' + cat.color;
      var remove = cat.custom
        ? '<span class="chip-remove" data-remove="' + Utils.escapeHtml(cat.id) + '" title="Eliminar categoría">✕</span>'
        : '';
      return '<button type="button" class="chip" data-cat="' + Utils.escapeHtml(cat.id) + '"' +
        ' aria-pressed="' + active + '" style="' + style + '">' +
        '<span>' + Utils.escapeHtml(cat.icon) + '</span>' + Utils.escapeHtml(cat.name) + remove +
        '</button>';
    }).join('');

    var newChip = '<button type="button" class="chip chip-add" data-new-category>＋ Nueva categoría</button>';

    container.innerHTML = chips + newChip;
  }

  /* --- Historial --------------------------------------------------------- */

  /** Aplica buscador + filtro de categoría sobre los gastos del mes. */
  function filteredExpenses(month) {
    var search = (App.ui.search || '').toLowerCase().trim();
    var categoryFilter = App.ui.category || 'all';

    return Store.expensesInMonth(month).filter(function (e) {
      if (categoryFilter !== 'all' && e.categoryId !== categoryFilter) return false;
      if (!search) return true;
      var cat = Store.categoryById(e.categoryId);
      var haystack = (e.description + ' ' + cat.name + ' ' + e.method + ' ' + e.date).toLowerCase();
      return haystack.indexOf(search) >= 0;
    }).sort(function (a, b) {
      if (a.date === b.date) return 0;
      return a.date < b.date ? 1 : -1; // más recientes primero
    });
  }

  function renderList() {
    var month = App.ui.month;
    var list = $('expense-list');
    var items = filteredExpenses(month);
    var totalMonth = Store.spentInMonth(month);

    $('expense-count').textContent = items.length === 1
      ? '1 movimiento · ' + Utils.money(Utils.sum(items, function (e) { return e.amount; }))
      : items.length + ' movimientos · ' + Utils.money(Utils.sum(items, function (e) { return e.amount; }));

    if (!items.length) {
      list.innerHTML = '<li class="empty-state">' +
        (Store.expensesInMonth(month).length
          ? 'Ningún gasto coincide con el filtro.'
          : 'Sin gastos en este mes. ¡Anotá el primero arriba!') +
        '</li>';
      return;
    }

    list.innerHTML = items.map(function (expense) {
      var cat = Store.categoryById(expense.categoryId);
      return '' +
        '<li class="row" data-id="' + Utils.escapeHtml(expense.id) + '">' +
          '<span class="row-icon" style="background:' + cat.color + '1f;color:' + cat.color + '">' +
            Utils.escapeHtml(cat.icon) + '</span>' +
          '<div class="min-w-0 flex-1">' +
            '<p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">' +
              Utils.escapeHtml(expense.description) + '</p>' +
            '<p class="truncate text-xs text-slate-400 dark:text-slate-500">' + Utils.formatDate(expense.date) + ' · ' +
              Utils.escapeHtml(cat.name) + ' · ' + Utils.escapeHtml(expense.method) + '</p>' +
          '</div>' +
          '<span class="row-amount text-rose-600 dark:text-rose-400">− ' + Utils.money(expense.amount) + '</span>' +
          '<div class="flex gap-1">' +
            '<button type="button" class="icon-btn" data-action="edit" title="Editar" aria-label="Editar">✎</button>' +
            '<button type="button" class="icon-btn danger" data-action="delete" title="Eliminar" aria-label="Eliminar">🗑</button>' +
          '</div>' +
        '</li>';
    }).join('');
  }

  function renderFilters() {
    var select = $('filter-category');
    var previous = App.ui.category || 'all';
    select.innerHTML = '<option value="all">Todas las categorías</option>' +
      Store.categories().map(function (cat) {
        return '<option value="' + Utils.escapeHtml(cat.id) + '">' +
          Utils.escapeHtml(cat.icon + '  ' + cat.name) + '</option>';
      }).join('');
    select.value = previous;
  }

  /* --- Formulario -------------------------------------------------------- */

  function resetForm() {
    editingId = null;
    $('expense-form').reset();
    $('expense-date').value = Utils.todayISO();
    $('expense-form-title').textContent = 'Anotar gasto rápido';
    $('expense-submit').textContent = '＋ Agregar gasto';
    $('expense-cancel-edit').classList.add('hidden');
    renderCategoryChips();
  }

  function startEdit(id) {
    var expense = Store.expenses().filter(function (e) { return e.id === id; })[0];
    if (!expense) return;

    editingId = id;
    $('expense-description').value = expense.description;
    $('expense-amount').value = expense.amount;
    $('expense-date').value = expense.date;
    $('expense-category').value = expense.categoryId;
    $('expense-method').value = expense.method;
    $('expense-form-title').textContent = 'Editar gasto';
    $('expense-submit').textContent = '✓ Guardar cambios';
    $('expense-cancel-edit').classList.remove('hidden');
    renderCategoryChips();
    $('expense-description').focus();
  }

  /* --- Creación de categorías propias ------------------------------------ */

  var CATEGORY_PRESET_COLORS = [
    '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f97316',
    '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#64748b', '#78350f'
  ];

  function createCategory() {
    UI.form({
      title: 'Nueva categoría',
      message: 'Creá una categoría propia con su ícono y color.',
      submitLabel: 'Crear categoría',
      fields: [
        { name: 'name', label: 'Nombre', placeholder: 'Ej: Mascotas', required: true },
        { name: 'icon', label: 'Ícono (emoji)', value: '🏷️', placeholder: '🏷️' },
        { name: 'color', label: 'Color', type: 'color', value: CATEGORY_PRESET_COLORS[0] }
      ]
    }).then(function (values) {
      if (!values) return;
      if (!values.name.trim()) { UI.toast('La categoría necesita un nombre.', 'error'); return; }

      var cat = Store.addCategory({
        name: values.name.trim(),
        icon: values.icon.trim() || '🏷️',
        color: values.color
      });
      // Deja la nueva categoría seleccionada en el formulario de gastos.
      fillCategorySelect($('expense-category'), cat.id);
      renderCategoryChips();
      UI.toast('Categoría "' + cat.name + '" creada.', 'success');
    });
  }

  /* --- Eventos ----------------------------------------------------------- */

  function bind() {
    // Alta / edición de gastos
    $('expense-form').addEventListener('submit', function (ev) {
      ev.preventDefault();

      var amount = parseFloat($('expense-amount').value);
      if (!(amount > 0)) { UI.toast('Ingresá un monto mayor a 0.', 'error'); return; }

      var data = {
        description: $('expense-description').value.trim() || 'Gasto',
        amount: amount,
        date: $('expense-date').value || Utils.todayISO(),
        categoryId: $('expense-category').value,
        method: $('expense-method').value
      };

      if (editingId) {
        Store.updateExpense(editingId, data);
        UI.toast('Gasto actualizado.', 'success');
      } else {
        Store.addExpense(data);
        UI.toast('Gasto registrado.', 'success');
      }
      resetForm();
      $('expense-description').focus();
    });

    $('expense-cancel-edit').addEventListener('click', resetForm);

    // Cambiar categoría desde el <select> refresca el resaltado de los chips.
    $('expense-category').addEventListener('change', renderCategoryChips);

    // Chips: seleccionar categoría / eliminar categoría propia / crear nueva.
    $('category-chips').addEventListener('click', function (ev) {
      var remove = ev.target.closest('[data-remove]');
      if (remove) {
        ev.stopPropagation();
        var catId = remove.getAttribute('data-remove');
        var cat = Store.categoryById(catId);
        UI.confirm({
          title: '¿Eliminar la categoría "' + cat.name + '"?',
          message: 'Los gastos de esta categoría se moverán a "Otros".',
          confirmLabel: 'Eliminar',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.removeCategory(catId);
          UI.toast('Categoría eliminada.', 'info');
        });
        return;
      }

      if (ev.target.closest('[data-new-category]')) { createCategory(); return; }

      var chip = ev.target.closest('[data-cat]');
      if (!chip) return;
      $('expense-category').value = chip.getAttribute('data-cat');
      renderCategoryChips();
    });

    // Buscador (con debounce para no re-renderizar en cada tecla)
    $('search-input').addEventListener('input', Utils.debounce(function (ev) {
      App.ui.search = ev.target.value;
      renderList();
    }, 150));

    // Filtro por categoría
    $('filter-category').addEventListener('change', function (ev) {
      App.ui.category = ev.target.value;
      renderList();
    });

    // Editar / eliminar desde el historial
    $('expense-list').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var id = btn.closest('[data-id]').getAttribute('data-id');

      if (btn.getAttribute('data-action') === 'edit') {
        startEdit(id);
      } else {
        UI.confirm({
          title: '¿Eliminar este gasto?',
          message: 'Esta acción no se puede deshacer.',
          confirmLabel: 'Eliminar',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          if (editingId === id) resetForm();
          Store.removeExpense(id);
          UI.toast('Gasto eliminado.', 'info');
        });
      }
    });
  }

  function render() {
    fillCategorySelect($('expense-category'));
    fillMethodSelect($('expense-method'));
    renderCategoryChips();
    renderFilters();
    renderList();
  }

  App.Expenses = {
    init: function () {
      $('expense-date').value = Utils.todayISO();
      bind();
    },
    render: render,
    resetForm: resetForm
  };
})(window.App);
