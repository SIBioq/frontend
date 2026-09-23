# Quitar ciudad por defecto al crear pacientes

## Pedido

Evitar que el frontend precargue Leones en la ciudad, porque el laboratorio
atiende pacientes de distintas localidades y la secretaría podía guardar un
valor incorrecto sin confirmarlo.

## Cambios verificados

- Las altas desde Ingreso y Pacientes comienzan con `city` vacío, tanto para
  pacientes identificados como anónimos.
- Al reiniciar el diálogo de alta, la ciudad vuelve a quedar vacía.
- La edición sigue hidratando y conservando `patient.city`.
- Se mantuvieron el recorte del texto cargado y el campo opcional; no cambió
  el backend ni el contrato de la API.

## Archivos

- `src/components/ingreso/components/create-patient-form.tsx`
- `src/components/patients/components/create-patient-dialog.tsx`
- `src/components/patients/components/edit-patient-dialog.tsx` (verificación de
  conservación de ciudad existente)

## Pruebas

- `npx tsc -b`: OK.
- ESLint focalizado: OK.
- Búsqueda de defaults `Leones`: sin resultados en los formularios de alta.
- `git diff --check`: OK.

## Pendientes

- Prueba manual de altas, reinicio y edición en la interfaz.
- No se realizó merge, push ni deploy.
- Revisar en un ticket separado los `console.log`/`console.error` preexistentes
  que podrían incluir objetos de paciente; no fueron introducidos ni ampliados
  por este cambio.
