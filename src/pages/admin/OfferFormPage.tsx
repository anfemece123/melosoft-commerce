import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Formik, Form } from 'formik';
import { ArrowLeft, Tag } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { IntegerInput } from '@/components/forms/IntegerInput';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FormErrorAlert } from '@/components/ui/FormErrorAlert';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { useAppSelector } from '@/app/hooks';
import { offersService } from '@/features/offers/offersService';
import { domainsService } from '@/features/domains/domainsService';
import { productsService } from '@/features/products/productsService';
import { notify } from '@/lib/notifications';
import { slugify } from '@/utils/slugify';
import { formatCurrency } from '@/utils/formatCurrency';
import { calculateDiscountPercentage } from '@/lib/pricing/pricing.utils';
import { offerSchema } from '@/schemas/offer.schema';
import type { OfferFormValues } from '@/schemas/offer.schema';
import type { Product } from '@/features/products/products.types';
import type { Offer } from '@/features/offers/offers.types';
import type { CountdownMode } from '@/types/common.types';

function toISOOrNull(dtLocal: string): string | null {
  if (!dtLocal) return null;
  return new Date(dtLocal).toISOString();
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OfferFormPage() {
  const { storeId, offerId } = useParams<{ storeId: string; offerId: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(offerId);

  const store = useAppSelector((s) => s.stores.current);
  const profile = useAppSelector((s) => s.auth.profile);
  const currentCommerceSettings = useAppSelector((s) => s.stores.currentCommerceSettings);
  const isMenu = currentCommerceSettings?.catalogType === 'menu';
  const currency = store?.currency ?? 'COP';

  const [initialValues, setInitialValues] = useState<OfferFormValues>({
    title: '',
    slug: '',
    subtitle: '',
    description: '',
    productId: '',
    regularPrice: '',
    offerPrice: '',
    countdownMode: 'fixed_window',
    startsAt: '',
    endsAt: '',
    durationMinutes: '',
    showCountdown: true,
    isVisibleInStore: false,
    sortOrder: 0,
    status: 'draft',
    ctaLabel: 'Quiero esta oferta',
    whatsappNumber: '',
    whatsappMessage: '',
    termsAndConditions: '',
  });

  const [loadingOffer, setLoadingOffer] = useState(isEditing);
  const [products, setProducts] = useState<Product[]>([]);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [existingOffer, setExistingOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (!storeId) return;
    void productsService.getProductsByStore(storeId).then(setProducts).catch(() => {});
  }, [storeId]);

  useEffect(() => {
    if (!isEditing || !offerId) return;
    async function loadOffer() {
      try {
        const offer = await offersService.getOfferById(offerId!);
        if (!offer) {
          notify.error('Campaña no encontrada');
          navigate(`/admin/stores/${storeId}/offers`);
          return;
        }
        setExistingOffer(offer);
        setHeroPreview(offer.heroImageUrl);
        setInitialValues({
          title: offer.title,
          slug: offer.slug,
          subtitle: offer.subtitle ?? '',
          description: offer.description,
          productId: offer.productId ?? '',
          regularPrice: offer.regularPrice > 0 ? offer.regularPrice : '',
          offerPrice: offer.offerPrice,
          countdownMode: offer.countdownMode,
          startsAt: toDatetimeLocal(offer.startsAt),
          endsAt: toDatetimeLocal(offer.endsAt),
          durationMinutes: offer.durationMinutes ?? '',
          showCountdown: offer.showCountdown,
          isVisibleInStore: offer.isVisibleInStore,
          sortOrder: offer.sortOrder,
          status: offer.status === 'active' ? 'active' : 'draft',
          ctaLabel: offer.ctaLabel,
          whatsappNumber: offer.whatsappNumber ?? '',
          whatsappMessage: offer.whatsappMessage ?? '',
          termsAndConditions: offer.termsAndConditions ?? '',
        });
      } catch (err) {
        notify.fromError(err);
      } finally {
        setLoadingOffer(false);
      }
    }
    void loadOffer();
  }, [isEditing, offerId, storeId, navigate]);

  async function handleSubmit(values: OfferFormValues) {
    if (!storeId) return;

    let heroImageUrl = existingOffer?.heroImageUrl ?? null;

    if (heroFile) {
      const ownerId = profile?.userId ?? store?.ownerId ?? '';
      const targetId = existingOffer?.id ?? 'temp';
      heroImageUrl = await offersService.uploadOfferImage(ownerId, storeId, targetId, heroFile);
    }

    const payload = {
      storeId,
      productId: values.productId || null,
      title: values.title,
      slug: values.slug,
      subtitle: values.subtitle || null,
      description: values.description,
      regularPrice: Number(values.regularPrice) || 0,
      offerPrice: Number(values.offerPrice),
      countdownMode: values.countdownMode as CountdownMode,
      startsAt: values.countdownMode === 'fixed_window' ? toISOOrNull(values.startsAt) : null,
      endsAt: values.countdownMode === 'fixed_window' ? toISOOrNull(values.endsAt) : null,
      durationMinutes: values.countdownMode === 'per_visitor'
        ? (Number(values.durationMinutes) || null)
        : null,
      showCountdown: values.showCountdown,
      isVisibleInStore: values.isVisibleInStore,
      sortOrder: values.sortOrder === '' ? 0 : values.sortOrder,
      status: values.status as 'draft' | 'active',
      whatsappNumber: values.whatsappNumber || null,
      whatsappMessage: values.whatsappMessage || null,
      ctaLabel: values.ctaLabel,
      heroImageUrl,
      termsAndConditions: values.termsAndConditions || null,
    };

    if (isEditing && existingOffer) {
      await offersService.updateOffer(existingOffer.id, payload);
      notify.success('Campaña actualizada.');
    } else {
      await offersService.createOffer(payload);
      notify.success('Campaña creada.');
    }
    navigate(`/admin/stores/${storeId}/offers`);
  }

  function handleHeroChange(file: File | null) {
    if (!file) return;
    setHeroFile(file);
    setHeroPreview(URL.createObjectURL(file));
  }

  function removeHero() {
    setHeroFile(null);
    setHeroPreview(null);
  }

  const productOptions = products
    .filter((p) => p.status === 'active')
    .map((p) => ({ value: p.id, label: `${p.name} (${formatCurrency(p.regularPrice, 'es-CO', currency)})` }));

  if (loadingOffer) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to={`/admin/stores/${storeId}/offers`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a campañas
        </Link>
      </div>

      <PageHeader
        title={isEditing ? 'Editar campaña' : 'Nueva campaña'}
        description={
          isEditing
            ? 'Modifica los datos de la campaña de oferta.'
            : `Crea una landing de campaña de ${isMenu ? 'menú' : 'producto'} con contador regresivo.`
        }
      />

      <Formik
        initialValues={initialValues}
        enableReinitialize
        validationSchema={offerSchema}
        onSubmit={async (values, { setSubmitting, setStatus }) => {
          try {
            await handleSubmit(values);
          } catch (err) {
            setStatus(err instanceof Error ? err.message : 'Error al guardar');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ values, errors, touched, handleChange, handleBlur, setFieldValue, setFieldTouched, isSubmitting, status }) => (
          <Form className="space-y-6">
            {status && <FormErrorAlert message={status} />}

            {/* Sección 1 — Información de campaña */}
            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-500" />
                  Información de campaña
                </h3>
                <div className="space-y-4">
                  <Input
                    id="title"
                    name="title"
                    label="Título de la campaña *"
                    placeholder="Promo hamburguesa fin de semana"
                    value={values.title}
                    onChange={(e) => {
                      handleChange(e);
                      if (!isEditing) {
                        void setFieldValue('slug', slugify(e.target.value));
                      }
                    }}
                    onBlur={handleBlur}
                    error={touched.title ? errors.title : undefined}
                  />
                  <Input
                    id="slug"
                    name="slug"
                    label="Slug (URL)"
                    placeholder="promo-hamburguesa-fin-de-semana"
                    value={values.slug}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.slug ? errors.slug : undefined}
                    hint={store
                      ? `${domainsService.getPlatformStoreUrl(store.slug)}/o/${values.slug || 'slug-campaña'}`
                      : 'La campaña usará la dirección pública de la empresa'}
                  />
                  <Input
                    id="subtitle"
                    name="subtitle"
                    label="Subtítulo (opcional)"
                    placeholder="Solo este fin de semana"
                    value={values.subtitle}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.subtitle ? errors.subtitle : undefined}
                  />
                  <Textarea
                    id="description"
                    name="description"
                    label="Descripción vendedora *"
                    placeholder="Describe la oferta de manera atractiva para el cliente..."
                    value={values.description}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.description ? errors.description : undefined}
                    rows={4}
                  />
                </div>
              </CardBody>
            </Card>

            {/* Sección 2 — Producto asociado */}
            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 mb-4">
                  {isMenu ? 'Plato asociado' : 'Producto asociado'} (opcional)
                </h3>
                <Select
                  id="productId"
                  name="productId"
                  label={isMenu ? 'Plato del menú' : 'Producto'}
                  placeholder={`Sin ${isMenu ? 'plato' : 'producto'} asociado`}
                  value={values.productId}
                  onChange={(e) => {
                    handleChange(e);
                    const prod = products.find((p) => p.id === e.target.value);
                    if (prod && !values.regularPrice) {
                      void setFieldValue('regularPrice', prod.regularPrice);
                    }
                  }}
                  onBlur={handleBlur}
                  options={productOptions}
                  hint="Al seleccionar un plato/producto, el precio normal se pre-rellena automáticamente."
                />
              </CardBody>
            </Card>

            {/* Sección 3 — Precios */}
            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 mb-4">Precios de campaña</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MoneyInput
                    id="regularPrice"
                    name="regularPrice"
                    label="Precio normal (referencia)"
                    currency={currency}
                    placeholder="30000"
                    value={values.regularPrice}
                    onChange={(value) => void setFieldValue('regularPrice', value)}
                    onBlur={() => void setFieldTouched('regularPrice', true)}
                    error={touched.regularPrice ? errors.regularPrice : undefined}
                    hint="Se muestra tachado para mostrar el ahorro."
                  />
                  <MoneyInput
                    id="offerPrice"
                    name="offerPrice"
                    label="Precio especial de campaña *"
                    currency={currency}
                    placeholder="22000"
                    value={values.offerPrice}
                    onChange={(value) => void setFieldValue('offerPrice', value)}
                    onBlur={() => void setFieldTouched('offerPrice', true)}
                    error={touched.offerPrice ? errors.offerPrice : undefined}
                  />
                </div>
                {/* Preview */}
                {values.offerPrice !== '' && values.regularPrice !== '' &&
                  Number(values.offerPrice) > 0 && Number(values.regularPrice) > Number(values.offerPrice) && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-green-700 text-lg">
                      {formatCurrency(Number(values.offerPrice), 'es-CO', currency)}
                    </span>
                    <span className="text-gray-400 line-through text-sm">
                      {formatCurrency(Number(values.regularPrice), 'es-CO', currency)}
                    </span>
                    <DiscountBadge
                      percentage={calculateDiscountPercentage(
                        Number(values.regularPrice),
                        Number(values.offerPrice)
                      )}
                    />
                    <span className="text-xs text-green-600">
                      Ahorro: {formatCurrency(
                        Number(values.regularPrice) - Number(values.offerPrice),
                        'es-CO',
                        currency
                      )}
                    </span>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Sección 4 — Contador */}
            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 mb-4">Tipo de contador</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {([
                    {
                      value: 'fixed_window',
                      label: 'Ventana fija',
                      desc: 'Todos ven el mismo contador con fecha de vencimiento definida.',
                    },
                    {
                      value: 'per_visitor',
                      label: 'Por visitante',
                      desc: 'Cada persona tiene X minutos desde que abre el link por primera vez.',
                    },
                  ] as { value: CountdownMode; label: string; desc: string }[]).map((option) => (
                    <label
                      key={option.value}
                      className={[
                        'border-2 rounded-xl p-4 cursor-pointer transition-colors',
                        values.countdownMode === option.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="countdownMode"
                        value={option.value}
                        checked={values.countdownMode === option.value}
                        onChange={() => void setFieldValue('countdownMode', option.value)}
                        className="sr-only"
                      />
                      <p className={`font-semibold text-sm ${values.countdownMode === option.value ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                    </label>
                  ))}
                </div>

                {values.countdownMode === 'fixed_window' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      id="startsAt"
                      name="startsAt"
                      type="datetime-local"
                      label="Inicia (opcional)"
                      value={values.startsAt}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                    <Input
                      id="endsAt"
                      name="endsAt"
                      type="datetime-local"
                      label="Vence *"
                      value={values.endsAt}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.endsAt ? errors.endsAt : undefined}
                    />
                  </div>
                )}

                {values.countdownMode === 'per_visitor' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <IntegerInput
                      id="durationMinutes"
                      name="durationMinutes"
                      label="Duración en minutos *"
                      min={1}
                      placeholder="120"
                      value={values.durationMinutes}
                      onChange={(value) => void setFieldValue('durationMinutes', value)}
                      onBlur={() => void setFieldTouched('durationMinutes', true)}
                      error={touched.durationMinutes ? errors.durationMinutes : undefined}
                      hint="Ej: 60 = 1 hora, 120 = 2 horas, 1440 = 24 horas"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <input
                    id="showCountdown"
                    type="checkbox"
                    checked={values.showCountdown}
                    onChange={(e) => void setFieldValue('showCountdown', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="showCountdown" className="text-sm text-gray-700 cursor-pointer">
                    Mostrar contador regresivo en la landing
                  </label>
                </div>
              </CardBody>
            </Card>

            {/* Sección 5 — Imagen de campaña */}
            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 mb-4">Imagen de campaña (opcional)</h3>
                <ImageUploadField
                  id="offer-hero-image"
                  label="Imagen de campaña"
                  assetKind="offer_hero"
                  previewUrl={heroPreview}
                  onFileSelect={handleHeroChange}
                  onClear={heroPreview ? removeHero : undefined}
                  aspectClassName="h-32 w-full max-w-sm rounded-2xl"
                  hint="Usa una imagen horizontal para la portada de la oferta."
                />
                <p className="text-xs text-gray-400 mt-2">
                  Si no se sube imagen, se usará la imagen principal del plato/producto asociado.
                </p>
              </CardBody>
            </Card>

            {/* Sección 6 — WhatsApp */}
            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 mb-4">WhatsApp</h3>
                <div className="space-y-4">
                  <Input
                    id="whatsappNumber"
                    name="whatsappNumber"
                    label="Número de WhatsApp (opcional)"
                    placeholder="+573001234567"
                    value={values.whatsappNumber}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    hint="Si está vacío, se usa el número de la tienda."
                  />
                  <Textarea
                    id="whatsappMessage"
                    name="whatsappMessage"
                    label="Mensaje personalizado (opcional)"
                    placeholder="Hola, quiero aprovechar la promo..."
                    value={values.whatsappMessage}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows={3}
                    hint="El precio de campaña y el código de oferta se agregan automáticamente."
                  />
                  <Input
                    id="ctaLabel"
                    name="ctaLabel"
                    label="Texto del botón principal *"
                    placeholder="Quiero esta oferta"
                    value={values.ctaLabel}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={touched.ctaLabel ? errors.ctaLabel : undefined}
                  />
                </div>
              </CardBody>
            </Card>

            {/* Sección 7 — Configuración */}
            <Card>
              <CardBody>
                <h3 className="font-semibold text-gray-900 mb-4">Configuración</h3>
                <div className="space-y-4">
                  <Select
                    id="status"
                    name="status"
                    label="Estado"
                    value={values.status}
                    onChange={handleChange}
                    options={[
                      { value: 'draft', label: 'Borrador — no visible' },
                      { value: 'active', label: 'Activa — visible por link' },
                    ]}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="isVisibleInStore"
                      type="checkbox"
                      checked={values.isVisibleInStore}
                      onChange={(e) => void setFieldValue('isVisibleInStore', e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isVisibleInStore" className="text-sm text-gray-700 cursor-pointer">
                      Mostrar en la página principal de la tienda
                    </label>
                  </div>
                  <IntegerInput
                    id="sortOrder"
                    name="sortOrder"
                    label="Orden de visualización"
                    min={0}
                    value={values.sortOrder}
                    onChange={(value) => void setFieldValue('sortOrder', value)}
                    onBlur={() => void setFieldTouched('sortOrder', true)}
                    error={touched.sortOrder ? errors.sortOrder : undefined}
                    hint="Número menor = aparece primero."
                  />
                  <Textarea
                    id="termsAndConditions"
                    name="termsAndConditions"
                    label="Términos y condiciones (opcional)"
                    placeholder="Oferta válida hasta agotar existencias..."
                    value={values.termsAndConditions}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    rows={3}
                  />
                </div>
              </CardBody>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pb-8">
              <Link to={`/admin/stores/${storeId}/offers`}>
                <Button type="button" variant="ghost">Cancelar</Button>
              </Link>
              <Button type="submit" isLoading={isSubmitting}>
                {isEditing ? 'Guardar cambios' : 'Crear campaña'}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
}
