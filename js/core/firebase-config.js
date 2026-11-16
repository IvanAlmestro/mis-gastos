/* =========================================================================
   firebase-config.js · Configuración de Firebase (sincronización)
   -------------------------------------------------------------------------
   Pegá acá los datos de TU proyecto de Firebase. El campo imprescindible
   es `databaseURL` (Realtime Database). El resto los pide el SDK web, pero
   para esta app (sin Firebase Auth/Storage/FCM) pueden quedar vacíos.

   Pasos completos en README.md → "Sincronización entre PC y celular".
   IMPORTANTE: no pegues claves/secretos ajenos a la config pública del SDK
   web de Firebase (esta config es identificatoria del proyecto; la
   protección real depende de las reglas de la base de datos y de tu código
   de sincronización).

   Si dejás `databaseURL` vacío, la app funciona igual: el botón ☁️ queda
   desactivado y seguís usando localStorage + backup/import manual.
   ========================================================================= */
window.FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  databaseURL: 'https://mis-gastos-67b8d-default-rtdb.firebaseio.com',
  projectId: 'mis-gastos-67b8d',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};
