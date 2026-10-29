# GastónGastín 🐉

App de finanzas personales y del hogar para iPhone. Funciona como una app instalada (sin App Store), **sin internet**, sin cuentas y sin servidor: todos los datos viven solo en tu iPhone.

## ⚠️ Lo más importante

- **Usa siempre el ícono instalado.** En iOS, los datos que anotas en Safari y los de la app instalada se guardan en lugares distintos.
- **Respalda seguido.** Si borras la app o los datos del sitio, se pierde todo lo que no esté respaldado. La app te avisa cuando toca (Más → Respaldo y exportación).
- Este repositorio es público, pero **no contiene ningún dato tuyo**: los datos nunca salen del teléfono.

## Instalar en el iPhone (una sola vez)

1. Abre **Safari** (no Chrome) en el iPhone.
2. Entra a la dirección de la app: `https://TU-USUARIO.github.io/app-finanzas/`
3. Espera a que cargue por completo (con internet, solo esta primera vez).
4. Toca el botón **Compartir** (el cuadrado con una flecha hacia arriba, abajo al centro).
5. Baja en el menú y toca **«Añadir a pantalla de inicio»**.
6. Toca **Añadir** (arriba a la derecha).
7. Cierra Safari. Desde ahora abre GastónGastín **solo** con el ícono del dragoncito.

## Primeros pasos dentro de la app

1. **Crea tu PIN** cuando la app lo ofrezca (4 a 6 dígitos). Se pide al abrir y al volver a la app.
2. Ve a **Más → Ajustes** y completa: presupuesto mensual por tipo de gasto, cupo de tu tarjeta y, si quieres, el porcentaje de reparto con Pollo (50% por defecto).
3. Registra tu **sueldo** con el botón **+** → Ingreso.
4. Registra tus **servicios** del mes (arriendo, gastos comunes, agua, internet, suscripciones). El mes siguiente puedes usar **«Copiar del mes anterior»** y corregir los montos.
5. Haz tu **primer respaldo**: Más → Respaldo y exportación → **Crear respaldo** → «Guardar en Archivos» (idealmente en iCloud Drive).

## Cómo registrar en la feria (sin señal)

1. Toca **+** → **Compra rápida**.
2. Escribe el producto. Si ya lo compraste antes, aparece en sugerencias; al elegirlo se completan marca, formato y categoría, y ves **último precio, promedio de 12 meses, lugar más barato y más caro**.
3. Productos a granel: contenido **1 kg** y en **Cantidad** los kilos (por ejemplo 1,5).
4. Usa **«Guardar y anotar otra»** para seguir con el siguiente producto.

## Qué incluye

- Resumen del mes con ahorro, responsabilidades de cada uno y control de auditoría ($0).
- Compras de la casa (50/50) y personales, servicios y gastos fijos, ingresos y compras en cuotas (primera cuota el último día del mes de compra).
- Presupuesto vs real por tipo con semáforos (🟢 < 70%, 🟡 desde 70%, 🔴 desde 95%; configurables) y comparación con tu promedio histórico.
- Cuadre Iván–Pollo, tarjeta de crédito y cupo disponible.
- Tabla Maestra de precios que se alimenta sola, con historial, gráfico de evolución y comparación entre lugares.
- Despensa con stock, mínimo con alerta «se acaba» y lista de compras automática.
- Hormigas y suscripciones (cuánto ahorrarías eliminando cada una), etiquetas de gustos y mascota.
- Dashboard de 12 meses, proyección de ahorro y estacionalidad de precios.
- Herramienta para unir productos duplicados («Leche» y «Lecha»).
- Exportación a un único Excel (.xlsx) con una hoja por tabla, y respaldo para restaurar.
- Modo claro y oscuro según el iPhone.

## Restaurar en otro iPhone

1. Instala la app en el nuevo iPhone (pasos de arriba).
2. Más → Respaldo y exportación → **Restaurar desde respaldo** → elige el archivo `.json`.

## Actualizar la app

Cuando se suban archivos nuevos a este repositorio, la app se actualiza sola: ábrela con internet, ciérrala por completo y vuelve a abrirla. Tus datos no se tocan.

## Archivos

Todo está en la raíz, sin dependencias externas: `index.html`, `styles.css`, `core.js` (cálculos y base de datos local), `charts.js` (gráficos), `xlsx.js` (Excel), `app.js` (pantallas), `sw.js` (modo sin conexión), `manifest.webmanifest` e íconos.
