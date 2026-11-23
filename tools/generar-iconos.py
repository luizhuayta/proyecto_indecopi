#!/usr/bin/env python3
"""Genera frontend/public/iconos.svg (sprite) desde lucide-static (licencia ISC)."""
import re, urllib.request
from pathlib import Path

VERSION = '1.73.0'  # fijar según `npm view lucide-static time --json` (≥7 días)
MAPA = {
    'graduacion': 'graduation-cap', 'libro': 'book-open', 'biblioteca': 'library', 'plataforma': 'laptop',
    'usuarios': 'users', 'calendario': 'calendar', 'premio': 'award', 'documento': 'file-text',
    'balanza': 'scale', 'monedas': 'coins', 'correo': 'mail', 'telefono': 'phone', 'ubicacion': 'map-pin',
    'reloj': 'clock', 'grafico': 'chart-column', 'escuela': 'school', 'noticias': 'newspaper',
    'megafono': 'megaphone', 'escudo': 'shield-check', 'busqueda': 'search', 'enlace': 'external-link',
    'flecha': 'arrow-right', 'menu': 'menu', 'cerrar': 'x', 'pausa': 'pause', 'reproducir': 'play',
    'mensaje': 'message-circle', 'accesibilidad': 'accessibility', 'inicio': 'house', 'paginas': 'files',
    'medios': 'image', 'identidad': 'building-2', 'apariencia': 'palette', 'mensajes': 'inbox',
    'cuenta': 'user-cog', 'salir': 'log-out', 'sol': 'sun', 'luna': 'moon', 'guia': 'sliders-horizontal',
    'chevron': 'chevron-right', 'plegar': 'chevrons-left', 'desplegar': 'chevrons-right', 'check': 'check',
}
ROOT = Path(__file__).resolve().parents[1]
simbolos = []
for nombre, lucide in MAPA.items():
    svg = urllib.request.urlopen(f'https://unpkg.com/lucide-static@{VERSION}/icons/{lucide}.svg').read().decode()
    cuerpo = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1).strip()
    simbolos.append(
        f'<symbol id="{nombre}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{cuerpo}</symbol>')
destino = ROOT / 'frontend' / 'public' / 'iconos.svg'
destino.write_text('<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n'
                   f'<!-- Lucide {VERSION}, licencia ISC. Generado por tools/generar-iconos.py -->\n'
                   + '\n'.join(simbolos) + '\n</svg>\n', encoding='utf-8')
print('Wrote', destino, len(simbolos), 'iconos')
