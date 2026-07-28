# Cambios V21 — guardado confirmado de Solicitud VE

## Corrección principal

La generación de una Solicitud VE ahora se confirma como una única operación
en la base compartida:

1. guarda la solicitud en Historial;
2. descuenta las botellas de las estibas asignadas;
3. marca el pedido correspondiente como realizado y lo muestra en verde.

Los botones para descargar Excel, PDF o imprimir aparecen únicamente después de
que la base confirma las tres acciones.

## Controles agregados

- Si el stock o el pedido cambiaron en otra PC, la solicitud no se guarda de
  forma parcial y se pide actualizar antes de reintentar.
- Si la base devuelve un error o una página no válida, se muestra un mensaje
  claro y no se habilita la descarga.
- El pedido se vincula por su identificador de origen y, como respaldo, por PIN°
  y código normalizados.
- Una base D1 nueva se inicializa antes de habilitar la generación.
- Se evita reutilizar silenciosamente un número de solicitud existente.

## Compatibilidad

- No modifica ni elimina el historial existente.
- No requiere una migración nueva de D1.
- Mantiene los cambios anteriores de Rev. 08, reporte de muestras, stock
  histórico, lotes y administración.
