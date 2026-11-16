/* =========================================================================
   ui.js · Componentes de interfaz reutilizables
   - toasts (notificaciones)
   - modales: confirm() y choose() y form(), todos basados en Promesas
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var $ = Utils.$;

  /* --- Notificaciones ---------------------------------------------------- */
  var TOAST_ICONS = { success: '✅', error: '⚠️', info: 'ℹ️' };

  function toast(message, type) {
    var container = $('toast-container');
    if (!container) return;

    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('data-type', type || 'info');
    el.innerHTML = '<span>' + (TOAST_ICONS[type] || TOAST_ICONS.info) + '</span><span>' +
      Utils.escapeHtml(message) + '</span>';
    container.appendChild(el);

    setTimeout(function () {
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(12px)';
      setTimeout(function () { el.remove(); }, 200);
    }, 2800);
  }

  /* --- Modales ----------------------------------------------------------- */
  /**
   * Monta un modal en el DOM y devuelve un objeto con `close(value)`.
   * Se cierra con Escape o clic en el fondo.
   */
  function mountModal(innerHTML, onResolve) {
    var root = $('modal-root');
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = innerHTML;
    root.appendChild(backdrop);

    var card = backdrop.firstElementChild;
    document.body.style.overflow = 'hidden';

    var settled = false;
    function close(value) {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      backdrop.remove();
      onResolve(value);
    }
    function onKey(ev) { if (ev.key === 'Escape') close(null); }

    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('mousedown', function (ev) {
      if (ev.target === backdrop) close(null);
    });

    // Cierra al hacer clic en cualquier botón con data-modal-value.
    card.querySelectorAll('[data-modal-value]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        close(btn.getAttribute('data-modal-value'));
      });
    });

    return { close: close, card: card, backdrop: backdrop };
  }

  function escapeAttr(value) {
    return Utils.escapeHtml(value == null ? '' : String(value));
  }

  function headerHtml(title, message) {
    return '<h3 class="text-base font-bold text-slate-900 dark:text-white">' + escapeAttr(title) + '</h3>' +
      (message ? '<p class="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">' + escapeAttr(message) + '</p>' : '');
  }

  /** Modal de confirmación. Resuelve `true` si se confirma, `false` si no. */
  function confirm(options) {
    return new Promise(function (resolve) {
      var danger = options.danger;
      var html =
        '<div class="modal-card" role="dialog" aria-modal="true">' +
          headerHtml(options.title, options.message) +
          '<div class="mt-5 flex justify-end gap-2">' +
            '<button type="button" class="btn btn-ghost" data-modal-value="no">' +
              escapeAttr(options.cancelLabel || 'Cancelar') + '</button>' +
            '<button type="button" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-modal-value="yes">' +
              escapeAttr(options.confirmLabel || 'Confirmar') + '</button>' +
          '</div>' +
        '</div>';
      mountModal(html, function (value) { resolve(value === 'yes'); });
    });
  }

  /**
   * Modal con varias opciones. Resuelve el `value` de la opción elegida
   * (o null si se cancela). Ej: sí / solo marcar / cancelar.
   */
  function choose(options) {
    return new Promise(function (resolve) {
      var buttons = (options.options || []).map(function (opt) {
        var variant = opt.variant === 'danger' ? 'btn-danger'
          : opt.variant === 'ghost' ? 'btn-ghost' : 'btn-primary';
        return '<button type="button" class="btn ' + variant + ' w-full" data-modal-value="' +
          escapeAttr(opt.value) + '">' + escapeAttr(opt.label) + '</button>';
      }).join('');

      var html =
        '<div class="modal-card" role="dialog" aria-modal="true">' +
          headerHtml(options.title, options.message) +
          '<div class="mt-5 flex flex-col gap-2">' + buttons + '</div>' +
          '<div class="mt-3 text-center">' +
            '<button type="button" class="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" data-modal-value="">' +
              escapeAttr(options.cancelLabel || 'Cancelar') + '</button>' +
          '</div>' +
        '</div>';

      mountModal(html, function (value) {
        resolve(value === '' || value === null ? null : value);
      });
    });
  }

  /**
   * Modal con formulario dinámico.
   * fields: [{ name, label, type, value, placeholder, required, options }]
   * Resuelve un objeto { name: value } o null si se cancela.
   */
  function form(options) {
    return new Promise(function (resolve) {
      var fields = options.fields || [];
      var fieldsHtml = fields.map(function (field) {
        var id = 'mf_' + field.name;
        var label = '<label class="label" for="' + id + '">' + escapeAttr(field.label) + '</label>';
        var control;

        if (field.type === 'select') {
          control = '<select id="' + id + '" name="' + escapeAttr(field.name) + '" class="input">' +
            (field.options || []).map(function (opt) {
              var selected = String(opt.value) === String(field.value) ? ' selected' : '';
              return '<option value="' + escapeAttr(opt.value) + '"' + selected + '>' +
                escapeAttr(opt.label) + '</option>';
            }).join('') + '</select>';
        } else if (field.type === 'color') {
          control = '<input id="' + id + '" name="' + escapeAttr(field.name) + '" type="color" class="input h-10 p-1" value="' +
            escapeAttr(field.value || '#64748b') + '" />';
        } else {
          control = '<input id="' + id + '" name="' + escapeAttr(field.name) + '" type="' +
            escapeAttr(field.type || 'text') + '" class="input" value="' + escapeAttr(field.value || '') +
            '" placeholder="' + escapeAttr(field.placeholder || '') + '"' +
            (field.required ? ' required' : '') + ' />';
        }
        return '<div>' + label + control + '</div>';
      }).join('');

      var html =
        '<div class="modal-card" role="dialog" aria-modal="true">' +
          headerHtml(options.title, options.message) +
          '<form class="mt-4 space-y-3">' + fieldsHtml +
            '<div class="flex justify-end gap-2 pt-1">' +
              '<button type="button" class="btn btn-ghost" data-modal-value="">' +
                escapeAttr(options.cancelLabel || 'Cancelar') + '</button>' +
              '<button type="submit" class="btn btn-primary">' +
                escapeAttr(options.submitLabel || 'Guardar') + '</button>' +
            '</div>' +
          '</form>' +
        '</div>';

      var modal = mountModal(html, resolve);
      var formEl = modal.card.querySelector('form');
      var first = formEl.querySelector('input, select');

      formEl.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var values = {};
        fields.forEach(function (field) {
          var el = formEl.querySelector('[name="' + field.name + '"]');
          values[field.name] = el ? el.value.trim() : '';
        });
        modal.close(values);
      });

      if (first) setTimeout(function () { first.focus(); }, 50);
    });
  }

  App.UI = {
    toast: toast,
    confirm: confirm,
    choose: choose,
    form: form
  };
})(window.App);
