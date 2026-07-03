import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { MapPin, Plus, Pencil, Trash2, Star, Eye, EyeOff, Check } from 'lucide-react';
import { useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { locationsService, type CreateLocationPayload } from '@/features/locations/locationsService';
import { geoService } from '@/features/geo/geoService';
import type { GeoDepartment, GeoCity } from '@/features/geo/geo.types';
import type { StoreLocation } from '@/features/locations/locations.types';
import { notify } from '@/lib/notifications';

const locationSchema = Yup.object({
  name: Yup.string().required('Nombre requerido').max(80),
  addressLine: Yup.string().nullable().default(null),
  neighborhood: Yup.string().nullable().default(null),
  department: Yup.string().trim().min(1, 'Departamento requerido').max(100).required('Departamento requerido'),
  city: Yup.string().trim().min(1, 'Ciudad requerida').max(100).required('Ciudad requerida'),
  phone: Yup.string().nullable().default(null),
  whatsappNumber: Yup.string().nullable().default(null),
  allowsPickup: Yup.boolean().default(true),
  allowsLocalDelivery: Yup.boolean().default(false),
  deliveryNotes: Yup.string().nullable().default(null),
  pickupNotes: Yup.string().nullable().default(null),
});

type LocationForm = Yup.InferType<typeof locationSchema>;

const EMPTY_FORM: LocationForm = {
  name: '',
  addressLine: null,
  neighborhood: null,
  department: '',
  city: '',
  phone: null,
  whatsappNumber: null,
  allowsPickup: true,
  allowsLocalDelivery: false,
  deliveryNotes: null,
  pickupNotes: null,
};

export function LocationsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Geo state
  const [departments, setDepartments] = useState<GeoDepartment[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  async function load() {
    if (!storeId) return;
    try {
      setLoading(true);
      const data = await locationsService.getStoreLocations(storeId);
      setLocations(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Error al cargar sucursales');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load departments once
  useEffect(() => {
    geoService.getDepartments('CO')
      .then(setDepartments)
      .catch(() => { /* silent — user can still type if geo fails */ });
  }, []);

  const formik = useFormik<LocationForm>({
    initialValues: EMPTY_FORM,
    validationSchema: locationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!storeId) return;
      setSaving(true);
      try {
        if (editingId) {
          await locationsService.updateLocation(editingId, {
            name: values.name,
            addressLine: values.addressLine ?? null,
            neighborhood: values.neighborhood ?? null,
            city: values.city,
            department: values.department,
            country: 'CO',
            phone: values.phone ?? null,
            whatsappNumber: values.whatsappNumber ?? null,
            allowsPickup: values.allowsPickup,
            allowsLocalDelivery: values.allowsLocalDelivery,
            deliveryNotes: values.deliveryNotes ?? null,
            pickupNotes: values.pickupNotes ?? null,
          });
          notify.success('Sucursal actualizada correctamente.');
        } else {
          const newLoc: CreateLocationPayload = {
            name: values.name,
            addressLine: values.addressLine ?? null,
            neighborhood: values.neighborhood ?? null,
            city: values.city,
            department: values.department,
            country: 'CO',
            isPrimary: locations.length === 0,
            isActive: true,
            isPublic: true,
            allowsPickup: values.allowsPickup,
            allowsLocalDelivery: values.allowsLocalDelivery,
            phone: values.phone ?? null,
            whatsappNumber: values.whatsappNumber ?? null,
            sortOrder: locations.length,
            deliveryNotes: values.deliveryNotes ?? null,
            pickupNotes: values.pickupNotes ?? null,
          };
          await locationsService.createLocation(storeId, newLoc);
          notify.success('Sucursal creada correctamente.');
        }
        setShowForm(false);
        setEditingId(null);
        setCities([]);
        formik.resetForm();
        await load();
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Error al guardar');
      } finally {
        setSaving(false);
      }
    },
  });

  useScrollToFirstFormikError({
    errors: formik.errors,
    submitCount: formik.submitCount,
    isSubmitting: formik.isSubmitting,
  });

  // Load cities when department changes
  useEffect(() => {
    const dept = departments.find(d => d.name === formik.values.department);
    if (!dept) { setCities([]); return; }
    setLoadingGeo(true);
    geoService.getCities(dept.id)
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingGeo(false));
  }, [formik.values.department, departments]); // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit(loc: StoreLocation) {
    setEditingId(loc.id);
    void formik.setValues({
      name: loc.name,
      addressLine: loc.addressLine ?? null,
      neighborhood: loc.neighborhood ?? null,
      department: loc.department ?? '',
      city: loc.city ?? '',
      phone: loc.phone ?? null,
      whatsappNumber: loc.whatsappNumber ?? null,
      allowsPickup: loc.allowsPickup,
      allowsLocalDelivery: loc.allowsLocalDelivery,
      deliveryNotes: loc.deliveryNotes ?? null,
      pickupNotes: loc.pickupNotes ?? null,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setCities([]);
    formik.resetForm();
  }

  async function handleSetPrimary(loc: StoreLocation) {
    if (!storeId || loc.isPrimary) return;
    try {
      await locationsService.setPrimaryLocation(storeId, loc.id);
      await load();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al actualizar sede principal');
    }
  }

  async function handleToggleActive(loc: StoreLocation) {
    if (loc.isPrimary && loc.isActive) return;
    try {
      await locationsService.updateLocation(loc.id, { isActive: !loc.isActive });
      await load();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error');
    }
  }

  async function handleDelete(loc: StoreLocation) {
    if (loc.isPrimary) return;
    if (!confirm(`¿Eliminar la sucursal "${loc.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(loc.id);
    try {
      await locationsService.deleteLocation(loc.id);
      await load();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sucursales"
        description="Gestiona las sedes y puntos de atención de tu empresa."
        action={
          !showForm ? (
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Nueva sucursal
            </Button>
          ) : undefined
        }
      />

      {loadError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {showForm && (
        <Card className="p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            {editingId ? 'Editar sucursal' : 'Nueva sucursal'}
          </h3>
          <form onSubmit={formik.handleSubmit} className="space-y-4">
            {/* Row: name + phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre de la sucursal *"
                placeholder="Sede principal, Sucursal Norte…"
                {...formik.getFieldProps('name')}
                error={formik.touched.name ? formik.errors.name : undefined}
              />
              <Input
                label="Teléfono"
                placeholder="+57 601 000 0000"
                {...formik.getFieldProps('phone')}
              />
            </div>

            {/* Row: address + neighborhood */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Dirección"
                placeholder="Cra 15 # 93-47"
                {...formik.getFieldProps('addressLine')}
              />
              <Input
                label="Barrio / Referencia"
                placeholder="El Poblado"
                {...formik.getFieldProps('neighborhood')}
              />
            </div>

            {/* Row: department + city (cascading) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Departamento *"
                id="department"
                name="department"
                value={formik.values.department ?? ''}
                onChange={e => {
                  void formik.setFieldValue('department', e.target.value);
                  void formik.setFieldValue('city', '');
                }}
                onBlur={formik.handleBlur}
                error={formik.touched.department ? formik.errors.department : undefined}
                options={[
                  { value: '', label: 'Seleccionar departamento...' },
                  ...departments.map(d => ({ value: d.name, label: d.name })),
                ]}
              />
              <Select
                label="Ciudad / Municipio *"
                id="city"
                name="city"
                value={formik.values.city ?? ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                disabled={!formik.values.department || loadingGeo}
                error={formik.touched.city ? formik.errors.city : undefined}
                options={
                  cities.length === 0
                    ? [{ value: '', label: formik.values.department ? (loadingGeo ? 'Cargando ciudades...' : 'Sin ciudades para este departamento') : 'Selecciona primero un departamento' }]
                    : [
                        { value: '', label: 'Seleccionar ciudad...' },
                        ...cities.map(c => ({ value: c.name, label: c.name })),
                      ]
                }
              />
            </div>

            {/* Row: whatsapp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="WhatsApp"
                placeholder="+57 300 000 0000"
                {...formik.getFieldProps('whatsappNumber')}
              />
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={formik.values.allowsPickup}
                  onChange={e => void formik.setFieldValue('allowsPickup', e.target.checked)}
                />
                Permite recogida en sede
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={formik.values.allowsLocalDelivery}
                  onChange={e => void formik.setFieldValue('allowsLocalDelivery', e.target.checked)}
                />
                Hace domicilios locales
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} isLoading={saving}>
                {editingId ? 'Guardar cambios' : 'Crear sucursal'}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando sucursales…</div>
      ) : locations.length === 0 ? (
        <Card className="p-10 text-center">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No hay sucursales registradas.</p>
          <p className="text-xs text-gray-400 mt-1">
            La sede principal se crea automáticamente al registrar la empresa.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <Card key={loc.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <MapPin className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{loc.name}</span>
                      {loc.isPrimary && (
                        <Badge variant="info">
                          <Star className="w-3 h-3 mr-1" />
                          Principal
                        </Badge>
                      )}
                      {!loc.isActive && <Badge variant="warning">Inactiva</Badge>}
                    </div>
                    {(loc.addressLine || loc.city) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[loc.addressLine, loc.neighborhood, loc.city, loc.department]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {loc.allowsPickup && <span className="flex items-center gap-1"><Check className="w-3 h-3" />Recogida</span>}
                      {loc.allowsLocalDelivery && <span className="flex items-center gap-1"><Check className="w-3 h-3" />Domicilio</span>}
                      {loc.phone && <span>{loc.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {!loc.isPrimary && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleSetPrimary(loc)}
                      title="Marcar como principal"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleToggleActive(loc)}
                    disabled={loc.isPrimary && loc.isActive}
                    title={loc.isActive ? 'Desactivar' : 'Activar'}
                  >
                    {loc.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(loc)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {!loc.isPrimary && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDelete(loc)}
                      disabled={deletingId === loc.id}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
