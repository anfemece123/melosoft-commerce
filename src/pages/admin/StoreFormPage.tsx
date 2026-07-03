import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import type { FormikErrors } from 'formik';
import {
  User, Building2, Palette, MapPin, Clock, FileText,
  Sun, Moon, CheckCircle2, AlertCircle, Utensils, ShoppingBag, ClipboardList, Home,
} from 'lucide-react';
import type { BusinessVertical } from '@/types/common.types';
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
import { useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { slugify } from '@/utils/slugify';
import { getThemeColors, THEME_PRESET_LIST } from '@/utils/themePresets';
import type { ThemePreset, ThemeMode } from '@/types/common.types';
import { cn } from '@/utils/cn';
import { geoService } from '@/features/geo/geoService';
import type { GeoDepartment, GeoCity } from '@/features/geo/geo.types';

// ── Business vertical constants ──────────────────────────────

const VERTICAL_OPTIONS: Array<{
  value: BusinessVertical;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'food_restaurant',
    label: 'Restaurante / Comida',
    description: 'Menú, domicilios, recogida, tablero Kanban en tiempo real.',
    icon: <Utensils className="w-5 h-5" />,
  },
  {
    value: 'retail_products',
    label: 'Venta de productos',
    description: 'Catálogo, carrito, pedidos web, envío nacional.',
    icon: <ShoppingBag className="w-5 h-5" />,
  },
  {
    value: 'catalog_quote',
    label: 'Catálogo / Cotización',
    description: 'Solo catálogo público. Cotizaciones y contacto por WhatsApp.',
    icon: <ClipboardList className="w-5 h-5" />,
  },
  {
    value: 'real_estate',
    label: 'Bienes raíces',
    description: 'Propiedades, contacto y solicitud de información. (Próximamente)',
    icon: <Home className="w-5 h-5" />,
  },
];

const SUBCATEGORIES: Record<BusinessVertical, Array<{ value: string; label: string }>> = {
  food_restaurant: [
    { value: 'restaurante', label: 'Restaurante' },
    { value: 'comidas_rapidas', label: 'Comidas rápidas' },
    { value: 'cafeteria', label: 'Cafetería' },
    { value: 'panaderia', label: 'Panadería' },
    { value: 'bar_cafe', label: 'Bar / Café' },
    { value: 'postres', label: 'Postres' },
    { value: 'otro', label: 'Otro' },
  ],
  retail_products: [
    { value: 'lociones_perfumes', label: 'Lociones / perfumes' },
    { value: 'ropa_moda', label: 'Ropa / moda' },
    { value: 'gafas_accesorios', label: 'Gafas / accesorios' },
    { value: 'tecnologia', label: 'Tecnología' },
    { value: 'belleza_cosmeticos', label: 'Belleza / cosméticos' },
    { value: 'salud_bienestar', label: 'Salud / bienestar' },
    { value: 'mascotas', label: 'Mascotas' },
    { value: 'hogar_deco', label: 'Hogar y deco' },
    { value: 'deporte', label: 'Deporte' },
    { value: 'joyeria', label: 'Joyería' },
    { value: 'accesorios', label: 'Accesorios' },
    { value: 'otro', label: 'Otro' },
  ],
  catalog_quote: [
    { value: 'b2b_mayorista', label: 'B2B / Mayorista' },
    { value: 'fabricante', label: 'Fabricante' },
    { value: 'productos_a_medida', label: 'Productos a medida' },
    { value: 'servicios_cotizables', label: 'Servicios cotizables' },
    { value: 'artesanias', label: 'Artesanías' },
    { value: 'catalogo_general', label: 'Catálogo general' },
    { value: 'otro', label: 'Otro' },
  ],
  real_estate: [
    { value: 'inmobiliaria', label: 'Inmobiliaria' },
    { value: 'venta_inmuebles', label: 'Venta de inmuebles' },
    { value: 'arriendo', label: 'Arriendo' },
    { value: 'proyectos_nuevos', label: 'Proyectos nuevos' },
    { value: 'agente_independiente', label: 'Agente independiente' },
    { value: 'otro', label: 'Otro' },
  ],
};

const VERTICAL_PRESET_SUMMARY: Record<BusinessVertical, string[]> = {
  food_restaurant: [
    'Menú digital con categorías de platos',
    'Carrito y pedidos web habilitados',
    'Domicilio local y recogida en local',
    'WhatsApp habilitado',
    'Tablero Kanban de pedidos en tiempo real',
  ],
  retail_products: [
    'Catálogo de productos físicos',
    'Carrito y pedidos web habilitados',
    'WhatsApp habilitado',
    'Envío nacional, domicilio local y recogida',
    'Vista de pedidos tipo ecommerce',
  ],
  catalog_quote: [
    'Catálogo público sin checkout',
    'Solo WhatsApp para cotizaciones',
    'Sin carrito ni pago directo',
    'Ideal para B2B, mayoristas o productos a medida',
  ],
  real_estate: [
    'Catálogo de propiedades (próximamente)',
    'Contacto y solicitud de información por WhatsApp',
    'Sin carrito ni checkout',
    'Vista de leads (próximamente)',
  ],
};

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
  businessVertical: '' as StoreCreationFormValues['businessVertical'],
  businessSubcategory: '' as StoreCreationFormValues['businessSubcategory'],
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

// ── Error summary helpers ─────────────────────────────────────

const FIELD_LABELS: Partial<Record<keyof StoreCreationFormValues, string>> = {
  ownerFullName: 'Nombre del propietario',
  ownerEmail: 'Email del propietario',
  ownerPhone: 'Teléfono del propietario',
  name: 'Nombre de la empresa',
  slug: 'URL (slug) de la tienda',
  businessVertical: 'Tipo de empresa',
  businessSubcategory: 'Subcategoría',
  description: 'Descripción',
  whatsappNumber: 'WhatsApp de contacto',
  country: 'País',
  city: 'Ciudad (empresa)',
  currency: 'Moneda',
  mode: 'Modo de tema',
  themePreset: 'Tema de color',
  locationDepartment: 'Departamento (sede principal)',
  locationCity: 'Ciudad / Municipio (sede principal)',
  businessHours: 'Horario del establecimiento',
};

function getErrorSummary(
  errors: FormikErrors<StoreCreationFormValues>,
  values: StoreCreationFormValues
): string[] {
  const labels: string[] = [];
  for (const key of Object.keys(errors) as Array<keyof StoreCreationFormValues>) {
    const val = errors[key];
    if (!val) continue;
    // Skip businessSubcategory in summary when vertical not chosen yet — user
    // must fix vertical first, subcategory is implicitly blocked.
    if (key === 'businessSubcategory' && !values.businessVertical) continue;
    const label = FIELD_LABELS[key];
    if (label) {
      labels.push(label);
    } else if (key === 'businessHours' && typeof val !== 'string') {
      labels.push('Horario del establecimiento');
    }
  }
  return labels;
}

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
    onSubmit: async (values, { setStatus }) => {
      console.log('[StoreFormPage] formik onSubmit fired', values);
      try {
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

        console.log('[StoreFormPage] calling create-store-with-owner');
        const result = await storesService.createStoreWithOwner({
          ownerFullName: values.ownerFullName,
          ownerEmail: values.ownerEmail,
          ownerPhone: values.ownerPhone,
          ownerDocumentType: values.ownerDocumentType || null,
          ownerDocumentNumber: values.ownerDocumentNumber || null,
          name: values.name,
          slug: values.slug,
          slogan: values.slogan || null,
          businessVertical: values.businessVertical as BusinessVertical,
          businessSubcategory: values.businessSubcategory,
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

        console.log('[StoreFormPage] create-store-with-owner response', result);
        // Optimistically add to Redux so StoresPage shows it immediately
        const loadedStores = await storesService.getStores();
        const newStore = loadedStores.find((s) => s.id === result.storeId);
        if (newStore) dispatch(addStore(newStore));

        void navigate(`/admin/stores/${result.storeId}`);
      } catch (err) {
        console.error('[StoreFormPage] submit error', err);
        setStatus(err instanceof Error ? err.message : 'Error al crear la empresa');
      }
    },
  });

  useScrollToFirstFormikError({
    errors: formik.errors,
    submitCount: formik.submitCount,
    isSubmitting: formik.isSubmitting,
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

  // Show error when the field has been touched OR after a submit attempt —
  // Formik does NOT auto-touch fields on submit, so without submitCount > 0
  // no errors would ever appear after the user clicks "Crear empresa".
  function fieldError(field: keyof StoreCreationFormValues): string | undefined {
    const error = formik.errors[field];
    if (typeof error !== 'string') return undefined;
    const showError = !!formik.touched[field] || formik.submitCount > 0;
    return showError ? error : undefined;
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

  // Per-row business hour errors — only shown after a submit attempt
  const businessHourRowErrors: Array<string | undefined> =
    formik.submitCount > 0 && Array.isArray(formik.errors.businessHours)
      ? (formik.errors.businessHours as Array<Record<string, string> | undefined>).map((rowErr) => {
          if (!rowErr || typeof rowErr !== 'object') return undefined;
          return rowErr.opensAt ?? rowErr.closesAt;
        })
      : [];

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

      {/* DEV-ONLY: raw Formik errors for debugging — remove before shipping */}
      {import.meta.env.DEV && formik.submitCount > 0 && Object.keys(formik.errors).length > 0 && (
        <pre className="mb-4 rounded-lg bg-red-50 p-4 text-xs text-red-700 overflow-auto max-h-48">
          {JSON.stringify(formik.errors, null, 2)}
        </pre>
      )}

      {/* Validation summary: lists the exact fields with errors after a failed submit */}
      {formik.submitCount > 0 && Object.keys(formik.errors).length > 0 && !formik.isSubmitting && (
        <div
          data-error-summary="true"
          className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm"
        >
          <div className="flex items-start gap-2 text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium">Hay campos requeridos sin completar:</p>
              {(() => {
                const summary = getErrorSummary(formik.errors, formik.values);
                const visible = summary.slice(0, 5);
                const extra = summary.length - visible.length;
                return (
                  <>
                    <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-700">
                      {visible.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                      {extra > 0 && <li>…y {extra} campo{extra > 1 ? 's' : ''} más</li>}
                    </ul>
                    <p className="mt-2 text-amber-600">Corrige estos campos para continuar.</p>
                  </>
                );
              })()}
            </div>
          </div>
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
              {/* Vertical selector */}
              <div id="businessVertical" data-field-name="businessVertical">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Tipo de empresa <span className="text-red-500">*</span>
                </p>
                <div className={cn(
                  'grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg p-1 transition-colors',
                  formik.submitCount > 0 && formik.errors.businessVertical
                    ? 'ring-1 ring-red-300 bg-red-50/40'
                    : ''
                )}>
                  {VERTICAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      aria-invalid={formik.submitCount > 0 && !!formik.errors.businessVertical}
                      onClick={() => {
                        void formik.setFieldTouched('businessVertical', true);
                        void formik.setFieldValue('businessVertical', opt.value);
                        void formik.setFieldTouched('businessSubcategory', false);
                        void formik.setFieldValue('businessSubcategory', '');
                      }}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                        formik.values.businessVertical === opt.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      )}
                    >
                      <span className={cn(
                        'mt-0.5 shrink-0',
                        formik.values.businessVertical === opt.value ? 'text-indigo-600' : 'text-gray-400'
                      )}>
                        {opt.icon}
                      </span>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          formik.values.businessVertical === opt.value ? 'text-indigo-700' : 'text-gray-800'
                        )}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {(formik.touched.businessVertical || formik.submitCount > 0) && formik.errors.businessVertical && (
                  <p
                    className="mt-1 text-xs text-red-600"
                    data-error-for="businessVertical"
                  >
                    {formik.errors.businessVertical as string}
                  </p>
                )}
                {/* If vertical not selected, subcategory is also blocked — surface that here */}
                {formik.submitCount > 0 && !formik.values.businessVertical && formik.errors.businessSubcategory && (
                  <p className="mt-0.5 text-xs text-red-500">
                    Selecciona el tipo de empresa para poder elegir la subcategoría.
                  </p>
                )}
              </div>

              {/* Subcategory chips — shown once vertical is selected */}
              {formik.values.businessVertical && (
                <div id="businessSubcategory" data-field-name="businessSubcategory">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Subcategoría <span className="text-red-500">*</span>
                  </p>
                  <div className={cn(
                    'flex flex-wrap gap-2 rounded-lg p-1 transition-colors',
                    formik.submitCount > 0 && formik.errors.businessSubcategory
                      ? 'ring-1 ring-red-300 bg-red-50/40'
                      : ''
                  )}>
                    {SUBCATEGORIES[formik.values.businessVertical as BusinessVertical].map((sub) => (
                      <button
                        key={sub.value}
                        type="button"
                        aria-invalid={formik.submitCount > 0 && !!formik.errors.businessSubcategory}
                        onClick={() => {
                          void formik.setFieldTouched('businessSubcategory', true);
                          void formik.setFieldValue('businessSubcategory', sub.value);
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                          formik.values.businessSubcategory === sub.value
                            ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                  {(formik.touched.businessSubcategory || formik.submitCount > 0) && formik.errors.businessSubcategory && (
                    <p
                      className="mt-1 text-xs text-red-600"
                      data-error-for="businessSubcategory"
                    >
                      {formik.errors.businessSubcategory as string}
                    </p>
                  )}
                </div>
              )}

              {/* Preset summary — shown once subcategory is selected */}
              {formik.values.businessVertical && formik.values.businessSubcategory && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <p className="text-xs font-semibold text-indigo-700 mb-2">
                    Configuración que se aplicará:
                  </p>
                  <ul className="space-y-1">
                    {VERTICAL_PRESET_SUMMARY[formik.values.businessVertical as BusinessVertical].map((item) => (
                      <li key={item} className="flex items-center gap-1.5 text-xs text-indigo-800">
                        <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-indigo-600">
                    Puedes ajustar todo desde la configuración de la tienda después de crearla.
                  </p>
                </div>
              )}
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
              title="Horario del establecimiento"
              description="Horario visible al público en el ecommerce. Opcional — puedes ajustarlo después desde la configuración de la tienda."
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
                  {businessHourRowErrors[idx] && (
                    <p className="col-span-12 mt-0.5 text-xs text-red-600">{businessHourRowErrors[idx]}</p>
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
