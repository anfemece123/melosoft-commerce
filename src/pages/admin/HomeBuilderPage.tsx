import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { HomeBuilderCanvas } from '@/components/admin/homeBuilder/canvas/HomeBuilderCanvas';
import { AddHomeSectionModal } from '@/components/admin/homeBuilder/AddHomeSectionModal';
import { SectionWizardModal } from '@/components/admin/homeBuilder/wizard/SectionWizardModal';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentStore, selectMyMemberships } from '@/features/stores/stores.selectors';
import { selectAuthProfile } from '@/features/auth/auth.selectors';
import { canManageStore } from '@/utils/permissions';
import { homeSectionsService } from '@/features/homeSections/homeSectionsService';
import { productsService } from '@/features/products/productsService';
import { categoriesService } from '@/features/categories/categoriesService';
import { storesService } from '@/features/stores/storesService';
import { domainsService } from '@/features/domains/domainsService';
import { buildStorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import { getProductCardCtaLabel, canUseWebOrders, type PublicCommerceConfig } from '@/lib/commerce/commerceConfig.utils';
import type { StoreHomeSection } from '@/features/homeSections/homeSections.types';
import type { HomeSectionType, PublicProductPage, PublicStoreCategory, PublicStorePage } from '@/types/common.types';
import type { PreviewDevice } from '@/components/admin/homeBuilder/previewFrame/StorefrontSectionPreviewFrame';
import { notify } from '@/lib/notifications';

export function HomeBuilderPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const profile = useAppSelector(selectAuthProfile);
  const myMemberships = useAppSelector(selectMyMemberships);
  const store = useAppSelector(selectCurrentStore);

  const canManage = storeId ? canManageStore(profile, myMemberships, storeId) : false;

  // 'hero' is never offered/created from this page anymore — the cover is
  // owned by Store Settings — but a pre-existing row is filtered out
  // defensively so it can never show up in this list even if one exists.
  const [sections, setSections] = useState<StoreHomeSection[]>([]);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  // Public-shaped data (same fetch StoreHomePage itself uses) so both the
  // canvas's section cards and the wizard's live preview can render the
  // *actual* public section renderer — real theme colors, real product
  // cards with variants, real currency formatting — instead of an
  // admin-only approximation. Loaded once here, not per card/wizard open.
  const [publicStore, setPublicStore] = useState<PublicStorePage | null>(null);
  const [publicProducts, setPublicProducts] = useState<PublicProductPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingType, setCreatingType] = useState<HomeSectionType | null>(null);
  const [editingSection, setEditingSection] = useState<StoreHomeSection | null>(null);
  // Lifted here (not owned by HomeBuilderCanvas) so opening the wizard
  // from "Editar" can start its own toggle in sync with whichever device
  // mode the canvas is currently showing.
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');

  useEffect(() => {
    if (!storeId || !store?.slug) return;
    let cancelled = false;
    Promise.all([
      homeSectionsService.getStoreHomeSections(storeId),
      categoriesService.getStoreCategories(storeId),
      storesService.getPublicStoreBySlug(store.slug),
      productsService.getPublicProductsByStoreSlug(store.slug),
    ])
      .then(([sectionsData, categoriesData, publicStoreData, publicProductsData]) => {
        if (cancelled) return;
        setSections(sectionsData.filter((s) => s.sectionType !== 'hero'));
        setCategories(categoriesData);
        setPublicStore(publicStoreData);
        setPublicProducts(publicProductsData);
      })
      .catch((err) => notify.fromError(err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, store?.slug]);

  // Same construction StoreHomePage itself uses (buildStorefrontTheme +
  // commerceConfig.utils) — reused, not reimplemented, so the wizard
  // preview's theme/CTA copy can never drift from what the public page
  // actually renders.
  const previewTheme = useMemo(
    () =>
      buildStorefrontTheme({
        mode: publicStore?.themeMode,
        primaryColor: publicStore?.primaryColor,
        secondaryColor: publicStore?.secondaryColor,
        accentColor: publicStore?.accentColor,
        backgroundColor: publicStore?.backgroundColor,
        textColor: publicStore?.textColor,
        buttonRadius: publicStore?.buttonRadius,
      }),
    [publicStore]
  );
  const previewCommerceConfig: PublicCommerceConfig = {
    catalogType: publicStore?.catalogType ?? null,
    commerceMode: publicStore?.commerceMode ?? null,
    allowsPickup: publicStore?.allowsPickup ?? null,
    allowsLocalDelivery: publicStore?.allowsLocalDelivery ?? null,
    allowsNationalShipping: publicStore?.allowsNationalShipping ?? null,
    whatsappCheckoutEnabled: publicStore?.whatsappCheckoutEnabled ?? null,
    webOrderEnabled: publicStore?.webOrderEnabled ?? null,
    cashOnDeliveryEnabled: publicStore?.cashOnDeliveryEnabled ?? null,
    onlineCheckoutEnabled: publicStore?.onlineCheckoutEnabled ?? null,
    localDeliveryNotes: publicStore?.localDeliveryNotes ?? null,
    shippingNotes: publicStore?.shippingNotes ?? null,
  };
  const previewIsMenu = publicStore?.catalogType === 'menu';
  const previewShowCartButton = canUseWebOrders(previewCommerceConfig);
  const previewProductCardCtaLabel = getProductCardCtaLabel(previewCommerceConfig);
  const previewCurrency = publicStore?.currency ?? 'COP';

  if (!store || !storeId) return <LoadingScreen />;

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-gray-500">No tienes permisos para editar el inicio de esta tienda.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Diseño de inicio"
        description="Organiza las secciones que aparecerán debajo de la portada de tu tienda."
        action={
          <div className="flex items-center gap-2">
            <a
              href={domainsService.getPlatformStoreUrl(store.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Ver tienda
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setPickerOpen(true)}>
              Agregar sección
            </Button>
          </div>
        }
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Cargando secciones…</p>
      ) : (
        <HomeBuilderCanvas
          storeId={storeId}
          sections={sections}
          theme={previewTheme}
          storeSlug={store.slug}
          currency={previewCurrency}
          isMenu={previewIsMenu}
          showCartButton={previewShowCartButton}
          productCardCtaLabel={previewProductCardCtaLabel}
          publicProducts={publicProducts}
          categories={categories}
          viewMode={previewDevice}
          onViewModeChange={setPreviewDevice}
          onSectionsChange={setSections}
          onAddSection={() => setPickerOpen(true)}
          onEditSection={setEditingSection}
        />
      )}

      <AddHomeSectionModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(type) => {
          setPickerOpen(false);
          setCreatingType(type);
        }}
      />

      {creatingType && (
        <SectionWizardModal
          key={creatingType}
          open
          storeId={storeId}
          sectionType={creatingType}
          categories={categories}
          publicProducts={publicProducts}
          theme={previewTheme}
          storeSlug={store.slug}
          currency={previewCurrency}
          isMenu={previewIsMenu}
          showCartButton={previewShowCartButton}
          productCardCtaLabel={previewProductCardCtaLabel}
          initialPreviewDevice={previewDevice}
          onClose={() => setCreatingType(null)}
          onSaved={(created) => {
            setSections((current) => [...current, created]);
            setCreatingType(null);
          }}
        />
      )}

      {editingSection && (
        <SectionWizardModal
          key={editingSection.id}
          open
          storeId={storeId}
          sectionType={editingSection.sectionType}
          existingSection={editingSection}
          categories={categories}
          publicProducts={publicProducts}
          theme={previewTheme}
          storeSlug={store.slug}
          currency={previewCurrency}
          isMenu={previewIsMenu}
          showCartButton={previewShowCartButton}
          productCardCtaLabel={previewProductCardCtaLabel}
          initialPreviewDevice={previewDevice}
          onClose={() => setEditingSection(null)}
          onSaved={(updated) => {
            setSections((current) => current.map((s) => (s.id === updated.id ? updated : s)));
            setEditingSection(null);
          }}
        />
      )}
    </div>
  );
}
