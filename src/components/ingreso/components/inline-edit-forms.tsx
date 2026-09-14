"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Building2, Save, Stethoscope, User, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import { Input } from "../../ui/input"
import { Label } from "../../ui/label"
import { Switch } from "../../ui/switch"
import { Textarea } from "../../ui/textarea"
import { useApi } from "../../../hooks/use-api"
import { MEDICAL_ENDPOINTS, PATIENT_ENDPOINTS } from "../../../config/api"
import { formatApiError, getErrorMessage } from "../../../lib/api-error"
import type { Doctor, Insurance, Patient } from "../../../types"
import { NbuSelect } from "../../configuration/components/nbu-select"
import { BillingEntitySelect } from "../../configuration/components/billing-entity-select"

function FormActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
      <Button type="submit" disabled={busy} className="flex-1 bg-[#204983] hover:bg-[#1a3d6f]"><Save className="h-4 w-4" />{busy ? "Guardando..." : "Guardar cambios"}</Button>
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}><X className="h-4 w-4" />Cancelar</Button>
    </div>
  )
}

function Field({ label, name, value, onChange, type = "text", inputMode }: { label: string; name: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return <div className="space-y-2"><Label htmlFor={`inline-${name}`}>{label}</Label><Input id={`inline-${name}`} name={name} type={type} inputMode={inputMode} value={value} onChange={onChange} /></div>
}

function InlineCard({ icon, title, onSubmit, busy, onCancel, children }: { icon: React.ReactNode; title: string; onSubmit: React.FormEventHandler<HTMLFormElement>; busy: boolean; onCancel: () => void; children: React.ReactNode }) {
  return <Card className="border-0 bg-white/80 shadow-lg backdrop-blur-sm"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-[#204983]">{icon}{title}</CardTitle></CardHeader><CardContent><form onSubmit={onSubmit} className="space-y-4">{children}<FormActions busy={busy} onCancel={onCancel} /></form></CardContent></Card>
}

export function EditPatientInlineForm({ patient, onCancel, onSaved }: { patient: Patient; onCancel: () => void; onSaved: (patient: Patient) => void }) {
  const { apiRequest } = useApi()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ first_name: patient.first_name || "", last_name: patient.last_name || "", dni: patient.dni || "", birth_date: patient.birth_date ? patient.birth_date.split("T")[0] : "", sex: patient.sex || "", phone_mobile: patient.phone_mobile || "", alt_phone: patient.alt_phone || "", email: patient.email || "", country: patient.country || "", province: patient.province || "", city: patient.city || "", address: patient.address || "", observations: patient.observations || "" })

  useEffect(() => {
    setForm((current) => ({ ...current, first_name: patient.first_name || "", last_name: patient.last_name || "", dni: patient.dni || "", birth_date: patient.birth_date ? patient.birth_date.split("T")[0] : "", sex: patient.sex || "", phone_mobile: patient.phone_mobile || "", alt_phone: patient.alt_phone || "", email: patient.email || "", country: patient.country || "", province: patient.province || "", city: patient.city || "", address: patient.address || "", observations: patient.observations || "" }))
  }, [patient])

  const change = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: name === "dni" ? value.replace(/\D/g, "").slice(0, 8) : value }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const anonymous = Boolean(patient.is_anonymous)
    if (!form.first_name.trim() || (!anonymous && (!form.last_name.trim() || !form.dni || !form.birth_date || !form.sex))) { toast.error("Completá los campos obligatorios"); return }
    try {
      setBusy(true)
      const response = await apiRequest(PATIENT_ENDPOINTS.PATIENT_DETAIL(patient.id), { method: "PATCH", body: { ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), dni: form.dni.replace(/\D/g, ""), phone_mobile: form.phone_mobile.trim(), alt_phone: form.alt_phone.trim(), email: form.email.trim(), country: form.country.trim(), province: form.province.trim(), city: form.city.trim(), address: form.address.trim(), observations: form.observations.trim() } })
      if (!response.ok) throw new Error(formatApiError(await response.json(), "No se pudo actualizar el paciente."))
      onSaved(await response.json()); toast.success("Paciente actualizado")
    } catch (error) { toast.error("No se pudo actualizar el paciente", { description: getErrorMessage(error) }) } finally { setBusy(false) }
  }

  return <InlineCard icon={<User className="h-5 w-5" />} title="Editar paciente" onSubmit={submit} busy={busy} onCancel={onCancel}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre *" name="first_name" value={form.first_name} onChange={change} /><Field label={`Apellido ${patient.is_anonymous ? "" : "*"}`} name="last_name" value={form.last_name} onChange={change} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label={`DNI ${patient.is_anonymous ? "" : "*"}`} name="dni" value={form.dni} onChange={change} inputMode="numeric" /><Field label="Fecha de nacimiento" name="birth_date" type="date" value={form.birth_date} onChange={change} /></div>
    <div className="space-y-2"><Label htmlFor="inline-patient-sex">Sexo</Label><select id="inline-patient-sex" name="sex" value={form.sex} onChange={change} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">Seleccionar sexo</option><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Teléfono móvil" name="phone_mobile" value={form.phone_mobile} onChange={change} /><Field label="Teléfono alternativo" name="alt_phone" value={form.alt_phone} onChange={change} /></div>
    <Field label="Email" name="email" type="email" value={form.email} onChange={change} />
    <div className="grid gap-4 sm:grid-cols-3"><Field label="País" name="country" value={form.country} onChange={change} /><Field label="Provincia" name="province" value={form.province} onChange={change} /><Field label="Ciudad" name="city" value={form.city} onChange={change} /></div>
    <Field label="Dirección" name="address" value={form.address} onChange={change} />
    <div className="space-y-2"><Label htmlFor="inline-patient-observations">Observaciones</Label><Textarea id="inline-patient-observations" name="observations" value={form.observations} onChange={change} rows={3} /></div>
  </InlineCard>
}

export function EditDoctorInlineForm({ doctor, onCancel, onSaved }: { doctor: Doctor; onCancel: () => void; onSaved: (doctor: Doctor) => void }) {
  const { apiRequest } = useApi()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ first_name: doctor.first_name, last_name: doctor.last_name, license: doctor.license })
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim() || !form.license.trim()) { toast.error("Completá los campos obligatorios"); return }
    try { setBusy(true); const response = await apiRequest(MEDICAL_ENDPOINTS.DOCTOR_DETAIL(doctor.id), { method: "PATCH", body: form }); if (!response.ok) throw new Error(formatApiError(await response.json(), "No se pudo actualizar el médico.")); onSaved(await response.json()); toast.success("Médico actualizado") } catch (error) { toast.error("No se pudo actualizar el médico", { description: getErrorMessage(error) }) } finally { setBusy(false) }
  }
  return <InlineCard icon={<Stethoscope className="h-5 w-5" />} title="Editar médico" onSubmit={submit} busy={busy} onCancel={onCancel}><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre *" name="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /><Field label="Apellido *" name="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div><Field label="Matrícula *" name="license" value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} /></InlineCard>
}

function Toggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) { return <div className="flex items-center justify-between rounded-md border p-3"><Label className="text-sm">{label}</Label><Switch checked={checked} onCheckedChange={onCheckedChange} /></div> }

export function EditInsuranceInlineForm({ insurance, onCancel, onSaved }: { insurance: Insurance; onCancel: () => void; onSaved: (insurance: Insurance) => void }) {
  const { apiRequest } = useApi()
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: insurance.name, description: insurance.description || "", ub_value: insurance.ub_value || "", nbu_id: typeof insurance.nbu === "object" && insurance.nbu ? String(insurance.nbu.id) : insurance.nbu ? String(insurance.nbu) : "", billing_entity_id: insurance.billing_entity?.id ? String(insurance.billing_entity.id) : "", chooses_billing_entity: Boolean(insurance.chooses_billing_entity), a_reintegro: Boolean(insurance.a_reintegro), descuento_desde_ub: insurance.descuento_desde_ub || "", descuento_porcentaje_a_cobrar: insurance.descuento_porcentaje_a_cobrar || "", charges_coseguro: Boolean(insurance.charges_coseguro), charges_material_descartable: Boolean(insurance.charges_material_descartable), charges_derivacion: Boolean(insurance.charges_derivacion), requires_preauthorization: Boolean(insurance.requires_preauthorization) })
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (form.name.trim().length < 3) { toast.error("El nombre debe tener al menos 3 caracteres"); return }
    try { setBusy(true); const response = await apiRequest(MEDICAL_ENDPOINTS.INSURANCE_DETAIL(insurance.id), { method: "PATCH", body: { ...form, name: form.name.trim(), ub_value: form.ub_value || undefined, nbu: form.nbu_id ? Number(form.nbu_id) : null, billing_entity_id: form.chooses_billing_entity ? null : (form.billing_entity_id ? Number(form.billing_entity_id) : null) } }); if (!response.ok) throw new Error(formatApiError(await response.json(), "No se pudo actualizar la obra social.")); onSaved(await response.json()); toast.success("Obra social actualizada") } catch (error) { toast.error("No se pudo actualizar la obra social", { description: getErrorMessage(error) }) } finally { setBusy(false) }
  }
  const toggle = (name: keyof typeof form, value: boolean) => setForm((current) => ({ ...current, [name]: value }))
  return <InlineCard icon={<Building2 className="h-5 w-5" />} title="Editar obra social" onSubmit={submit} busy={busy} onCancel={onCancel}><Field label="Nombre *" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Field label="Descripción" name="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Field label="Valor UB" name="ub_value" type="number" value={form.ub_value} onChange={(e) => setForm({ ...form, ub_value: e.target.value })} /><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="inline-insurance-nbu">Nomenclador (NBU)</Label><NbuSelect id="inline-insurance-nbu" value={form.nbu_id} onValueChange={(value) => setForm({ ...form, nbu_id: value })} /></div><div className="space-y-2"><Label htmlFor="inline-insurance-billing">Entidad de facturación</Label><BillingEntitySelect id="inline-insurance-billing" value={form.billing_entity_id} onValueChange={(value) => setForm({ ...form, billing_entity_id: value })} disabled={form.chooses_billing_entity} /></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Descuento desde UB" name="descuento_desde_ub" type="number" value={form.descuento_desde_ub} onChange={(e) => setForm({ ...form, descuento_desde_ub: e.target.value })} /><Field label="Porcentaje a cobrar" name="descuento_porcentaje_a_cobrar" type="number" value={form.descuento_porcentaje_a_cobrar} onChange={(e) => setForm({ ...form, descuento_porcentaje_a_cobrar: e.target.value })} /></div><div className="grid gap-3 sm:grid-cols-2"><Toggle label="Elegir entidad en cada ingreso" checked={form.chooses_billing_entity} onCheckedChange={(value) => setForm({ ...form, chooses_billing_entity: value, billing_entity_id: value ? "" : form.billing_entity_id })} /><Toggle label="A reintegro" checked={form.a_reintegro} onCheckedChange={(value) => toggle("a_reintegro", value)} /><Toggle label="Cobra coseguro" checked={form.charges_coseguro} onCheckedChange={(value) => toggle("charges_coseguro", value)} /><Toggle label="Cobra material descartable" checked={form.charges_material_descartable} onCheckedChange={(value) => toggle("charges_material_descartable", value)} /><Toggle label="Cobra derivación" checked={form.charges_derivacion} onCheckedChange={(value) => toggle("charges_derivacion", value)} /><Toggle label="Requiere preautorización" checked={form.requires_preauthorization} onCheckedChange={(value) => toggle("requires_preauthorization", value)} /></div></InlineCard>
}
