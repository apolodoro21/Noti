# Noti 3.0 — cambios de esta entrega

## Archivos modificados

### `index.html`
- Se eliminó del encabezado de la app el texto “Organización Personal”.
- El encabezado ahora muestra únicamente `Noti` y el nombre del usuario activo, sin “Hola”.
- Se agregó el botón 🔧 de ajustes.
- Se agregó el panel de ajustes con idioma, tema y paletas.
- Se amplió la barra del editor con tamaño, resaltador y tachado.
- Se agregó la insignia de versión fija `v3.0`.

### `styles.css`
- Se añadieron estilos para modo claro y oscuro.
- Se añadieron 5 paletas suaves y variables de acento/borde.
- Se añadieron las 7 nuevas familias tipográficas.
- Se añadieron estilos para el panel de ajustes y sus selectores.
- Se mantuvo el diseño responsive existente.

### `app.js`
- Se añadió traducción Español/English para la interfaz.
- Se añadió persistencia local y sincronización de preferencias en `profiles.settings`.
- Se mantuvo la sesión de Supabase existente y la sincronización de notas, dibujos y horarios.
- Se añadieron 7 tipografías nuevas: Arial, Helvetica, Times New Roman, Garamond, Trebuchet MS, Verdana y Courier New.
- Se añadió tamaño de texto de 10 a 48 px para texto seleccionado.
- Se añadió resaltador amarillo suave fijo.
- Se añadió tachado mediante el comando reversible del editor.

### `SUPABASE_MIGRACION.sql`
- Se agregó `profiles.settings` como `jsonb` para guardar preferencias por usuario.

### `sw.js`
- El caché pasó de `noti-v2` a `noti-v3` para que GitHub Pages no conserve los archivos anteriores.

### `README.md`
- Se actualizaron las funciones y las instrucciones de publicación.

## Migración requerida

Ejecuta `SUPABASE_MIGRACION.sql` una sola vez en el SQL Editor de Supabase. Si no lo haces inmediatamente, la aplicación conserva una copia local de las preferencias y no se rompe el login ni la sincronización existente de notas, dibujos y horarios.

## Versión

**3.0** — se asigna versión principal porque esta entrega incorpora funciones nuevas importantes: panel de ajustes con preferencias persistentes, idioma, temas/paletas y una ampliación sustancial del editor de texto.
