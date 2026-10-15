# Vista previa del informe en celulares y en Safari

| | |
|---|---|
| **Fecha** | 2026-10-15 |
| **Rama** | feature/vista-previa-en-celulares |
| **Estado** | hecho; falta confirmar en iPhone |
| **Tipo** | fix |

## Qué se pidió

La vista previa del informe no andaba bien fuera de la computadora:

- En el celular se veía sólo la primera página y con barra horizontal.
- En iOS funcionaba sólo desde Chrome: Safari bloqueaba la ventana.
- Desde un acceso directo de la pantalla de inicio con "Abrir como app web"
  también avisaba que bloqueaba los pop-ups.

Tiene que seguir abriéndose en una ventana aparte.

## Qué se hizo

- `src/lib/ventana-de-vista-previa.ts`: `abrirVistaPrevia(pdf, …)` pasó a
  `abrirVentanaDeVistaPrevia(titulo)`, que abre la ventana con "Generando la
  vista previa…" y devuelve `{ mostrar(pdf, paginas), cerrar() }`.
- En celulares y tablets (`esCelularOTablet`) cada página se dibuja con pdf.js
  (`pdfjs-dist`, build `legacy`) como una imagen JPEG al ancho de la pantalla.
  En la computadora sigue el iframe con el visor del navegador.
- `avisoDeVentanaBloqueada()`: si la ventana no abre desde un acceso directo
  (modo standalone), dice que se abra desde Safari o Chrome, en vez de pedir
  permitir pop-ups.
- `protocol-card.tsx` (vista previa de un protocolo) y `protocolos-page.tsx`
  (vista previa en lote) abren la ventana antes de pedir el PDF.

## Decisiones

- **La ventana se abre en el toque, no cuando llega el PDF.** Safari sólo deja
  abrir ventanas como respuesta directa a un toque; después de un `await` lo
  bloquea. Chrome tolera unos segundos, por eso andaba sólo ahí.
- **Imágenes y no iframe en el celular.** Safari del iPhone dibuja un PDF en un
  iframe como una sola imagen de la primera página; Chrome de Android no lo
  muestra. Se detecta por dispositivo y no por ancho de pantalla: lo que falla
  es el visor, no el tamaño.
- **Un solo canvas reusado y JPEG por página**, para no quedarse sin memoria
  con un lote grande. Resolución: ancho de pantalla × densidad × 1,5, con tope
  de 12 millones de píxeles por página.
- **pdf.js se carga a demanda**: queda en sus propios chunks y no suma a la
  carga de la app.

- **pdf.js dibuja con `intent: "print"`** (corrección posterior, misma fecha).
  En el iPhone la vista previa salía en blanco: el dibujo corre en la pestaña
  de Labsalud, que queda oculta detrás de la ventana nueva, y una pestaña
  oculta no recibe `requestAnimationFrame`, que pdf.js usa con el intent de
  pantalla. Con `print` avanza sin eso. Reproducido y verificado anulando
  `requestAnimationFrame` en el navegador integrado.

## Archivos tocados

- `src/lib/ventana-de-vista-previa.ts`
- `src/components/protocolos/components/protocol-card.tsx`
- `src/components/protocolos/protocolos-page.tsx`
- `package.json`, `package-lock.json` (`pdfjs-dist`)

## Cómo se probó

- Navegador integrado con vista de celular Android y un PDF ficticio de 3
  páginas: las tres se ven a 351 px en una pantalla de 375, sin barra
  horizontal; se ve el "Generando…" y el contador de páginas. Como ese
  navegador no abre pop-ups, la ventana se reemplazó por un iframe a pantalla
  completa.
- Vista de computadora: sigue el iframe con el visor del navegador.
- `npm run build` y `npm run lint` limpios.
- No hay simulador de iOS instalado: Safari del iPhone y el acceso directo se
  prueban en el teléfono después de desplegar.

## Pendiente

- Confirmar en un iPhone, desde Safari y desde el acceso directo. Si desde el
  acceso directo iOS no deja abrir la ventana, la alternativa es un enlace
  temporal del backend que muestre el PDF sin sesión (decisión de seguridad
  pendiente).
