/* =========================================================================
   sync.js · Sincronización opcional entre dispositivos con Firebase
   -------------------------------------------------------------------------
   Cómo funciona (simple y sin backend propio):

   - Cada dispositivo elige el MISMO "código de sincronización" (una especie
     de contraseña). Los datos se guardan en Firebase Realtime Database bajo
     la ruta  mis-gastos/<código> .
   - Cuando cambiás algo localmente, se sube (con un pequeño retraso/debounce).
   - Cuando otro dispositivo cambia algo, este se entera en vivo y lo aplica.
   - Resolución de conflictos: "gana el último que escribió", comparando el
     campo `updatedAt` (milisegundos). Es lo más simple y suficiente para un
     uso personal de 1 persona / 2 dispositivos.

   El SDK de Firebase NO se carga hasta que la sincronización está activada,
   así la app sigue siendo liviana y funciona sin internet.

   Si `window.FIREBASE_CONFIG.databaseURL` está vacío, todo esto queda inerte.
   ========================================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  var Utils = App.Utils;
  var UI = App.UI;
  var Store = App.Store;

  var SETTINGS_KEY = 'gastos-estudiante:sync';
  var SDK_VERSION = '10.12.2';
  var SDK_BASE = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';

  var settings = { enabled: false, code: '' };
  var status = 'off'; // off | connecting | syncing | synced | error
  var ref = null;     // referencia de Realtime Database
  var sdkPromise = null;

  /* --- Estado interno ---------------------------------------------------- */

  function loadSettings() {
    try {
      var raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (raw && typeof raw === 'object') {
        settings.enabled = !!raw.enabled;
        settings.code = String(raw.code || '');
      }
    } catch (e) { /* sin datos guardados */ }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* modo privado */ }
  }

  /** ¿Hay configuración de Firebase cargada? */
  function isConfigured() {
    return !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL);
  }

  /** Normaliza el código: sin acentos ni caracteres prohibidos en claves. */
  function sanitizeCode(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
      .trim()
      .toLowerCase()
      .replace(/[.#$\[\]/\s]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64);
  }

  /* --- Indicador visual en la cabecera ----------------------------------- */

  var STATUS_META = {
    off:        { icon: '☁️', label: 'Sincronización desactivada' },
    connecting: { icon: '⏳', label: 'Conectando con la nube…' },
    syncing:    { icon: '🔄', label: 'Subiendo cambios…' },
    synced:     { icon: '✅', label: 'Sincronizado' },
    error:      { icon: '⚠️', label: 'Error de sincronización' }
  };

  function setStatus(next) {
    status = next;
    var meta = STATUS_META[next] || STATUS_META.off;
    var icon = Utils.$('sync-icon');
    if (icon) icon.textContent = meta.icon;
    var btn = Utils.$('btn-sync');
    if (btn) {
      var title = settings.enabled
        ? meta.label + ' · código: ' + settings.code
        : meta.label;
      btn.setAttribute('title', title);
      btn.setAttribute('aria-label', title);
    }
  }

  function statusText() {
    return (STATUS_META[status] || STATUS_META.off).label;
  }

  /* --- Carga diferida del SDK de Firebase -------------------------------- */

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-sync-sdk="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') resolve();
        else existing.addEventListener('load', resolve);
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.syncSdk = src;
      script.addEventListener('load', function () { script.dataset.loaded = '1'; resolve(); });
      script.addEventListener('error', function () { reject(new Error('No se pudo cargar ' + src)); });
      document.head.appendChild(script);
    });
  }

  function loadSdk() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = loadScript(SDK_BASE + 'firebase-app-compat.js')
      .then(function () { return loadScript(SDK_BASE + 'firebase-database-compat.js'); });
    return sdkPromise;
  }

  /* --- Subida / bajada de datos ------------------------------------------ */

  /** Sube el estado local a la nube (si hay conexión activa). */
  function pushNow() {
    if (!ref) return;
    setStatus('syncing');
    ref.set(Store.getState()).then(function () {
      setStatus('synced');
    }).catch(function (err) {
      console.error('[Sync] error al subir:', err);
      setStatus('error');
      UI.toast('No se pudieron subir los cambios a la nube.', 'error');
    });
  }

  var pushSoon = Utils.debounce(pushNow, 900);

  /** Se llama desde Store.commit() en cada cambio local. */
  function onLocalChange(fromRemote) {
    if (fromRemote || !settings.enabled || !ref) return;
    setStatus('syncing');
    pushSoon();
  }

  /** Llega un cambio desde la nube (también el primero al conectar). */
  function onRemote(snapshot) {
    var remote = snapshot.val();

    if (!remote) {
      // La nube está vacía: subimos lo que tenemos localmente.
      pushNow();
      return;
    }

    var remoteAt = Number(remote.updatedAt) || 0;
    var localAt = Number(Store.getState().updatedAt) || 0;

    if (remoteAt > localAt) {
      Store.applySnapshot(remote); // no re-sube: commit se marca como remoto
      setStatus('synced');
    } else if (localAt > remoteAt) {
      pushNow();
    } else {
      setStatus('synced');
    }
  }

  /* --- Conexión ---------------------------------------------------------- */

  function connect() {
    if (!settings.enabled || !isConfigured()) { setStatus('off'); return; }
    setStatus('connecting');

    loadSdk().then(function () {
      if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
      var db = window.firebase.database();
      ref = db.ref('mis-gastos/' + settings.code);

      ref.on('value', onRemote, function (err) {
        console.error('[Sync] error de lectura:', err);
        setStatus('error');
      });
    }).catch(function (err) {
      console.error('[Sync] no se pudo cargar el SDK:', err);
      setStatus('error');
      UI.toast('No se pudo conectar con Firebase. Revisá tu conexión.', 'error');
    });
  }

  function enable(code) {
    settings.enabled = true;
    settings.code = code;
    saveSettings();
    connect();
    UI.toast('Sincronización activada. Código: ' + code, 'success');
  }

  function disable() {
    if (ref) { try { ref.off(); } catch (e) { /* ignorar */ } ref = null; }
    settings.enabled = false;
    saveSettings();
    setStatus('off');
    UI.toast('Sincronización desactivada.', 'info');
  }

  /* --- Interfaz (botón de la cabecera) ----------------------------------- */

  function askCode(current) {
    return UI.form({
      title: 'Conectar sincronización',
      message: 'Elegí un código largo y difícil de adivinar y usá el MISMO en todos tus dispositivos. ' +
        'Funciona como contraseña (sin login): no lo compartas con nadie.',
      submitLabel: 'Conectar',
      fields: [{
        name: 'syncCode',
        label: 'Código de sincronización',
        value: current || '',
        placeholder: 'ej: ivan-gastos-7f3a9c-k2m8',
        required: true
      }]
    }).then(function (values) {
      if (!values) return;
      var code = sanitizeCode(values.syncCode);
      if (code.length < 6) {
        UI.toast('Usá un código de al menos 6 caracteres (mejor si es largo y aleatorio).', 'error');
        return;
      }
      enable(code);
    });
  }

  function openPanel() {
    if (!isConfigured()) {
      return UI.confirm({
        title: 'Sincronización en la nube',
        message: 'Falta configurar Firebase. Abrí js/core/firebase-config.js y pegá los datos ' +
          'de tu proyecto (mirá el README, sección "Sincronización entre PC y celular"). ' +
          'Después volvé a tocar este botón.',
        confirmLabel: 'Entendido',
        cancelLabel: 'Cerrar'
      });
    }

    if (!settings.enabled) return askCode('');

    return UI.choose({
      title: 'Sincronización activa',
      message: 'Código: ' + settings.code + ' · Estado: ' + statusText() + '.',
      options: [
        { label: '☁️ Sincronizar ahora', value: 'now' },
        { label: '✏️ Cambiar código', value: 'change', variant: 'ghost' },
        { label: '🚫 Desconectar', value: 'off', variant: 'danger' }
      ]
    }).then(function (choice) {
      if (choice === 'now') { pushNow(); UI.toast('Sincronizando…', 'info'); }
      else if (choice === 'change') return askCode(settings.code);
      else if (choice === 'off') disable();
    });
  }

  /* --- Arranque ---------------------------------------------------------- */

  function init() {
    loadSettings();
    setStatus(settings.enabled ? 'connecting' : 'off');

    var btn = Utils.$('btn-sync');
    if (btn) btn.addEventListener('click', openPanel);

    // Al volver la conexión, empujamos lo que haya pendiente.
    window.addEventListener('online', function () { if (settings.enabled) pushSoon(); });

    if (settings.enabled) connect();
  }

  App.Sync = {
    init: init,
    onLocalChange: onLocalChange,
    openPanel: openPanel,
    enable: enable,
    disable: disable,
    pushNow: pushNow,
    isConfigured: isConfigured,
    sanitizeCode: sanitizeCode,
    status: function () { return status; },
    settings: function () { return { enabled: settings.enabled, code: settings.code }; }
  };
})(window.App);
