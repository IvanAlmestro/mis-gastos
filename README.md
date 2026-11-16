# 💸 Mis Gastos — Panel de presupuesto para estudiantes

Aplicación web local (**SPA**) para controlar los gastos personales y el presupuesto
mensual que un estudiante recibe de su familia.

Funciona directamente en el navegador, sin backend ni base de datos: **todos los datos
se guardan en `localStorage`** y se pueden respaldar/restaurar con un archivo JSON.

---

## ▶️ Cómo ejecutarla

**Opción 1 (la más simple):** abrí `index.html` con doble clic en tu navegador.
Los scripts son clásicos (no módulos ES) justamente para que `file://` funcione sin servidor.

**Opción 2 (recomendada para desarrollo):** levantá un servidor estático.

```bash
# con Python
python3 -m http.server 8080

# o con Node
npx serve .
```

Luego abrí <http://localhost:8080>.

> Requiere conexión a internet la primera vez, porque Tailwind CSS, Chart.js y la tipografía
> Inter se cargan por CDN. Sin conexión, la app sigue funcionando pero sin estilos ni gráfico
> (las estadísticas muestran un aviso amable).

---

## 📁 Estructura de archivos

```
.
├── index.html              # Marcado de la SPA: cabecera, pestañas y las 4 vistas
├── css/
│   └── styles.css          # Componentes propios (cards, botones, chips, modales, toasts…)
└── js/
    ├── core/               # Motor de la app (no depende de las pantallas)
    │   ├── utils.js        # Funciones puras: fechas, moneda es-AR, ids, escape de HTML
    │   ├── store.js        # Estado central + persistencia en localStorage + backup
    │   ├── ui.js           # Toasts y modales reutilizables (confirm / choose / form)
    │   ├── charts.js       # Envoltorio de Chart.js (torta y barras horizontales)
    │   ├── theme.js        # Modo claro / oscuro (preferencia guardada + preferencia del SO)
    │   ├── firebase-config.js  # ⚙️ Tus credenciales de Firebase (lo completás vos)
    │   └── sync.js         # Sincronización opcional entre dispositivos (Firebase)
    ├── views/              # Una pantalla por archivo
    │   ├── budget.js       # Vista 1 · Resumen de balance + ingresos
    │   ├── expenses.js     # Vista 2 · Anotador rápido de gastos + historial
    │   ├── stats.js        # Vista 3 · Estadísticas y diagnósticos
    │   └── bills.js        # Vista 4 · Agenda de vencimientos
    └── app.js              # Arranque, navegación, selector de mes y backup
```

Cada archivo de `js/` es un **módulo** que se registra en el namespace global `App`
(patrón IIFE), por lo que no hay dependencias de build y el orden de carga es explícito
en `index.html`. `core/` es el motor y `views/` las pantallas.

---

## ✨ Funcionalidades

### 1. Resumen de balance (presupuesto mensual)
- Registro de **ingresos** con concepto, monto, fecha y nota.
- Tarjetas en tiempo real:
  - **Dinero disponible total** → todos los ingresos menos todos los gastos (tu plata real).
  - **Total gastado en el mes** → con la cantidad de movimientos.
  - **Saldo restante del mes** → con **barra de progreso que cambia de color**
    (verde → ámbar → naranja → rojo según cuánto presupuesto queda).
- **Filtro por mes/año** (selector + botones ‹ › + botón *Hoy*) para revisar meses anteriores.
- El presupuesto del mes se calcula como la suma de los ingresos de ese mes.

### 2. Anotador rápido de gastos
- Formulario pensado para cargar un gasto en segundos: descripción, monto,
  fecha (por defecto hoy), categoría y medio de pago.
- **Categorías predefinidas** con ícono y color:
  *Alimentación / Súper, Facturas / Servicios, Transporte, Universidad / Apuntes,
  Salidas / Ocio, Salud / Deporte, Otros*.
- **Chips de categoría** para seleccionar con un clic y **crear categorías propias**
  (nombre, emoji y color). Las categorías propias se pueden eliminar (sus gastos pasan a *Otros*).
- **Medios de pago**: Efectivo, Débito / Transferencia, Mercado Pago / Billetera.
- Historial con **buscador** (descripción, categoría o medio de pago), **filtro por categoría**
  y botones de **editar** y **eliminar**.

### 3. Estadísticas para recortar gastos
- Gráfico **Chart.js** con el monto y el porcentaje por categoría, con dos modos:
  **🍩 torta** y **📊 barras horizontales**.
- Desglose numérico con barras de proporción.
- Tres tarjetas de diagnóstico rápido:
  - **Top gastos más grandes** → los 3 gastos individuales más altos del mes.
  - **Categoría más frecuente** → la de mayor cantidad de transacciones (gastos hormiga),
    con el promedio por compra.
  - **Categoría de mayor impacto** → la que consume el mayor porcentaje del presupuesto.

### 4. Agenda de vencimientos
- Alta de vencimientos con **servicio/concepto**, **monto estimado**, **fecha** y
  **estado** (Pendiente / Pagado).
- **Alertas visuales automáticas**: etiqueta **amarilla** si vence dentro de los próximos
  5 días, **roja** si está vencido, y un contador en la pestaña con lo que requiere atención.
- Botón **“✓ Pagar”** que pregunta si querés **descontar automáticamente el monto como gasto**
  en la categoría *Facturas / Servicios*. También se puede deshacer el pago (y elimina el gasto asociado).
- Resumen de total pendiente, vencidos y próximos a vencer.

### Extras
- **Modo oscuro** completo (ver más abajo).
- **Sincronización opcional** entre PC y celular con Firebase (botón **☁️**; ver más abajo).
- **Exportar / Importar backup JSON** desde la cabecera (con confirmación antes de reemplazar datos).
- Atajos de teclado **1–4** para cambiar de vista y **D** para alternar el tema.
- Diseño responsive, estados vacíos cuidados y notificaciones (toasts).

---

## 🌙 Modo oscuro

- Botón **🌙 / ☀️** en la cabecera para alternar el tema; también con la tecla **D**.
- La preferencia se guarda en `localStorage` (clave `gastos-estudiante:theme`) y se
  aplica **antes de pintar** para evitar el destello blanco al cargar.
- Si nunca elegiste un tema, la app **sigue la preferencia del sistema operativo** y
  reacciona en vivo si el SO cambia de claro a oscuro.
- Los gráficos de Chart.js, los controles nativos (`date`, `month`, `checkbox`) y los
  `scrollbars` también se adaptan al tema.
- Implementado con la clase `dark` en `<html>`: utilidades `dark:` de Tailwind +
  variables CSS propias en `css/styles.css`.

---

## 🚀 Publicarlo gratis (y usarlo desde el celular y la PC)

La app es **100 % estática** (`index.html` + `css/` + `js/`), así que se puede hostear
gratis en cualquiera de estas dos opciones. En ambas, cada `git push` **vuelve a
desplegar automáticamente**, es decir, la app se mantiene actualizada sola.

### Opción A · Vercel (la más simple)
1. Subí el proyecto a un repositorio de GitHub.
2. Entrá a <https://vercel.com>, iniciá sesión con GitHub y elegí **Add New → Project**.
3. Seleccioná el repositorio. Vercel detecta que es un sitio estático: **no cambies**
   el *Framework Preset* (dejalo en *Other*) y dejá vacío el *Build Command*.
   El *Output Directory* es la raíz (`.`).
4. **Deploy**. Te queda una URL tipo `https://mis-gastos.vercel.app` accesible desde
   cualquier dispositivo.

### Opción B · GitHub Pages (recomendada)
El repo ya incluye el workflow `.github/workflows/deploy-pages.yml` y `.nojekyll`.

1. Creá un repositorio en GitHub (vacío, sin README/licencia inicial para evitar conflictos).
2. En tu máquina, dentro del proyecto:
   ```bash
   git remote add origin https://github.com/<tu-usuario>/<tu-repo>.git
   git push -u origin main
   ```
   (El proyecto ya está inicializado en la rama `main`.)
3. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Cada push a `main` publica automáticamente la app en:
   `https://<tu-usuario>.github.io/<tu-repo>/`.

> Si tu rama por defecto fuera `master`, cambiá `branches: [main]` en el workflow. El
> archivo `.nojekyll` evita que Jekyll interfiera con las carpetas `css/` y `js/`.

### ☁️ Sincronización entre PC y celular
Por defecto **no** hay sincronización: `localStorage` es **por navegador y por
dispositivo**, así que lo que cargás en el celular no aparece en la PC (y viceversa).
La app trae lista una sincronización **gratuita con Firebase** para resolverlo, explicada
en la sección siguiente. Si no la configurás, seguís moviendo datos con
**Exportar / Importar JSON** desde la cabecera.

---

## ☁️ Sincronización entre PC y celular (Firebase)

La app puede mantener los datos iguales en todos tus dispositivos usando
**Firebase Realtime Database** (plan gratuito *Spark*), sin backend propio.

### Cómo se usa (una vez configurado)
1. En cada dispositivo, tocá el botón **☁️** de la cabecera.
2. Escribí el **mismo código** en todos (ej: `ivan-gastos-7f3a9c`). Es como una
   contraseña: **no lo compartas**.
3. Listo. Los cambios se suben solos y bajan en el otro dispositivo. El ícono muestra el
   estado: ✅ sincronizado · 🔄 subiendo · ⏳ conectando · ⚠️ error · ☁️ desactivado.

Resolución de conflictos: gana el **último cambio** (se compara `updatedAt`). Para una
persona usando 2 dispositivos alcanza y sobra.

### Configurar Firebase (5 minutos, una sola vez)
1. Entrá a <https://console.firebase.google.com> y **creá un proyecto** (podés desactivar
   Google Analytics).
2. **Build → Realtime Database → Create Database**. Elegí una región y creala (podés empezar
   en modo bloqueado; vas a pegar las reglas abajo).
3. **Project settings (⚙️) → General → Your apps**: agregá una app **Web (`</>`)** y copiá
   el objeto `firebaseConfig`.
4. Pegá esos valores en **`js/core/firebase-config.js`** (imprescindible: `databaseURL`,
   con forma `https://<proyecto>-default-rtdb.firebaseio.com`).
5. En Realtime Database, pestaña **Rules**, usá unas reglas acotadas al nodo de la app y con
   validación mínima (no hay login, así que la protección real es tu **código secreto**):

   ```json
   {
     "rules": {
       ".read": false,
       ".write": false,
       "mis-gastos": {
         "$code": {
           ".read": "$code.matches(/^[a-z0-9-]{6,64}$/)",
           ".write": "$code.matches(/^[a-z0-9-]{6,64}$/)"
         }
       }
     }
   }
   ```

   > Esto limita acceso al espacio `mis-gastos/<código>` y exige la estructura esperada, pero
   > **no reemplaza autenticación**: cualquiera que conozca la URL de la base **y** tu código
   > podría leer/escribir ese nodo. Usá un código **largo y aleatorio** (no compartido).
   > Para seguridad fuerte, el siguiente paso es sumar **Firebase Auth** y reglas por usuario.

6. Hacé commit y `git push` para que GitHub Pages publique la config. Luego, en PC y celu,
   abrí la app, tocá **☁️** y cargá el **mismo código**.

### Privacidad
Con esto, los datos viajan a los servidores de Google (Firebase). Si preferís que **no
salgan de tu dispositivo**, no configures esta sección: la app sigue siendo 100 % local.

---

## 🗃️ Modelo de datos (`localStorage` → clave `gastos-estudiante:v1`)

```json
{
  "version": 1,
  "updatedAt": 1794861374900,
  "categories": [{ "id": "alimentacion", "name": "Alimentación / Súper", "icon": "🛒", "color": "#10b981", "custom": false }],
  "incomes":  [{ "id": "inc_x", "date": "2026-11-01", "amount": 150000, "concept": "Transferencia mensual", "note": "" }],
  "expenses": [{ "id": "exp_y", "date": "2026-11-03", "amount": 18000, "description": "Súper", "categoryId": "alimentacion", "method": "Débito / Transferencia", "billId": null }],
  "bills":    [{ "id": "bill_z", "name": "Internet", "amount": 12000, "dueDate": "2026-11-20", "status": "pendiente", "paidAt": null, "expenseId": null }]
}
```

Al importar, el estado se **normaliza**: se garantizan las categorías por defecto y
cualquier gasto con una categoría inexistente se reasigna a *Otros*. El campo `updatedAt`
(marca de tiempo del último cambio) es el que usa la sincronización para decidir qué
versión gana.

---

## 🧱 Decisiones técnicas

- **Sin build step.** Tailwind por CDN + Chart.js por CDN + JS clásico modular.
  Así la app se abre con doble clic y no hay `npm install` ni bundler.
- **Un solo origen de verdad.** Todo cambio de datos pasa por `Store.commit()`, que
  persiste en `localStorage` y notifica a la UI. Ningún módulo escribe el estado directamente.
- **Re-render por vista.** Al cambiar de datos solo se vuelve a pintar la vista activa,
  lo que evita perder el foco mientras se escribe en el buscador.
- **Modales con Promesas.** `UI.confirm()`, `UI.choose()` y `UI.form()` devuelven promesas,
  lo que hace que los flujos (confirmar borrado, preguntar si descontar un pago, crear una
  categoría) se lean de forma lineal.
- **Escapado de HTML** en todo texto ingresado por el usuario (`Utils.escapeHtml`).
- **Montos con `Intl.NumberFormat('es-AR')`** y redondeo a 2 decimales para evitar errores
  de coma flotante.

---

## 🧪 Verificación

Se corrió una batería de pruebas de humo con `jsdom` sobre el `index.html` real,
cubriendo las 4 vistas: alta/edición/borrado de gastos e ingresos, buscador y filtros,
creación de categorías propias, gráfico y diagnósticos, alertas y pago de vencimientos
(con descuento automático y deshacer), navegación de meses, persistencia, backup/import,
el **modo oscuro** (toggle, persistencia, recoloreo del gráfico, icono/ARIA y atajo `D`) y
la **sincronización** (botón, degradación elegante sin configurar y saneado del código).
