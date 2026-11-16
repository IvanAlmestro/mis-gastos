/* =========================================================================
   charts.js · Envoltorio mínimo sobre Chart.js
   Se encarga de crear, actualizar y destruir el gráfico de categorías.
   Los colores de ejes y tooltip se adaptan al tema activo.
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var instance = null;

  /** Convierte un color hex + alfa a rgba() (para bordes suaves). */
  function withAlpha(hex, alpha) {
    var h = String(hex || '#64748b').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  /** Colores que dependen del tema (claro / oscuro). */
  function palette() {
    var isDark = App.ui && App.ui.theme === 'dark';
    return isDark ? {
      grid: '#1e293b',
      tick: '#94a3b8',
      label: '#e2e8f0',
      border: '#0f172a',
      tooltipBg: '#e2e8f0',
      tooltipText: '#0f172a'
    } : {
      grid: '#f1f5f9',
      tick: '#94a3b8',
      label: '#475569',
      border: '#ffffff',
      tooltipBg: '#0f172a',
      tooltipText: '#ffffff'
    };
  }

  function isReady() { return typeof window.Chart !== 'undefined'; }

  function destroy() {
    if (instance) { instance.destroy(); instance = null; }
  }

  /**
   * Dibuja el gráfico de gasto por categoría.
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label,value,color}>} items
   * @param {'doughnut'|'bar'} type
   */
  function render(canvas, items, type) {
    if (!canvas) return;
    if (!isReady()) return; // Chart.js no cargó (sin conexión)

    destroy();

    var c = palette();
    var labels = items.map(function (i) { return i.label; });
    var values = items.map(function (i) { return i.value; });
    var colors = items.map(function (i) { return i.color; });
    var total = Utils.sum(values);
    var isBar = type === 'bar';

    instance = new window.Chart(canvas.getContext('2d'), {
      type: isBar ? 'bar' : 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: isBar ? colors.map(function (col) { return withAlpha(col, 0.85); }) : colors,
          borderColor: isBar ? colors : c.border,
          borderWidth: isBar ? 0 : 2,
          borderRadius: isBar ? 8 : 0,
          hoverOffset: isBar ? 0 : 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: isBar ? 'y' : 'x',
        cutout: isBar ? undefined : '62%',
        layout: { padding: isBar ? 4 : 8 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: c.tooltipBg,
            titleColor: c.tooltipText,
            bodyColor: c.tooltipText,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function (ctx) {
                var value = Number(ctx.parsed[isBar ? 'x' : 'y'] != null
                  ? (isBar ? ctx.parsed.x : ctx.parsed.y)
                  : ctx.parsed) || 0;
                var pct = total ? (value / total * 100) : 0;
                return Utils.money(value) + '  ·  ' + pct.toFixed(1) + '% del gasto';
              }
            }
          }
        },
        scales: isBar ? {
          x: {
            beginAtZero: true,
            grid: { color: c.grid, drawBorder: false },
            ticks: {
              color: c.tick,
              font: { size: 11 },
              callback: function (value) { return Utils.money(value); }
            }
          },
          y: {
            grid: { display: false, drawBorder: false },
            ticks: { color: c.label, font: { size: 11, weight: '600' } }
          }
        } : {},
        animation: { duration: 400 }
      }
    });
  }

  App.Charts = { render: render, destroy: destroy, isReady: isReady };
})(window.App);
