import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import { Palette, FileText, CreditCard, ShoppingBag, Save, CheckCircle, Building2, Sun, Moon, Plus, Images, AlertTriangle, ExternalLink, LayoutTemplate } from 'lucide-react';
import { useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { paymentsService } from '@/features/payments/paymentsService';
import type { StorePaymentSettings } from '@/features/payments/payments.types';
import { getWompiAvailability } from '@/features/payments/wompiStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { SwitchField } from '@/components/ui/SwitchField';
import { StoreLogoField } from '@/components/admin/StoreLogoField';
import { StoreHeroSlideEditor, type EditableStoreHeroSlide } from '@/components/admin/StoreHeroSlideEditor';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  buildCommerceUpdatePayload,
  getCommerceProfile,
  getDefaultHeroCta,
  mapBusinessTypeToBusinessCategory,
  normalizeCommerceSettings,
} from '@/features/stores/storeCommerceProfiles';
import { setCurrentCommerceSettings, setCurrentStore, updateStore as updateStoreAction } from '@/features/stores/storesSlice';
import { storeCommerceService } from '@/features/stores/storeCommerceService';
import { storesService } from '@/features/stores/storesService';
import { notify } from '@/lib/notifications';
import { storeCommerceSchema } from '@/schemas/storeCommerce.schema';
import type { StoreCommerceFormValues } from '@/schemas/storeCommerce.schema';
import { storeGeneralSettingsSchema } from '@/schemas/storeGeneralSettings.schema';
import type { StoreGeneralSettingsFormValues } from '@/schemas/storeGeneralSettings.schema';
import { storeThemeSchema } from '@/schemas/storeTheme.schema';
import { getThemeColors, THEME_PRESET_LIST } from '@/utils/themePresets';
import { cn } from '@/utils/cn';
import type { CatalogType, CommerceMode, DeliveryMode, ThemeMode, ThemePreset, PublicHeaderSettings, PublicHeaderStyle, LogoSize, MenuTextSize, HeaderMenuMode } from '@/types/common.types';
import { DEFAULT_HEADER_SETTINGS } from '@/types/common.types';
import type { Store } from '@/features/stores/stores.types';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';


const CATALOG_TYPE_LABELS: Record<string, string> = {
  physical_products: 'Productos físicos',
  menu: 'Menú / Restaurante',
  services: 'Servicios',
  mixed: 'Mixto',
};

type SellingModeKey = 'catalog_only' | 'whatsapp' | 'web_cod' | 'web_online';
type DeliveryUXKey = 'none' | 'pickup' | 'local' | 'both' | 'national';

function getSellingModeOptions(canUseOnline: boolean) {
  return [
    {
      key: 'catalog_only' as SellingModeKey,
      label: 'Solo catálogo',
      description: 'Los clientes pueden explorar el catálogo o menú. Sin pedidos desde la página.',
      badge: null as string | null,
      badgeColor: null as string | null,
      disabled: false,
    },
    {
      key: 'whatsapp' as SellingModeKey,
      label: 'Pedido por WhatsApp',
      description: 'Los clientes eligen productos y hacen su pedido directamente por WhatsApp.',
      badge: null as string | null,
      badgeColor: null as string | null,
      disabled: false,
    },
    {
      key: 'web_cod' as SellingModeKey,
      label: 'Pedido desde la página',
      description: 'Los clientes agregan productos al pedido, escriben sus datos y pagan contraentrega.',
      badge: 'Recomendado' as string | null,
      badgeColor: '#16a34a' as string | null,
      disabled: false,
    },
    {
      key: 'web_online' as SellingModeKey,
      label: 'Checkout online con pago',
      description: canUseOnline
        ? 'Los clientes pagan antes de confirmar el pedido usando Wompi.'
        : 'Pago en línea con tarjeta o PSE vía Wompi.',
      badge: canUseOnline ? null : 'Requiere configuración' as string | null,
      badgeColor: canUseOnline ? null : '#d97706' as string | null,
      disabled: !canUseOnline,
    },
  ];
}

const DELIVERY_UX_OPTIONS = [
  { key: 'none' as DeliveryUXKey, label: 'Sin entrega', description: 'Atención presencial, para llevar o sin coordinar entrega online.' },
  { key: 'pickup' as DeliveryUXKey, label: 'Recogida en el local', description: 'El cliente pide y pasa a recoger en tu local.', needsPickup: true },
  { key: 'local' as DeliveryUXKey, label: 'Solo domicilio local', description: 'Entregas a domicilio en tu ciudad o zona.', needsLocal: true },
  { key: 'both' as DeliveryUXKey, label: 'Recogida + domicilio local', description: 'El cliente elige si pasa a recoger o pide a domicilio.', needsPickup: true, needsLocal: true },
  { key: 'national' as DeliveryUXKey, label: 'Envío nacional (paquetería)', description: 'Despachos a todo el país por empresa de mensajería.', needsNational: true },
] as const;

type PaymentMethodKey = 'cash_on_delivery' | 'online_only' | 'both';

function getPaymentMethodOptions(canUseOnline: boolean) {
  return [
    {
      key: 'cash_on_delivery' as PaymentMethodKey,
      label: 'Pago contraentrega',
      description: 'El cliente arma el pedido desde la página y paga en efectivo al recibir.',
      badge: null as string | null,
      badgeColor: null as string | null,
      disabled: false,
    },
    {
      key: 'online_only' as PaymentMethodKey,
      label: 'Pago online con Wompi',
      description: canUseOnline
        ? 'El cliente paga con tarjeta o PSE antes de confirmar el pedido.'
        : 'El cliente paga con tarjeta o PSE antes de confirmar el pedido.',
      badge: canUseOnline ? null : 'Requiere configuración' as string | null,
      badgeColor: canUseOnline ? null : '#d97706' as string | null,
      disabled: !canUseOnline,
    },
    {
      key: 'both' as PaymentMethodKey,
      label: 'Contraentrega + pago online',
      description: canUseOnline
        ? 'El cliente elige cómo prefiere pagar al confirmar su pedido.'
        : 'El cliente elige cómo prefiere pagar al confirmar su pedido.',
      badge: canUseOnline ? null : 'Requiere configuración' as string | null,
      badgeColor: canUseOnline ? null : '#d97706' as string | null,
      disabled: !canUseOnline,
    },
  ];
}

function deriveSellingMode(values: StoreCommerceFormValues): SellingModeKey {
  if (values.webOrderEnabled && values.onlineCheckoutEnabled && !values.cashOnDeliveryEnabled) return 'web_online';
  if (values.webOrderEnabled) return 'web_cod';
  if (values.whatsappCheckoutEnabled) return 'whatsapp';
  return 'catalog_only';
}

function deriveDeliveryUX(values: StoreCommerceFormValues): DeliveryUXKey {
  if (values.allowsNationalShipping) return 'national';
  if (values.allowsLocalDelivery && values.allowsPickup) return 'both';
  if (values.allowsLocalDelivery) return 'local';
  if (values.allowsPickup) return 'pickup';
  return 'none';
}

function deriveCommerceMode(sellingKey: SellingModeKey, deliveryKey: DeliveryUXKey): CommerceMode {
  if (sellingKey === 'catalog_only') return 'catalog_only';
  if (deliveryKey === 'national') return 'national_shipping';
  if (deliveryKey === 'local' || deliveryKey === 'both') return 'local_delivery_and_pickup';
  return 'local_orders';
}

function derivePaymentMethod(values: StoreCommerceFormValues): PaymentMethodKey {
  if (values.cashOnDeliveryEnabled && values.onlineCheckoutEnabled) return 'both';
  if (values.onlineCheckoutEnabled) return 'online_only';
  return 'cash_on_delivery';
}

function generateCommerceSummary(values: StoreCommerceFormValues): string {
  const sellingKey = deriveSellingMode(values);
  const deliveryKey = deriveDeliveryUX(values);
  const catalogLabel = CATALOG_TYPE_LABELS[values.catalogType] ?? 'catálogo';
  const parts: string[] = [`Tu tienda mostrará un ${catalogLabel.toLowerCase()}.`];
  switch (sellingKey) {
    case 'catalog_only':
      parts.push('Tu tienda mostrará el catálogo sin recibir pedidos desde la página.');
      break;
    case 'whatsapp':
      parts.push('Los clientes harán pedidos por WhatsApp.');
      break;
    case 'web_cod':
      parts.push('Los clientes podrán armar su pedido en la página y pagar contraentrega.');
      break;
  }
  if (sellingKey !== 'catalog_only') {
    switch (deliveryKey) {
      case 'none': parts.push('Sin entrega programada (presencial o para llevar).'); break;
      case 'pickup': parts.push('Con recogida en tu local.'); break;
      case 'local': parts.push('Con domicilio local.'); break;
      case 'both': parts.push('Con recogida en local y domicilio local.'); break;
      case 'national': parts.push('Con envío nacional por paquetería.'); break;
    }
  }
  return parts.join(' ');
}

type SettingsSection =
  | 'general'
  | 'hero'
  | 'commerce'
  | 'theme'
  | 'header'
  | 'policies'
  | 'payments';

interface ThemeAppearanceFormValues {
  mode: ThemeMode;
  themePreset: ThemePreset;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonRadius: string;
}

const BUTTON_RADIUS_OPTIONS = [
  { value: '8px', label: 'Suave' },
  { value: '16px', label: 'Medio' },
  { value: '24px', label: 'Redondo' },
  { value: '999px', label: 'Píldora' },
];

const TEXT_COLOR_OPTIONS = [
  { value: '#111111', label: 'Negro' },
  { value: '#FFFFFF', label: 'Blanco' },
];

function ThemeColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-10 cursor-pointer rounded-full border-0 bg-transparent p-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p id={id} className="font-mono text-xs text-gray-500">{value.toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
}

function createDefaultHeroSlide(sortOrder: number, store?: Store | null): EditableStoreHeroSlide {
  return {
    id: crypto.randomUUID(),
    sortOrder,
    isActive: true,
    showTitle: true,
    showSubtitle: true,
    showCta: true,
    showMainImage: true,
    showBadgeImage: true,
    title:
      sortOrder === 1
        ? store?.heroTitle ?? store?.slogan ?? store?.name ?? ''
        : '',
    subtitle:
      sortOrder === 1
        ? store?.heroSubtitle ?? store?.description ?? ''
        : '',
    ctaLabel:
      sortOrder === 1
        ? store?.heroCtaLabel ?? getDefaultHeroCta(store?.businessVertical ?? null)
        : getDefaultHeroCta(store?.businessVertical ?? null),
    mainImageUrl: sortOrder === 1 ? store?.heroImageUrl ?? null : null,
    backgroundImageUrl: sortOrder === 1 ? store?.heroBackgroundImageUrl ?? null : null,
    badgeImageUrl: null,
  };
}

export function StoreSettingsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const dispatch = useAppDispatch();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [saved, setSaved] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [heroEnabled, setHeroEnabled] = useState(true);
  const [heroSlides, setHeroSlides] = useState<EditableStoreHeroSlide[]>([]);
  const [activeHeroSlideId, setActiveHeroSlideId] = useState<string | null>(null);
  const [heroLoading, setHeroLoading] = useState(false);
  const [heroSaving, setHeroSaving] = useState(false);
  const [heroSaved, setHeroSaved] = useState(false);
  const [heroStatus, setHeroStatus] = useState<string | null>(null);
  const [heroUploadErrors, setHeroUploadErrors] = useState<Record<string, string>>({});
  const [heroUploadingBySlot, setHeroUploadingBySlot] = useState<Record<string, boolean>>({});
  const [wompiSettings, setWompiSettings] = useState<StorePaymentSettings | null>(null);
  const [themeSaved, setThemeSaved] = useState(false);
  const [headerSettings, setHeaderSettings] = useState<PublicHeaderSettings>({ ...DEFAULT_HEADER_SETTINGS });
  const [headerSaved, setHeaderSaved] = useState(false);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [themeInitialValues, setThemeInitialValues] = useState<ThemeAppearanceFormValues>(() => {
    const defaults = getThemeColors('blue', 'light');
    return {
      mode: 'light',
      themePreset: 'blue',
      primaryColor: defaults.primaryColor,
      secondaryColor: defaults.secondaryColor,
      accentColor: defaults.accentColor,
      backgroundColor: defaults.backgroundColor,
      textColor: defaults.textColor,
      buttonRadius: defaults.buttonRadius,
    };
  });

  const currentStore = useAppSelector((s) => s.stores.current);
  const currentCommerceSettings = useAppSelector((s) => s.stores.currentCommerceSettings);
  const derivedBusinessCategory = mapBusinessTypeToBusinessCategory(currentStore?.businessType);

  useEffect(() => {
    if (!storeId) return;
    // Load Wompi settings to determine if online checkout is available
    paymentsService
      .getStorePaymentSettings(storeId)
      .then((data) => setWompiSettings(data))
      .catch(() => setWompiSettings(null));
  }, [storeId]);

  // Store/commerce settings are hydrated by StoreAccessRoute
  // (useEnsureCurrentStore) before this page renders.
  useEffect(() => {
    if (!storeId) return;

    storesService
      .getStoreTheme(storeId)
      .then((theme) => {
        if (theme) {
          const presetDefaults = getThemeColors(theme.themePreset, theme.mode);
          setThemeInitialValues({
            mode: theme.mode,
            themePreset: theme.themePreset,
            primaryColor: theme.primaryColor ?? presetDefaults.primaryColor,
            secondaryColor: theme.secondaryColor ?? presetDefaults.secondaryColor,
            accentColor: theme.accentColor ?? presetDefaults.accentColor,
            backgroundColor: theme.backgroundColor ?? presetDefaults.backgroundColor,
            textColor: theme.textColor ?? presetDefaults.textColor,
            buttonRadius: theme.buttonRadius ?? presetDefaults.buttonRadius,
          });
          if (theme.headerSettings) {
            setHeaderSettings({ ...DEFAULT_HEADER_SETTINGS, ...theme.headerSettings });
          }
          return;
        }

        const defaults = getThemeColors('blue', 'light');
        setThemeInitialValues({
          mode: 'light',
          themePreset: 'blue',
          primaryColor: defaults.primaryColor,
          secondaryColor: defaults.secondaryColor,
          accentColor: defaults.accentColor,
          backgroundColor: defaults.backgroundColor,
          textColor: defaults.textColor,
          buttonRadius: defaults.buttonRadius,
        });
      })
      .catch(() => { /* theme can be configured later */ });
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !currentStore) return;

    setHeroEnabled(currentStore.heroEnabled);
    setHeroLoading(true);
    setHeroStatus(null);

    storesService
      .getStoreHeroSlides(storeId)
      .then((slides) => {
        if (slides.length > 0) {
          const formattedSlides = slides.map((slide) => ({
              id: slide.id,
              sortOrder: slide.sortOrder,
              isActive: slide.isActive,
              showTitle: slide.showTitle,
              showSubtitle: slide.showSubtitle,
              showCta: slide.showCta,
              showMainImage: slide.showMainImage,
              showBadgeImage: slide.showBadgeImage,
              title: slide.title ?? '',
              subtitle: slide.subtitle ?? '',
              ctaLabel: slide.ctaLabel ?? 'Ver menú',
              mainImageUrl: slide.mainImageUrl,
              backgroundImageUrl: slide.backgroundImageUrl,
              badgeImageUrl: slide.badgeImageUrl,
            }));
          setHeroSlides(formattedSlides);
          setActiveHeroSlideId(formattedSlides[0]?.id ?? null);
          return;
        }

        const defaultSlides = [createDefaultHeroSlide(1, currentStore)];
        setHeroSlides(defaultSlides);
        setActiveHeroSlideId(defaultSlides[0].id);
      })
      .catch((err) => {
        const defaultSlides = [createDefaultHeroSlide(1, currentStore)];
        setHeroSlides(defaultSlides);
        setActiveHeroSlideId(defaultSlides[0].id);
        setHeroStatus(err instanceof Error ? err.message : 'No se pudo cargar la portada.');
      })
      .finally(() => {
        setHeroLoading(false);
      });
  }, [storeId, currentStore]);

  useEffect(() => {
    if (heroSlides.length === 0) {
      setActiveHeroSlideId(null);
      return;
    }

    if (!activeHeroSlideId || !heroSlides.some((slide) => slide.id === activeHeroSlideId)) {
      setActiveHeroSlideId(heroSlides[0].id);
    }
  }, [heroSlides, activeHeroSlideId]);

  const generalFormik = useFormik<StoreGeneralSettingsFormValues>({
    enableReinitialize: true,
    initialValues: {
      name: currentStore?.name ?? '',
      slogan: currentStore?.slogan ?? '',
      description: currentStore?.description ?? '',
      whatsappNumber: currentStore?.whatsappNumber ?? '',
      supportEmail: currentStore?.supportEmail ?? '',
      city: currentStore?.city ?? '',
      heroTitle: '',
      heroSubtitle: '',
      heroCtaLabel: '',
      heroImageUrl: '',
      heroBackgroundImageUrl: '',
    },
    validationSchema: storeGeneralSettingsSchema,
    onSubmit: async (values, { setStatus }) => {
      if (!storeId || !currentStore) return;
      try {
        const updated = await storesService.updateStore(storeId, {
          name: values.name,
          slogan: values.slogan || null,
          description: values.description,
          whatsappNumber: values.whatsappNumber,
          supportEmail: values.supportEmail || null,
          city: values.city || null,
          logoUrl: currentStore.logoUrl,
        });
        dispatch(updateStoreAction(updated));
        dispatch(setCurrentStore(updated));
        setGeneralSaved(true);
        setTimeout(() => setGeneralSaved(false), 3000);
        setStatus(undefined);
        notify.success('Información general guardada.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Error al guardar la información');
        notify.fromError(err, 'No se pudo guardar la información general.');
      }
    },
  });

  useScrollToFirstFormikError({
    errors: generalFormik.errors,
    submitCount: generalFormik.submitCount,
    isSubmitting: generalFormik.isSubmitting,
  });

  const formik = useFormik<StoreCommerceFormValues>({
    enableReinitialize: true,
    initialValues: normalizeCommerceSettings({
      businessCategory: currentCommerceSettings?.businessCategory ?? derivedBusinessCategory,
      catalogType: (currentCommerceSettings?.catalogType ?? 'physical_products') as CatalogType,
      commerceMode: (currentCommerceSettings?.commerceMode ?? 'catalog_only') as CommerceMode,
      deliveryMode: (currentCommerceSettings?.deliveryMode ?? 'none') as DeliveryMode,
      allowsPickup: currentCommerceSettings?.allowsPickup ?? false,
      allowsLocalDelivery: currentCommerceSettings?.allowsLocalDelivery ?? false,
      allowsNationalShipping: currentCommerceSettings?.allowsNationalShipping ?? false,
      whatsappCheckoutEnabled: currentCommerceSettings?.whatsappCheckoutEnabled ?? true,
      webOrderEnabled: currentCommerceSettings?.webOrderEnabled ?? false,
      onlineCheckoutEnabled: currentCommerceSettings?.onlineCheckoutEnabled ?? false,
      cashOnDeliveryEnabled: currentCommerceSettings?.cashOnDeliveryEnabled ?? false,
      defaultOrderMethod: currentCommerceSettings?.defaultOrderMethod ?? 'whatsapp',
      localDeliveryNotes: currentCommerceSettings?.localDeliveryNotes ?? '',
      shippingNotes: currentCommerceSettings?.shippingNotes ?? '',
    }),
    validationSchema: storeCommerceSchema,
    onSubmit: async (values, { setStatus }) => {
      if (!storeId) return;
      // Guard: prevent saving online checkout config without Wompi ready
      if (values.onlineCheckoutEnabled && !getWompiAvailability(wompiSettings).canUseOnlinePayments) {
        setStatus('Para activar pago online primero debes configurar y activar Wompi en la pestaña Pagos.');
        return;
      }
      try {
        const updated = await storeCommerceService.updateStoreCommerceSettings(
          storeId,
          buildCommerceUpdatePayload(values)
        );
        dispatch(setCurrentCommerceSettings(updated));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        setStatus(undefined);
        notify.success('Configuración comercial guardada.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Error al guardar');
        notify.fromError(err, 'No se pudo guardar la configuración comercial.');
      }
    },
  });

  useScrollToFirstFormikError({
    errors: formik.errors,
    submitCount: formik.submitCount,
    isSubmitting: formik.isSubmitting,
  });

  const commerceProfile = getCommerceProfile(formik.values.businessCategory);
  const wompiAvailability = getWompiAvailability(wompiSettings);

  const currentSellingMode = deriveSellingMode(formik.values);
  const currentDeliveryUX = deriveDeliveryUX(formik.values);
  const currentPaymentMethod = derivePaymentMethod(formik.values);
  const showPaymentBlock = currentSellingMode === 'web_cod' || currentSellingMode === 'web_online';

  function handleSellingModeChange(key: SellingModeKey) {
    const newCommerceMode = deriveCommerceMode(key === 'web_online' ? 'web_cod' : key, key === 'catalog_only' ? 'none' : currentDeliveryUX);
    let patch: Partial<StoreCommerceFormValues>;
    switch (key) {
      case 'catalog_only':
        patch = {
          commerceMode: 'catalog_only',
          whatsappCheckoutEnabled: false,
          webOrderEnabled: false,
          onlineCheckoutEnabled: false,
          cashOnDeliveryEnabled: false,
          defaultOrderMethod: 'whatsapp',
          deliveryMode: 'none',
          allowsPickup: false,
          allowsLocalDelivery: false,
          allowsNationalShipping: false,
        };
        break;
      case 'whatsapp':
        patch = { commerceMode: newCommerceMode, whatsappCheckoutEnabled: true, webOrderEnabled: false, onlineCheckoutEnabled: false, cashOnDeliveryEnabled: false, defaultOrderMethod: 'whatsapp' };
        break;
      case 'web_cod':
        patch = { commerceMode: newCommerceMode, whatsappCheckoutEnabled: false, webOrderEnabled: true, onlineCheckoutEnabled: false, cashOnDeliveryEnabled: true, defaultOrderMethod: 'web_order' };
        break;
      case 'web_online':
        patch = { commerceMode: newCommerceMode, whatsappCheckoutEnabled: false, webOrderEnabled: true, onlineCheckoutEnabled: true, cashOnDeliveryEnabled: false, defaultOrderMethod: 'online_checkout' };
        break;
    }
    void formik.setValues({ ...formik.values, ...patch });
  }

  function handlePaymentMethodChange(key: PaymentMethodKey) {
    switch (key) {
      case 'cash_on_delivery':
        void formik.setValues({ ...formik.values, cashOnDeliveryEnabled: true, onlineCheckoutEnabled: false });
        break;
      case 'online_only':
        void formik.setValues({ ...formik.values, cashOnDeliveryEnabled: false, onlineCheckoutEnabled: true });
        break;
      case 'both':
        void formik.setValues({ ...formik.values, cashOnDeliveryEnabled: true, onlineCheckoutEnabled: true });
        break;
    }
  }

  function handleDeliveryUXChange(key: DeliveryUXKey) {
    const newCommerceMode = deriveCommerceMode(currentSellingMode, key);
    let patch: Partial<StoreCommerceFormValues>;
    switch (key) {
      case 'none':
        patch = { commerceMode: newCommerceMode, deliveryMode: 'none', allowsPickup: false, allowsLocalDelivery: false, allowsNationalShipping: false };
        break;
      case 'pickup':
        patch = { commerceMode: newCommerceMode, deliveryMode: 'pickup_only', allowsPickup: true, allowsLocalDelivery: false, allowsNationalShipping: false };
        break;
      case 'local':
        patch = { commerceMode: newCommerceMode, deliveryMode: 'local_delivery', allowsPickup: false, allowsLocalDelivery: true, allowsNationalShipping: false };
        break;
      case 'both':
        patch = { commerceMode: newCommerceMode, deliveryMode: 'local_delivery', allowsPickup: true, allowsLocalDelivery: true, allowsNationalShipping: false };
        break;
      case 'national':
        patch = { commerceMode: newCommerceMode, deliveryMode: 'national_shipping', allowsPickup: false, allowsLocalDelivery: false, allowsNationalShipping: true };
        break;
    }
    void formik.setValues({ ...formik.values, ...patch });
  }

  const themeFormik = useFormik<ThemeAppearanceFormValues>({
    enableReinitialize: true,
    initialValues: themeInitialValues,
    validationSchema: storeThemeSchema,
    onSubmit: async (values, { setStatus }) => {
      if (!storeId) return;
      try {
        await storesService.upsertStoreTheme({
          storeId,
          mode: values.mode,
          themePreset: values.themePreset,
          primaryColor: values.primaryColor,
          secondaryColor: values.secondaryColor,
          accentColor: values.accentColor,
          backgroundColor: values.backgroundColor,
          textColor: values.textColor,
          buttonRadius: values.buttonRadius,
          templateKey: 'default',
        });
        setThemeSaved(true);
        setTimeout(() => setThemeSaved(false), 3000);
        setStatus(undefined);
        notify.success('Tema guardado.');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Error al guardar el tema');
        notify.fromError(err, 'No se pudo guardar el tema.');
      }
    },
  });

  useScrollToFirstFormikError({
    errors: themeFormik.errors,
    submitCount: themeFormik.submitCount,
    isSubmitting: themeFormik.isSubmitting,
  });

  const sellingModeOptions = getSellingModeOptions(wompiAvailability.canUseOnlinePayments);
  const visibleSellingModes = sellingModeOptions.filter((opt) => {
    if (opt.key === 'catalog_only') return true;
    if (opt.key === 'whatsapp') return commerceProfile.allowWhatsappOrders;
    if (opt.key === 'web_cod') return commerceProfile.allowWebsiteOrders;
    if (opt.key === 'web_online') return commerceProfile.allowWebsiteOrders;
    return false;
  });
  const paymentMethodOptions = getPaymentMethodOptions(wompiAvailability.canUseOnlinePayments);

  const hasDeliveryOptions = commerceProfile.allowPickup || commerceProfile.allowLocalDelivery || commerceProfile.allowNationalShipping;

  const visibleDeliveryOptions = DELIVERY_UX_OPTIONS.filter((opt) => {
    if (opt.key === 'none') return true;
    if ('needsPickup' in opt && opt.needsPickup && !commerceProfile.allowPickup) return false;
    if ('needsLocal' in opt && opt.needsLocal && !commerceProfile.allowLocalDelivery) return false;
    if ('needsNational' in opt && opt.needsNational && !commerceProfile.allowNationalShipping) return false;
    return true;
  });
  const activeHeroSlide = heroSlides.find((slide) => slide.id === activeHeroSlideId) ?? heroSlides[0] ?? null;
  const heroPreviewTheme = buildStorefrontTheme({
    mode: themeFormik.values.mode,
    primaryColor: themeFormik.values.primaryColor,
    secondaryColor: themeFormik.values.backgroundColor,
    accentColor: themeFormik.values.primaryColor,
    backgroundColor: themeFormik.values.backgroundColor,
    textColor: themeFormik.values.textColor,
    buttonRadius: themeFormik.values.buttonRadius,
  });
  async function handleSaveHeaderSettings() {
    if (!storeId) return;
    setHeaderSaving(true);
    try {
      await storesService.updateStoreTheme(storeId, { headerSettings });
      setHeaderSaved(true);
      setTimeout(() => setHeaderSaved(false), 3000);
      notify.success('Header guardado.');
    } catch (err) {
      notify.fromError(err, 'No se pudo guardar la configuración del header.');
    } finally {
      setHeaderSaving(false);
    }
  }

  const sections: { key: SettingsSection; label: string }[] = [
    { key: 'general', label: 'Información general' },
    { key: 'hero', label: 'Portada pública' },
    { key: 'commerce', label: 'Configuración comercial' },
    { key: 'theme', label: 'Tema y apariencia' },
    { key: 'header', label: 'Header público' },
    { key: 'policies', label: 'Políticas' },
    { key: 'payments', label: 'Pagos' },
  ];

  async function handleLogoSelect(file: File | null) {
    if (!file || !storeId || !currentStore) return;
    setLogoUploadError(null);
    setLogoUploading(true);

    try {
      const logoUrl = await storesService.uploadStoreLogo(storeId, file);
      const updated = await storesService.updateStore(storeId, { logoUrl });
      dispatch(updateStoreAction(updated));
      dispatch(setCurrentStore(updated));
      notify.success('Logo actualizado.');
    } catch (err) {
      setLogoUploadError(err instanceof Error ? err.message : 'No se pudo subir el logo');
      notify.fromError(err, 'No se pudo subir el logo.');
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleClearLogo() {
    if (!storeId) return;
    try {
      const updated = await storesService.updateStore(storeId, { logoUrl: null });
      dispatch(updateStoreAction(updated));
      dispatch(setCurrentStore(updated));
      notify.success('Logo eliminado.');
    } catch (err) {
      setLogoUploadError(err instanceof Error ? err.message : 'No se pudo quitar el logo');
      notify.fromError(err, 'No se pudo quitar el logo.');
    }
  }

  function updateHeroSlide(slideId: string, updater: (slide: EditableStoreHeroSlide) => EditableStoreHeroSlide) {
    setHeroSlides((current) =>
      current.map((slide) => (slide.id === slideId ? updater(slide) : slide))
    );
  }

  function setHeroUploadState(key: string, value: boolean) {
    setHeroUploadingBySlot((current) => ({ ...current, [key]: value }));
  }

  function setHeroUploadError(key: string, value: string | null) {
    setHeroUploadErrors((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  async function uploadHeroAsset(
    slideId: string,
    slot: 'main' | 'background' | 'badge',
    file: File | null
  ) {
    if (!file || !storeId) return;

    const key = `${slideId}:${slot}`;
    setHeroUploadError(key, null);
    setHeroUploadState(key, true);

    try {
      const imageUrl = slot === 'main'
        ? await storesService.uploadStoreHeroImage(storeId, file)
        : slot === 'background'
          ? await storesService.uploadStoreHeroBackground(storeId, file)
          : await storesService.uploadStoreHeroBadge(storeId, file);

      updateHeroSlide(slideId, (slide) => ({
        ...slide,
        mainImageUrl: slot === 'main' ? imageUrl : slide.mainImageUrl,
        backgroundImageUrl: slot === 'background' ? imageUrl : slide.backgroundImageUrl,
        badgeImageUrl: slot === 'badge' ? imageUrl : slide.badgeImageUrl,
      }));
    } catch (err) {
      setHeroUploadError(
        key,
        err instanceof Error ? err.message : 'No se pudo subir la imagen.'
      );
      notify.fromError(err, 'No se pudo subir la imagen de portada.');
    } finally {
      setHeroUploadState(key, false);
    }
  }

  function addHeroSlide() {
    setHeroSlides((current) => {
      const nextSlide = createDefaultHeroSlide(current.length + 1, currentStore);
      setActiveHeroSlideId(nextSlide.id);
      return [...current, nextSlide];
    });
  }

  function removeHeroSlide(slideId: string) {
    setHeroSlides((current) =>
      current
        .filter((slide) => slide.id !== slideId)
        .map((slide, index) => ({ ...slide, sortOrder: index + 1 }))
    );
  }

  async function handleHeroSave() {
    if (!storeId || !currentStore) return;

    setHeroSaving(true);
    setHeroStatus(null);

    try {
      const normalizedSlides = heroSlides
        .slice(0, 3)
        .map((slide, index) => ({
          id: slide.id,
          storeId,
          sortOrder: index + 1,
          isActive: slide.isActive,
          showTitle: slide.showTitle,
          showSubtitle: slide.showSubtitle,
          showCta: slide.showCta,
          showMainImage: slide.showMainImage,
          showBadgeImage: slide.showBadgeImage,
          title: slide.title.trim() || null,
          subtitle: slide.subtitle.trim() || null,
          ctaLabel: slide.ctaLabel.trim() || null,
          mainImageUrl: slide.mainImageUrl ?? null,
          backgroundImageUrl: slide.backgroundImageUrl ?? null,
          badgeImageUrl: slide.badgeImageUrl ?? null,
        }));

      const primarySlide = normalizedSlides[0] ?? null;

      const updatedStore = await storesService.updateStore(storeId, {
        heroEnabled,
        heroTitle: primarySlide?.title ?? null,
        heroSubtitle: primarySlide?.subtitle ?? null,
        heroCtaLabel: primarySlide?.ctaLabel ?? null,
        heroImageUrl: primarySlide?.mainImageUrl ?? null,
        heroBackgroundImageUrl: primarySlide?.backgroundImageUrl ?? null,
      });

      await storesService.replaceStoreHeroSlides(storeId, normalizedSlides);
      dispatch(updateStoreAction(updatedStore));
      dispatch(setCurrentStore(updatedStore));
      setHeroSaved(true);
      setTimeout(() => setHeroSaved(false), 3000);
      notify.success('Portada guardada.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar la portada';
      const normalizedMessage = /hero_enabled|store_hero_slides/i.test(message)
        ? 'La configuración avanzada de portada requiere aplicar la migración 019_storefront_hero_carousel.sql en Supabase.'
        : message;
      setHeroStatus(normalizedMessage);
      notify.fromError(err, 'No se pudo guardar la portada.');
    } finally {
      setHeroSaving(false);
    }
  }

  function applyThemeMode(mode: ThemeMode) {
    const backgroundColor = mode === 'dark' ? '#141414' : '#FFFFFF';
    const textColor = mode === 'dark' ? '#FFFFFF' : '#111111';

    void themeFormik.setValues({
      ...themeFormik.values,
      mode,
      backgroundColor,
      textColor,
      secondaryColor: backgroundColor,
    });
  }

  function handleThemeColorChange(field: 'primaryColor' | 'backgroundColor' | 'textColor', value: string) {
    const primaryColor = field === 'primaryColor' ? value : themeFormik.values.primaryColor;
    const backgroundColor = field === 'backgroundColor' ? value : themeFormik.values.backgroundColor;
    const textColor = field === 'textColor' ? value : themeFormik.values.textColor;

    void themeFormik.setValues({
      ...themeFormik.values,
      primaryColor,
      accentColor: primaryColor,
      backgroundColor,
      secondaryColor: backgroundColor,
      textColor,
    });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 bg-gray-50/95 pb-3 backdrop-blur supports-[backdrop-filter]:bg-gray-50/85">
        <PageHeader
          title="Configuración de tienda"
          description="Personaliza el modelo de venta, tema y políticas de esta tienda."
          sticky={false}
          className="mb-4"
        />

        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50/90 md:overflow-x-visible">
          {sections.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={[
                'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px',
                activeSection === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
      <div className={cn('space-y-6 pb-6', activeSection === 'hero' ? 'max-w-7xl' : 'max-w-3xl')}>
        {activeSection === 'general' && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-5">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Información general</h2>
            </div>

            <form onSubmit={generalFormik.handleSubmit} noValidate className="space-y-5">
              <StoreLogoField
                id="store-logo-settings"
                previewUrl={currentStore?.logoUrl ?? null}
                onFileSelect={(file) => void handleLogoSelect(file)}
                onClear={() => void handleClearLogo()}
                uploading={logoUploading}
                error={logoUploadError ?? undefined}
                hint="Este logo se usa en el ecommerce público de la empresa."
              />

              <Input
                id="name"
                label="Nombre de la empresa"
                {...generalFormik.getFieldProps('name')}
                error={generalFormik.touched.name ? generalFormik.errors.name : undefined}
              />

              <Input
                id="slogan"
                label="Eslogan"
                {...generalFormik.getFieldProps('slogan')}
                error={generalFormik.touched.slogan ? generalFormik.errors.slogan : undefined}
              />

              <Textarea
                id="description"
                label="Descripción"
                rows={3}
                {...generalFormik.getFieldProps('description')}
                error={generalFormik.touched.description ? generalFormik.errors.description : undefined}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="whatsappNumber"
                  label="WhatsApp de contacto"
                  {...generalFormik.getFieldProps('whatsappNumber')}
                  error={generalFormik.touched.whatsappNumber ? generalFormik.errors.whatsappNumber : undefined}
                />
                <Input
                  id="supportEmail"
                  type="email"
                  label="Email de soporte"
                  {...generalFormik.getFieldProps('supportEmail')}
                  error={generalFormik.touched.supportEmail ? generalFormik.errors.supportEmail : undefined}
                />
              </div>

              <Input
                id="city"
                label="Ciudad"
                {...generalFormik.getFieldProps('city')}
                error={generalFormik.touched.city ? generalFormik.errors.city : undefined}
              />

              {typeof generalFormik.status === 'string' && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {generalFormik.status}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" isLoading={generalFormik.isSubmitting}>
                  <Save className="w-4 h-4 mr-1.5" />
                  Guardar información
                </Button>
                {generalSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Guardado
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>
        )}

        {activeSection === 'hero' && (
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3">
              <Images className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Portada pública</h2>
            </div>

            <div className="space-y-5">
              <SwitchField
                id="hero-enabled"
                label="Mostrar portada pública"
                description="Si la desactivas, la página pública empieza directamente con el contenido inferior."
                checked={heroEnabled}
                onChange={setHeroEnabled}
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addHeroSlide}
                  disabled={heroSlides.length >= 3}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Agregar pantalla
                </Button>
                <p className="text-xs text-gray-500">Máximo 3 pantallas.</p>
              </div>

              {heroSlides.length > 1 ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {heroSlides.map((slide) => {
                    const isActive = slide.id === activeHeroSlide?.id;
                    return (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setActiveHeroSlideId(slide.id)}
                        className={[
                          'min-w-[180px] rounded-xl border px-4 py-3 text-left transition-colors',
                          isActive
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 bg-white hover:border-gray-300',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-gray-900">Pantalla {slide.sortOrder}</span>
                          <span
                            className={[
                              'rounded-full px-2 py-0.5 text-[10px] font-medium',
                              slide.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                            ].join(' ')}
                          >
                            {slide.isActive ? 'Activa' : 'Oculta'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {activeHeroSlide ? (
                <StoreHeroSlideEditor
                  key={activeHeroSlide.id}
                  slide={activeHeroSlide}
                  onChange={(nextSlide) => updateHeroSlide(activeHeroSlide.id, () => nextSlide)}
                  onRemove={heroSlides.length > 1 ? () => removeHeroSlide(activeHeroSlide.id) : undefined}
                  onMainImageSelect={(file) => void uploadHeroAsset(activeHeroSlide.id, 'main', file)}
                  onBackgroundImageSelect={(file) => void uploadHeroAsset(activeHeroSlide.id, 'background', file)}
                  onBadgeImageSelect={(file) => void uploadHeroAsset(activeHeroSlide.id, 'badge', file)}
                  mainImageUploading={heroUploadingBySlot[`${activeHeroSlide.id}:main`] ?? false}
                  backgroundImageUploading={heroUploadingBySlot[`${activeHeroSlide.id}:background`] ?? false}
                  badgeImageUploading={heroUploadingBySlot[`${activeHeroSlide.id}:badge`] ?? false}
                  mainImageError={heroUploadErrors[`${activeHeroSlide.id}:main`]}
                  backgroundImageError={heroUploadErrors[`${activeHeroSlide.id}:background`]}
                  badgeImageError={heroUploadErrors[`${activeHeroSlide.id}:badge`]}
                  previewTheme={heroPreviewTheme}
                  storeName={currentStore?.name ?? 'Mi tienda'}
                  logoUrl={currentStore?.logoUrl ?? null}
                />
              ) : null}

              {heroLoading && (
                <p className="text-sm text-gray-500">Cargando configuración de portada...</p>
              )}

              {heroStatus && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {heroStatus}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button type="button" isLoading={heroSaving} onClick={() => void handleHeroSave()}>
                  <Save className="w-4 h-4 mr-1.5" />
                  Guardar portada
                </Button>
                {heroSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Guardado
                  </span>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
        )}

        {activeSection === 'commerce' && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-6">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Configuración comercial</h2>
            </div>

            <form onSubmit={formik.handleSubmit} noValidate className="space-y-8">

              {/* Block 1: Perfil del negocio (read-only) */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">
                  Perfil del negocio
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-gray-900">{commerceProfile.label}</h3>
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    {CATALOG_TYPE_LABELS[formik.values.catalogType] ?? formik.values.catalogType}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{commerceProfile.description}</p>
                <p className="mt-3 text-xs text-gray-400">
                  La categoría del negocio se configura al crear la tienda. Para cambiarla, contacta a soporte.
                </p>
              </div>

              {/* Block 2: Canal de pedido */}
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-0.5">Canal de pedido</p>
                <p className="text-xs text-gray-500 mb-3">Elige cómo tus clientes van a hacer sus pedidos.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleSellingModes.map((opt) => {
                    const isSelected = !opt.disabled && currentSellingMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => {
                          if (!opt.disabled) {
                            handleSellingModeChange(opt.key as SellingModeKey);
                          }
                        }}
                        className={cn(
                          'relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all',
                          opt.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                          isSelected
                            ? 'border-indigo-400 bg-indigo-50 shadow-sm ring-1 ring-indigo-200'
                            : !opt.disabled ? 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30' : 'border-gray-200 bg-gray-50'
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                            isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                          )}
                        >
                          {isSelected && (
                            <div className="h-full w-full rounded-full bg-white" style={{ transform: 'scale(0.45)' }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                            {opt.badge && (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{ backgroundColor: opt.badgeColor ?? '#6b7280' }}
                              >
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">{opt.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wompi hint under selling modes (when web_online is blocked) */}
              {commerceProfile.allowWebsiteOrders && !wompiAvailability.canUseOnlinePayments && currentSellingMode !== 'web_online' && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-amber-800">{wompiAvailability.message}</p>
                    <Link
                      to={`/admin/stores/${storeId}/payments`}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Configurar Wompi
                    </Link>
                  </div>
                </div>
              )}

              {/* Block 3: Formas de pago — solo si web_order_enabled o web_online */}
              {showPaymentBlock && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">Formas de pago</p>
                    <p className="text-xs text-gray-500 mb-3">¿Cómo pagará el cliente cuando haga su pedido desde la página?</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {paymentMethodOptions.map((opt) => {
                        const isSelected = !opt.disabled && currentPaymentMethod === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            disabled={opt.disabled}
                            onClick={() => { if (!opt.disabled) { handlePaymentMethodChange(opt.key); } }}
                            className={cn(
                              'relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all',
                              opt.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                              isSelected
                                ? 'border-indigo-400 bg-indigo-50 shadow-sm ring-1 ring-indigo-200'
                                : !opt.disabled
                                  ? 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                                  : 'border-gray-200 bg-gray-50'
                            )}
                          >
                            <div
                              className={cn(
                                'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                                isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                              )}
                            >
                              {isSelected && (
                                <div className="h-full w-full rounded-full bg-white" style={{ transform: 'scale(0.45)' }} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                                {opt.badge && (
                                  <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                    style={{ backgroundColor: opt.badgeColor ?? '#6b7280' }}
                                  >
                                    {opt.badge}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-gray-500">{opt.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Wompi availability hint */}
                  {!wompiAvailability.canUseOnlinePayments && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-amber-800">{wompiAvailability.message}</p>
                        <Link
                          to={`/admin/stores/${storeId}/payments`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ir a configurar Wompi
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Block 4: ¿Cómo entregas? (only if not catalog_only and profile has delivery options) */}
              {currentSellingMode !== 'catalog_only' && hasDeliveryOptions && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-0.5">¿Cómo entregas?</p>
                  <p className="text-xs text-gray-500 mb-3">Selecciona las opciones de entrega disponibles para tus clientes.</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {visibleDeliveryOptions.map((opt) => {
                      const isSelected = currentDeliveryUX === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleDeliveryUXChange(opt.key)}
                          className={cn(
                            'relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer',
                            isSelected
                              ? 'border-indigo-400 bg-indigo-50 shadow-sm ring-1 ring-indigo-200'
                              : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                          )}
                        >
                          <div
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                              isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                            )}
                          >
                            {isSelected && (
                              <div className="h-full w-full rounded-full bg-white" style={{ transform: 'scale(0.45)' }} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{opt.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Optional delivery notes */}
              {formik.values.allowsLocalDelivery && (
                <Textarea
                  id="localDeliveryNotes"
                  label="Notas de domicilio local"
                  placeholder="Ej: Cubrimos los barrios X, Y, Z. Tiempo estimado 30–45 min."
                  rows={2}
                  {...formik.getFieldProps('localDeliveryNotes')}
                  error={formik.touched.localDeliveryNotes ? formik.errors.localDeliveryNotes : undefined}
                />
              )}

              {formik.values.allowsNationalShipping && (
                <Textarea
                  id="shippingNotes"
                  label="Notas de envío nacional"
                  placeholder="Ej: Envíos a todo el país por Servientrega. Costo según peso y destino."
                  rows={2}
                  {...formik.getFieldProps('shippingNotes')}
                  error={formik.touched.shippingNotes ? formik.errors.shippingNotes : undefined}
                />
              )}

              {/* Block 5: Summary */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  Resumen de la configuración
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {generateCommerceSummary(formik.values)}
                </p>
              </div>

              {typeof formik.status === 'string' && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formik.status}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" isLoading={formik.isSubmitting}>
                  <Save className="w-4 h-4 mr-1.5" />
                  Guardar configuración
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Guardado
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>
        )}

        {activeSection === 'theme' && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-5">
              <Palette className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Tema y apariencia</h2>
            </div>

            <form onSubmit={themeFormik.handleSubmit} noValidate className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">1. Elige el estilo base</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['light', 'dark'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => applyThemeMode(mode)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all',
                        themeFormik.values.mode === mode
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      {mode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {mode === 'light' ? 'Claro' : 'Oscuro'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-sm font-medium text-gray-700">2. Color principal sugerido</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {THEME_PRESET_LIST.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handleThemeColorChange('primaryColor', preset.swatch)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                          themeFormik.values.primaryColor.toUpperCase() === preset.swatch.toUpperCase()
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        )}
                      >
                        <span
                          className="h-5 w-5 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.swatch }}
                        />
                        <span className="truncate">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <ThemeColorField
                  id="primaryColor"
                  label="3. Color principal"
                  value={themeFormik.values.primaryColor}
                  onChange={(value) => handleThemeColorChange('primaryColor', value)}
                />
                <ThemeColorField
                  id="backgroundColor"
                  label="4. Color de fondo"
                  value={themeFormik.values.backgroundColor}
                  onChange={(value) => handleThemeColorChange('backgroundColor', value)}
                />
                <div className="space-y-2">
                  <p className="block text-sm font-medium text-gray-700">5. Color de letra</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TEXT_COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleThemeColorChange('textColor', option.value)}
                        className={cn(
                          'rounded-xl border px-3 py-3 text-sm font-medium transition-all',
                          themeFormik.values.textColor.toUpperCase() === option.value.toUpperCase()
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        )}
                      >
                        <span
                          className="mx-auto mb-2 block h-5 w-12 rounded border"
                          style={{ backgroundColor: option.value, borderColor: '#d1d5db' }}
                        />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Select
                  id="buttonRadius"
                  label="Forma de botones"
                  options={BUTTON_RADIUS_OPTIONS}
                  {...themeFormik.getFieldProps('buttonRadius')}
                  error={themeFormik.touched.buttonRadius ? themeFormik.errors.buttonRadius : undefined}
                />
              </div>

              <div
                className="overflow-hidden rounded-2xl border"
                style={{
                  background: themeFormik.values.mode === 'dark'
                    ? [
                        'radial-gradient(circle at 20% 22%, rgba(255,255,255,0.06) 0, transparent 18%)',
                        'radial-gradient(circle at 75% 24%, rgba(255,255,255,0.05) 0, transparent 16%)',
                        'repeating-linear-gradient(105deg, rgba(255,255,255,0.012) 0 2px, transparent 2px 6px)',
                        `linear-gradient(135deg, ${themeFormik.values.backgroundColor} 0%, ${themeFormik.values.secondaryColor} 58%, #090b0f 100%)`,
                      ].join(', ')
                    : themeFormik.values.backgroundColor,
                  borderColor: `${themeFormik.values.textColor}18`,
                }}
              >
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ backgroundColor: themeFormik.values.secondaryColor }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: themeFormik.values.textColor }}>
                      Vista previa
                    </p>
                    <p className="text-xs" style={{ color: `${themeFormik.values.textColor}AA` }}>
                      Así se verán los colores principales del ecommerce.
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: themeFormik.values.primaryColor,
                      color: themeFormik.values.backgroundColor,
                      borderRadius: themeFormik.values.buttonRadius,
                    }}
                  >
                    {themeFormik.values.mode === 'light' ? 'Light' : 'Dark'}
                  </span>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black" style={{ color: themeFormik.values.textColor }}>
                      Tu portada pública
                    </h3>
                    <p className="max-w-md text-sm" style={{ color: `${themeFormik.values.textColor}CC` }}>
                      Este preview te ayuda a revisar contraste, fondo, jerarquía y el estilo general antes de guardar.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="px-5 py-2.5 text-sm font-semibold"
                      style={{
                        backgroundColor: themeFormik.values.primaryColor,
                        color: themeFormik.values.backgroundColor,
                        borderRadius: themeFormik.values.buttonRadius,
                      }}
                    >
                      Ver menú
                    </button>
                    <div
                      className="rounded-xl border px-4 py-2 text-sm"
                      style={{
                        borderColor: `${themeFormik.values.primaryColor}55`,
                        color: themeFormik.values.textColor,
                        backgroundColor: themeFormik.values.secondaryColor,
                      }}
                    >
                      Tarjeta secundaria
                    </div>
                    <span className="text-sm font-medium" style={{ color: themeFormik.values.accentColor }}>
                      Color acento activo
                    </span>
                  </div>
                </div>
              </div>

              {typeof themeFormik.status === 'string' && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {themeFormik.status}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" isLoading={themeFormik.isSubmitting}>
                  <Save className="w-4 h-4 mr-1.5" />
                  Guardar tema
                </Button>
                {themeSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Guardado
                  </span>
                )}
              </div>
            </form>
          </CardBody>
        </Card>
        )}

        {activeSection === 'header' && (
        <HeaderSettingsSection
          settings={headerSettings}
          onChange={setHeaderSettings}
          onSave={() => void handleSaveHeaderSettings()}
          saving={headerSaving}
          saved={headerSaved}
          catalogType={currentCommerceSettings?.catalogType ?? null}
        />
        )}

        {activeSection === 'policies' && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Políticas</h2>
            </div>
            <p className="text-sm text-gray-500">
              Políticas de envío, devoluciones, garantía, privacidad y términos.
            </p>
            <p className="text-xs text-indigo-500 mt-3 font-medium">Disponible próximamente</p>
          </CardBody>
        </Card>
        )}

        {activeSection === 'payments' && (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Pagos — Wompi</h2>
            </div>

            {/* Status summary */}
            <div className={cn(
              'rounded-xl border px-4 py-4 mb-5',
              wompiAvailability.reason === 'ready'
                ? 'border-green-200 bg-green-50'
                : wompiAvailability.reason === 'disabled'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-200 bg-gray-50'
            )}>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  wompiAvailability.reason === 'ready'
                    ? 'bg-green-100 text-green-700'
                    : wompiAvailability.reason === 'disabled'
                      ? 'bg-amber-100 text-amber-700'
                      : wompiAvailability.reason === 'incomplete'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
                )}>
                  {wompiAvailability.reason === 'ready' && 'Activo'}
                  {wompiAvailability.reason === 'disabled' && 'Desactivado'}
                  {wompiAvailability.reason === 'incomplete' && 'Configuración incompleta'}
                  {wompiAvailability.reason === 'not_configured' && 'No configurado'}
                </span>
              </div>
              <p className="text-sm text-gray-700">{wompiAvailability.message}</p>
              {wompiSettings && (
                <p className="text-xs text-gray-500 mt-1">
                  Entorno: {wompiSettings.environment === 'production' ? 'Producción' : 'Sandbox'}
                  {wompiSettings.publicKey && ` · Clave pública configurada`}
                </p>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Configura las llaves de Wompi para aceptar pagos con tarjeta, PSE y otros métodos.
              Las llaves privadas se procesan de forma segura mediante Edge Functions — nunca quedan expuestas en el navegador.
            </p>

            <Link
              to={`/admin/stores/${storeId}/payments`}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              {wompiAvailability.reason === 'not_configured' ? 'Configurar Wompi' : 'Ver configuración de pagos'}
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </Link>
          </CardBody>
        </Card>
        )}
      </div>
      </div>
    </div>
  );
}

// ── HeaderSettingsSection ────────────────────────────────────

interface HeaderSettingsSectionProps {
  settings: PublicHeaderSettings;
  onChange: (s: PublicHeaderSettings) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  catalogType: string | null;
}

function HeaderToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none',
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

function HeaderSettingsSection({
  settings,
  onChange,
  onSave,
  saving,
  saved,
}: HeaderSettingsSectionProps) {
  function set<K extends keyof PublicHeaderSettings>(key: K, value: PublicHeaderSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  const noIdentity = !settings.showLogo && !settings.showStoreName;

  const STYLE_OPTIONS: Array<{
    key: PublicHeaderStyle;
    label: string;
    description: string;
    preview: React.ReactNode;
  }> = [
    {
      key: 'classic',
      label: 'Clásico',
      description: 'Logo + nombre izquierda · navegación centrada · buscador + carrito derecha.',
      preview: (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
            {/* left: logo + name */}
            <div className="flex items-center gap-1.5 flex-1">
              <div className="w-5 h-5 rounded-full bg-indigo-200 shrink-0" />
              <div className="w-12 h-2 rounded bg-gray-300" />
            </div>
            {/* center: nav */}
            <div className="flex items-center gap-2 flex-1 justify-center">
              <div className="w-5 h-1.5 rounded bg-gray-200" />
              <div className="w-7 h-1.5 rounded bg-gray-200" />
            </div>
            {/* right: search + cart */}
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <div className="w-14 h-4 rounded-md bg-gray-100 border border-gray-200" />
              <div className="w-4 h-4 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'search',
      label: 'Con buscador',
      description: 'Barra de búsqueda central para tiendas con muchos productos o platos.',
      preview: (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-indigo-200" />
                <div className="w-10 h-2 rounded bg-gray-300" />
              </div>
              <div className="flex-1 mx-2 h-4 rounded-md bg-gray-100 border border-gray-200" />
              <div className="w-5 h-5 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <div className="w-6 h-1.5 rounded bg-gray-200" />
              <div className="w-8 h-1.5 rounded bg-indigo-200" />
              <div className="w-7 h-1.5 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      ),
    },
  ];

  const LOGO_SIZE_OPTIONS: Array<{ value: LogoSize; label: string }> = [
    { value: 'sm', label: 'Original' },
    { value: 'md', label: 'Mediano' },
    { value: 'lg', label: 'Grande' },
  ];

  const MENU_TEXT_SIZE_OPTIONS: Array<{ value: MenuTextSize; label: string }> = [
    { value: 'sm', label: 'Original' },
    { value: 'md', label: 'Mediano' },
    { value: 'lg', label: 'Grande' },
  ];

  const MENU_MODE_OPTIONS: Array<{ value: HeaderMenuMode; label: string; description: string }> = [
    {
      value: 'catalog_link',
      label: 'Enlace al catálogo',
      description: 'Muestra un link directo a la página de todos los productos.',
    },
    {
      value: 'categories',
      label: 'Por categorías',
      description: 'Muestra un link por cada categoría de producto activa.',
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="flex items-center gap-3 mb-1">
            <LayoutTemplate className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Header de la tienda</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Elige cómo se verá la parte superior de tu tienda pública.
          </p>

          {/* Style selector */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Estilo del header</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => set('style', opt.key)}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border-2 p-3 text-left transition-all',
                    settings.style === opt.key
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  {opt.preview}
                  <div>
                    <span className={cn('text-sm font-semibold block mb-0.5', settings.style === opt.key ? 'text-indigo-700' : 'text-gray-700')}>
                      {opt.label}
                    </span>
                    <p className="text-xs text-gray-500 leading-snug">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Warning: no identity */}
          {noIdentity && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Recomendamos mostrar al menos el logo o el nombre de la empresa.</p>
            </div>
          )}

          {/* Behavior toggles */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Comportamiento</p>
            <div className="rounded-xl border border-gray-200 bg-white px-4">
              <HeaderToggle
                label="Header fijo al hacer scroll"
                description="El header se mantiene visible cuando el usuario baja por la página."
                checked={settings.isSticky}
                onChange={(v) => set('isSticky', v)}
              />
              <HeaderToggle
                label="Transparente sobre la portada"
                description="El header empieza transparente cuando hay portada y se vuelve sólido al hacer scroll."
                checked={settings.transparentOnHero}
                onChange={(v) => set('transparentOnHero', v)}
              />
            </div>
          </div>

          {/* Identity toggles */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-1">Identidad de la marca</p>
            <div className="rounded-xl border border-gray-200 bg-white px-4">
              <HeaderToggle
                label="Mostrar logo"
                description="Muestra el logo de tu empresa en el header."
                checked={settings.showLogo}
                onChange={(v) => set('showLogo', v)}
              />
              <HeaderToggle
                label="Mostrar nombre de la empresa"
                description="Muestra el nombre junto al logo."
                checked={settings.showStoreName}
                onChange={(v) => set('showStoreName', v)}
              />
              <HeaderToggle
                label="Mostrar enlace 'Inicio'"
                description="Permite que los clientes vuelvan fácilmente a la página principal de la tienda."
                checked={settings.showHomeLink}
                onChange={(v) => set('showHomeLink', v)}
              />
            </div>
          </div>

          {/* Logo size */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">Tamaño del logo</p>
            <div className="flex gap-2">
              {LOGO_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('logoSize', opt.value)}
                  className={cn(
                    'flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all',
                    settings.logoSize === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Menu text size */}
          <div className="mb-5">
            <p className="text-sm font-medium text-gray-700 mb-2">Tamaño del texto de navegación</p>
            <div className="flex gap-2">
              {MENU_TEXT_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('menuTextSize', opt.value)}
                  className={cn(
                    'flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all',
                    settings.menuTextSize === opt.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Menu mode */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Modo de navegación</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MENU_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('menuMode', opt.value)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                    settings.menuMode === opt.value
                      ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                      : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors',
                      settings.menuMode === opt.value ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                    )}
                  >
                    {settings.menuMode === opt.value && (
                      <div className="h-full w-full rounded-full bg-white" style={{ transform: 'scale(0.45)' }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-3 pb-2">
        <Button type="button" onClick={onSave} isLoading={saving}>
          <Save className="w-4 h-4 mr-1.5" />
          Guardar header
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" />
            Guardado
          </span>
        )}
      </div>
    </div>
  );
}
