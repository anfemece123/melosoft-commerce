import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import {
  User, Building2, Palette, MapPin, Clock, FileText,
  Sun, Moon, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { StoreLogoField } from '@/components/admin/StoreLogoField';
import { useAppDispatch } from '@/app/hooks';
import { addStore } from '@/features/stores/storesSlice';
import { storesService } from '@/features/stores/storesService';
import { storeCreationSchema } from '@/schemas/storeCreation.schema';
import type { StoreCreationFormValues } from '@/schemas/storeCreation.schema';
import { slugify } from '@/utils/slugify';
import { getThemeColors, THEME_PRESET_LIST } from '@/utils/themePresets';
import type { ThemePreset, ThemeMode } from '@/types/common.types';
import { cn } from '@/utils/cn';
import { geoService } from '@/features/geo/geoService';
import type { GeoDepartment, GeoCity } from '@/features/geo/geo.types';

// ── Constants ────────────────────────────────────────────────

const BUSINESS_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'barberia',    label: 'Barbería' },
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'moda',        label: 'Moda y ropa' },
  { value: 'tecnologia',  label: 'Tecnología' },
  { value: 'mascotas',    label: 'Mascotas' },
  { value: 'hogar',       label: 'Hogar y deco' },
  { value: 'belleza',     label: 'Belleza y estética' },
  { value: 'salud',       label: 'Salud y bienestar' },
  { value: 'otro',        label: 'Otro' },
];

const CURRENCY_OPTIONS = [
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
];

const COUNTRY_OPTIONS = [
  { value: 'CO', label: 'Colombia' },
  { value: 'MX', label: 'México' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'ES', label: 'España' },
  { value: 'AR', label: 'Argentina' },
];

const DOCUMENT_TYPE_OPTIONS = [
  { value: '',         label: 'Seleccionar...' },
  { value: 'CC',       label: 'Cédula de ciudadanía (CC)' },
  { value: 'NIT',      label: 'NIT' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'other',    label: 'Otro' },
];

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const DEFAULT_BUSINESS_HOURS: StoreCreationFormValues['businessHours'] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  dayOfWeek: day,
  isOpen: day >= 1 && day <= 5,
  opensAt: day === 6 ? '09:00' : day === 0 ? null : '08:00',
  closesAt: day === 6 ? '14:00' : day === 0 ? null : '18:00',
  breakStartsAt: null,
  breakEndsAt: null,
}));

const DEFAULT_POLICIES = {
  shippingPolicy: 'Realizamos envíos a nivel nacional. Los pedidos son procesados en 1-2 días hábiles. El tiempo de entrega varía según la ciudad de destino.',
  returnsPolicy: 'Aceptamos devoluciones dentro de los 15 días posteriores a la compra, siempre que el producto esté en perfectas condiciones y con su empaque original.',
  warrantyPolicy: 'Todos nuestros productos cuentan con garantía del fabricante. Ante cualquier defecto, contáctanos para gestionar el reemplazo o reparación.',
  privacyPolicy: 'Tu información personal es tratada con total confidencialidad. No compartimos tus datos con terceros. Usamos tu información únicamente para procesar pedidos y mejorar tu experiencia.',
  termsAndConditions: 'Al realizar una compra en nuestra tienda aceptas nuestros términos y condiciones. Nos reservamos el derecho de modificar precios y disponibilidad sin previo aviso.',
};

const INITIAL_VALUES = {
  // Owner
  ownerFullName: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerDocumentType: '',
  ownerDocumentNumber: '',
  // Company
  name: '',
  slug: '',
  slogan: '',
  businessType: '' as StoreCreationFormValues['businessType'],
  description: '',
  logoUrl: '',
  supportEmail: '',
  whatsappNumber: '',
  country: 'CO',
  city: '',
  currency: 'COP',
  // Design
  mode: 'light',
  themePreset: 'blue',
  // Location
  locationAddressLine: '',
  locationNeighborhood: '',
  locationCity: '',
  locationDepartment: '',
  locationPostalCode: '',
  locationIsPublic: true,
  // Hours
  businessHours: DEFAULT_BUSINESS_HOURS,
  // Policies
  usePolicyDefaults: true,
  shippingPolicy: DEFAULT_POLICIES.shippingPolicy,
  returnsPolicy: DEFAULT_POLICIES.returnsPolicy,
  warrantyPolicy: DEFAULT_POLICIES.warrantyPolicy,
  privacyPolicy: DEFAULT_POLICIES.privacyPolicy,
  termsAndConditions: DEFAULT_POLICIES.termsAndConditions,
} satisfies StoreCreationFormValues;

// ── Section header ───────────────────────────────────────────

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4 pb-3 border-b border-gray-100">
      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export function StoreFormPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [departments, setDepartments] = useState<GeoDepartment[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  useEffect(() => {
    geoService.getDepartments('CO').then(setDepartments).catch(() => undefined);
  }, []);

  const formik = useFormik<StoreCreationFormValues>({
    initialValues: INITIAL_VALUES,
    validationSchema: storeCreationSchema,
    onSubmit: async (values) => {
      const colors = getThemeColors(values.themePreset as ThemePreset, values.mode as ThemeMode);

      const policies = values.usePolicyDefaults
        ? DEFAULT_POLICIES
        : {
            shippingPolicy: values.shippingPolicy || null,
            returnsPolicy: values.returnsPolicy || null,
            warrantyPolicy: values.warrantyPolicy || null,
            privacyPolicy: values.privacyPolicy || null,
            termsAndConditions: values.termsAndConditions || null,
          };

      const result = await storesService.createStoreWithOwner({
        ownerFullName: values.ownerFullName,
        ownerEmail: values.ownerEmail,
        ownerPhone: values.ownerPhone,
        ownerDocumentType: values.ownerDocumentType || null,
        ownerDocumentNumber: values.ownerDocumentNumber || null,
        name: values.name,
        slug: values.slug,
        slogan: values.slogan || null,
        businessType: values.businessType,
        description: values.description,
        logoUrl: values.logoUrl || null,
        supportEmail: values.supportEmail || null,
        whatsappNumber: values.whatsappNumber,
        country: values.country,
        city: values.city,
        currency: values.currency,
        mode: values.mode as ThemeMode,
        themePreset: values.themePreset,
        primaryColor: colors.primaryColor,
        secondaryColor: colors.secondaryColor,
        accentColor: colors.accentColor,
        backgroundColor: colors.backgroundColor,
        textColor: colors.textColor,
        buttonRadius: colors.buttonRadius,
        location: {
          addressLine: values.locationAddressLine || null,
          neighborhood: values.locationNeighborhood || null,
          city: values.locationCity || null,
          department: values.locationDepartment || null,
          country: values.country,
          postalCode: values.locationPostalCode || null,
          isPublic: values.locationIsPublic,
        },
        businessHours: values.businessHours.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          isOpen: h.isOpen,
          opensAt: h.opensAt || null,
          closesAt: h.closesAt || null,
          breakStartsAt: h.breakStartsAt || null,
          breakEndsAt: h.breakEndsAt || null,
        })),
        policies,
      });

      // Optimistically add to Redux so StoresPage shows it immediately
      const loadedStores = await storesService.getStores();
      const newStore = loadedStores.find((s) => s.id === result.storeId);
      if (newStore) dispatch(addStore(newStore));

      void navigate(`/admin/stores/${result.storeId}`);
    },
  });

  // Auto-generate slug from store name
  useEffect(() => {
    if (formik.values.name && !formik.touched.slug) {
      void formik.setFieldValue('slug', slugify(formik.values.name));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.name]);

  // Load cities when locationDepartment changes
  useEffect(() => {
    const dept = departments.find((d) => d.name === formik.values.locationDepartment);
    if (!dept) { setCities([]); return; }
    setLoadingGeo(true);
    geoService.getCities(dept.id)
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingGeo(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.locationDepartment, departments]);

  // Sync policy fields when usePolicyDefaults is toggled on
  useEffect(() => {
    if (formik.values.usePolicyDefaults) {
      void formik.setValues((prev) => ({
        ...prev,
        shippingPolicy: DEFAULT_POLICIES.shippingPolicy,
        returnsPolicy: DEFAULT_POLICIES.returnsPolicy,
        warrantyPolicy: DEFAULT_POLICIES.warrantyPolicy,
        privacyPolicy: DEFAULT_POLICIES.privacyPolicy,
        termsAndConditions: DEFAULT_POLICIES.termsAndConditions,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.usePolicyDefaults]);

  const selectedColors = getThemeColors(
    formik.values.themePreset as ThemePreset,
    formik.values.mode as ThemeMode
  );

  function fieldError(field: keyof StoreCreationFormValues): string | undefined {
    const touched = formik.touched[field];
    const error = formik.errors[field];
    return touched && typeof error === 'string' ? error : undefined;
  }

  async function handleLogoSelect(file: File | null) {
    if (!file) return;
    setLogoUploadError(null);
    setLogoUploading(true);

    try {
      const storeKey = formik.values.slug || slugify(formik.values.name) || 'draft';
      const logoUrl = await storesService.uploadStoreLogo(storeKey, file);
      await formik.setFieldValue('logoUrl', logoUrl);
    } catch (err) {
      setLogoUploadError(err instanceof Error ? err.message : 'No se pudo subir el logo');
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Nueva empresa"
        description="Completa la información para generar el ecommerce público de esta empresa."
      />

      {formik.status && (
        <div className="mb-6 flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{formik.status as string}</span>
        </div>
      )}

      <form onSubmit={formik.handleSubmit} noValidate className="max-w-2xl space-y-6">

        {/* ── Section 1: Owner ── */}
        <Card>
          <CardBody>
            <SectionHeader
              icon={<User className="w-4 h-4 text-indigo-600" />}
              title="Propietario"
              description="El email ingresado será el acceso de login del dueño de esta tienda."
            />
            <div className="space-y-4">
              <Input
                label="Nombre completo"
                id="ownerFullName"
                name="ownerFullName"
                placeholder="Ej: Carlos Gómez"
                value={formik.values.ownerFullName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={fieldError('ownerFullName')}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Email (login del owner)"
                  id="ownerEmail"
                  name="ownerEmail"
                  type="email"
                  placeholder="owner@empresa.com"
                  value={formik.values.ownerEmail}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('ownerEmail')}
                  required
                />
                <Input
                  label="Teléfono"
                  id="ownerPhone"
                  name="ownerPhone"
                  placeholder="+57 300 000 0000"
                  value={formik.values.ownerPhone}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('ownerPhone')}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Tipo de documento"
                  id="ownerDocumentType"
                  name="ownerDocumentType"
                  options={DOCUMENT_TYPE_OPTIONS}
                  value={formik.values.ownerDocumentType ?? ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                <Input
                  label="Número de documento"
                  id="ownerDocumentNumber"
                  name="ownerDocumentNumber"
                  placeholder="Ej: 12345678"
                  value={formik.values.ownerDocumentNumber ?? ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ── Section 2: Company info ── */}
        <Card>
          <CardBody>
            <SectionHeader
              icon={<Building2 className="w-4 h-4 text-indigo-600" />}
              title="Información de la empresa"
            />
            <div className="space-y-4">
              <StoreLogoField
                id="logoUrl"
                previewUrl={formik.values.logoUrl || null}
                onFileSelect={(file) => void handleLogoSelect(file)}
                onClear={() => void formik.setFieldValue('logoUrl', '')}
                uploading={logoUploading}
                error={logoUploadError ?? fieldError('logoUrl')}
                hint="Sube el logo que se mostrará en el ecommerce público y en el header de la tienda."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nombre de la empresa"
                  id="name"
                  name="name"
                  placeholder="Ej: Tienda Nova"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('name')}
                  required
                />
                <Input
                  label="Slug (URL pública)"
                  id="slug"
                  name="slug"
                  placeholder="tienda-nova"
                  value={formik.values.slug}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('slug')}
                  hint={`/s/${formik.values.slug || '...'}`}
                  required
                />
              </div>
              <Input
                label="Eslogan"
                id="slogan"
                name="slogan"
                placeholder="Ej: Lo mejor en tecnología al mejor precio"
                value={formik.values.slogan ?? ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={fieldError('slogan')}
              />
              <Select
                label="Tipo de negocio"
                id="businessType"
                name="businessType"
                options={BUSINESS_TYPE_OPTIONS}
                value={formik.values.businessType}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={fieldError('businessType')}
              />
              <Textarea
                label="Descripción"
                id="description"
                name="description"
                placeholder="Descripción de la empresa para el ecommerce público..."
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={fieldError('description')}
                rows={3}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="WhatsApp de contacto"
                  id="whatsappNumber"
                  name="whatsappNumber"
                  placeholder="+57 300 000 0000"
                  value={formik.values.whatsappNumber}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('whatsappNumber')}
                  required
                />
                <Input
                  label="Email de soporte"
                  id="supportEmail"
                  name="supportEmail"
                  type="email"
                  placeholder="soporte@empresa.com"
                  value={formik.values.supportEmail ?? ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('supportEmail')}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="País"
                  id="country"
                  name="country"
                  options={COUNTRY_OPTIONS}
                  value={formik.values.country}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('country')}
                />
                <Input
                  label="Ciudad"
                  id="city"
                  name="city"
                  placeholder="Ej: Bogotá"
                  value={formik.values.city}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('city')}
                  required
                />
                <Select
                  label="Moneda"
                  id="currency"
                  name="currency"
                  options={CURRENCY_OPTIONS}
                  value={formik.values.currency}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError('currency')}
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ── Section 3: Design ── */}
        <Card>
          <CardBody>
            <SectionHeader
              icon={<Palette className="w-4 h-4 text-indigo-600" />}
              title="Diseño visual"
              description="Elige el modo y la paleta de colores del ecommerce."
            />
            <div className="space-y-5">
              {/* Mode selector */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Modo</p>
                <div className="flex gap-3">
                  {(['light', 'dark'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => void formik.setFieldValue('mode', m)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all',
                        formik.values.mode === m
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      {m === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      {m === 'light' ? 'Light' : 'Dark'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset selector */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Paleta de colores</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {THEME_PRESET_LIST.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => void formik.setFieldValue('themePreset', p.key)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border text-xs font-medium transition-all',
                        formik.values.themePreset === p.key
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      <span
                        className="w-6 h-6 rounded-full shadow-sm"
                        style={{ backgroundColor: p.swatch }}
                      />
                      {p.label}
                      {formik.values.themePreset === p.key && (
                        <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview chip */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                <div
                  className="w-8 h-8 rounded-lg shadow-sm"
                  style={{ backgroundColor: selectedColors.primaryColor }}
                />
                <div
                  className="w-8 h-8 rounded-lg shadow-sm border"
                  style={{
                    backgroundColor: selectedColors.backgroundColor,
                    borderColor: selectedColors.primaryColor + '40',
                  }}
                />
                <div className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    {THEME_PRESET_LIST.find((p) => p.key === formik.values.themePreset)?.label}
                  </span>{' '}
                  · {formik.values.mode === 'light' ? 'Claro' : 'Oscuro'}
                  <span className="ml-2 font-mono" style={{ color: selectedColors.primaryColor }}>
                    {selectedColors.primaryColor}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ── Section 4: Location ── */}
        <Card>
          <CardBody>
            <SectionHeader
              icon={<MapPin className="w-4 h-4 text-indigo-600" />}
              title="Ubicación de la sede principal"
              description="Departamento y ciudad son requeridos. La dirección exacta es opcional."
            />
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Dirección"
                  id="locationAddressLine"
                  name="locationAddressLine"
                  placeholder="Ej: Cra 15 #93-47"
                  value={formik.values.locationAddressLine ?? ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                <Input
                  label="Barrio"
                  id="locationNeighborhood"
                  name="locationNeighborhood"
                  placeholder="Ej: Chapinero"
                  value={formik.values.locationNeighborhood ?? ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Departamento *"
                  id="locationDepartment"
                  name="locationDepartment"
                  value={formik.values.locationDepartment ?? ''}
                  onChange={(e) => {
                    formik.handleChange(e);
                    void formik.setFieldValue('locationCity', '');
                  }}
                  onBlur={formik.handleBlur}
                  error={fieldError('locationDepartment')}
                  options={[
                    { value: '', label: 'Seleccionar departamento...' },
                    ...departments.map((d) => ({ value: d.name, label: d.name })),
                  ]}
                />
                <Select
                  label="Ciudad / Municipio *"
                  id="locationCity"
                  name="locationCity"
                  value={formik.values.locationCity ?? ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  disabled={!formik.values.locationDepartment || loadingGeo}
                  error={fieldError('locationCity')}
                  options={
                    cities.length === 0
                      ? [{ value: '', label: formik.values.locationDepartment ? (loadingGeo ? 'Cargando...' : 'Sin ciudades') : 'Selecciona primero un departamento' }]
                      : [
                          { value: '', label: 'Seleccionar ciudad...' },
                          ...cities.map((c) => ({ value: c.name, label: c.name })),
                        ]
                  }
                />
              </div>
              <Input
                label="Código postal"
                id="locationPostalCode"
                name="locationPostalCode"
                placeholder="Ej: 110111"
                value={formik.values.locationPostalCode ?? ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="locationIsPublic"
                  name="locationIsPublic"
                  checked={formik.values.locationIsPublic}
                  onChange={formik.handleChange}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Mostrar ubicación en el ecommerce público</span>
              </label>
            </div>
          </CardBody>
        </Card>

        {/* ── Section 5: Business hours ── */}
        <Card>
          <CardBody>
            <SectionHeader
              icon={<Clock className="w-4 h-4 text-indigo-600" />}
              title="Horarios de atención"
              description="Configura los horarios de apertura de la empresa."
            />
            <div className="space-y-2">
              {formik.values.businessHours.map((hour, idx) => (
                <div
                  key={hour.dayOfWeek}
                  className={cn(
                    'grid grid-cols-12 gap-2 items-center py-2 px-1 rounded-lg text-sm',
                    hour.isOpen ? 'bg-green-50' : 'bg-gray-50'
                  )}
                >
                  {/* Day toggle */}
                  <div className="col-span-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hour.isOpen}
                      onChange={(e) => {
                        const updated = [...formik.values.businessHours];
                        updated[idx] = { ...updated[idx], isOpen: e.target.checked };
                        void formik.setFieldValue('businessHours', updated);
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className={cn('font-medium text-xs', hour.isOpen ? 'text-gray-800' : 'text-gray-400')}>
                      {DAY_LABELS[hour.dayOfWeek]}
                    </span>
                  </div>

                  {hour.isOpen ? (
                    <>
                      <div className="col-span-4">
                        <input
                          type="time"
                          value={hour.opensAt ?? ''}
                          onChange={(e) => {
                            const updated = [...formik.values.businessHours];
                            updated[idx] = { ...updated[idx], opensAt: e.target.value };
                            void formik.setFieldValue('businessHours', updated);
                          }}
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-1 text-center text-gray-400 text-xs">—</div>
                      <div className="col-span-4">
                        <input
                          type="time"
                          value={hour.closesAt ?? ''}
                          onChange={(e) => {
                            const updated = [...formik.values.businessHours];
                            updated[idx] = { ...updated[idx], closesAt: e.target.value };
                            void formik.setFieldValue('businessHours', updated);
                          }}
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="col-span-9 text-xs text-gray-400 italic">Cerrado</div>
                  )}
                </div>
              ))}
              {typeof formik.errors.businessHours === 'string' && (
                <p className="text-xs text-red-600">{formik.errors.businessHours}</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ── Section 6: Policies ── */}
        <Card>
          <CardBody>
            <SectionHeader
              icon={<FileText className="w-4 h-4 text-indigo-600" />}
              title="Políticas"
              description="Textos legales para el ecommerce público."
            />
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="usePolicyDefaults"
                  name="usePolicyDefaults"
                  checked={formik.values.usePolicyDefaults}
                  onChange={formik.handleChange}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  Usar textos de política por defecto (pueden editarse después)
                </span>
              </label>

              {!formik.values.usePolicyDefaults && (
                <div className="space-y-4 pt-2">
                  <Textarea
                    label="Política de envíos"
                    id="shippingPolicy"
                    name="shippingPolicy"
                    value={formik.values.shippingPolicy ?? ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    rows={3}
                  />
                  <Textarea
                    label="Política de devoluciones"
                    id="returnsPolicy"
                    name="returnsPolicy"
                    value={formik.values.returnsPolicy ?? ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    rows={3}
                  />
                  <Textarea
                    label="Garantía"
                    id="warrantyPolicy"
                    name="warrantyPolicy"
                    value={formik.values.warrantyPolicy ?? ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    rows={3}
                  />
                  <Textarea
                    label="Política de privacidad"
                    id="privacyPolicy"
                    name="privacyPolicy"
                    value={formik.values.privacyPolicy ?? ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    rows={3}
                  />
                  <Textarea
                    label="Términos y condiciones"
                    id="termsAndConditions"
                    name="termsAndConditions"
                    value={formik.values.termsAndConditions ?? ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    rows={3}
                  />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3 pb-8">
          <Button
            type="submit"
            isLoading={formik.isSubmitting}
            disabled={formik.isSubmitting}
          >
            Crear empresa
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void navigate('/admin/stores')}
            disabled={formik.isSubmitting}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
