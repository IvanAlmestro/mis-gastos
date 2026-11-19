/* =========================================================================
   store.js · Estado central + persistencia en localStorage
   -------------------------------------------------------------------------
   Modelo de datos:
   {
     version: 1,
     categories: [{ id, name, icon, color, parentId, custom }],
     incomes:    [{ id, date, amount, concept, note }],
     expenses:   [{ id, date, amount, description, categoryId, method, billId }],
     bills:      [{ id, name, amount, dueDate, status, paidAt, expenseId }]
   }
   Las categorías son de dos niveles: `parentId` apunta a un grupo (definido
   en DEFAULT_GROUPS); las categorías propias no tienen grupo. Los gastos
   guardan siempre la subcategoría (hoja) en `categoryId`.

   Todas las mutaciones pasan por `commit()`, que guarda y notifica a la UI.
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var STORAGE_KEY = 'gastos-estudiante:v1';

  var FALLBACK_CATEGORY_ID = 'otros-general';
  var DEFAULT_CATEGORY_ID = 'comida-supermercado';
  var BILLS_CATEGORY_ID = 'fijos-otro';
  var DEFAULT_PAYMENT_METHOD = 'Débito / Transferencia';
  var PAYMENT_METHODS = ['Efectivo', DEFAULT_PAYMENT_METHOD];

  /* --- Grupos (categorías de primer nivel) ------------------------------ */
  var DEFAULT_GROUPS = [
    { id: 'comida',          name: 'Comida',           icon: '🍽️', color: '#10b981' },
    { id: 'social',          name: 'Social',           icon: '🎉', color: '#ec4899' },
    { id: 'fijos',           name: 'Fijos',            icon: '🏠', color: '#3b82f6' },
    { id: 'transporte',      name: 'Transporte',       icon: '🚌', color: '#f59e0b' },
    { id: 'actividad-fisica', name: 'Actividad física', icon: '🏃', color: '#8b5cf6' },
    { id: 'antojo',          name: 'Antojo',           icon: '🍦', color: '#f97316' },
    { id: 'otros',           name: 'Otros',            icon: '📦', color: '#64748b' }
  ];

  /* --- Subcategorías (hojas que se pueden asignar a un gasto) ----------- */
  var DEFAULT_CATEGORIES = [
    { id: 'comida-supermercado', name: 'Supermercado', icon: '🛒', color: '#10b981', parentId: 'comida', custom: false },
    { id: 'comida-verduleria',   name: 'Verdulería',   icon: '🥬', color: '#22c55e', parentId: 'comida', custom: false },
    { id: 'comida-carniceria',   name: 'Carnicería',   icon: '🥩', color: '#ef4444', parentId: 'comida', custom: false },
    { id: 'comida-polleria',     name: 'Pollería',     icon: '🍗', color: '#f97316', parentId: 'comida', custom: false },
    { id: 'comida-panaderia',    name: 'Panadería',    icon: '🥖', color: '#eab308', parentId: 'comida', custom: false },
    { id: 'comida-agua',         name: 'Agua',         icon: '💧', color: '#0ea5e9', parentId: 'comida', custom: false },

    { id: 'social-juntada', name: 'Juntada de pibes', icon: '🧉', color: '#ec4899', parentId: 'social', custom: false },
    { id: 'social-bar',     name: 'Bar',              icon: '🍻', color: '#f43f5e', parentId: 'social', custom: false },
    { id: 'social-evento',  name: 'Evento',           icon: '🎟️', color: '#a855f7', parentId: 'social', custom: false },

    { id: 'fijos-alquiler', name: 'Alquiler', icon: '🏠', color: '#3b82f6', parentId: 'fijos', custom: false },
    { id: 'fijos-internet', name: 'Internet', icon: '🌐', color: '#6366f1', parentId: 'fijos', custom: false },
    { id: 'fijos-celular',  name: 'Celular',  icon: '📱', color: '#818cf8', parentId: 'fijos', custom: false },
    { id: 'fijos-otro',     name: 'Otro',     icon: '🧾', color: '#64748b', parentId: 'fijos', custom: false },

    { id: 'transporte-sube',   name: 'SUBE',       icon: '🚇', color: '#f59e0b', parentId: 'transporte', custom: false },
    { id: 'transporte-viaje',  name: 'Viaje',      icon: '🚗', color: '#f97316', parentId: 'transporte', custom: false },
    { id: 'transporte-bici',   name: 'Gasto bici', icon: '🚲', color: '#14b8a6', parentId: 'transporte', custom: false },
    { id: 'transporte-otro',   name: 'Otro',       icon: '🛣️', color: '#64748b', parentId: 'transporte', custom: false },

    { id: 'actividad-futbol',    name: 'Fútbol',    icon: '⚽', color: '#22c55e', parentId: 'actividad-fisica', custom: false },
    { id: 'actividad-voley',     name: 'Voley',     icon: '🏐', color: '#8b5cf6', parentId: 'actividad-fisica', custom: false },
    { id: 'actividad-tenis',     name: 'Tenis',     icon: '🎾', color: '#84cc16', parentId: 'actividad-fisica', custom: false },
    { id: 'actividad-gimnasio',  name: 'Gimnasio',  icon: '🏋️', color: '#6366f1', parentId: 'actividad-fisica', custom: false },

    { id: 'antojo-helado', name: 'Helado',  icon: '🍦', color: '#f97316', parentId: 'antojo', custom: false },
    { id: 'antojo-comida', name: 'Comida',  icon: '🍔', color: '#ef4444', parentId: 'antojo', custom: false },
    { id: 'antojo-dulce',  name: 'Dulce',   icon: '🍰', color: '#ec4899', parentId: 'antojo', custom: false },
    { id: 'antojo-online', name: 'Online',  icon: '📦', color: '#a855f7', parentId: 'antojo', custom: false },

    { id: FALLBACK_CATEGORY_ID, name: 'Otros',   icon: '📦', color: '#64748b', parentId: 'otros', custom: false },
    { id: 'otros-regalo',  name: 'Regalos', icon: '🎁', color: '#f43f5e', parentId: 'otros', custom: false },
    { id: 'otros-salud',   name: 'Salud',   icon: '💊', color: '#ef4444', parentId: 'otros', custom: false },
    { id: 'otros-libro',   name: 'Libro',   icon: '📚', color: '#3b82f6', parentId: 'otros', custom: false },
    { id: 'otros-ropa',    name: 'Ropa',    icon: '👕', color: '#8b5cf6', parentId: 'otros', custom: false }
  ];

  /* Categorías de la versión anterior: se migran para no perder gastos. */
  var LEGACY_CATEGORY_MAP = {
    alimentacion: 'comida-supermercado',
    facturas: 'fijos-otro',
    transporte: 'transporte-otro',
    universidad: 'otros-libro',
    ocio: 'social-bar',
    salud: 'otros-salud',
    otros: FALLBACK_CATEGORY_ID
  };

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
      parentId: c.parentId ? String(c.parentId) : null,
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
    var rawId = String(e.categoryId || FALLBACK_CATEGORY_ID);
    return {
      id: e.id || Utils.uid('exp'),
      date: e.date || Utils.todayISO(),
      amount: Utils.round2(e.amount),
      description: String(e.description || 'Gasto'),
      categoryId: LEGACY_CATEGORY_MAP[rawId] || rawId,
      // Pagos con "Mercado Pago / Billetera" pasan al único método digital.
      method: PAYMENT_METHODS.indexOf(e.method) >= 0 ? e.method : DEFAULT_PAYMENT_METHOD,
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

    var defaultsById = {};
    DEFAULT_CATEGORIES.forEach(function (d) { defaultsById[d.id] = d; });

    var categories = (Array.isArray(raw.categories) ? raw.categories : [])
      .map(normalizeCategory)
      .filter(Boolean)
      // Las categorías viejas se reemplazan por sus equivalentes; las propias se mantienen.
      .filter(function (c) { return !LEGACY_CATEGORY_MAP[c.id]; })
      // Repara las categorías por defecto que vinieron sin `parentId` (por ejemplo,
      // datos que hizo circular un dispositivo con una versión vieja de la app).
      .map(function (c) {
        var def = defaultsById[c.id];
        return def ? Object.assign({}, def) : c;
      });

    if (!categories.some(function (c) { return c.id === FALLBACK_CATEGORY_ID; })) {
      categories.push({
        id: FALLBACK_CATEGORY_ID, name: 'Otros', icon: '📦',
        color: '#64748b', parentId: 'otros', custom: false
      });
    }
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
          if (ids.indexOf(e.categoryId) < 0) e.categoryId = FALLBACK_CATEGORY_ID;
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
    defaultPaymentMethod: function () { return DEFAULT_PAYMENT_METHOD; },
    defaultCategoryId: function () { return DEFAULT_CATEGORY_ID; },
    billsCategoryId: function () { return BILLS_CATEGORY_ID; },
    fallbackCategoryId: function () { return FALLBACK_CATEGORY_ID; },

    groups: function () {
      return DEFAULT_GROUPS.map(function (g) { return Object.assign({}, g); });
    },
    groupById: function (id) {
      return DEFAULT_GROUPS.filter(function (g) { return g.id === id; })[0] || null;
    },
    categoriesInGroup: function (groupId) {
      return state.categories.filter(function (c) { return c.parentId === groupId; });
    },
    customCategories: function () {
      return state.categories.filter(function (c) { return !c.parentId; });
    },
    groupOfCategory: function (id) {
      var cat = Store.categoryById(id);
      return cat.parentId ? Store.groupById(cat.parentId) : null;
    },
    /** Etiqueta completa, por ejemplo "Comida · Supermercado". */
    categoryLabel: function (id) {
      var cat = Store.categoryById(id);
      var group = Store.groupOfCategory(id);
      return group ? group.name + ' · ' + cat.name : cat.name;
    },
    categoryById: function (id) {
      return state.categories.filter(function (c) { return c.id === id; })[0] || {
        id: FALLBACK_CATEGORY_ID, name: 'Otros', icon: '📦', color: '#64748b',
        parentId: 'otros', custom: false
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

    /** Elimina una categoría propia reasignando sus gastos a "Otros". */
    removeCategory: function (id) {
      var cat = Store.categoryById(id);
      if (!cat.custom) return false;
      state.categories = state.categories.filter(function (c) { return c.id !== id; });
      state.expenses.forEach(function (e) {
        if (e.categoryId === id) e.categoryId = FALLBACK_CATEGORY_ID;
      });
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
     * registra el gasto en "Fijos / Otro" con el método por defecto.
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
          categoryId: BILLS_CATEGORY_ID,
          method: DEFAULT_PAYMENT_METHOD,
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

    /**
     * Totales en un mes, ordenados de mayor a menor.
     * mode 'group' (por defecto) agrupa por categoría de primer nivel;
     * mode 'sub' agrupa por subcategoría (gastos con etiqueta "Grupo · Sub").
     */
    categoryTotalsInMonth: function (monthKey, mode) {
      var bySub = mode === 'sub';
      var expenses = Store.expensesInMonth(monthKey);
      var grouped = Utils.groupBy(expenses, function (e) {
        if (bySub) return e.categoryId;
        var cat = Store.categoryById(e.categoryId);
        return cat.parentId || e.categoryId;
      });

      return Object.keys(grouped).map(function (key) {
        var items = grouped[key];
        var total = Utils.sum(items, function (e) { return e.amount; });
        var cat = Store.categoryById(key);
        var bucket = bySub
          ? {
              id: key,
              name: Store.categoryLabel(key),
              icon: cat.icon,
              color: cat.color
            }
          : (Store.groupById(key) || {
              name: cat.name,
              icon: cat.icon,
              color: cat.color
            });
        return {
          category: bucket,
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

    DEFAULT_GROUPS: DEFAULT_GROUPS,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES
  };

  App.Store = Store;
})(window.App);
