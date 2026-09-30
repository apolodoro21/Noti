# Noti — PWA

Aplicación web instalable y responsive para Android/PC, con sincronización mediante Supabase y copia local.

## Noti 3.0
- Navegación Lunes–Viernes y Sábado–Domingo.
- Horario editable por día.
- Notas por día con negrita, checklist, tachado y resaltador amarillo suave.
- 10 tipografías disponibles: 3 existentes + 7 nuevas.
- Tamaño de texto de 10 a 48 px para texto seleccionado.
- Lienzo de dibujo con color, grosor, borrador y limpieza.
- Ajustes con idioma Español/English.
- Modo claro u oscuro.
- 5 paletas suaves: Azul, Lavanda, Menta, Durazno y Rosa.
- Preferencias guardadas por usuario en Supabase, con copia local.
- Versión visible permanentemente en la esquina inferior derecha: v3.0.
- Login y sesión con Supabase conservados.
- PWA con caché offline mediante Service Worker.

## Importante: migración de Supabase

Antes de usar la sincronización de preferencias entre dispositivos, ejecuta una sola vez el archivo `SUPABASE_MIGRACION.sql` en **Supabase → SQL Editor → New query**.

La migración agrega `profiles.settings` como `jsonb`. Si todavía no ejecutas la migración, Noti seguirá funcionando con copia local y no se rompe el login ni la sincronización existente de notas, dibujos y horarios.

## Publicar en GitHub Pages

1. Reemplaza en tu repositorio los archivos por los de este ZIP, manteniendo la carpeta `icons/`.
2. Si ya tienes el repositorio de Noti, no crees otro proyecto: sube estos archivos sobre los existentes.
3. Ejecuta `SUPABASE_MIGRACION.sql` una sola vez en el proyecto Supabase que ya utiliza Noti.
4. Publica/actualiza GitHub Pages.
5. Si el navegador conserva una versión anterior, el Service Worker de Noti 3.0 usa el caché `noti-v3` para forzar la actualización de los archivos de la aplicación.

## Archivos principales

- `index.html`: estructura de la interfaz, encabezado, editor y panel de ajustes.
- `styles.css`: tema claro/oscuro, paletas, bordes, responsive y estilos del editor.
- `app.js`: lógica de Noti, Supabase, preferencias, traducciones y editor.
- `SUPABASE_MIGRACION.sql`: migración necesaria para sincronizar preferencias por usuario.
- `sw.js`: Service Worker; actualizado a caché `noti-v3`.
- `manifest.webmanifest`: configuración PWA.
- `icons/`: iconos existentes de Noti.
