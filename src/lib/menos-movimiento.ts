/**
 * Si el sistema pidió menos movimiento, no se anima nada.
 *
 * Es una preferencia del sistema operativo, no un gusto: quien la activa suele
 * hacerlo porque el movimiento en pantalla le da mareo o le dispara una
 * migraña. Una animación que crece hasta ocupar la pantalla entera —como la de
 * protocolo creado— es justo de las que molestan.
 *
 * Se consulta en el momento y no se cachea: la persona la puede cambiar con la
 * app abierta.
 */
export const menosMovimiento = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
