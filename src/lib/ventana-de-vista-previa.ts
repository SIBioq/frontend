/**
 * La ventana de vista previa del informe: para mirarlo, no para sacarlo.
 *
 * POR QUÉ NO ES ABRIR EL PDF Y LISTO
 * ==================================
 * Abrir el PDF en una pestaña lo entrega al visor del navegador, que trae su
 * barra con imprimir y descargar. Y una impresión desde ahí es justamente la
 * que el sistema no ve: no marca el protocolo como enviado, no queda en la
 * auditoría y nadie se entera de que ese papel salió. El camino para sacar el
 * informe es el botón de imprimir, que sí pregunta si el paciente lo recibe.
 *
 * Entonces el PDF va embebido en una página propia, con `#toolbar=0`, que en
 * Chrome y Edge esconde esa barra. Y la página se declara no imprimible: si
 * alguien igual manda Ctrl+P, sale una hoja que explica por dónde se imprime.
 *
 * POR QUÉ LA VENTANA SE ABRE SIN `noopener`
 * =========================================
 * `window.open(url, target, "noopener")` devuelve `null` SIEMPRE, por
 * especificación, aunque la ventana se haya abierto. Con esa bandera puesta,
 * acá no quedaba referencia para escribir el contenido: se abría un
 * `about:blank` vacío y el código lo interpretaba como que el navegador la
 * había bloqueado. La ventana hay que escribirla, así que la referencia hace
 * falta; el vínculo se corta después, poniéndole `opener` en null, que es lo
 * que `noopener` iba a hacer.
 *
 * HASTA DÓNDE LLEGA
 * =================
 * Esto no es un candado y no puede serlo: quien quiere el archivo lo guarda
 * igual, y en Firefox y Safari el visor ignora `#toolbar=0` y muestra su barra.
 * Lo que hace es no OFRECER la salida equivocada, que es de lo que se trata:
 * quien está mirando no encuentra un botón de imprimir a mano, y el que quiere
 * imprimir de verdad usa el que corresponde.
 */

/** Lo que se ve arriba de todo, para que nadie confunda esta ventana con la otra. */
const AVISO = "Vista previa · no marca el protocolo como enviado"

/**
 * Cuántas páginas tiene el PDF que mandó el servidor, si lo dijo.
 *
 * Viene contado en `X-Page-Count`: el backend lo sabe al maquetar, y sacarlo
 * acá del PDF ya armado obligaría a traer un lector de PDF entero. Si no llega
 * —un backend viejo, o la cabecera sin exponer por CORS— la vista previa se
 * abre igual, sin el número.
 */
export function paginasDelPdf(respuesta: Response): number | null {
  const paginas = Number.parseInt(respuesta.headers.get("X-Page-Count") ?? "", 10)
  return Number.isFinite(paginas) && paginas > 0 ? paginas : null
}

export function textoDePaginas(paginas: number): string {
  return paginas === 1 ? "1 página" : `${paginas} páginas`
}

export function abrirVistaPrevia(pdf: Blob, titulo: string, paginas: number | null = null): boolean {
  const url = URL.createObjectURL(pdf)
  // En la pestaña también: con dos vistas previas abiertas, se distinguen sin entrar.
  const tituloDeLaVentana = paginas ? `${titulo} · ${textoDePaginas(paginas)}` : titulo
  // Sin `noopener`: con esa bandera `window.open` devuelve null aunque abra la
  // ventana, y sin referencia no hay dónde escribir. Ver arriba.
  const ventana = window.open("", "_blank")

  if (!ventana) {
    // Acá sí es el bloqueador de pop-ups: no se abrió nada.
    URL.revokeObjectURL(url)
    return false
  }

  ventana.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${tituloDeLaVentana}</title>
  <style>
    :root { color-scheme: light; }
    html, body { margin: 0; height: 100%; background: #eef2f7;
                 font-family: 'Segoe UI', Arial, sans-serif; }
    header { display: flex; align-items: center; gap: 8px; box-sizing: border-box; height: 39px;
             padding: 10px 16px; background: #204983; color: #fff; font-size: 13px; }
    header strong { font-weight: 700; letter-spacing: 1px; }
    header .paginas { margin-left: auto; padding: 1px 10px; border-radius: 999px;
                      background: rgba(255, 255, 255, 0.18); font-size: 12px; font-weight: 700; }
    iframe { display: block; width: 100%; height: calc(100% - 39px); border: 0; }
    /* Esta ventana no es para sacar el informe: ver el comentario del módulo. */
    @media print {
      header, iframe { display: none; }
      body::after {
        content: "Esta es la vista previa: desde acá no se imprime. Para imprimir el informe, usá el botón Imprimir del diálogo de reporte, que pregunta si el paciente lo recibe.";
        display: block; padding: 40px; font-size: 14px; line-height: 1.6; color: #000;
      }
    }
  </style>
</head>
<body>
  <header><strong>LABSALUD</strong> · ${AVISO}${paginas ? `<span class="paginas">${textoDePaginas(paginas)}</span>` : ""}</header>
  <iframe src="${url}#toolbar=0&amp;navpanes=0&amp;statusbar=0" title="${titulo}"></iframe>
</body>
</html>`)
  ventana.document.close()
  // El vínculo con la pantalla que la abrió no hace falta para nada, así que se
  // corta: es lo que iba a hacer `noopener`.
  try {
    ventana.opener = null
  } catch {
    // Algún navegador no deja tocarlo; no cambia nada de lo que se ve.
  }

  // El blob se suelta cuando la ventana se cerró, no a los treinta segundos:
  // el visor lo puede volver a pedir al cambiar de página o al hacer zoom, y
  // soltarlo antes deja la vista previa en blanco sin decir por qué.
  const vigilante = window.setInterval(() => {
    if (ventana.closed) {
      window.clearInterval(vigilante)
      URL.revokeObjectURL(url)
    }
  }, 1000)

  return true
}

