# Borrador de ingreso: guardar un protocolo a mitad de cargar

| | |
|---|---|
| **Fecha** | 2026-09-23 |
| **Rama** | feature/borrador-ingreso |
| **Estado** | hecho |
| **Tipo** | feature |

## Qué se pidió

Permitir que el usuario abandone la pantalla de carga de protocolo a mitad de camino y pueda retomar lo que dejó. Mientras hay datos sin enviar, la navbar debe indicarlo de forma visual (ícono de alerta o cambio de color). Al volver a la pantalla aparece un cartel que ofrece continuar o descartar.

## Qué se hizo

- **Capa de persistencia** (`src/lib/borrador-de-ingreso.ts`): funciones de lectura, guardado y borrado de borradores en `localStorage`, con esquema versionado. Clave única por usuario y por navegador: `sibioq:borrador-ingreso:v1:<id de usuario>`. Toda operación en `try/catch` (cuota llena, modo privado).
- **Hook de control** (`src/hooks/use-borrador-de-ingreso.ts`): ciclo de vida del borrador en la pantalla. Lee al montar, guarda con debounce de 600 ms si está habilitado el guardado, descarta o borra. Bloquea el guardado automático mientras haya un borrador pendiente de decisión (RF9).
- **Hook reactivo para navbar** (`src/hooks/use-hay-borrador-de-ingreso.ts`): booleano suscripto a cambios locales (`EVENTO_BORRADOR_DE_INGRESO`) y de otras pestañas (`storage`), vía `useSyncExternalStore`.
- **Cartel de aviso** (`src/components/ingreso/components/aviso-de-borrador.tsx`): presentación pura; muestra cantidad de análisis, hora del guardado, y botones «Continuar» / «Descartar».
- **Integración en ingreso** (`src/components/ingreso/ingreso-page.tsx`): arma una foto del formulario en cada render (`instantanea`), la pasa al hook, muestra el cartel si hay borrador pendiente. Restauración: pide cada entidad al backend por su id; si falta alguna, avisa por toast pero restaura el resto.
- **Navbar en ámbar** (`src/components/navbar.tsx`): el ítem «Ingreso» cambia a texto ámbar (`text-amber-600`) y subrayado ámbar cuando hay borrador y no se está ya en esa pantalla.

## Decisiones

- **PHI mínima: sólo ids**. El localStorage queda con ids numéricos (paciente, médico, obra social, análisis, montos) y número de afiliado — no hay nombre, DNI ni código legible de análisis. Pedir cada entidad al backend garantiza datos frescos al restaurar. El número de afiliado se guarda porque es dato del trámite, necesario para reconstruir.

- **Degradación en `try/catch`**. Todo acceso a `localStorage` atrapa excepciones: cuota llena, modo privado o JSON corrupto no rompen la pantalla, degradan a «no hay borrador» en silencio.

- **Esquema versionado**. La clave lleva `v1` y el payload tiene `version: 1`. JSON de otra versión se descarta y borra en silencio (permite evolucionar el esquema sin confundir borradores viejos).

- **Por usuario, en esta PC**. La clave incluye el id logueado. Otro usuario en la misma máquina no ve borradores ajenos; cerrar sesión no borra nada (es una decisión del usuario, no una limpieza automática).

- **Debounce de 600 ms**. El formulario cambia en cada tecla y escribir en localStorage en cada una no tiene sentido. 600 ms es el valor elegido: nada en la pantalla depende de que la escritura haya terminado, así que el retardo no se ve. Al salir de Ingreso por la app (navbar, otro link) lo que quedaba en el debounce se escribe en el momento, así que ni el último cambio se pierde ni el ámbar llega tarde. El riesgo que queda es chico y conocido: cerrar la pestaña o el navegador dentro de esos 600 ms pierde el último tecleo.

- **No pisar un borrador con formulario vacío (RF9)**. Mientras hay un borrador pendiente de decisión (el cartel visible), el guardado automático está deshabilitado. Si el usuario empieza a cargar sin apretar botón, nada se guarda. Esto evita perder el borrador que se está ofreciendo.

- **Restauración de obra social sin limpiar campos**. Se usa `setSelectedInsurance` directo, no `handleInsuranceSelect` (que limpia afiliado, orden, preautorización y montos). Luego se reponen esos campos con los valores guardados, evitando sobrescrituras accidentales.

- **ABI se resuelve antes de setear paciente**. `abiCargadoPara.current` se marca con el id del paciente antes de `setCurrentPatient`, para que el efecto que agrega el Acto Bioquímico de Internación no duplique lo que el usuario quizás ya sacó de la lista.

- **La cotización se recalcula sola**. No se guarda el `quote` (depende de la obra social y de qué está autorizado), sino que `useProtocolQuote` se recalcula al restaurar. Los montos `quote` no se guardan, los montos del usuario sí (pagos, coseguro, material, derivación).

- **Método de envío en state inicial**. Se busca en la lista ya cargada al entrar, no se pide al backend (no hay endpoint para un id de SendMethod específico). Si cambió el catálogo, el id guardado quizás no existe y se restaura `null` (la pantalla sigue funcionando, el usuario elige otro).

- **Borrado en tres casos**: al crear el protocolo con éxito (vía `handleReset`), al apretar «Descartar» en el cartel, y al limpiar el formulario con el botón de «limpiar». Además, `guardarBorrador` borra automáticamente si la instantánea quedó sin datos significativos.

- **Datos significativos = paciente O al menos un análisis**. Un formulario completamente vacío no genera borrador (no hay qué recuperar). Con un paciente elegido o un análisis cargado sí.

## Archivos tocados

| archivo | qué cambió |
|---|---|
| `src/lib/borrador-de-ingreso.ts` | Archivo nuevo: lógica de persistencia, esquema, sanidad |
| `src/hooks/use-borrador-de-ingreso.ts` | Archivo nuevo: ciclo de vida del borrador en la pantalla |
| `src/hooks/use-hay-borrador-de-ingreso.ts` | Archivo nuevo: hook reactivo para la navbar |
| `src/components/ingreso/components/aviso-de-borrador.tsx` | Archivo nuevo: cartel de retomar/descartar |
| `src/components/ingreso/ingreso-page.tsx` | Instancia del hook, crea `instantanea`, muestra cartel, restaura datos, borra al éxito/reset |
| `src/components/navbar.tsx` | Importa `useHayBorradorDeIngreso`, pinta «Ingreso» en ámbar si hay borrador fuera de esa pantalla |

## Cómo se verificó

Lo que efectivamente se corrió:

```bash
npm run build   # tsc -b && vite build: limpio, 0 errores de tipado
npm run lint    # 28 warnings, 0 errores — el baseline del repo, sin sumar
```

El repo **no tiene tests automatizados** (no hay vitest ni ningún runner), así
que la lógica del borrador no está cubierta por pruebas. Si en algún momento se
suma vitest, `src/lib/borrador-de-ingreso.ts` es el candidato natural: es
función pura sobre `localStorage` y se testea sin montar React.

## Recorrido manual pendiente de hacer contra el navegador

```text
# 1. Cargar medio ingreso: paciente, médico, análisis; ir a otra pantalla
# 2. Navbar: "Ingreso" queda en ámbar
# 3. Volver a "/ingreso": aparece el cartel "Quedó este protocolo sin enviar"
# 4. Click "Continuar": 
#    - Pide datos al backend y restaura el formulario
#    - Cotización se recalcula
#    - Botón "Crear Protocolo" reaparece
#    - Ámbar de navbar desaparece (estamos en la pantalla)
# 5. Crear protocolo: ámbar se apaga, borrador se borra
# 6. Repetir con "Descartar": formulario limpio, borrador borrado, ámbar apagado
# 7. Con otro usuario en la misma PC: no aparece el cartel del usuario anterior
# 8. Cambiar a otra pestaña y volver: el evento `storage` refresca el estado de la navbar
```

Ninguno de esos ocho pasos se ejecutó todavía: quedan como la lista de
comprobación para la primera prueba en el navegador. Los puntos 7 (otro usuario
en la misma PC) y 8 (otra pestaña) son los que más conviene mirar, porque
dependen de la clave por usuario y del evento `storage`, que es lo único que no
se puede ver leyendo la pantalla de Ingreso sola.

## Pendiente

Nada. Plan y código están completos. No hay tests automatizados de interfaz (el repo no tiene vitest ni Playwright configurados).
