# Gestión de Estibas y Solicitudes VE

Aplicación industrial para Fraccionamiento de vinos. Importa los archivos reales de referencia, calcula vencimientos, prioriza estibas por FEFO, sincroniza en vivo los pedidos de Google Sheets y genera la Solicitud VE en Excel, PDF e impresión.

## Alcance implementado

- Dashboard responsive con totales de estibas, botellas, vencidas, próximas, disponibles y utilizadas.
- Gráficos por estado, producto y cliente.
- Importación automática de `ESTIBAS.xlsx` sin elegir columnas ni hoja manualmente, sin límite artificial de 1.000 filas (prueba automatizada con 2.500 filas).
- Calendario fijo `Lotes_2016_2026.xlsx` con 4.018 códigos y once hojas anuales. El botón **Cargar lotes** agrega 2027, 2028 y años futuros sin borrar el histórico.
- Deducción automática del año por prefijo: `26xxx` = 2026, `25xxx` = 2025, `24xxx` = 2024; la fecha de llenado de cada hoja se obtiene de ese lote.
- La fecha de elaboración y la fecha de llenado se obtienen siempre del código de lote del calendario, no de `Fecha Fraccionam.` del reporte. El vencimiento se calcula a 90 días.
- Alertas: vencida, menos de 15 días, menos de 30 días, correcta, lote sin fecha y prefijo sin regla.
- Bloqueo de estibas vencidas, utilizadas o sin datos suficientes para producción.
- Orden FEFO y filtros por cliente, producto, línea, país, variedad, cosecha, código y lote.
- Pedidos obtenidos de los bloques **PROGRAMACIÓN LÍNEA 1, 2 y 3**, mostrando exclusivamente filas cuya acción sea **VESTIR**. La simulación conserva los datos desde `PIN°` hasta `Botellas`.
- Generación de Solicitud VE con validación de stock suficiente y selección de estibas del último reporte importado.
- Selección manual de uno o varios grupos de stock. Si un lote no alcanza, se pueden marcar otros hasta completar el pedido y destildarlos libremente; el botón automático FEFO fue retirado de la interfaz.
- Consolidación del stock por producto + lote + fecha de llenado: los códigos de barra no se presentan uno por uno; se muestra el stock total del grupo y cuánto se ocupa realmente.
- Al reimportar el reporte, los consumos de Solicitudes VE anteriores se vuelven a aplicar por producto, descripción, lote, corte y fecha. Se muestra el saldo y el detalle “ya ocupaste … para el pedido PIN° …”.
- La agrupación normaliza espacios, guiones y mayúsculas del reporte, y FEFO agota el stock consolidado del grupo antes de continuar con el lote siguiente.
- El Excel generado contiene una pestaña independiente por lote utilizado, nombrada con producto y lote, para no mezclar corte, stock ni cantidades.
- La fecha posible de vestido utiliza el primer día de la semana del programa (por ejemplo, `20/07/2026`) y la celda manual de **Cantidad de botellas** permanece vacía.
- En la plantilla, **Código** proviene de la columna `Producto` del reporte de estibas; las cajas se escriben debajo de `6` o `12` según la presentación.
- La cantidad de cajas se calcula como `botellas que se ocupan ÷ unidades por caja` y siempre se redondea hacia arriba a cajas enteras (`632 ÷ 12 = 53`).
- `Cj x` del Google Sheets es la fuente de la presentación 6/12. Si el stock disponible no cubre el pedido, se muestra el faltante pero se permite generar la solicitud para completarla con producción semanal.
- `Tapón/SC` del Sheets define el cierre: cuando contiene `Screw`, la solicitud agrega `SCREW` junto a la variedad (por ejemplo, `CHARDONNAY SCREW`).
- La vista Estibas reproduce y consolida las columnas operativas; `Fecha elaboración` muestra el valor calculado desde lotes.
- Pedidos pendientes o agregados se muestran en amarillo y se pueden tildar; los realizados quedan verdes. Generar una VE los marca automáticamente.
- Historial permite tildar solicitudes y exportar un Excel de muestras con producto, descripción, lote, corte, PIN° y solicitud.
- Las solicitudes de prueba pueden eliminarse desde Historial. La operación devuelve exactamente las botellas de cada asignación al stock y deja nuevamente el pedido como pendiente.
- La vista previa fue retirada: después de **Generar Solicitud VE** se despliega un menú para descargar Excel, descargar PDF o imprimir directamente.
- Historial conserva dos acciones independientes sobre las solicitudes seleccionadas: **Reporte de muestras** y **Generar Solicitud VE semanal**.
- El archivo semanal se llama `Solicitud de VE Sem dd-mm-aaaa.xlsx`, contiene el formulario completo y crea una pestaña amarilla por combinación de vino/lote. Los nombres repetidos reciben `(2)`, `(3)`, etc. automáticamente.
- Acceso interno inicial `admin` / `1234`, alta y eliminación de usuarios con contraseña y cierre de sesión.
- Exportación a Excel sobre la plantilla original, PDF e impresión.
- Historial buscable por fecha, cliente, PN y lote, con reexportación.
- Administración de catálogos, usuarios, roles y parámetros de vencimiento.
- Auditoría de importaciones, sincronizaciones, cambios y solicitudes.
- Inicio de sesión interno con credenciales, roles, cierre de sesión y persistencia durable; las contraseñas se guardan como hash SHA-256.

## Datos reales analizados

| Fuente | Resultado detectado |
|---|---|
| `ESTIBAS(1)(1).xlsx` | Hoja `Reporte`, 30 columnas y 601 estibas válidas |
| `Lotes_2016_2026.xlsx` | 11 hojas, 4.018 códigos, de 2016 a 2026 |
| Solicitud VE | Hoja `ALAMOS WOTM SB`, formulario R1 IB 03, Rev. 07 |
| Google Sheets | Tres pestañas semanales y 76 columnas; encabezado en fila 4 |

Con fecha de control 18/07/2026, el reporte real produce: 352 vencidas, 10 con menos de 15 días, 26 con menos de 30 días, 193 correctas y 20 con prefijo `027`, para el cual no se recibió una regla. Los lotes de años anteriores ya no dependen de importar un archivo separado: el año y el día juliano se deducen automáticamente del código `AATTT`.

## Arquitectura

```text
React / Vinext
  ├─ importadores configurables de Excel
  ├─ motor de vencimientos y FEFO
  ├─ generador Excel / PDF / impresión
  └─ cliente REST
          │
          ├─ despliegue web: API Vinext + D1 (SQLite compatible)
          └─ red interna: FastAPI + SQLAlchemy + SQLite/PostgreSQL
```

Las reglas de negocio viven en `lib/`, separadas de las pantallas. La persistencia se consume mediante el mismo contrato `/api/state` en ambos backends. Para la simulación se guarda un estado versionado; el repositorio FastAPI está aislado detrás de una interfaz para poder normalizar tablas o cambiar de SQLite a PostgreSQL sin modificar React.

## Estructura principal

```text
app/                     interfaz, autenticación y API del despliegue web
components/screens/      dashboard, estibas, pedidos, VE, historial y administración
lib/expiry.ts            reglas de vencimiento y fechas de lote
lib/importers.ts         detección automática e importación de Excel
lib/exporters.ts         Excel sobre plantilla original y PDF
lib/server/              persistencia D1 del despliegue web
backend/app/api/         rutas FastAPI
backend/app/services/    casos de uso
backend/app/repositories repositorio SQLAlchemy
backend/app/db/          modelo y sesión SQLite/PostgreSQL
db/ + drizzle/           esquema y migración D1
public/examples/         los tres archivos de referencia listos para probar
tests/                   pruebas de reglas, importación real y renderizado
```

## Ejecutar la interfaz y el backend web integrado

Requisitos: Node.js 22.13 o superior y npm.

```bash
npm ci
npm run dev
```

Abrir la URL indicada por Vite. En desarrollo local se utiliza una identidad de simulación. En el despliegue interno, el acceso requiere inicio de sesión y la identidad se obtiene de los encabezados seguros del entorno.

Comandos útiles:

```bash
npm run lint
npm test
npm run build
npm run db:generate
```

## Ejecutar con FastAPI y SQLite

Requisitos: Python 3.12 o superior. Desde la raíz del proyecto:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
cp .env.example .env
PYTHONPATH=. python scripts/create_db.py
uvicorn app.main:app --reload --port 8000
```

En otra terminal, desde la raíz:

```bash
printf 'NEXT_PUBLIC_API_BASE_URL=http://localhost:8000\n' > .env.local
npm run dev
```

La documentación OpenAPI queda disponible en `http://localhost:8000/api/docs` y el control de salud en `http://localhost:8000/api/health`.

Para PostgreSQL sólo se cambia `DATABASE_URL`, por ejemplo:

```text
DATABASE_URL=postgresql+psycopg://usuario:clave@servidor/estibas
```

## Flujo de prueba completo

1. Ingresar en **Estibas**.
2. El calendario 2016–2026 ya está incorporado. Pulsar **Cargar reporte** para importar `ESTIBAS.xlsx`; **Cargar lotes** queda para agregar años futuros.
3. Revisar los totales, estados, fechas calculadas y filtros. Las columnas desconocidas quedan preservadas como datos adicionales.
4. Ingresar en **Pedidos**, elegir la semana y revisar por separado las líneas 1, 2 y 3. Sólo se muestran productos con acción `VESTIR`.
5. Elegir un producto del programa para abrir la Solicitud VE con su `PIN°`, código, cliente, presentación, cajas y botellas.
6. Pulsar **Asignar por FEFO**. El sistema toma el lote más antiguo y continúa con los siguientes hasta cubrir el pedido; el desglose puede revisarse antes de generar.
7. Cuando el stock cubra el pedido, generar la solicitud.
8. Descargar Excel o PDF, imprimir y comprobar el registro en **Historial**.
9. Recargar la aplicación para verificar que inventario, solicitudes, usuarios, parámetros y auditoría permanecen guardados.

## Publicación en Cloudflare

El proyecto está preparado para Cloudflare Workers mediante Vinext, Vite y Wrangler. El paquete ZIP incluye el frontend, la API, la migración D1, el backend FastAPI alternativo, ejemplos y documentación. Para una cuenta Cloudflare propia se deben instalar dependencias, crear/vincular la base D1 y desplegar con Wrangler siguiendo `CLOUDFLARE_DEPLOY.md`.

## Detección automática de columnas

El importador recorre todas las hojas y las primeras 40 filas para localizar la tabla con mejor coincidencia. Los encabezados se normalizan sin depender de mayúsculas, tildes, puntuación ni posición. Los sinónimos se concentran en `FIELD_ALIASES`; agregar una nueva denominación de origen no obliga a cambiar el motor ni las pantallas. Toda columna no reconocida se conserva en `extraData` junto con archivo y fila de origen.

La plantilla VE sí posee posiciones de formulario propias. Esas coordenadas están encapsuladas exclusivamente en `lib/exporters.ts`; se carga el Excel original y se sustituyen los valores sin reconstruir ni degradar su formato. La cantidad se ubica en mercado interno o mercado externo (6/12 unidades) según corresponda y el campo **Responsable queda vacío**.

## Google Sheets

La simulación utiliza una instantánea validada de las filas `VESTIR` y los encabezados reales observados en el documento. El lector `lib/sheet-program.ts` detecta dinámicamente los límites de cada línea y no depende de números de fila fijos:

- `Sem 13-07 al 17-07`
- `Sem 20-07 al 24-07`
- `TENTATIVO Sem 27-07 al 31-07`

El ID y el GID se administran desde **Administración → Configuración**, no están repartidos por el código. En la pantalla **Pedidos**, el libro se actualiza automáticamente cada 30 segundos mientras la pestaña está visible; el botón **Actualizar programación** permite hacerlo inmediatamente. Ambas lecturas descargan nuevamente el libro con caché desactivada. La planilla debe permitir lectura mediante enlace; no se incluyen credenciales en el repositorio.

## Seguridad

- Acceso web mediante usuario y contraseña internos; perfil inicial `admin` / `1234`.
- Roles modelados: Administrador, Supervisor y Operario.
- Usuario activo y rol visibles en la interfaz.
- Escrituras de la API atribuidas al correo autenticado.
- Auditoría de acciones operativas.
- Sin contraseñas, tokens ni credenciales de Google dentro del código.

Para la instalación definitiva se recomienda vincular los roles a un directorio corporativo y aplicar autorización por operación en las rutas normalizadas de recursos.

## Decisiones pendientes para conectar producción

Antes del corte definitivo hacen falta estas definiciones de negocio o acceso:

1. regla de elaboración/vencimiento para los códigos que comienzan con `027`;
2. credencial de sólo lectura para Google Sheets;
3. confirmación de qué columnas del reporte representan país, variedad y cosecha cuando no vienen explícitas;
4. validación final de una Solicitud VE exportada por Producción, Calidad y Legales.

Ninguna de esas ausencias se oculta: los registros afectados aparecen como bloqueados y con su causa visible.
