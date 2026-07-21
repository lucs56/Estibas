# Reemplazo limpio del repositorio

1. Conserve únicamente la carpeta oculta `.git` de su repositorio local.
2. Elimine el resto de los archivos y carpetas del proyecto.
3. Extraiga todo el contenido de este ZIP en la raíz del repositorio.
4. Verifique que `app/api` contenga únicamente `google-sheets` y `state`.
5. Ejecute `npm run install:ci` y luego `npm run build`.
6. Publique con `git add -A`, `git commit` y `git push origin main`.

No copie `node_modules`, `dist`, `.vinext`, `.sites-runtime` ni `.wrangler`: se generan automáticamente.
