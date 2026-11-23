#!/usr/bin/env python3
"""Convierte los campos icono del catálogo en desplegables de la lista blanca.

Recorre `cms/blocks.json` y, en los tipos que usan icono (`stats`, `accesos`),
cambia cada campo `icon`/`icono` a `type: "select"` con las opciones de
`frontend/src/app/cms/iconos.ts` (ICONOS). Así el editor muestra un desplegable
y el visitante solo recibe iconos de la lista blanca.

Uso:  python3 tools/sincronizar-iconos.py && python3 tools/generar-bloques.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICONOS_TS = ROOT / "frontend" / "src" / "app" / "cms" / "iconos.ts"
BLOQUES = ROOT / "cms" / "blocks.json"
TIPOS_CON_ICONO = ("stats", "accesos")


def opciones_icono() -> list[dict]:
    """Nombre y etiqueta de cada icono declarado en ICONOS, en el mismo orden."""
    ts = ICONOS_TS.read_text(encoding="utf-8")
    cuerpo = ts.split("export const ICONOS = {")[1].split("} as const")[0]
    iconos = re.findall(r"(\w+): '([^']+)'", cuerpo)
    return [{"value": "", "label": "Sin icono"}] + [
        {"value": nombre, "label": etiqueta} for nombre, etiqueta in iconos
    ]


def main() -> None:
    opciones = opciones_icono()
    datos = json.loads(BLOQUES.read_text(encoding="utf-8"))

    def recorrer(campos: list) -> None:
        for campo in campos:
            if campo["path"] in ("icon", "icono"):
                campo["type"] = "select"
                campo["options"] = opciones
                campo["label"] = "Icono"
            for hijo in ("item", "children"):
                if hijo in campo:
                    recorrer(campo[hijo])

    for tipo in TIPOS_CON_ICONO:
        if tipo not in datos["blocks"]:
            continue
        recorrer(datos["blocks"][tipo]["schema"])

    BLOQUES.write_text(
        json.dumps(datos, ensure_ascii=False, indent=4) + "\n", encoding="utf-8"
    )
    print("Wrote", BLOQUES)


if __name__ == "__main__":
    main()
