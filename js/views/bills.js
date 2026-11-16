/* =========================================================================
   bills.js · Vista "Vencimientos": agenda de facturas y pagos fijos
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var Store = App.Store;
  var UI = App.UI;
  var $ = Utils.$;

  var editingId = null;
  var SOON_DAYS = 5; // umbral de alerta amarilla

  /* --- Estado visual de cada vencimiento --------------------------------- */
  /**
   * Devuelve la etiqueta y el color de alerta según los días restantes.
   * rojo  = vencido · amarillo = vence pronto · gris = al día · verde = pagado
   */
  function statusInfo(bill) {
    if (bill.status === 'pagado') {
      return { badge: 'badge-emerald', text: 'Pagado', border: '#10b981' };
    }
    var days = Utils.daysUntil(bill.dueDate);

    if (days < 0) {
      var n = Math.abs(days);
      return { badge: 'badge-rose', text: 'Vencido hace ' + n + (n === 1 ? ' día' : ' días'), border: '#e11d48' };
    }
    if (days === 0) return { badge: 'badge-amber', text: 'Vence hoy', border: '#f59e0b' };
    if (days <= SOON_DAYS) {
      return { badge: 'badge-amber', text: 'Vence en ' + days + (days === 1 ? ' día' : ' días'), border: '#f59e0b' };
    }
    return { badge: 'badge-slate', text: 'Vence el ' + Utils.formatDate(bill.dueDate), border: '#e2e8f0' };
  }

  /* --- Resumen superior -------------------------------------------------- */
  function renderSummary() {
    var pending = Store.bills().filter(function (b) { return b.status !== 'pagado'; });
    var overdue = pending.filter(function (b) { return Utils.daysUntil(b.dueDate) < 0; });
    var soon = pending.filter(function (b) {
      var d = Utils.daysUntil(b.dueDate);
      return d >= 0 && d <= SOON_DAYS;
    });

    $('bill-total-pending').textContent = Utils.money(Utils.sum(pending, function (b) { return b.amount; }));
    $('bill-total-overdue').textContent = Utils.money(Utils.sum(overdue, function (b) { return b.amount; }));
    $('bill-total-soon').textContent = Utils.money(Utils.sum(soon, function (b) { return b.amount; }));

    $('bill-count-overdue').textContent = overdue.length
      ? overdue.length + (overdue.length === 1 ? ' pago atrasado' : ' pagos atrasados')
      : 'Sin vencimientos atrasados';
    $('bill-count-soon').textContent = soon.length
      ? soon.length + (soon.length === 1 ? ' pago por vencer' : ' pagos por vencer')
      : 'Nada urgente por ahora';
  }

  /* --- Listado ----------------------------------------------------------- */
  function renderList() {
    var list = $('bill-list');
    var showPaid = App.ui.showPaidBills !== false;

    var bills = Store.bills().filter(function (b) {
      return showPaid || b.status !== 'pagado';
    }).sort(function (a, b) {
      // Pendientes primero (por fecha de vencimiento), pagados al final.
      var aPaid = a.status === 'pagado';
      var bPaid = b.status === 'pagado';
      if (aPaid !== bPaid) return aPaid ? 1 : -1;
      return a.dueDate < b.dueDate ? -1 : (a.dueDate > b.dueDate ? 1 : 0);
    });

    if (!bills.length) {
      list.innerHTML = '<li class="empty-state">' +
        (Store.bills().length ? 'No hay vencimientos para mostrar.' : 'Sin vencimientos cargados. Agregá tus facturas fijas.') +
        '</li>';
      return;
    }

    list.innerHTML = bills.map(function (bill) {
      var info = statusInfo(bill);
      var paid = bill.status === 'pagado';

      return '' +
        '<li class="row rounded-xl border border-slate-100 dark:border-slate-800" data-id="' + Utils.escapeHtml(bill.id) + '" ' +
            'style="border-left:4px solid ' + info.border + '">' +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-2">' +
              '<p class="truncate text-sm font-semibold ' + (paid ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-800 dark:text-slate-100') + '">' +
                Utils.escapeHtml(bill.name) + '</p>' +
              '<span class="badge ' + info.badge + '">' + Utils.escapeHtml(info.text) + '</span>' +
            '</div>' +
            '<p class="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Monto estimado: ' + Utils.money(bill.amount) +
              (paid && bill.paidAt ? ' · pagado el ' + Utils.formatDate(bill.paidAt) : '') + '</p>' +
          '</div>' +
          '<div class="flex flex-wrap items-center justify-end gap-1">' +
            (paid
              ? '<button type="button" class="btn btn-ghost btn-sm" data-action="unpay">↺ Deshacer</button>'
              : '<button type="button" class="btn btn-primary btn-sm" data-action="pay">✓ Pagar</button>') +
            '<button type="button" class="icon-btn" data-action="edit" title="Editar" aria-label="Editar">✎</button>' +
            '<button type="button" class="icon-btn danger" data-action="delete" title="Eliminar" aria-label="Eliminar">🗑</button>' +
          '</div>' +
        '</li>';
    }).join('');
  }

  /* --- Formulario -------------------------------------------------------- */
  function resetForm() {
    editingId = null;
    $('bill-form').reset();
    $('bill-date').value = Utils.todayISO();
    $('bill-status').value = 'pendiente';
    $('bill-form-title').textContent = 'Nuevo vencimiento';
    $('bill-submit').textContent = '＋ Guardar vencimiento';
    $('bill-cancel-edit').classList.add('hidden');
  }

  function startEdit(id) {
    var bill = Store.bills().filter(function (b) { return b.id === id; })[0];
    if (!bill) return;

    editingId = id;
    $('bill-name').value = bill.name;
    $('bill-amount').value = bill.amount;
    $('bill-date').value = bill.dueDate;
    $('bill-status').value = bill.status;
    $('bill-form-title').textContent = 'Editar vencimiento';
    $('bill-submit').textContent = '✓ Guardar cambios';
    $('bill-cancel-edit').classList.remove('hidden');
    $('bill-name').focus();
  }

  /* --- Marcar como pagado ------------------------------------------------ */
  function payBillFlow(id) {
    var bill = Store.bills().filter(function (b) { return b.id === id; })[0];
    if (!bill) return;

    UI.choose({
      title: 'Marcar "' + bill.name + '" como pagado',
      message: '¿Querés descontar ' + Utils.money(bill.amount) +
        ' como un gasto en la categoría "Facturas / Servicios"?',
      options: [
        { label: 'Sí, registrar el gasto', value: 'expense' },
        { label: 'Solo marcar como pagado', value: 'status', variant: 'ghost' }
      ],
      cancelLabel: 'Cancelar'
    }).then(function (choice) {
      if (!choice) return;
      Store.payBill(id, choice === 'expense');
      UI.toast(choice === 'expense'
        ? 'Pago registrado y gasto descontado.'
        : 'Vencimiento marcado como pagado.', 'success');
    });
  }

  /* --- Eventos ----------------------------------------------------------- */
  function bind() {
    $('bill-form').addEventListener('submit', function (ev) {
      ev.preventDefault();

      var amount = parseFloat($('bill-amount').value);
      if (!(amount > 0)) { UI.toast('Ingresá un monto estimado mayor a 0.', 'error'); return; }

      var data = {
        name: $('bill-name').value.trim() || 'Servicio',
        amount: amount,
        dueDate: $('bill-date').value || Utils.todayISO(),
        status: $('bill-status').value
      };

      if (editingId) {
        Store.updateBill(editingId, data);
        UI.toast('Vencimiento actualizado.', 'success');
      } else {
        Store.addBill(data);
        UI.toast('Vencimiento agregado.', 'success');
      }
      resetForm();
    });

    $('bill-cancel-edit').addEventListener('click', resetForm);

    $('bill-show-paid').addEventListener('change', function (ev) {
      App.ui.showPaidBills = ev.target.checked;
      renderList();
    });

    $('bill-list').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-action]');
      if (!btn) return;
      var id = btn.closest('[data-id]').getAttribute('data-id');
      var action = btn.getAttribute('data-action');

      if (action === 'edit') {
        startEdit(id);
      } else if (action === 'pay') {
        payBillFlow(id);
      } else if (action === 'unpay') {
        UI.confirm({
          title: '¿Deshacer el pago?',
          message: 'El vencimiento volverá a "Pendiente". Si se había registrado el gasto, también se eliminará.',
          confirmLabel: 'Deshacer',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.unpayBill(id);
          UI.toast('Pago deshecho.', 'info');
        });
      } else if (action === 'delete') {
        UI.confirm({
          title: '¿Eliminar este vencimiento?',
          message: 'Esta acción no se puede deshacer.',
          confirmLabel: 'Eliminar',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          if (editingId === id) resetForm();
          Store.removeBill(id);
          UI.toast('Vencimiento eliminado.', 'info');
        });
      }
    });
  }

  function render() {
    $('bill-show-paid').checked = App.ui.showPaidBills !== false;
    renderSummary();
    renderList();
  }

  App.Bills = {
    init: function () {
      $('bill-date').value = Utils.todayISO();
      bind();
    },
    render: render,
    resetForm: resetForm
  };
})(window.App);
