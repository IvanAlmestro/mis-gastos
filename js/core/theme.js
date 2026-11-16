/* =========================================================================
   theme.js · Modo claro / oscuro
   -------------------------------------------------------------------------
   - La preferencia se guarda en localStorage.
   - Si el usuario nunca eligió, se sigue la preferencia del sistema operativo
     (y se reacciona en vivo a los cambios de tema del SO).
   - El tema se refleja con la clase `dark` en <html>, que activa tanto las
     utilidades `dark:` de Tailwind como las variables CSS de styles.css.
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var STORAGE_KEY = 'gastos-estudiante:theme';
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /** Preferencia guardada explícitamente, o null si el usuario no eligió. */
  function stored() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (e) {
      return null;
    }
  }

  function systemPrefersDark() { return !!(media && media.matches); }

  /** Tema efectivo: la elección del usuario o, si no hay, la del sistema. */
  function current() { return stored() || (systemPrefersDark() ? 'dark' : 'light'); }

  /** Aplica el tema al documento y actualiza el botón de la cabecera. */
  function apply(theme) {
    var isDark = theme === 'dark';
    var root = document.documentElement;

    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    App.ui.theme = theme;

    var icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';

    var btn = document.getElementById('theme-toggle');
    if (btn) {
      var label = isDark ? 'Activar modo claro' : 'Activar modo oscuro';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('aria-pressed', String(isDark));
    }
  }

  /** Cambia el tema y lo persiste como elección del usuario. */
  function set(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* modo privado */ }
    apply(theme);
  }

  function toggle() {
    set(App.ui.theme === 'dark' ? 'light' : 'dark');
    // Repinta la vista activa para que el gráfico use los colores del nuevo tema.
    if (App.renderView) App.renderView();
  }

  function init() {
    apply(current());

    // Si no hay preferencia guardada, seguimos al sistema en vivo.
    if (media && media.addEventListener) {
      media.addEventListener('change', function () {
        if (stored()) return;
        apply(current());
        if (App.renderView) App.renderView();
      });
    }

    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggle);
  }

  App.Theme = {
    init: init,
    toggle: toggle,
    set: set,
    apply: apply,
    current: current
  };
})(window.App);
