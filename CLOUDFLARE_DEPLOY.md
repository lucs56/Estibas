# Publicación en Cloudflare

## Requisitos

- Node.js 22.13 o superior
- Cuenta de Cloudflare con Workers y D1 habilitados
- Wrangler autenticado (`npx wrangler login`)

## Preparación

```bash
npm ci
npm run lint
npm test
npm run build
```

Los scripts se invocan mediante `bash`, por lo que la compilación funciona también cuando el proyecto se cargó a GitHub desde la interfaz web y se perdieron los permisos ejecutables de los archivos `.sh`.

Crear una base D1 para producción:

```bash
npx wrangler d1 create gestion-estibas-ve
```

Guardar el `database_id` devuelto. Aplicar la migración incluida:

```bash
npx wrangler d1 execute gestion-estibas-ve --remote --file drizzle/0000_petite_vertigo.sql
```

## Despliegue

La salida validada se genera en `dist/`. Publicar indicando el nombre y el identificador reales de D1; el build genera automáticamente la configuración final del Worker y sus assets:

```bash
CLOUDFLARE_D1_DATABASE_NAME=gestion-estibas-ve \
CLOUDFLARE_D1_DATABASE_ID=PEGAR_DATABASE_ID \
npm run deploy:cloudflare
```

Mantener el binding D1 con el nombre `DB`, que es el utilizado por la API.

No subir credenciales de Google ni secretos al repositorio. Configurarlos como secretos del Worker. Para operar con PostgreSQL/FastAPI fuera de Cloudflare, seguir las instrucciones principales de `README.md`.
