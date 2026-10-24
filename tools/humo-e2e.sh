#!/usr/bin/env bash
# Prueba de humo end-to-end del API en vivo.
# Recorre la cadena completa: login -> crear página -> guardar borrador ->
# publicar -> verla en el portal público -> eliminarla -> logout.
#
# Uso: ./tools/humo-e2e.sh [URL_BASE]
# Por defecto http://127.0.0.1:8000 (el contenedor del API).

set -euo pipefail

BASE="${1:-http://127.0.0.1:8000}"
USUARIO="admin"
CLAVE="${CLAVE_ADMIN:-admin}"
GALLETAS="$(mktemp)"
trap 'rm -f "$GALLETAS"' EXIT

SLUG="prueba-humo-$$"
FALLOS=0

paso() { printf '  \033[36m•\033[0m %s\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
mal()  { printf '  \033[31m✗ %s\033[0m\n' "$1"; FALLOS=$((FALLOS + 1)); }

json() { curl -s -b "$GALLETAS" -c "$GALLETAS" -H 'Content-Type: application/json' "$@"; }

echo "Prueba de humo contra $BASE"

# ---- login ---------------------------------------------------------------
paso "login como $USUARIO"
CUERPO=$(json -X POST "$BASE/api/auth/login" -d "{\"usuario\":\"$USUARIO\",\"contrasena\":\"$CLAVE\"}")
if echo "$CUERPO" | jq -e '.ok == true' >/dev/null; then
  ok "sesión iniciada"
else
  mal "no se pudo iniciar sesión: $CUERPO"
  echo "Prueba abortada."
  exit 1
fi
CSRF=$(json "$BASE/api/auth/me" | jq -r '.csrfToken')

# ---- crear página --------------------------------------------------------
paso "crear página /$SLUG"
CUERPO=$(json -X POST "$BASE/api/paginas" -H "X-CSRF-Token: $CSRF" \
  -d "{\"slug\":\"$SLUG\",\"titulo\":\"Prueba de humo\",\"plantilla\":\"blank\"}")
if echo "$CUERPO" | jq -e '.pagina.slug == "'"$SLUG"'"' >/dev/null 2>&1; then
  ok "página creada"
else
  mal "respuesta inesperada: $CUERPO"
fi

# ---- guardar borrador ----------------------------------------------------
paso "guardar borrador con un bloque de texto"
CUERPO=$(json -X PUT "$BASE/api/paginas/$SLUG" -H "X-CSRF-Token: $CSRF" \
  -d '{"contenido":{"blocks":[{"id":"b1","type":"richText","hidden":false,"props":{"title":"Humo","body":"<p>Contenido de la prueba de humo.</p>"}}]}}')
if echo "$CUERPO" | jq -e '.version' >/dev/null 2>&1; then
  VERSION=$(echo "$CUERPO" | jq -r '.version')
  ok "borrador guardado (versión $VERSION)"
else
  mal "respuesta inesperada: $CUERPO"
fi

# ---- el borrador NO debe verse en el portal ------------------------------
paso "el portal no muestra el borrador"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/publico/pagina?ruta=/$SLUG")
if [ "$CODIGO" = "404" ]; then
  ok "404 antes de publicar (correcto)"
else
  mal "se esperaba 404 y llegó $CODIGO"
fi

# ---- publicar ------------------------------------------------------------
paso "publicar"
CUERPO=$(json -X POST "$BASE/api/paginas/$SLUG/publicar" -H "X-CSRF-Token: $CSRF" -d "{\"version\":${VERSION:-1}}")
if echo "$CUERPO" | jq -e '.version' >/dev/null 2>&1 || echo "$CUERPO" | jq -e '.ok' >/dev/null 2>&1; then
  ok "publicada"
else
  mal "respuesta inesperada: $CUERPO"
fi

# ---- verla en el portal --------------------------------------------------
paso "el portal muestra la página publicada"
CUERPO=$(curl -s "$BASE/api/publico/pagina?ruta=/$SLUG")
if echo "$CUERPO" | jq -e '.contenido.blocks[0].props.body' >/dev/null 2>&1; then
  ok "visible públicamente"
else
  mal "no visible: $CUERPO"
fi

# ---- eliminar ------------------------------------------------------------
paso "eliminar la página de prueba"
CUERPO=$(json -X DELETE "$BASE/api/paginas/$SLUG" -H "X-CSRF-Token: $CSRF")
if echo "$CUERPO" | jq -e '.ok' >/dev/null 2>&1; then
  ok "eliminada"
else
  mal "respuesta inesperada: $CUERPO"
fi

# ---- logout --------------------------------------------------------------
json -X POST "$BASE/api/auth/logout" >/dev/null
ok "sesión cerrada"

echo
if [ "$FALLOS" -eq 0 ]; then
  echo "Resultado: TODO OK"
else
  echo "Resultado: $FALLOS fallo(s)"
  exit 1
fi
