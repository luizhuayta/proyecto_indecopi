/**
 * Iconos disponibles para bloques, marco y panel. Viven en un sprite propio
 * (`/iconos.svg`, subconjunto de Lucide, licencia ISC) para no depender de un
 * CDN. La lista es blanca: el nombre llega de contenido editable y solo se
 * acepta si está aquí, así nunca entra texto arbitrario en el atributo.
 */
export const ICONOS = {
  graduacion: 'Graduación', libro: 'Libro', biblioteca: 'Biblioteca', plataforma: 'Plataforma virtual',
  usuarios: 'Personas', calendario: 'Calendario', premio: 'Premio', documento: 'Documento',
  balanza: 'Normativa', monedas: 'Costos', correo: 'Correo', telefono: 'Teléfono', ubicacion: 'Ubicación',
  reloj: 'Horario', grafico: 'Estadística', escuela: 'Institución', noticias: 'Noticias',
  megafono: 'Comunicado', escudo: 'Privacidad', busqueda: 'Buscar', enlace: 'Enlace externo',
  flecha: 'Flecha', menu: 'Menú', cerrar: 'Cerrar', pausa: 'Pausa', reproducir: 'Reproducir',
  mensaje: 'Mensaje', accesibilidad: 'Accesibilidad', inicio: 'Inicio', paginas: 'Páginas',
  medios: 'Medios', identidad: 'Identidad', apariencia: 'Apariencia', mensajes: 'Bandeja',
  cuenta: 'Cuenta', salir: 'Salir', sol: 'Modo claro', luna: 'Modo oscuro', guia: 'Guía',
  chevron: 'Siguiente', plegar: 'Plegar', desplegar: 'Desplegar', check: 'Correcto',
} as const;

export type NombreIcono = keyof typeof ICONOS;

export const OPCIONES_ICONO = Object.entries(ICONOS).map(([value, label]) => ({ value, label }));

export function iconoSvg(nombre: unknown, clase = 'icono'): string {
  return typeof nombre === 'string' && Object.hasOwn(ICONOS, nombre)
    ? `<svg class="${clase}" aria-hidden="true" focusable="false"><use href="/iconos.svg#${nombre}"></use></svg>`
    : '';
}
