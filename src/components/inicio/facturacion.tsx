import { Receipt } from "lucide-react"

import type { Inicio } from "./tipos"
import { contraQue, fecha } from "./formato"
import { Bloque, Dato, Diferencia, RenglonConEnlace, TituloDeBloque, type Sentido } from "./piezas"

const Contra = ({ valor, antes, sentido }: { valor: number; antes: number | null | undefined; sentido: Sentido }) => (
  <Diferencia valor={valor} contra={antes} sentido={sentido} compacta />
)

/**
 * Lo que falta facturar y cómo viene ARCA. Lo ve sólo quien puede facturar:
 * el backend no manda `facturacion` a los demás.
 *
 * Listos para facturar y lo facturado no son buenos ni malos (dependen de
 * cuándo se presenta), así que su flecha va en gris. Lo pendiente y lo fallido
 * en ARCA sí: más es peor.
 */
export default function Facturacion({ datos, posicion }: { datos: Inicio; posicion: number }) {
  const f = datos.facturacion
  if (!f) return null
  const hasta = fecha(datos.referencia).getDate()

  return (
    <Bloque tema="obras" posicion={posicion} className="gap-2.5">
      <TituloDeBloque tema="obras" icono={Receipt}>
        Facturación
      </TituloDeBloque>

      {f.listos_para_facturar && f.arca_pendientes && f.arca_fallidos ? (
        <>
          <p className="-mt-0.5 mb-0 text-xs text-slate-500">
            Lo pendiente, contra hace una semana. En ARCA, los protocolos de los últimos {f.dias_arca} días.
          </p>
          <RenglonConEnlace
            valor={f.listos_para_facturar.valor}
            texto="listos para facturar"
            diferencia={<Contra valor={f.listos_para_facturar.valor} antes={f.listos_para_facturar.hace_una_semana} sentido="neutro" />}
            enlace="/facturacion"
            textoDelEnlace="Ir a Facturación →"
          />
          <Dato
            grande
            etiqueta="Pendiente en ARCA"
            valor={f.arca_pendientes.valor}
            diferencia={<Contra valor={f.arca_pendientes.valor} antes={f.arca_pendientes.hace_una_semana} sentido="mas-es-peor" />}
          />
          <Dato
            grande
            aviso={f.arca_fallidos.valor > 0}
            etiqueta="Fallido en ARCA"
            valor={f.arca_fallidos.valor}
            diferencia={<Contra valor={f.arca_fallidos.valor} antes={f.arca_fallidos.hace_una_semana} sentido="mas-es-peor" />}
          />
        </>
      ) : null}

      <p className="mb-0 mt-1 text-xs text-slate-500">
        Facturado en ARCA del 1 al {hasta}, contra {contraQue(datos.comparacion.meses)}
      </p>
      <Dato
        grande
        etiqueta="Facturado"
        valor={f.arca_facturado.valor}
        diferencia={
          <Contra
            valor={f.arca_facturado.valor}
            antes={f.arca_facturado.comparacion === null ? null : Math.round(f.arca_facturado.comparacion)}
            sentido="neutro"
          />
        }
      />
    </Bloque>
  )
}
