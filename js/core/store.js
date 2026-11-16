/* =========================================================================
   store.js · Estado central + persistencia en localStorage
   -------------------------------------------------------------------------
   Modelo de datos:
   {
     version: 1,
     categories: [{ id, name, icon, color, custom }],
     incomes:    [{ id, date, amount, concept, note }],
     expenses:   [{ id, date, amount, description, categoryId, method, billId }],
     bills:      [{ id, name, amount, dueDate, status, paidAt, expenseId }]
   }
   Todas las mutaciones pasan por `commit()`, que guarda y notifica a la UI.
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var STORAGE_KEY = 'gastos-estudiante:v1';

  /* --- Categorías orientadas a un estudiante ---------------------------- */
  var DEFAULT_CATEGORIES = [
    { id: 'alimentacion', name: 'Alimentación / Súper', icon: '🛒', color: '#10b981', custom: false },
    { id: 'facturas',     name: 'Facturas / Servicios', icon: '🧾', color: '#3b82f6', custom: false },
    { id: 'transporte',   name: 'Transporte',           icon: '🚌', color: '#f59e0b', custom: false },
    { id: 'universidad',  name: 'Universidad / Apuntes', icon: '🎓', color: '#8b5cf6', custom: false },
    { id: 'ocio',         name: 'Salidas / Ocio',       icon: '🎉', color: '#ec4899', custom: false },
    { id: 'salud',        name: 'Salud / Deporte',      icon: '💪', color: '#ef4444', custom: false },
    { id: 'otros',        name: 'Otros',                icon: '📦', color: '#64748b', custom: false }
  ];

  var PAYMENT_METHODS = ['Efectivo', 'Débito / Transferencia', 'Mercado Pago / Billetera'];

  /* --- Estado ------------------------------------------------------------ */
  var state = createInitialState();
  var listeners = [];

  function createInitialState() {
    return {
      version: 1,
      updatedAt: 0, // se usa para resolver conflictos en la sincronización
      categories: DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); }),
      incomes: [],
      expenses: [],
      bills: []
    };
  }

  /* --- Normalización (defensa ante datos corruptos o backups viejos) ----- */
  function normalizeCategory(c) {
    if (!c || !c.id) return null;
    return {
      id: String(c.id),
      name: String(c.name || 'Sin nombre'),
      icon: String(c.icon || '🏷️'),
      color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#64748b',
      custom: !!c.custom
    };
  }

  function normalizeIncome(i) {
    if (!i) return null;
    return {
      id: i.id || Utils.uid('inc'),
      date: i.date || Utils.todayISO(),
      amount: Utils.round2(i.amount),
      concept: String(i.concept || 'Ingreso'),
      note: String(i.note || '')
    };
  }

  function normalizeExpense(e) {
    if (!e) return null;
    return {
      id: e.id || Utils.uid('exp'),
      date: e.date || Utils.todayISO(),
      amount: Utils.round2(e.amount),
      description: String(e.description || 'Gasto'),
      categoryId: e.categoryId || 'otros',
      method: PAYMENT_METHODS.indexOf(e.method) >= 0 ? e.method : PAYMENT_METHODS[0],
      billId: e.billId || null
    };
  }

  function normalizeBill(b) {
    if (!b) return null;
    return {
      id: b.id || Utils.uid('bill'),
      name: String(b.name || 'Servicio'),
      amount: Utils.round2(b.amount),
      dueDate: b.dueDate || Utils.todayISO(),
      status: b.status === 'pagado' ? 'pagado' : 'pendiente',
      paidAt: b.paidAt || null,
      expenseId: b.expenseId || null
    };
  }

  /** Convierte datos crudos en un estado válido y completo. */
  function normalize(raw) {
    var base = createInitialState();
    if (!raw || typeof raw !== 'object') return base;

    var categories = (Array.isArray(raw.categories) ? raw.categories : [])
      .map(normalizeCategory)
      .filter(Boolean);

    // Garantiza que siempre exista la categoría "otros" (fallback seguro).
    if (!categories.some(function (c) { return c.id === 'otros'; })) {
      categories.push({ id: 'otros', name: 'Otros', icon: '📦', color: '#64748b', custom: false });
    }
    // Asegura también las categorías por defecto que falten.
    DEFAULT_CATEGORIES.forEach(function (def) {
      if (!categories.some(function (c) { return c.id === def.id; })) categories.push(Object.assign({}, def));
    });

    var ids = categories.map(function (c) { return c.id; });

    return {
      version: 1,
      updatedAt: Number(raw.updatedAt) || 0,
      categories: categories,
      incomes: (Array.isArray(raw.incomes) ? raw.incomes : []).map(normalizeIncome).filter(Boolean),
      expenses: (Array.isArray(raw.expenses) ? raw.expenses : []).map(normalizeExpense).filter(Boolean)
        .map(function (e) {
          if (ids.indexOf(e.categoryId) < 0) e.categoryId = 'otros';
          return e;
        }),
      bills: (Array.isArray(raw.bills) ? raw.bills : []).map(normalizeBill).filter(Boolean)
    };
  }

  /* --- Persistencia ------------------------------------------------------ */
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('[Store] No se pudo guardar en localStorage:', err);
      if (App.UI) App.UI.toast('No se pudieron guardar los datos en el navegador.', 'error');
    }
  }

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (err) { console.error('[Store] listener error:', err); }
    });
  }

  /**
   * Guarda y avisa a la UI. Punto único de entrada tras cada cambio.
   * `options.fromRemote` evita re-sellar la fecha y re-subir a la nube
   * cuando el cambio vino justamente de la sincronización.
   */
  function commit(options) {
    if (!options || !options.fromRemote) state.updatedAt = Date.now();
    persist();
    notify();
    if (App.Sync) App.Sync.onLocalChange(!!(options && options.fromRemote));
  }

  /* --- API pública ------------------------------------------------------- */
  var Store = {
    /** Carga los datos desde localStorage. */
    init: function () {
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { raw = null; }
      state = normalize(raw);
      persist();
      return state;
    },

    subscribe: function (fn) { listeners.push(fn); },
    getState: function () { return state; },

    /* --- Catálogos --- */
    categories: function () { return state.categories.slice(); },
    paymentMethods: function () { return PAYMENT_METHODS.slice(); },
    categoryById: function (id) {
      return state.categories.filter(function (c) { return c.id === id; })[0] || {
        id: 'otros', name: 'Otros', icon: '📦', color: '#64748b', custom: false
      };
    },

    /** Crea una categoría propia y la devuelve. */
    addCategory: function (data) {
      var category = normalizeCategory({
        id: Utils.uid('cat'),
        name: data.name,
        icon: data.icon || '🏷️',
        color: data.color || '#64748b',
        custom: true
      });
      state.categories.push(category);
      commit();
      return category;
    },

    /** Elimina una categoría propia reasignando sus gastos a "otros". */
    removeCategory: function (id) {
      var cat = Store.categoryById(id);
      if (!cat.custom) return false;
      state.categories = state.categories.filter(function (c) { return c.id !== id; });
      state.expenses.forEach(function (e) { if (e.categoryId === id) e.categoryId = 'otros'; });
      commit();
      return true;
    },

    /* --- Ingresos --- */
    incomes: function () { return state.incomes.slice(); },

    addIncome: function (data) {
      var income = normalizeIncome(Object.assign({ id: Utils.uid('inc') }, data));
      state.incomes.push(income);
      commit();
      return income;
    },

    updateIncome: function (id, data) {
      state.incomes = state.incomes.map(function (i) {
        return i.id === id ? normalizeIncome(Object.assign({}, i, data, { id: id })) : i;
      });
      commit();
    },

    removeIncome: function (id) {
      state.incomes = state.incomes.filter(function (i) { return i.id !== id; });
      commit();
    },

    /* --- Gastos --- */
    expenses: function () { return state.expenses.slice(); },

    addExpense: function (data) {
      var expense = normalizeExpense(Object.assign({ id: Utils.uid('exp') }, data));
      state.expenses.push(expense);
      commit();
      return expense;
    },

    updateExpense: function (id, data) {
      state.expenses = state.expenses.map(function (e) {
        return e.id === id ? normalizeExpense(Object.assign({}, e, data, { id: id })) : e;
      });
      commit();
    },

    removeExpense: function (id) {
      state.expenses = state.expenses.filter(function (e) { return e.id !== id; });
      commit();
    },

    /* --- Vencimientos --- */
    bills: function () { return state.bills.slice(); },

    addBill: function (data) {
      var bill = normalizeBill(Object.assign({ id: Utils.uid('bill') }, data));
      state.bills.push(bill);
      commit();
      return bill;
    },

    updateBill: function (id, data) {
      state.bills = state.bills.map(function (b) {
        return b.id === id ? normalizeBill(Object.assign({}, b, data, { id: id })) : b;
      });
      commit();
    },

    removeBill: function (id) {
      state.bills = state.bills.filter(function (b) { return b.id !== id; });
      commit();
    },

    /**
     * Marca un vencimiento como pagado. Si `asExpense` es true, además
     * registra el gasto en la categoría "Facturas / Servicios".
     */
    payBill: function (id, asExpense) {
      var bill = state.bills.filter(function (b) { return b.id === id; })[0];
      if (!bill) return null;

      bill.status = 'pagado';
      bill.paidAt = Utils.todayISO();

      if (asExpense) {
        var expense = normalizeExpense({
          id: Utils.uid('exp'),
          date: Utils.todayISO(),
          amount: bill.amount,
          description: bill.name,
          categoryId: 'facturas',
          method: PAYMENT_METHODS[1],
          billId: bill.id
        });
        state.expenses.push(expense);
        bill.expenseId = expense.id;
      }
      commit();
      return bill;
    },

    /** Deshace el pago y elimina el gasto asociado si existía. */
    unpayBill: function (id) {
      var bill = state.bills.filter(function (b) { return b.id === id; })[0];
      if (!bill) return;
      if (bill.expenseId) {
        state.expenses = state.expenses.filter(function (e) { return e.id !== bill.expenseId; });
        bill.expenseId = null;
      }
      bill.status = 'pendiente';
      bill.paidAt = null;
      commit();
    },

    /* --- Consultas / totales --- */
    incomesInMonth: function (monthKey) {
      return state.incomes.filter(function (i) { return Utils.monthKeyOf(i.date) === monthKey; });
    },

    expensesInMonth: function (monthKey) {
      return state.expenses.filter(function (e) { return Utils.monthKeyOf(e.date) === monthKey; });
    },

    /** Presupuesto del mes = suma de ingresos de ese mes. */
    budgetInMonth: function (monthKey) {
      return Utils.round2(Utils.sum(Store.incomesInMonth(monthKey), function (i) { return i.amount; }));
    },

    /** Total gastado en el mes. */
    spentInMonth: function (monthKey) {
      return Utils.round2(Utils.sum(Store.expensesInMonth(monthKey), function (e) { return e.amount; }));
    },

    /** Dinero disponible real: todos los ingresos menos todos los gastos. */
    availableTotal: function () {
      return Utils.round2(Utils.sum(state.incomes, function (i) { return i.amount; })
        - Utils.sum(state.expenses, function (e) { return e.amount; }));
    },

    /** Totales por categoría en un mes, ordenados de mayor a menor. */
    categoryTotalsInMonth: function (monthKey) {
      var expenses = Store.expensesInMonth(monthKey);
      var grouped = Utils.groupBy(expenses, function (e) { return e.categoryId; });

      return Object.keys(grouped).map(function (catId) {
        var items = grouped[catId];
        var total = Utils.sum(items, function (e) { return e.amount; });
        return {
          category: Store.categoryById(catId),
          total: Utils.round2(total),
          count: items.length,
          average: Utils.round2(total / items.length)
        };
      }).sort(function (a, b) { return b.total - a.total; });
    },

    /* --- Backup --- */
    exportJSON: function () {
      return JSON.stringify(state, null, 2);
    },

    /** Importa un backup. Devuelve true si fue válido. */
    importJSON: function (text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { return false; }
      if (!parsed || typeof parsed !== 'object') return false;
      if (!parsed.incomes && !parsed.expenses && !parsed.bills) return false;
      state = normalize(parsed);
      commit();
      return true;
    },

    /** Reemplaza el estado por uno que llega de la nube (sin re-subirlo). */
    applySnapshot: function (raw) {
      state = normalize(raw);
      commit({ fromRemote: true });
    },

    /** Borra todo y vuelve al estado inicial. */
    reset: function () {
      state = createInitialState();
      commit();
    },

    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES
  };

  App.Store = Store;
})(window.App);
