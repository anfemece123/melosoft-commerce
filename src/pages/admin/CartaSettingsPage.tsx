import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  GripVertical,
  LayoutTemplate,
  ListTree,
  QrCode,
  Save,
  Settings2,
  UtensilsCrossed,
} from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { CartaPreviewFrame, type CartaPreviewDevice } from '@/components/admin/carta/CartaPreviewFrame';
import { CartaNavigationPicker, CartaTemplatePicker } from '@/components/admin/carta/CartaTemplatePicker';
import { CartaCoverEditor } from '@/components/admin/carta/CartaCoverEditor';
import { CartaCategoryImagePicker } from '@/components/admin/carta/CartaCategoryImagePicker';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { SwitchField } from '@/components/ui/SwitchField';
import { EmptyState } from '@/components/ui/EmptyState';
import { PanelLoadingState } from '@/components/ui/LoadingScreen';
import { storeCartaSchema, type StoreCartaFormValues } from '@/schemas/storeCarta.schema';
import { cartaService } from '@/features/carta/cartaService';
import { categoriesService } from '@/features/categories/categoriesService';
import { productsService } from '@/features/products/productsService';
import { storesService } from '@/features/stores/storesService';
import { domainsService } from '@/features/domains/domainsService';
import { generateQrCodeDataUrl } from '@/lib/qrcode';
import { notify } from '@/lib/notifications';
import { formatCurrency } from '@/utils/formatCurrency';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import type { PublicCartaCategory, PublicCartaPage } from '@/features/carta/carta.types';
import type { Store, StoreTheme } from '@/features/stores/stores.types';
import type { StoreDomain } from '@/features/domains/domains.types';
import type { PublicStoreCategory } from '@/types/common.types';
import type { Product } from '@/features/products/products.types';

type EditorTab = 'design' | 'organize' | 'publish';
interface CartaPublicationState {
  enabled: boolean;
  listedInStorefront: boolean;
}

const EMPTY_FORM: StoreCartaFormValues = {
  enabled: false,
  listedInStorefront: false,
  title: '',
  subtitle: '',
  templateKey: 'signature',
  navigationMode: 'continuous',
  showCategoryDescriptions: true,
  coverLayout: 'none',
  coverProductIds: [],
  coverImageUrl: null,
  coverBackgroundImageUrl: null,
  showLogo: true,
  showProductDescriptions: true,
  categoryHeadingAlignment: 'center',
  productImageMode: 'all',
  categoryImageSelections: {},
  categoryImagePositions: {},
  categoryImageSizes: {},
};

function sortBySavedOrder<T extends { id: string }>(items: T[], savedOrder: string[]): T[] {
  if (savedOrder.length === 0) return items;
  const positions = new Map(savedOrder.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const aIndex = positions.get(a.id);
    const bIndex = positions.get(b.id);
    if (aIndex === undefined && bIndex === undefined) return 0;
    if (aIndex === undefined) return 1;
    if (bIndex === undefined) return -1;
    return aIndex - bIndex;
  });
}

function SortableProductRow({ product, currency }: { product: Product; currency: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-shadow ${isDragging ? 'z-10 border-indigo-300 bg-indigo-50 shadow-lg' : 'border-gray-100 bg-white'}`}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`Mover ${product.name}`} className="cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      {product.mainImageUrl ? <img src={product.mainImageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-800">{product.name}</p>
        <p className={`mt-0.5 text-[11px] font-medium ${product.showInCarta && product.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
          {product.showInCarta && product.status === 'active' ? 'Visible en la carta' : 'No visible en la carta'}
        </p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-gray-600">{formatCurrency(product.cartaPrice ?? product.regularPrice, 'es-CO', currency)}</span>
    </div>
  );
}

interface SortableCategoryCardProps {
  category: PublicStoreCategory;
  products: Product[];
  currency: string;
  expanded: boolean;
  onToggle: () => void;
  onProductsReordered: (products: Product[]) => void;
}

function SortableCategoryCard({ category, products, currency, expanded, onToggle, onProductsReordered }: SortableCategoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleProductDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex((product) => product.id === active.id);
    const newIndex = products.findIndex((product) => product.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onProductsReordered(arrayMove(products, oldIndex, newIndex));
  }

  const visibleCount = products.filter((product) => product.showInCarta && product.status === 'active').length;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`overflow-hidden rounded-2xl border bg-white transition-shadow ${isDragging ? 'z-10 border-indigo-300 shadow-xl' : 'border-gray-200 shadow-sm'}`}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button type="button" {...attributes} {...listeners} aria-label={`Mover categoría ${category.name}`} className="cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500"><UtensilsCrossed className="h-4 w-4" /></div>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{category.name}</p>
            <p className="mt-0.5 text-xs text-gray-500">{visibleCount} visibles · {products.length} productos</p>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
        </button>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-3">
          {products.length === 0 ? <p className="py-3 text-center text-sm text-gray-400">Esta categoría todavía no tiene productos.</p> : (
            <DndContext sensors={sensors} onDragEnd={handleProductDragEnd}>
              <SortableContext items={products.map((product) => product.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">{products.map((product) => <SortableProductRow key={product.id} product={product} currency={currency} />)}</div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}

function buildPreviewPage(
  store: Store | null,
  storeTheme: StoreTheme | null,
  values: StoreCartaFormValues,
  categories: PublicStoreCategory[],
  products: Product[]
): PublicCartaPage {
  const visibleProducts = products.filter((product) => product.showInCarta && product.status === 'active');
  const previewCategories: PublicCartaCategory[] = categories.map((category, index) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    sortOrder: index,
    products: visibleProducts
      .filter((product) => product.categoryId === category.id)
      .map((product, productIndex) => ({
        id: product.id,
        name: product.name,
        shortDescription: product.shortDescription,
        imageUrl: product.mainImageUrl,
        price: product.cartaPrice ?? product.regularPrice,
        sortOrder: productIndex,
      })),
  })).filter((category) => category.products.length > 0);

  const uncategorized = visibleProducts.filter((product) => !product.categoryId);
  if (uncategorized.length > 0) {
    previewCategories.push({
      id: null,
      name: 'Otros',
      slug: null,
      description: null,
      imageUrl: null,
      sortOrder: Number.MAX_SAFE_INTEGER,
      products: uncategorized.map((product, index) => ({
        id: product.id,
        name: product.name,
        shortDescription: product.shortDescription,
        imageUrl: product.mainImageUrl,
        price: product.cartaPrice ?? product.regularPrice,
        sortOrder: index,
      })),
    });
  }

  return {
    storeName: store?.name ?? 'Tu restaurante',
    logoUrl: store?.logoUrl ?? null,
    currency: store?.currency ?? 'COP',
    title: values.title || null,
    subtitle: values.subtitle || null,
    templateKey: values.templateKey,
    navigationMode: values.navigationMode,
    showCategoryDescriptions: values.showCategoryDescriptions,
    coverLayout: values.coverLayout,
    coverProductIds: values.coverProductIds,
    coverImageUrl: values.coverImageUrl,
    coverBackgroundImageUrl: values.coverBackgroundImageUrl,
    showLogo: values.showLogo,
    showProductDescriptions: values.showProductDescriptions,
    categoryHeadingAlignment: values.categoryHeadingAlignment,
    productImageMode: values.productImageMode,
    categoryImageSelections: values.categoryImageSelections,
    categoryImagePositions: values.categoryImagePositions,
    categoryImageSizes: values.categoryImageSizes,
    themeMode: storeTheme?.mode ?? null,
    primaryColor: storeTheme?.primaryColor ?? null,
    secondaryColor: storeTheme?.secondaryColor ?? null,
    accentColor: storeTheme?.accentColor ?? null,
    backgroundColor: storeTheme?.backgroundColor ?? null,
    textColor: storeTheme?.textColor ?? null,
    buttonRadius: storeTheme?.buttonRadius ?? null,
    categories: previewCategories,
  };
}

export function CartaSettingsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeFromState = useAppSelector((state) => state.stores.current);
  const [storeData, setStoreData] = useState<Store | null>(storeFromState);
  const [storeTheme, setStoreTheme] = useState<StoreTheme | null>(null);
  const [domains, setDomains] = useState<StoreDomain[]>([]);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('design');
  const [previewDevice, setPreviewDevice] = useState<CartaPreviewDevice>('mobile');
  const [orderDirty, setOrderDirty] = useState(false);
  const [publication, setPublication] = useState<CartaPublicationState>({ enabled: false, listedInStorefront: false });
  const [savedPublication, setSavedPublication] = useState<CartaPublicationState>({ enabled: false, listedInStorefront: false });
  const [loadIssues, setLoadIssues] = useState<string[]>([]);
  const [coverImageUploading, setCoverImageUploading] = useState(false);
  const [coverImageError, setCoverImageError] = useState<string | null>(null);
  const [coverBackgroundUploading, setCoverBackgroundUploading] = useState(false);
  const [coverBackgroundError, setCoverBackgroundError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const formik = useFormik<StoreCartaFormValues>({
    initialValues: EMPTY_FORM,
    validationSchema: storeCartaSchema,
    onSubmit: async (values) => {
      if (!storeId) return;
      const productOrder = [
        ...categories.flatMap((category) => products.filter((product) => product.categoryId === category.id).map((product) => product.id)),
        ...products.filter((product) => !product.categoryId).map((product) => product.id),
      ];
      try {
        await cartaService.upsertCartaSettings({
          storeId,
          enabled: publication.enabled,
          listedInStorefront: publication.listedInStorefront,
          title: values.title || null,
          subtitle: values.subtitle || null,
          templateKey: values.templateKey,
          navigationMode: values.navigationMode,
          showCategoryDescriptions: values.showCategoryDescriptions,
          categoryOrder: categories.map((category) => category.id),
          productOrder,
          coverLayout: values.coverLayout,
          coverProductIds: values.coverProductIds,
          coverImageUrl: values.coverImageUrl,
          coverBackgroundImageUrl: values.coverBackgroundImageUrl,
          showLogo: values.showLogo,
          showProductDescriptions: values.showProductDescriptions,
          categoryHeadingAlignment: values.categoryHeadingAlignment,
          productImageMode: values.productImageMode,
          categoryImageSelections: Object.fromEntries(
            Object.entries(values.categoryImageSelections).filter(([categoryId]) => categories.some((category) => category.id === categoryId))
          ),
          categoryImagePositions: Object.fromEntries(
            Object.entries(values.categoryImagePositions).filter(([categoryId]) => categories.some((category) => category.id === categoryId))
          ),
          categoryImageSizes: Object.fromEntries(
            Object.entries(values.categoryImageSizes).filter(([categoryId]) => categories.some((category) => category.id === categoryId))
          ),
        });
        formik.resetForm({ values: { ...values, ...publication } });
        setSavedPublication(publication);
        setOrderDirty(false);
        notify.success('Carta digital guardada y actualizada');
      } catch (error) {
        notify.fromError(error);
      }
    },
  });

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    async function load() {
      const issues: string[] = [];
      async function safely<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
        try {
          return await promise;
        } catch (error) {
          issues.push(label);
          console.error(`[Carta digital] ${label}`, error);
          return fallback;
        }
      }

      try {
        const [settings, storeResult, themeResult, domainsResult, categoriesResult, productsResult, productImagesResult] = await Promise.all([
          safely('No se pudieron cargar los ajustes guardados.', cartaService.getCartaSettings(storeId!), null),
          safely('No se pudo cargar la información de la tienda.', storeFromState?.id === storeId ? Promise.resolve(storeFromState) : storesService.getStoreById(storeId!), storeFromState?.id === storeId ? storeFromState : null),
          safely('No se pudo cargar el tema; se muestran colores predeterminados.', storesService.getStoreTheme(storeId!), null),
          safely('No se pudieron cargar los dominios.', domainsService.list(storeId!), [] as StoreDomain[]),
          safely('No se pudieron cargar las categorías.', categoriesService.getStoreCategories(storeId!), [] as PublicStoreCategory[]),
          safely('No se pudieron cargar los productos.', productsService.getCartaProductsByStore(storeId!), [] as Product[]),
          safely('No se pudieron cargar las imágenes de galería; se usarán las imágenes principales.', productsService.getProductImagesByStore(storeId!), []),
        ]);
        if (cancelled) return;
        setLoadIssues(issues);
        const values: StoreCartaFormValues = settings ? {
          enabled: settings.enabled,
          listedInStorefront: settings.listedInStorefront,
          title: settings.title ?? '',
          subtitle: settings.subtitle ?? '',
          templateKey: settings.templateKey,
          navigationMode: settings.navigationMode,
          showCategoryDescriptions: settings.showCategoryDescriptions,
          coverLayout: settings.coverLayout,
          coverProductIds: settings.coverImageUrl ? [] : settings.coverProductIds.slice(0, 1),
          coverImageUrl: settings.coverImageUrl,
          coverBackgroundImageUrl: settings.coverBackgroundImageUrl,
          showLogo: settings.showLogo,
          showProductDescriptions: settings.showProductDescriptions,
          categoryHeadingAlignment: settings.categoryHeadingAlignment,
          productImageMode: settings.productImageMode,
          categoryImageSelections: settings.categoryImageSelections,
          categoryImagePositions: settings.categoryImagePositions,
          categoryImageSizes: settings.categoryImageSizes,
        } : EMPTY_FORM;
        formik.resetForm({ values });
        const publicationValues = {
          enabled: settings?.enabled ?? false,
          listedInStorefront: settings?.listedInStorefront ?? false,
        };
        setPublication(publicationValues);
        setSavedPublication(publicationValues);
        setStoreData(storeResult);
        setStoreTheme(themeResult);
        setDomains(domainsResult);
        setCategories(sortBySavedOrder(categoriesResult, settings?.categoryOrder ?? []));
        const primaryImageByProduct = new Map<string, string>();
        for (const image of productImagesResult) {
          if (!primaryImageByProduct.has(image.productId)) primaryImageByProduct.set(image.productId, image.imageUrl);
        }
        const productsWithGalleryImages = productsResult.map((product) => ({
          ...product,
          mainImageUrl: primaryImageByProduct.get(product.id) ?? product.mainImageUrl,
        }));
        setProducts(sortBySavedOrder(productsWithGalleryImages, settings?.productOrder ?? []));
      } catch (error) {
        notify.fromError(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
    // Formik is intentionally initialized from this one load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const publicUrl = storeData ? `${domainsService.getStorePublicUrl(storeData.slug, domains)}/carta` : null;
  const theme = useMemo(() => buildStorefrontTheme({
    mode: storeTheme?.mode,
    primaryColor: storeTheme?.primaryColor,
    secondaryColor: storeTheme?.secondaryColor,
    accentColor: storeTheme?.accentColor,
    backgroundColor: storeTheme?.backgroundColor,
    textColor: storeTheme?.textColor,
    buttonRadius: storeTheme?.buttonRadius,
  }), [storeTheme]);
  const previewPage = useMemo(
    () => buildPreviewPage(storeData, storeTheme, formik.values, categories, products),
    [storeData, storeTheme, formik.values, categories, products]
  );

  async function handleGenerateQr() {
    if (!publicUrl) return;
    try {
      setQrDataUrl(await generateQrCodeDataUrl(publicUrl));
    } catch (error) {
      notify.fromError(error);
    }
  }

  async function handleCoverImageUpload(file: File | null) {
    if (!file || !storeId) return;
    setCoverImageUploading(true);
    setCoverImageError(null);
    try {
      const imageUrl = await storesService.uploadStoreCartaCover(storeId, file);
      await formik.setFieldValue('coverImageUrl', imageUrl);
      await formik.setFieldValue('coverProductIds', []);
      notify.success('Imagen de portada cargada. Guarda la carta para publicarla.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir la imagen de portada.';
      setCoverImageError(message);
      notify.fromError(error, 'No se pudo subir la imagen de portada.');
    } finally {
      setCoverImageUploading(false);
    }
  }

  async function handleCoverBackgroundUpload(file: File | null) {
    if (!file || !storeId) return;
    setCoverBackgroundUploading(true);
    setCoverBackgroundError(null);
    try {
      const imageUrl = await storesService.uploadStoreCartaCoverBackground(storeId, file);
      await formik.setFieldValue('coverBackgroundImageUrl', imageUrl);
      notify.success('Fondo de portada cargado. Guarda la carta para publicarlo.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo subir el fondo de portada.';
      setCoverBackgroundError(message);
      notify.fromError(error, 'No se pudo subir el fondo de portada.');
    } finally {
      setCoverBackgroundUploading(false);
    }
  }

  function handleCategoryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((category) => category.id === active.id);
    const newIndex = categories.findIndex((category) => category.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setCategories(arrayMove(categories, oldIndex, newIndex));
    setOrderDirty(true);
  }

  const publicationDirty = publication.enabled !== savedPublication.enabled
    || publication.listedInStorefront !== savedPublication.listedInStorefront;
  const hasUnsavedChanges = formik.dirty || orderDirty || publicationDirty;
  const categoriesLoadFailed = loadIssues.includes('No se pudieron cargar las categorías.');
  const productsLoadFailed = loadIssues.includes('No se pudieron cargar los productos.');
  const uncategorized = products.filter((product) => !product.categoryId);
  const currency = storeData?.currency ?? 'COP';

  const tabs: Array<{ key: EditorTab; label: string; icon: typeof LayoutTemplate }> = [
    { key: 'design', label: 'Diseño y vista previa', icon: LayoutTemplate },
    { key: 'organize', label: 'Categorías y platos', icon: ListTree },
    { key: 'publish', label: 'Publicación y QR', icon: QrCode },
  ];

  if (loading) {
    return <AdminPanelShell top={<PageHeader title="Carta digital" sticky={false} className="mb-4" />}><PanelLoadingState label="Preparando tu carta…" /></AdminPanelShell>;
  }

  return (
    <AdminPanelShell
      top={(
        <>
          <PageHeader
            title="Carta digital"
            description="Diseña una experiencia de menú profesional para tus clientes en el local."
            sticky={false}
            className="mb-4"
            action={(
              <div className="flex items-center gap-2">
                <label className="hidden cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 sm:flex" title="Publicar Carta digital">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={publication.enabled}
                    onChange={(event) => setPublication((current) => ({ ...current, enabled: event.target.checked }))}
                  />
                  <span className="relative h-5 w-9 rounded-full bg-gray-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-4" />
                  <span className={`text-xs font-semibold ${publication.enabled ? 'text-emerald-700' : 'text-gray-500'}`}>{publication.enabled ? 'Publicada' : 'Sin publicar'}</span>
                </label>
                {publicUrl && <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:inline-flex"><Eye className="h-4 w-4" /> Ver carta</a>}
                <Button type="button" onClick={() => void formik.submitForm()} isLoading={formik.isSubmitting} leftIcon={<Save className="h-4 w-4" />}>
                  {hasUnsavedChanges ? 'Guardar cambios' : 'Guardado'}
                </Button>
              </div>
            )}
          />
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}><Icon className="h-4 w-4" />{tab.label}</button>;
            })}
            <div className="ml-auto hidden items-center gap-1.5 px-3 text-xs font-medium text-gray-400 lg:flex">
              {hasUnsavedChanges ? <><span className="h-2 w-2 rounded-full bg-amber-400" /> Cambios sin guardar</> : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Todo guardado</>}
            </div>
          </div>
        </>
      )}
      contentClassName="pr-0"
    >
      <div className="mx-auto max-w-[1500px] pb-12 pt-5">
        {loadIssues.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Algunos datos secundarios no pudieron cargarse</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-5">{loadIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        )}
        {activeTab === 'design' && (
          <div className="grid items-start gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <Card><CardBody className="p-4 sm:p-5">
                <div className="mb-4"><p className="text-sm font-bold text-gray-900">1. Elige un formato</p><p className="mt-1 text-xs leading-5 text-gray-500">Cada formato reorganiza portada, categorías y platos de una forma distinta.</p></div>
                <CartaTemplatePicker value={formik.values.templateKey} onChange={(value) => void formik.setFieldValue('templateKey', value)} />
              </CardBody></Card>
              <Card><CardBody className="p-4 sm:p-5">
                <div className="mb-4"><p className="text-sm font-bold text-gray-900">2. Imágenes de portada</p><p className="mt-1 text-xs leading-5 text-gray-500">Tú decides si se muestran, cuáles usar y en qué orden.</p></div>
                <CartaCoverEditor
                  products={products}
                  layout={formik.values.coverLayout}
                  selectedProductIds={formik.values.coverProductIds}
                  customImageUrl={formik.values.coverImageUrl}
                  backgroundImageUrl={formik.values.coverBackgroundImageUrl}
                  uploadingCustomImage={coverImageUploading}
                  customImageError={coverImageError}
                  uploadingBackgroundImage={coverBackgroundUploading}
                  backgroundImageError={coverBackgroundError}
                  onLayoutChange={(value) => void formik.setFieldValue('coverLayout', value)}
                  onSelectedProductIdsChange={(value) => void formik.setFieldValue('coverProductIds', value)}
                  onCustomImageFileSelect={(file) => void handleCoverImageUpload(file)}
                  onCustomImageClear={() => {
                    setCoverImageError(null);
                    void formik.setFieldValue('coverImageUrl', null);
                  }}
                  onBackgroundImageFileSelect={(file) => void handleCoverBackgroundUpload(file)}
                  onBackgroundImageClear={() => {
                    setCoverBackgroundError(null);
                    void formik.setFieldValue('coverBackgroundImageUrl', null);
                  }}
                />
              </CardBody></Card>
              <Card><CardBody className="space-y-4 p-4 sm:p-5">
                <div><p className="text-sm font-bold text-gray-900">3. Identidad y textos</p><p className="mt-1 text-xs leading-5 text-gray-500">Los colores siempre se toman del diseño general de tu tienda.</p></div>
                <SwitchField id="carta-show-logo" label="Mostrar logo" description="Puedes ocultarlo para una portada solamente tipográfica." checked={formik.values.showLogo} onChange={(value) => void formik.setFieldValue('showLogo', value)} />
                <Input label="Título de la carta" placeholder="Nuestra carta" {...formik.getFieldProps('title')} error={formik.touched.title ? formik.errors.title : undefined} />
                <Textarea label="Mensaje de bienvenida" placeholder="Sabores preparados para compartir…" rows={3} {...formik.getFieldProps('subtitle')} error={formik.touched.subtitle ? formik.errors.subtitle : undefined} />
              </CardBody></Card>
              <Card><CardBody className="p-4 sm:p-5">
                <div className="mb-3"><p className="text-sm font-bold text-gray-900">4. Navegación y contenido</p><p className="mt-1 text-xs leading-5 text-gray-500">Define cómo se recorre y qué información acompaña cada plato.</p></div>
                <CartaNavigationPicker value={formik.values.navigationMode} onChange={(value) => void formik.setFieldValue('navigationMode', value)} />
                <div className="mt-3 space-y-3">
                  <SwitchField id="carta-category-descriptions" label="Mostrar descripciones de categoría" description="Usa el texto configurado en cada categoría." checked={formik.values.showCategoryDescriptions} onChange={(value) => void formik.setFieldValue('showCategoryDescriptions', value)} />
                  <SwitchField id="carta-product-descriptions" label="Mostrar descripciones de platos" description="Ocúltalas si quieres una carta todavía más limpia." checked={formik.values.showProductDescriptions} onChange={(value) => void formik.setFieldValue('showProductDescriptions', value)} />
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-700">Fotografías dentro de las categorías</p>
                  <p className="mt-1 text-[11px] leading-4 text-gray-500">La portada se configura aparte y no cambia con esta opción.</p>
                  <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
                    {([
                      ['all', 'Una por producto', 'Muestra la foto disponible de cada producto.'],
                      ['first_per_category', 'Una por categoría', 'Abre cada categoría con una sola imagen y deja los productos en una lista limpia.'],
                      ['none', 'Sin fotografías', 'Presenta categorías y productos únicamente con texto y precios.'],
                    ] as const).map(([value, label, description]) => {
                      const selected = formik.values.productImageMode === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => void formik.setFieldValue('productImageMode', value)}
                          className={`flex w-full items-start gap-3 border-b border-gray-100 px-3 py-3 text-left transition last:border-b-0 ${selected ? 'bg-indigo-50/70' : 'hover:bg-gray-50'}`}
                          aria-pressed={selected}
                        >
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-indigo-600' : 'border-gray-300'}`}>
                            {selected && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                          </span>
                          <span>
                            <span className={`block text-xs font-semibold ${selected ? 'text-indigo-700' : 'text-gray-700'}`}>{label}</span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-gray-500">{description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {formik.values.productImageMode === 'first_per_category' && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-700">Elige la imagen de cada categoría</p>
                    <p className="mb-3 mt-1 text-[11px] leading-4 text-gray-500">Puedes usar la foto propia de la categoría o cualquiera de sus productos visibles.</p>
                    <CartaCategoryImagePicker
                      categories={categories}
                      products={products}
                      selections={formik.values.categoryImageSelections}
                      positions={formik.values.categoryImagePositions}
                      sizes={formik.values.categoryImageSizes}
                      onChange={(value) => void formik.setFieldValue('categoryImageSelections', value)}
                      onPositionsChange={(value) => void formik.setFieldValue('categoryImagePositions', value)}
                      onSizesChange={(value) => void formik.setFieldValue('categoryImageSizes', value)}
                    />
                  </div>
                )}
                <div className="mt-4"><p className="mb-2 text-xs font-semibold text-gray-700">Alineación de categorías</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void formik.setFieldValue('categoryHeadingAlignment', 'left')} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${formik.values.categoryHeadingAlignment === 'left' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>A la izquierda</button><button type="button" onClick={() => void formik.setFieldValue('categoryHeadingAlignment', 'center')} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${formik.values.categoryHeadingAlignment === 'center' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'}`}>Centrada</button></div></div>
              </CardBody></Card>
            </aside>
            <section className="min-w-0 xl:sticky xl:top-0">
              <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-gray-900">Previsualización en vivo</h2><p className="mt-0.5 text-xs text-gray-500">Así se verá con el contenido y los colores actuales.</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Vista real</span></div>
              {previewPage.categories.length === 0 && !categoriesLoadFailed && !productsLoadFailed && <div className="mb-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs leading-5 text-gray-600">No hay platos visibles para representar debajo de la portada.</div>}
              <CartaPreviewFrame page={previewPage} theme={theme} device={previewDevice} onDeviceChange={setPreviewDevice} />
            </section>
          </div>
        )}

        {activeTab === 'organize' && (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,650px)_minmax(0,1fr)]">
            <section>
              <Card><CardBody>
                <div className="mb-5"><h2 className="text-base font-bold text-gray-900">Orden de la carta</h2><p className="mt-1 text-sm leading-6 text-gray-500">Arrastra categorías y abre cada una para ordenar sus platos. Este orden solo afecta la carta digital.</p></div>
                {categories.length === 0 ? (categoriesLoadFailed
                  ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center"><p className="text-sm font-semibold text-amber-800">No fue posible cargar las categorías</p><p className="mt-1 text-xs text-amber-700">Tus categorías no se han eliminado. Recarga el editor para volver a consultarlas.</p></div>
                  : <EmptyState icon={<UtensilsCrossed className="h-12 w-12" />} title="Aún no tienes categorías" description="Crea categorías de producto para organizar tu carta digital." />) : (
                  <DndContext sensors={sensors} onDragEnd={handleCategoryDragEnd}>
                    <SortableContext items={categories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
                        {categories.map((category) => (
                          <SortableCategoryCard
                            key={category.id}
                            category={category}
                            products={products.filter((product) => product.categoryId === category.id)}
                            currency={currency}
                            expanded={expandedCategoryId === category.id}
                            onToggle={() => setExpandedCategoryId(expandedCategoryId === category.id ? null : category.id)}
                            onProductsReordered={(reordered) => {
                              let replacementIndex = 0;
                              setProducts((current) => current.map((product) => product.categoryId === category.id ? reordered[replacementIndex++] : product));
                              setOrderDirty(true);
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
                {uncategorized.length > 0 && <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4"><p className="text-sm font-semibold text-gray-700">Sin categoría ({uncategorized.length})</p><p className="mt-1 text-xs leading-5 text-gray-500">Estos platos aparecerán al final, dentro de “Otros”. Asígnales una categoría desde Productos para ubicarlos en otra sección.</p></div>}
              </CardBody></Card>
            </section>
            <section className="min-w-0 xl:sticky xl:top-0">
              <div className="mb-3"><h2 className="text-sm font-bold text-gray-900">Resultado del orden</h2><p className="mt-0.5 text-xs text-gray-500">La previsualización cambia mientras arrastras.</p></div>
              {previewPage.categories.length > 0 && <CartaPreviewFrame page={previewPage} theme={theme} device={previewDevice} onDeviceChange={setPreviewDevice} />}
            </section>
          </div>
        )}

        {activeTab === 'publish' && (
          <div className="mx-auto grid max-w-5xl items-start gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-5">
              <Card className={publication.enabled ? 'border-emerald-200 bg-emerald-50/30' : ''}><CardBody>
                <div className="mb-5 flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${publication.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}><Settings2 className="h-5 w-5" /></div><div><h2 className="font-bold text-gray-900">Estado y visibilidad</h2><p className="mt-1 text-sm leading-6 text-gray-500">Controla cuándo está disponible y desde dónde pueden encontrarla.</p></div></div>
                <div className="space-y-3">
                  <SwitchField id="carta-enabled" label="Publicar Carta digital" description="Activa el enlace público y el código QR para tus clientes." checked={publication.enabled} onChange={(value) => setPublication((current) => ({ ...current, enabled: value }))} />
                  <SwitchField id="carta-listed" label="Mostrar acceso en el ecommerce" description="Añade un acceso a la carta desde tu tienda online. El enlace directo seguirá funcionando." checked={publication.listedInStorefront} onChange={(value) => setPublication((current) => ({ ...current, listedInStorefront: value }))} />
                </div>
              </CardBody></Card>
              {publicUrl && <Card><CardBody><h3 className="text-sm font-bold text-gray-900">Enlace de tu carta</h3><p className="mt-1 text-xs text-gray-500">Compártelo en redes, mensajes o material impreso.</p><div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2 pl-3"><span className="min-w-0 flex-1 truncate text-sm text-gray-600">{publicUrl}</span><a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">Abrir <ExternalLink className="h-3.5 w-3.5" /></a></div></CardBody></Card>}
            </div>
            <Card className="overflow-hidden"><div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-6 py-6 text-white"><QrCode className="h-7 w-7" /><h2 className="mt-4 text-xl font-bold">Tu carta en cada mesa</h2><p className="mt-2 text-sm leading-6 text-indigo-100">Genera el QR, descárgalo e imprímelo en mesas, mostrador o empaques.</p></div><CardBody>
              {qrDataUrl ? <div className="flex flex-col items-center"><div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"><img src={qrDataUrl} alt="Código QR de la carta digital" className="h-48 w-48" /></div><p className="mt-3 text-center text-xs text-gray-500">Apunta la cámara para abrir la carta.</p></div> : <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center"><QrCode className="h-12 w-12 text-gray-300" /><p className="mt-3 text-sm font-semibold text-gray-700">Tu código aparecerá aquí</p><p className="mt-1 text-xs text-gray-500">Puedes regenerarlo cuando quieras.</p></div>}
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Button type="button" variant="secondary" onClick={() => void handleGenerateQr()} disabled={!publicUrl} leftIcon={<QrCode className="h-4 w-4" />}>{qrDataUrl ? 'Regenerar' : 'Generar QR'}</Button>{qrDataUrl && <a href={qrDataUrl} download="carta-digital-qr.png" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"><Download className="h-4 w-4" /> Descargar</a>}</div>
            </CardBody></Card>
          </div>
        )}
      </div>
    </AdminPanelShell>
  );
}
