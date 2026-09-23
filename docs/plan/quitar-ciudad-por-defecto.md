# Plan: quitar ciudad por defecto en altas de pacientes

## Pedido

Evitar que las altas de pacientes precarguen `Leones`, porque el laboratorio
atiende personas de distintas localidades y ese valor puede persistir sin haber
sido confirmado por la secretaría.

## Requisitos

- RF1: toda alta de paciente debe iniciar `city` vacía, tanto para pacientes
  identificados como anónimos.
- RF2: al cerrar o completar un alta y reiniciar el formulario, `city` debe
  volver a quedar vacía.
- RF3: si la persona usuaria carga una ciudad, el payload debe conservarla
  recortada como hasta ahora; si no la carga, se mantiene el contrato actual de
  campo opcional.
- RF4: los formularios de edición deben mostrar y conservar la ciudad existente
  del paciente; no deben vaciar datos guardados por este cambio.
- RNF1: no cambiar endpoints, tipos compartidos ni contrato del backend.
- RNF2: no registrar ni exponer PII/PHI adicional en consola, errores o mensajes.
- RNF3: mantener tipado TypeScript y reglas de ESLint sin errores.

## Casos de uso y validación

1. Alta desde Ingreso: el campo Ciudad aparece vacío y el usuario puede
   escribir cualquier localidad.
2. Alta desde Pacientes: el campo Ciudad aparece vacío; después de cancelar o
   crear, una nueva apertura también queda vacía.
3. Alta anónima en ambos flujos: misma conducta, sin valor implícito.
4. Edición: un paciente con `Leones` u otra ciudad mantiene ese valor al abrir
   y guardar sin modificarlo; un paciente sin ciudad continúa vacío.

## Diseño y responsabilidades

- Los componentes de alta son responsables del estado inicial y del reinicio.
- Los componentes de edición siguen siendo responsables de hidratar el estado
  desde `Patient`; no requieren cambio productivo.
- No se agrega abstracción compartida: son tres literales puntuales y extraerlos
  aumentaría el acoplamiento sin aportar una regla de dominio nueva.

## Ticket de implementación

Cambiar a cadena vacía la inicialización de `city` en
`src/components/ingreso/components/create-patient-form.tsx` y la inicialización
más el reinicio en
`src/components/patients/components/create-patient-dialog.tsx`. Verificar por
búsqueda que no queden defaults `Leones`, revisar que las ediciones hidraten
`patient.city`, ejecutar TypeScript (`tsc -b`) y ESLint focalizado.

## Fuera de alcance

- Hacer obligatoria la ciudad.
- Reemplazar el texto libre por un catálogo de localidades.
- Cambiar país o provincia por defecto.
- Modificar backend, migraciones o datos existentes.
