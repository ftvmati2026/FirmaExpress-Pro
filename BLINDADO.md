# Repo Blindado (FirmaExpress Pro)

Objetivo: que siempre exista un punto "100% OK" al que puedas volver en 1 click con GitHub Desktop, aunque alguien rompa cosas.

## Regla de Oro

El branch `stable` es el que siempre tiene la versión funcionando.

No se programa directo en `stable`.

## Flujo Diario (GitHub Desktop)

1. Checkout `stable`
2. Branch -> New branch... (por ejemplo `feat/posicion-firma`)
3. Hacé los cambios
4. Commit (chiquitos y con mensaje claro)
5. Si algo sale mal: checkout `stable` y listo (vuelve a funcionar)
6. Si quedó bien y querés “publicar” lo nuevo:
   - Merge el branch a `main`
   - Probá que todo siga bien
   - Recién ahí: actualizar `stable` para que apunte a lo último bueno

## Cómo Actualizar `stable` (cuando todo anda perfecto)

En GitHub Desktop:

1. Checkout `main`
2. Branch -> Update from main... (si aparece)
3. Checkout `stable`
4. Branch -> Merge into current branch... -> elegir `main`
5. Push `stable`

Si en tu versión de Desktop no ves exactamente los mismos menús, decime cuál ves y te lo traduzco 1:1.

## Botón de Pánico (Volver a estar OK)

En cualquier momento:

1. Checkout `stable`
2. (Opcional) Discard changes si estabas con archivos modificados

Eso te deja el sistema tal como estaba en la última versión “OK”.

