/** Guía corta de cada sección del panel: qué es y los pasos habituales. */
export interface GuiaAdmin {
  etiqueta: string;
  descripcion: string;
  acciones: string[];
}

export const GUIAS_ADMIN: Record<string, GuiaAdmin> = {
  '/admin': {
    etiqueta: 'Tu espacio de trabajo',
    descripcion: 'El tablero resume lo que piden las personas visitantes y el estado del contenido del sitio.',
    acciones: ['Revisa «Solicitudes sin atender» y abre la bandeja que corresponda.', 'Comprueba el estado del contenido en las tarjetas.', 'Usa los accesos rápidos para ir a cada módulo o ver el portal.'],
  },
  '/admin/paginas': {
    etiqueta: 'Gestión de contenido',
    descripcion: 'Las páginas del sitio. Cada una se arma con bloques en el constructor visual.',
    acciones: ['Crea una página con su título y ruta.', 'Ábrela en el editor para agregar y ordenar bloques.', 'Guarda el borrador y publícala cuando esté lista.'],
  },
  '/admin/editor': {
    etiqueta: 'Constructor visual',
    descripcion: 'Edita los bloques de la página. La vista previa muestra el borrador tal como lo verá el visitante.',
    acciones: ['Selecciona un bloque en la vista previa.', 'Cambia sus textos e imágenes en el inspector.', 'Guarda; publica solo cuando quieras que la web cambie.'],
  },
  '/admin/noticias': {
    etiqueta: 'Gestión editorial',
    descripcion: 'Noticias y comunicados del sitio. Las publicadas aparecen en el bloque Novedades y en /noticias.',
    acciones: ['Crea la noticia con su imagen y texto alternativo.', 'Guárdala como borrador para revisarla.', 'Un administrador la publica.'],
  },
  '/admin/identidad': {
    etiqueta: 'Datos institucionales',
    descripcion: 'Nombre, RUC, dirección y contacto. Se usan en el pie y en los marcadores {{institucion.*}}.',
    acciones: ['Completa los datos oficiales.', 'Guarda: los cambios se ven al momento en el sitio.'],
  },
  '/admin/apariencia': {
    etiqueta: 'Identidad visual',
    descripcion: 'Colores, tipografías, logo, accesos rápidos, botones de cabecera, WhatsApp y redes.',
    acciones: ['Elige el color primario (estructura) y el de acento (acción).', 'Revisa los avisos de contraste.', 'Publica la apariencia.'],
  },
  '/admin/medios': {
    etiqueta: 'Biblioteca de medios',
    descripcion: 'Imágenes y documentos que usan los bloques.',
    acciones: ['Sube la imagen o el PDF.', 'Escribe su texto alternativo.', 'Elígelo desde el inspector del bloque.'],
  },
  '/admin/mensajes': {
    etiqueta: 'Bandeja de entrada',
    descripcion: 'Mensajes de contacto y reclamos llegados desde el sitio.',
    acciones: ['Abre el mensaje.', 'Responde y marca si quieres avisar por correo.', 'Cambia su estado al atenderlo.'],
  },
  '/admin/mensajes?tipo=tramite': {
    etiqueta: 'Mesa de partes',
    descripcion: 'Trámites y solicitudes llegados por la mesa de partes virtual del sitio.',
    acciones: ['Abre el trámite y anota su ticket.', 'Responde por escrito; marca «Avisar por correo» si la respuesta debe llegar al correo de la persona.', 'Archívalo cuando el trámite esté concluido.'],
  },
  '/admin/mensajes?tipo=reclamo': {
    etiqueta: 'Reclamaciones',
    descripcion: 'Reclamos y quejas del libro de reclamaciones. Tienen plazo de respuesta.',
    acciones: ['Abre el reclamo cuanto antes.', 'Responde dentro del plazo y deja constancia.', 'Archívalo solo cuando esté resuelto.'],
  },
  '/admin/mensajes?tipo=accesibilidad': {
    etiqueta: 'Reportes de accesibilidad',
    descripcion: 'Problemas de accesibilidad que las personas visitantes reportan desde el sitio.',
    acciones: ['Abre el reporte y revisa la página indicada.', 'Deriva el problema a quien mantenga el sitio.', 'Responde a la persona si dejó su correo.'],
  },
  '/admin/mensajes?tipo=contacto': {
    etiqueta: 'Otras solicitudes',
    descripcion: 'Consultas y solicitudes generales del formulario de contacto.',
    acciones: ['Abre la solicitud.', 'Responde o deriva al área que corresponda.', 'Archívala cuando esté atendida.'],
  },
  '/admin/usuarios': {
    etiqueta: 'Accesos al panel',
    descripcion: 'Cuentas que pueden entrar al panel y su rol.',
    acciones: ['Crea la cuenta con su rol.', 'Desactívala cuando ya no deba entrar.'],
  },
  '/admin/cuenta': {
    etiqueta: 'Tu cuenta',
    descripcion: 'Tus datos de acceso y tu contraseña.',
    acciones: ['Cambia tu contraseña periódicamente.'],
  },
};

export function guiaDe(url: string): GuiaAdmin {
  const [path, query] = url.split('?');
  if (path.startsWith('/admin/editor/')) {
    return GUIAS_ADMIN['/admin/editor'];
  }
  // Las bandejas temáticas tienen guía propia según el `?tipo=` de la URL.
  if (path === '/admin/mensajes' && query) {
    const clave = `${path}?tipo=${new URLSearchParams(query).get('tipo') ?? ''}`;
    return GUIAS_ADMIN[clave] ?? GUIAS_ADMIN['/admin/mensajes'];
  }
  return GUIAS_ADMIN[path] ?? GUIAS_ADMIN['/admin'];
}
