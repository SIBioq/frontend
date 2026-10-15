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
 * Entonces el PDF va en una página propia: en la computadora, embebido con
 * `#toolbar=0`, que en Chrome y Edge esconde esa barra; en el celular, como
 * imágenes (ver más abajo). Y la página se declara no imprimible: si alguien
 * igual manda Ctrl+P, sale una hoja que explica por dónde se imprime.
 *
 * LA VENTANA SE ABRE ANTES DE TENER EL PDF
 * ========================================
 * Safari sólo deja abrir una ventana como respuesta directa a un toque. Antes
 * se abría cuando el PDF ya había llegado, después de esperar al servidor, y
 * para Safari eso ya no era el toque: la bloqueaba y avisaba "pop-up
 * bloqueado" aunque nadie la hubiera bloqueado a mano. Chrome tolera unos
 * segundos de espera, por eso en el iPhone andaba sólo desde Chrome.
 *
 * Ahora `abrirVentanaDeVistaPrevia` se llama lo primero en el click, antes de
 * cualquier `await`, y la ventana arranca diciendo que el informe se está
 * generando. Cuando llega el PDF se le pone adentro con `mostrar`; si falla, se
 * cierra con `cerrar` y el error se avisa en la pantalla de siempre.
 *
 * EN EL CELULAR, PÁGINAS COMO IMÁGENES
 * ====================================
 * Un PDF dentro de un iframe no se puede leer en un celular: Safari del iPhone
 * lo dibuja como una sola imagen de la primera página, sin forma de bajar a
 * las otras y más ancha que la pantalla; Chrome de Android directamente no lo
 * muestra. Ahí cada página se dibuja con pdf.js en una imagen al ancho de la
 * pantalla, una debajo de la otra. En la computadora el visor del navegador
 * anda bien y sigue el iframe, que tiene zoom de verdad y texto seleccionable.
 *
 * POR QUÉ LA VENTANA SE ABRE SIN `noopener`
 * =========================================
 * `window.open(url, target, "noopener")` devuelve `null` SIEMPRE, por
 * especificación, aunque la ventana se haya abierto. La ventana hay que
 * escribirla, así que la referencia hace falta; el vínculo se corta después,
 * poniéndole `opener` en null, que es lo que `noopener` iba a hacer.
 *
 * HASTA DÓNDE LLEGA
 * =================
 * Esto no es un candado y no puede serlo: quien quiere el archivo lo guarda
 * igual, y en Firefox y Safari de computadora el visor ignora `#toolbar=0` y
 * muestra su barra. Lo que hace es no OFRECER la salida equivocada, que es de
 * lo que se trata: quien está mirando no encuentra un botón de imprimir a mano,
 * y el que quiere imprimir de verdad usa el que corresponde.
 */

/** Lo que se ve arriba de todo, para que nadie confunda esta ventana con la otra. */
const AVISO = "Vista previa · no marca el protocolo como enviado"

/**
 * El texto del aviso cuando la ventana no se pudo abrir.
 *
 * Abierta desde un acceso directo de la pantalla de inicio con "Abrir como app
 * web" (modo standalone), no hay pop-ups que permitir: si iOS no deja abrir la
 * ventana, el aviso de siempre manda a buscar un ajuste que no existe. Ahí se
 * dice lo que sí sirve.
 */
export function avisoDeVentanaBloqueada(): string {
  const instalada =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return instalada
    ? "Desde el acceso directo no se pudo abrir la vista previa en otra ventana. Abrí Labsalud desde Safari o Chrome para verla."
    : "El navegador bloqueó la ventana. Permití pop-ups para ver la vista previa."
}

/**
 * Cuántas páginas tiene el PDF que mandó el servidor, si lo dijo.
 *
 * Viene contado en `X-Page-Count`: el backend lo sabe al maquetar. Si no llega
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

/**
 * Si el visor de PDF del navegador no sirve para esto.
 *
 * Va por el dispositivo y no por el ancho de la pantalla: lo que falla es el
 * visor del celular, no el tamaño. Una computadora con la ventana angosta lo
 * muestra bien, y un iPad, que es ancho, tiene el mismo problema que el
 * iPhone. El iPad se presenta como Mac desde iPadOS 13: lo delata la pantalla
 * táctil.
 */
function esCelularOTablet(): boolean {
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

const escapar = (texto: string) =>
  texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const PAGINA = (titulo: string) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapar(titulo)}</title>
  <style>
    :root { color-scheme: light; }
    html, body { margin: 0; background: #eef2f7; font-family: 'Segoe UI', Arial, sans-serif; }
    body { min-height: 100vh; display: flex; flex-direction: column; }
    /* Tres columnas, las de los costados iguales: así la cantidad de páginas
       queda en el centro exacto de la barra, sea cual sea el largo del aviso. */
    header { position: sticky; top: 0; z-index: 1; flex: none;
             display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px;
             box-sizing: border-box; height: 39px; padding: 0 16px;
             background: #204983; color: #fff; font-size: 13px; }
    header .aviso { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    header strong { font-weight: 700; letter-spacing: 1px; }
    header .paginas { grid-column: 2; padding: 2px 12px; border-radius: 999px; white-space: nowrap;
                      background: rgba(255, 255, 255, 0.2); font-weight: 700; }
    header .paginas:empty { display: none; }
    /* En un celular centrar las páginas le deja al aviso media pantalla menos
       la píldora, y se corta en "Vi…": ahí la píldora va a la derecha. */
    @media (max-width: 600px) {
      header { grid-template-columns: minmax(0, 1fr) auto; padding: 0 12px; }
    }
    main { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .estado { margin: auto; padding: 24px; text-align: center; color: #475569; font-size: 15px; }
    .girando { width: 32px; height: 32px; margin: 0 auto 12px; border-radius: 50%;
               border: 3px solid #cbd5e1; border-top-color: #204983; animation: girar 0.8s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }
    iframe { display: block; flex: 1; width: 100%; height: calc(100vh - 39px); border: 0; }
    /* En el celular: páginas al ancho de la pantalla, sin barra horizontal. */
    .hojas { box-sizing: border-box; width: 100%; max-width: 960px; margin: 0 auto; padding: 12px; }
    .hojas img { display: block; width: 100%; height: auto; margin: 0 0 12px;
                 background: #fff; box-shadow: 0 1px 4px rgba(15, 23, 42, 0.2); }
    /* Esta ventana no es para sacar el informe: ver el comentario del módulo. */
    @media print {
      header, main { display: none; }
      body::after {
        content: "Esta es la vista previa: desde acá no se imprime. Para imprimir el informe, usá el botón Imprimir del diálogo de reporte, que pregunta si el paciente lo recibe.";
        display: block; padding: 40px; font-size: 14px; line-height: 1.6; color: #000;
      }
    }
  </style>
</head>
<body>
  <header><span class="aviso"><strong>LABSALUD</strong> · ${AVISO}</span><span class="paginas"></span></header>
  <main><div class="estado"><div class="girando"></div>Generando la vista previa…</div></main>
</body>
</html>`

export interface VentanaDeVistaPrevia {
  /** Pone el PDF en la ventana. Si la cerraron mientras se generaba, no hace nada. */
  mostrar: (pdf: Blob, paginas?: number | null) => Promise<void>
  /** La cierra sin mostrar nada: la generación falló y el error se avisa afuera. */
  cerrar: () => void
}

/**
 * Abre la ventana, todavía sin el PDF. Llamarla lo primero en el click, antes
 * de cualquier `await`: ver "La ventana se abre antes de tener el PDF".
 *
 * Devuelve `null` si el navegador no la dejó abrir.
 */
export function abrirVentanaDeVistaPrevia(titulo: string): VentanaDeVistaPrevia | null {
  // Sin `noopener`: con esa bandera `window.open` devuelve null aunque abra la
  // ventana, y sin referencia no hay dónde escribir. Ver arriba.
  const ventana = window.open("", "_blank")
  if (!ventana) return null

  try {
    ventana.document.write(PAGINA(titulo))
    ventana.document.close()
  } catch {
    // Se abrió pero no se puede escribir: para quien la mira es lo mismo que
    // no haberla podido abrir.
    ventana.close()
    return null
  }
  // El vínculo con la pantalla que la abrió no hace falta para nada, así que se
  // corta: es lo que iba a hacer `noopener`.
  try {
    ventana.opener = null
  } catch {
    // Algún navegador no deja tocarlo; no cambia nada de lo que se ve.
  }

  // Lo que hay que soltar cuando la ventana se cierre: el PDF y, en el
  // celular, una imagen por página. No se suelta antes: el visor del PDF lo
  // puede volver a pedir al cambiar de página o al hacer zoom, y soltarlo antes
  // deja la vista previa en blanco sin decir por qué.
  const urls: string[] = []
  const vigilante = window.setInterval(() => {
    if (ventana.closed) {
      window.clearInterval(vigilante)
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, 1000)

  const documento = ventana.document
  const contenido = () => documento.querySelector("main")

  return {
    async mostrar(pdf, paginas = null) {
      if (ventana.closed) return
      // En la pestaña también: con dos vistas previas abiertas, se distinguen sin entrar.
      if (paginas) {
        documento.title = `${titulo} · ${textoDePaginas(paginas)}`
        const marca = documento.querySelector(".paginas")
        if (marca) marca.textContent = textoDePaginas(paginas)
      }

      if (!esCelularOTablet()) {
        const url = URL.createObjectURL(pdf)
        urls.push(url)
        const iframe = documento.createElement("iframe")
        iframe.title = titulo
        iframe.src = `${url}#toolbar=0&navpanes=0&statusbar=0`
        contenido()?.replaceChildren(iframe)
        return
      }

      await dibujarComoImagenes(pdf, ventana, urls)
    },
    cerrar() {
      ventana.close()
    },
  }
}

/**
 * Cada página del PDF, como una imagen al ancho de la ventana.
 *
 * Se dibuja con pdf.js en un solo canvas que se reusa, y cada página se guarda
 * como JPEG: un canvas por página, en un lote de cincuenta protocolos, es
 * memoria que un celular no tiene. pdf.js se baja recién acá, la primera vez
 * que alguien abre una vista previa desde un celular.
 */
async function dibujarComoImagenes(pdf: Blob, ventana: Window, urls: string[]) {
  const [pdfjs, { default: urlDelWorker }] = await Promise.all([
    // La versión "legacy" anda en iPhones con un iOS de hace algunos años.
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = urlDelWorker

  const carga = pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) })
  try {
    const documentoPdf = await carga.promise
    if (ventana.closed) return
    const documento = ventana.document
    const hojas = documento.createElement("div")
    hojas.className = "hojas"
    documento.querySelector("main")?.replaceChildren(hojas)

    // El ancho en pantalla, por la densidad del celular para que se lea
    // nítido, y por 1,5 para que aguante un poco de zoom con los dedos. Con
    // tope: iOS no dibuja canvas de más de ~16 millones de píxeles.
    const ancho = Math.min(hojas.clientWidth || ventana.innerWidth, 960)
    const densidad = Math.min((ventana.devicePixelRatio || 1) * 1.5, 4)
    const canvas = document.createElement("canvas")
    const contexto = canvas.getContext("2d")
    if (!contexto) throw new Error("El navegador no puede dibujar la vista previa.")

    for (let numero = 1; numero <= documentoPdf.numPages; numero++) {
      if (ventana.closed) return
      const pagina = await documentoPdf.getPage(numero)
      const base = pagina.getViewport({ scale: 1 })
      let escala = (ancho * densidad) / base.width
      const maximo = 12_000_000
      if (base.width * escala * base.height * escala > maximo) {
        escala = Math.sqrt(maximo / (base.width * base.height))
      }
      const vista = pagina.getViewport({ scale: escala })
      canvas.width = Math.floor(vista.width)
      canvas.height = Math.floor(vista.height)
      contexto.fillStyle = "#fff"
      contexto.fillRect(0, 0, canvas.width, canvas.height)
      // `intent: "print"` no es para imprimir: es lo que hace que pdf.js dibuje
      // sin `requestAnimationFrame`. Esto corre en la pestaña de Labsalud, que
      // queda OCULTA detrás de la ventana recién abierta, y una pestaña oculta
      // no recibe animation frames: con el intent de pantalla el dibujo se
      // quedaba esperando para siempre y la vista previa salía en blanco.
      await pagina.render({ canvas, canvasContext: contexto, viewport: vista, intent: "print" }).promise
      pagina.cleanup()

      const imagen = await new Promise<Blob | null>((listo) => canvas.toBlob(listo, "image/jpeg", 0.9))
      if (!imagen || ventana.closed) return
      const url = URL.createObjectURL(imagen)
      urls.push(url)
      const img = documento.createElement("img")
      img.src = url
      img.alt = `Página ${numero} de ${documentoPdf.numPages}`
      hojas.appendChild(img)
    }
    // El canvas se achica a nada para que el celular suelte su memoria ya.
    canvas.width = 0
    canvas.height = 0
  } finally {
    void carga.destroy()
  }
}
