import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import { ArrowLeft, Upload, X, Clock, MapPin, Layers, AlertCircle } from 'lucide-react';
import { useScrollToFirstFormikError } from '@/hooks/useScrollToFirstFormikError';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { FormErrorAlert } from '@/components/ui/FormErrorAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { ImageCropDialog } from '@/components/admin/ImageCropDialog';
import { ProductCategorySelect } from '@/components/admin/ProductCategorySelect';
import { ProductCollectionsMultiSelect } from '@/components/admin/ProductCollectionsMultiSelect';
import { ProductFacetAssignments } from '@/components/admin/ProductFacetAssignments';
import { ProductOptionsEditor } from '@/components/admin/ProductOptionsEditor';
import { ProductVariantsEditor } from '@/components/admin/ProductVariantsEditor';
import { ProductDescriptionSectionsEditor } from '@/components/admin/ProductDescriptionSectionsEditor';
import { StockAdjustmentModal } from '@/components/admin/StockAdjustmentModal';
import { MoneyInput } from '@/components/forms/MoneyInput';
import { IntegerInput } from '@/components/forms/IntegerInput';
import { getProductFormLabels } from '@/lib/products/productFormLabels';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentStore, selectCurrentCommerceSettings } from '@/features/stores/stores.selectors';
import { productOptionsService, type ProductOptionGroupDraft } from '@/features/products/productOptionsService';
import { productsService } from '@/features/products/productsService';
import { productVariantsService } from '@/features/products/productVariantsService';
import { inventoryService } from '@/features/products/inventoryService';
import { locationsService } from '@/features/locations/locationsService';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import { categoriesService } from '@/features/categories/categoriesService';
import { collectionsService } from '@/features/collections/collectionsService';
import { facetsService } from '@/features/facets/facetsService';
import type { StoreLocation } from '@/features/locations/locations.types';
import type {
  ProductVariant,
  ProductVariantDraft,
  ProductVariantOption,
  ProductVariantOptionDraft,
} from '@/features/products/productVariants.types';
import { slugify } from '@/utils/slugify';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  calculateDiscountPercentage,
  calculateDiscountAmount,
  calculateSalePriceFromPercentage,
  calculateSalePriceFromFixedAmount,
} from '@/lib/pricing/pricing.utils';
import { productSchema } from '@/schemas/product.schema';
import type { DiscountMode, ProductFormValues } from '@/schemas/product.schema';
import { notify } from '@/lib/notifications';
import { mapSupabaseError } from '@/lib/errors/supabaseErrorMapper';
import type { ProductImage } from '@/features/products/products.types';
import type { ProductDescriptionSection, PublicStoreCategory, PublicStoreCollection } from '@/types/common.types';
import type { StoreFacet } from '@/features/facets/facets.types';
import { IMAGE_ASSET_PRESETS } from '@/lib/images/imageAssetPresets';
import { type LoadedImageFile, validateImageFile } from '@/lib/images/imageFile.utils';

const MAX_IMAGES = 5;

const DISCOUNT_MODES: { value: DiscountMode; label: string }[] = [
  { value: 'none', label: 'Sin descuento' },
  { value: 'direct_price', label: 'Precio promocional' },
  { value: 'percentage', label: '% Descuento' },
  { value: 'fixed_amount', label: 'Valor fijo' },
];

function ToggleField({
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
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
          checked ? 'bg-indigo-600' : 'bg-gray-200',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

// Shared by the initial "load product for editing" fetch and by the
// post-save resync (so local state always matches the DB right after a
// save, without a second round trip) — same mapping in both cases.
function mapSavedVariantsToDrafts(
  options: ProductVariantOption[],
  variants: ProductVariant[]
): ProductVariantDraft[] {
  const valueLookup = new Map(
    options.flatMap((option) =>
      option.values.map((value) => [value.id, { optionName: option.name, value: value.value }])
    )
  );
  return variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku ?? '',
    barcode: variant.barcode,
    price: variant.price ?? '',
    compareAtPrice: variant.compareAtPrice ?? '',
    stockQuantity: variant.stockQuantity,
    stockPolicy: variant.stockPolicy,
    status: variant.status,
    isDefault: variant.isDefault,
    position: variant.position,
    optionSignature: variant.optionSignature,
    optionValues: Object.fromEntries(
      variant.selectedValues
        .map((sv) => valueLookup.get(sv.optionValueId))
        .filter((entry): entry is { optionName: string; value: string } => entry !== undefined)
        .map((entry) => [entry.optionName, entry.value])
    ),
    imageUrl: variant.images[0]?.imageUrl ?? null,
  }));
}

// Same idea as mapSavedVariantsToDrafts, for the options/values side: keeps
// local draft state (including each value's uploaded gallery) in sync with
// the DB right after a save, and clears pendingImageFiles/PreviewUrls so a
// second "Guardar" click can never re-upload the same files.
function mapSavedOptionsToDrafts(options: ProductVariantOption[]): ProductVariantOptionDraft[] {
  return options.map((option) => ({
    clientKey: option.id,
    id: option.id,
    name: option.name,
    type: option.type,
    useAsPublicFilter: option.useAsPublicFilter,
    controlsMedia: option.controlsMedia,
    isRequired: option.isRequired,
    isActive: option.isActive,
    values: option.values.map((value) => ({
      clientKey: value.id,
      id: value.id,
      value: value.value,
      colorHex: value.colorHex,
      isActive: value.isActive,
      images: value.images,
    })),
  }));
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
    </div>
  );
}

export function ProductFormPage() {
  const { storeId, productId } = useParams<{ storeId: string; productId: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(productId);
  const slugEditedByUser = useRef(false);

  const store = useAppSelector(selectCurrentStore);
  const currentCommerceSettings = useAppSelector(selectCurrentCommerceSettings);
  const isMenu = currentCommerceSettings?.catalogType === 'menu';

  const labels = getProductFormLabels({
    vertical: store?.businessVertical ?? null,
    subcategory: store?.businessSubcategory ?? null,
    isMenu,
  });

  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [productNotFound, setProductNotFound] = useState(false);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<ProductImage | null>(null);
  const [cropQueue, setCropQueue] = useState<LoadedImageFile[]>([]);
  const [activeCrop, setActiveCrop] = useState<LoadedImageFile | null>(null);
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroupDraft[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [showVariantsAsCards, setShowVariantsAsCards] = useState(false);
  const [variantOptions, setVariantOptions] = useState<ProductVariantOptionDraft[]>([]);
  const [variantDrafts, setVariantDrafts] = useState<ProductVariantDraft[]>([]);
  const [descriptionSections, setDescriptionSections] = useState<ProductDescriptionSection[]>([]);
  const [activeLocations, setActiveLocations] = useState<StoreLocation[]>([]);
  const [locationAvailability, setLocationAvailability] = useState<Record<string, boolean>>({});
  const [adjustStockOpen, setAdjustStockOpen] = useState(false);
  const [currentStock, setCurrentStock] = useState(0);
  const [storeCategories, setStoreCategories] = useState<PublicStoreCategory[]>([]);
  const [storeCollections, setStoreCollections] = useState<PublicStoreCollection[]>([]);
  const [storeFacets, setStoreFacets] = useState<StoreFacet[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [selectedFacetValueIds, setSelectedFacetValueIds] = useState<string[]>([]);

  const defaultProductType = isMenu ? 'menu_item' : 'physical_product';
  const entitySingular = labels.entityName;
  const currency = store?.currency ?? 'COP';
  const selectedCategory = useMemo(
    () => storeCategories.find((category) => category.id === selectedCategoryId) ?? null,
    [selectedCategoryId, storeCategories],
  );

  const formik = useFormik<ProductFormValues>({
    initialValues: {
      productType: defaultProductType,
      name: '',
      slug: '',
      description: '',
      shortDescription: '',
      category: '',
      regularPrice: '',
      discountMode: 'none',
      discountValue: '',
      salePrice: '',
      sku: '',
      // Restaurant dishes are prepared on demand, so their professional
      // default is "available without a quantity limit". Retail products
      // keep the existing counted-inventory default.
      trackInventory: !isMenu,
      stockQuantity: '',
      status: 'active',
      isAvailable: true,
      isFeatured: false,
      preparationTimeMinutes: '',
      allowsSpecialInstructions: false,
      specialInstructionsLabel: '',
      specialInstructionsPlaceholder: '',
      specialInstructionsMaxLength: 180,
    },
    validationSchema: productSchema,
    onSubmit: async (values, { setStatus }) => {
      if (!storeId) return;
      try {
        // Counted variants need an explicit opening quantity. Restaurant
        // variants configured as "available without limit" intentionally
        // keep stock empty/0 and are sellable through allow_backorder.
        if (hasVariants) {
          const missingStock = variantDrafts.find(
            (v) => v.status === 'active' && v.stockPolicy === 'deny' && v.stockQuantity === ''
          );
          if (missingStock) {
            const label = Object.values(missingStock.optionValues).join(' / ') || 'variante';
            const msg = `Ingresa el stock inicial de la variante "${label}" o escribe 0 si no tiene unidades.`;
            setStatus(msg);
            notify.error(msg);
            return;
          }
        }

        // Resolve the final sale price from discount mode
        const regularPriceNum = Number(values.regularPrice);
        let finalSalePrice: number | null = null;

        if (values.discountMode === 'direct_price' && values.salePrice !== '') {
          finalSalePrice = Number(values.salePrice);
        } else if (values.discountMode === 'percentage' && values.discountValue !== '') {
          finalSalePrice = calculateSalePriceFromPercentage(regularPriceNum, Number(values.discountValue));
        } else if (values.discountMode === 'fixed_amount' && values.discountValue !== '') {
          finalSalePrice = calculateSalePriceFromFixedAmount(regularPriceNum, Number(values.discountValue));
        }

        // Guard: sale price must be strictly less than regular price
        if (finalSalePrice !== null && (finalSalePrice < 0 || finalSalePrice >= regularPriceNum)) {
          finalSalePrice = null;
        }

        // Base payload — stock is intentionally excluded.
        // For create: always inserted with stock=0; initial stock is set via RPC.
        // For edit: stock is never updated here — only via adjust_product_stock RPC.
        const basePayload = {
          storeId,
          productType: values.productType,
          name: values.name,
          slug: values.slug,
          description: values.description,
          shortDescription: values.shortDescription || null,
          category: selectedCategory?.name ?? null,
          categoryId: selectedCategory?.id ?? null,
          regularPrice: regularPriceNum,
          salePrice: finalSalePrice,
          compareAtPrice: null,
          costPrice: null,
          sku: values.sku || null,
          // Variants own their availability/stock policy. Never let a stale
          // parent stock value make the whole product appear sold out.
          trackInventory: hasVariants ? false : values.trackInventory,
          isFeatured: values.isFeatured,
          isAvailable: values.isAvailable,
          preparationTimeMinutes:
            values.preparationTimeMinutes !== '' ? Number(values.preparationTimeMinutes) : null,
          allowsSpecialInstructions: values.allowsSpecialInstructions,
          specialInstructionsLabel: values.specialInstructionsLabel || null,
          specialInstructionsPlaceholder: values.specialInstructionsPlaceholder || null,
          specialInstructionsMaxLength: Number(values.specialInstructionsMaxLength || 180),
          sortOrder: 0,
          status: values.status,
          mainImageUrl: null,
          descriptionSections,
          hasVariants,
          showVariantsAsCards: hasVariants && showVariantsAsCards,
          sizeChartId: null,
        };

        const saved = isEditing && productId
          ? await productsService.updateProduct(productId, basePayload)
          : await productsService.createProduct({ ...basePayload, stock: 0 });

        // Upload pending images sequentially so errors are per-file
        let firstUploadedUrl: string | null = null;
        for (let i = 0; i < pendingFiles.length; i++) {
          try {
            const img = await productsService.uploadProductImage(
              storeId,
              saved.id,
              pendingFiles[i],
              existingImages.length + i,
              existingImages.length === 0 && i === 0
            );
            if (i === 0 && existingImages.length === 0) firstUploadedUrl = img.imageUrl;
          } catch (imgErr) {
            notify.error(
              `No se pudo subir "${pendingFiles[i].name}": ${mapSupabaseError(imgErr)}`
            );
          }
        }

        if (!isEditing && firstUploadedUrl) {
          await productsService.updateProduct(saved.id, { mainImageUrl: firstUploadedUrl });
        }

        await productsService.setProductCollections(saved.id, selectedCollectionIds);
        await facetsService.setProductFacetValues(saved.id, selectedFacetValueIds);
        await productOptionsService.replaceProductOptionGroups(storeId, saved.id, optionGroups);

        const savedVariantOptions = await productVariantsService.saveVariantOptions(
          storeId,
          saved.id,
          hasVariants ? variantOptions : []
        );

        const imageFailures: string[] = [];
        if (hasVariants) {
          // Upload any pending "Color/Modelo" gallery images the merchant
          // picked before the option value had a real id. Matched by
          // POSITION (option index + value index), same reasoning as the
          // per-variant matching below: saveVariantOptions() processes
          // options/values in submission order and returns them in that
          // same order, so savedVariantOptions[i].values[j] is guaranteed
          // to be variantOptions[i].values[j]'s real saved row.
          for (let optionIndex = 0; optionIndex < variantOptions.length; optionIndex += 1) {
            const optionDraft = variantOptions[optionIndex];
            const savedOption = savedVariantOptions[optionIndex];
            if (!savedOption) continue;
            for (let valueIndex = 0; valueIndex < optionDraft.values.length; valueIndex += 1) {
              const valueDraft = optionDraft.values[valueIndex];
              const pendingFiles = valueDraft.pendingImageFiles ?? [];
              if (pendingFiles.length === 0) continue;
              const savedValue = savedOption.values[valueIndex];
              if (!savedValue) continue;
              const existingCount = savedValue.images.length;
              for (let i = 0; i < pendingFiles.length; i += 1) {
                try {
                  const image = await productVariantsService.uploadOptionValueImage(
                    storeId,
                    saved.id,
                    savedValue.id,
                    pendingFiles[i],
                    existingCount + i,
                    existingCount === 0 && i === 0
                  );
                  savedValue.images.push(image);
                } catch (imgErr) {
                  imageFailures.push(`${optionDraft.name}: ${valueDraft.value}`);
                  console.error(imgErr);
                  break; // one failure per value is enough to flag it
                }
              }
            }
          }
          // Resync local option/value state to the real DB result now — the
          // options/values themselves are already committed either way, and
          // this clears every pendingImageFiles/pendingImagePreviewUrls so a
          // second "Guardar" click can never re-upload the same files.
          for (const optionDraft of variantOptions) {
            for (const valueDraft of optionDraft.values) {
              (valueDraft.pendingImagePreviewUrls ?? []).forEach((url) => URL.revokeObjectURL(url));
            }
          }
          setVariantOptions(mapSavedOptionsToDrafts(savedVariantOptions));
        }

        const savedVariants = await productVariantsService.saveVariants(
          storeId,
          saved.id,
          hasVariants ? variantDrafts : [],
          savedVariantOptions
        );

        // Register initial stock for brand-new variants as an audited
        // "Inventario inicial" movement — mirrors exactly how a brand-new
        // simple product's initial stock is registered below, so variant
        // stock never appears from nowhere without a movement record.
        // Only variants without a pre-existing id go through this (a
        // variant that already existed keeps its stock untouched here,
        // and after this block variantDrafts is resynced from savedVariants
        // so a second "Guardar" click can never re-run this for the same
        // variant — draft.id will be set by then).
        const stockFailures: string[] = [];
        if (hasVariants) {
          // IMPORTANT: match drafts to their saved row by POSITION, not by
          // optionSignature. saveVariants() writes `position: index` for
          // every draft (new or existing) in submission order, and
          // fetchVariants() (which produces `savedVariants`) always orders
          // by `position ASC` — so savedVariants[i] is guaranteed to be
          // variantDrafts[i]'s real row. optionSignature can't be used here:
          // a brand-new draft's optionSignature is the text-based one built
          // client-side by generateVariantCombinations ("Color:Azul,Talla:39"),
          // while the persisted row's optionSignature is recomputed from real
          // option_value_ids inside saveVariants ("id1|id2") — the two never
          // string-match, which used to make every new variant's initial
          // stock/image silently skipped ("savedIndex === -1 → continue").
          for (let index = 0; index < variantDrafts.length; index += 1) {
            const draft = variantDrafts[index];
            if (draft.id) continue;
            const initialQty = draft.stockQuantity === '' ? 0 : Number(draft.stockQuantity);
            if (initialQty <= 0) continue; // explicit 0 needs no movement at all
            const savedVariant = savedVariants[index];
            if (!savedVariant) continue;
            try {
              const result = await inventoryService.adjustVariantStock({
                storeId,
                variantId: savedVariant.id,
                movementType: 'stock_in',
                quantityChange: initialQty,
                reason: 'Inventario inicial',
                notes: null,
              });
              savedVariants[index] = { ...savedVariant, stockQuantity: result.newStock };
            } catch (stockErr) {
              stockFailures.push(Object.values(draft.optionValues).join(' / ') || 'variante');
              console.error(stockErr);
            }
          }

          // Upload any variant image the merchant picked before the product
          // (and therefore the variant) had a real id — the file was only
          // held in memory as `pendingImageFile` until now. Same
          // position-based matching as above, for the same reason.
          for (let index = 0; index < variantDrafts.length; index += 1) {
            const draft = variantDrafts[index];
            if (!draft.pendingImageFile) continue;
            const savedVariant = savedVariants[index];
            if (!savedVariant) continue;
            try {
              const image = await productVariantsService.uploadVariantImage(
                storeId,
                saved.id,
                savedVariant.id,
                draft.pendingImageFile,
                0,
                true
              );
              savedVariants[index] = { ...savedVariant, images: [image] };
            } catch (imgErr) {
              imageFailures.push(Object.values(draft.optionValues).join(' / ') || 'variante');
              console.error(imgErr);
            }
          }

          // Always resync local state to the real DB result — the variant
          // rows themselves are already committed either way, so the table
          // must reflect their true ids/stock/images, not the stale pre-save
          // draft (this also clears pendingImageFile/pendingImagePreviewUrl,
          // since mapSavedVariantsToDrafts never sets them).
          setVariantDrafts(mapSavedVariantsToDrafts(savedVariantOptions, savedVariants));
        }

        // Save per-location availability
        for (const loc of activeLocations) {
          const isAvailable = locationAvailability[loc.id] ?? true;
          await productAvailabilityService.upsertAvailability(storeId, saved.id, loc.id, isAvailable);
        }

        // Register initial stock via RPC so it appears in inventory_movements
        if (!isEditing && !hasVariants && values.trackInventory) {
          const initialQty = values.stockQuantity !== '' ? Number(values.stockQuantity) : 0;
          if (initialQty > 0) {
            try {
              await inventoryService.adjustStock({
                storeId,
                productId: saved.id,
                movementType: 'stock_in',
                quantityChange: initialQty,
                reason: 'Inventario inicial',
                notes: null,
              });
            } catch (stockErr) {
              notify.warning(
                `El ${entitySingular} se creó, pero no se pudo registrar el inventario inicial: ${mapSupabaseError(stockErr)}`
              );
            }
          }
        }

        const label = entitySingular.charAt(0).toUpperCase() + entitySingular.slice(1);

        if (stockFailures.length > 0 || imageFailures.length > 0) {
          // Don't claim success when a variant's initial stock movement or
          // pending image upload failed — the variant/product data is
          // already saved correctly, but say the partial failure out loud
          // and point at how to fix it, rather than a generic "all good".
          const parts: string[] = [];
          if (stockFailures.length > 0) {
            parts.push(`no se pudo registrar el stock inicial de ${stockFailures.map((l) => `"${l}"`).join(', ')}`);
          }
          if (imageFailures.length > 0) {
            parts.push(`no se pudieron subir imágenes de ${imageFailures.map((l) => `"${l}"`).join(', ')}`);
          }
          notify.error(
            `${label} guardado, pero ${parts.join(' y ')}. Puedes intentarlo nuevamente desde la edición del producto.`
          );
          if (!isEditing) {
            // Still need the real productId in the URL — otherwise "Ajustar"
            // and variant image upload stay blocked by the missing id.
            void navigate(`/admin/stores/${storeId}/products/${saved.id}/edit`);
          }
          // Already editing: stay on this page — variantDrafts was just
          // resynced above, so the affected rows already show "Ajustar".
          return;
        }

        if (!isEditing && hasVariants && variantDrafts.length > 0) {
          // Variants (and their images) can only be fully managed once the
          // product exists — take the merchant straight to editing it so
          // they can immediately assign images per variant if they want to.
          notify.success(`${label} guardado. Ahora puedes agregar imágenes a las variantes.`);
          void navigate(`/admin/stores/${storeId}/products/${saved.id}/edit`);
        } else {
          notify.success(
            isEditing
              ? `${label} actualizado correctamente.`
              : `${label} creado correctamente.`
          );
          void navigate(`/admin/stores/${storeId}/products`);
        }
      } catch (err) {
        const msg = mapSupabaseError(err);
        setStatus(msg);
        notify.error(msg);
      }
    },
  });

  useScrollToFirstFormikError({
    errors: formik.errors,
    submitCount: formik.submitCount,
    isSubmitting: formik.isSubmitting,
  });

  // Commerce settings can arrive just after the form mounts. Correct the
  // untouched new-product default when the store resolves as a restaurant,
  // otherwise Formik would retain the retail `true` value from that first
  // render even though the restaurant UI never chose counted inventory.
  useEffect(() => {
    if (!isEditing && isMenu && formik.values.stockQuantity === '') {
      void formik.setFieldValue('trackInventory', false);
      void formik.setFieldValue('productType', 'menu_item');
    }
    // The transition into restaurant mode is the event that matters here;
    // including the full Formik object would rerun after every field update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, isMenu]);

  // Compute discount preview from current form values
  const discountPreview = useMemo(() => {
    const rp = Number(formik.values.regularPrice);
    const sp = Number(formik.values.salePrice);
    if (!rp || !sp || sp <= 0 || sp >= rp) return null;
    return {
      regular: rp,
      sale: sp,
      pct: calculateDiscountPercentage(rp, sp),
      savings: calculateDiscountAmount(rp, sp),
    };
  }, [formik.values.regularPrice, formik.values.salePrice]);

  // Load product for editing
  useEffect(() => {
    if (!productId) return;
    async function load() {
      if (!productId) return;
      const [product, images] = await Promise.all([
        productsService.getProductById(productId),
        productsService.getProductImages(productId),
      ]);
      const optionGroupsData = await productOptionsService.getProductOptionGroups(productId);
      if (product) {
        slugEditedByUser.current = true;
        void formik.setValues({
          productType: product.productType,
          name: product.name,
          slug: product.slug,
          description: product.description,
          shortDescription: product.shortDescription ?? '',
          category: product.category ?? '',
          regularPrice: product.regularPrice,
          discountMode: product.salePrice !== null ? 'direct_price' : 'none',
          discountValue: '',
          salePrice: product.salePrice ?? '',
          sku: product.sku ?? '',
          trackInventory: product.trackInventory,
          stockQuantity: product.stock,
          status: product.status === 'archived' ? 'active' : (product.status as 'draft' | 'active'),
          isAvailable: product.isAvailable,
          isFeatured: product.isFeatured,
          preparationTimeMinutes: product.preparationTimeMinutes ?? '',
          allowsSpecialInstructions: product.allowsSpecialInstructions,
          specialInstructionsLabel: product.specialInstructionsLabel ?? 'Indicaciones para tu pedido',
          specialInstructionsPlaceholder: product.specialInstructionsPlaceholder ?? 'Ej: sin cebolla, salsa aparte, término medio',
          specialInstructionsMaxLength: product.specialInstructionsMaxLength ?? 180,
        });
        setCurrentStock(product.stock);
        setExistingImages(images);
        setDescriptionSections(product.descriptionSections ?? []);
        setSelectedCategoryId(product.categoryId);
        setSelectedCollectionIds(product.collections.map((collection) => collection.id));
        setSelectedFacetValueIds(product.facetValues.map((value) => value.valueId));
        setHasVariants(product.hasVariants);
        setShowVariantsAsCards(product.showVariantsAsCards);
        if (product.hasVariants) {
          const [loadedOptions, loadedVariants] = await Promise.all([
            productVariantsService.getProductVariantOptions(productId),
            productVariantsService.getProductVariants(productId),
          ]);
          setVariantOptions(mapSavedOptionsToDrafts(loadedOptions));
          setVariantDrafts(mapSavedVariantsToDrafts(loadedOptions, loadedVariants));
        }
        setOptionGroups(optionGroupsData.map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          selectionType: group.selectionType,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          isRequired: group.isRequired,
          isActive: group.isActive,
          items: group.items.map((item) => ({
            id: item.id,
            label: item.label,
            description: item.description,
            priceDelta: item.priceDelta,
            isDefault: item.isDefault,
            isActive: item.isActive,
          })),
        })));
      } else {
        // Real product id in the URL, but the row is gone (deleted, or a
        // stale bookmark/back-button to an old edit link) — getProductById
        // already handles the 0-row case cleanly (PGRST116 -> null), but
        // nothing downstream was checking for it: the form would silently
        // stay on its empty "new product" defaults while still believing
        // isEditing=true, so saving would target a product_id that no
        // longer exists. Surface it clearly instead.
        setProductNotFound(true);
      }
      setLoadingProduct(false);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (activeCrop || cropQueue.length === 0) return;
    const [next, ...rest] = cropQueue;
    setActiveCrop(next);
    setCropQueue(rest);
  }, [activeCrop, cropQueue]);

  useEffect(() => {
    if (!storeId) return;
    Promise.all([
      locationsService.getStoreLocations(storeId),
      categoriesService.getStoreCategories(storeId),
      collectionsService.getStoreCollections(storeId),
      facetsService.getStoreFacets(storeId),
    ])
      .then(([locs, categories, collections, facets]) => {
        setActiveLocations(locs.filter(l => l.isActive));
        setStoreCategories(categories);
        setStoreCollections(collections);
        setStoreFacets(facets);
      })
      .catch(() => { /* silent */ });
  }, [storeId]);

  useEffect(() => {
    if (!productId) return;
    productAvailabilityService.getProductAvailability(productId)
      .then(map => setLocationAvailability(map))
      .catch(() => { /* silent */ });
  }, [productId]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    formik.handleChange(e);
    if (!slugEditedByUser.current) {
      void formik.setFieldValue('slug', slugify(e.target.value));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    slugEditedByUser.current = true;
    formik.handleChange(e);
  }

  function handleToggleSpecialInstructions(enabled: boolean) {
    void formik.setFieldValue('allowsSpecialInstructions', enabled);
    if (enabled) {
      if (!formik.values.specialInstructionsLabel) {
        void formik.setFieldValue('specialInstructionsLabel', labels.specialInstructions.labelDefault);
      }
      if (!formik.values.specialInstructionsPlaceholder) {
        void formik.setFieldValue('specialInstructionsPlaceholder', labels.specialInstructions.placeholderDefault);
      }
    }
  }

  function handleFixedDiscountChange(value: number | '') {
    void formik.setFieldValue('discountValue', value);
    const num = typeof value === 'number' ? value : 0;
    const rp = Number(formik.values.regularPrice);
    if (num > 0 && rp > 0 && num < rp) {
      void formik.setFieldValue('salePrice', calculateSalePriceFromFixedAmount(rp, num));
    }
  }

  function handleDiscountModeChange(mode: DiscountMode) {
    void formik.setFieldValue('discountMode', mode);
    void formik.setFieldValue('discountValue', '');
    void formik.setFieldValue('salePrice', '');
  }

  function handleDiscountValueChange(value: number | '') {
    void formik.setFieldValue('discountValue', value);
    const rp = Number(formik.values.regularPrice);
    if (value === '' || !rp) return;

    if (formik.values.discountMode === 'percentage' && value >= 1 && value <= 99) {
      void formik.setFieldValue('salePrice', calculateSalePriceFromPercentage(rp, value));
    } else if (formik.values.discountMode === 'fixed_amount' && value > 0 && value < rp) {
      void formik.setFieldValue('salePrice', calculateSalePriceFromFixedAmount(rp, value));
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const total = existingImages.length + pendingFiles.length + files.length;
    const allowed = files.slice(0, MAX_IMAGES - existingImages.length - pendingFiles.length);
    if (total > MAX_IMAGES) {
      notify.warning(`Solo puedes subir hasta ${MAX_IMAGES} imágenes por ${entitySingular}.`);
    }

    const prepared: LoadedImageFile[] = [];
    for (const file of allowed) {
      try {
        const loaded = await validateImageFile(file, 'product_image');
        prepared.push(loaded);
      } catch (err) {
        notify.error(`${file.name}: ${mapSupabaseError(err)}`);
      }
    }

    if (prepared.length > 0) {
      setCropQueue((prev) => [...prev, ...prepared]);
    }

    e.target.value = '';
  }

  function removePendingFile(index: number) {
    URL.revokeObjectURL(pendingPreviews[index]);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function appendPendingFile(file: File) {
    const preview = URL.createObjectURL(file);
    setPendingFiles((prev) => [...prev, file]);
    setPendingPreviews((prev) => [...prev, preview]);
    setActiveCrop(null);
  }

  async function handleDeleteExistingConfirmed(image: ProductImage) {
    setDeletingImageId(image.id);
    setConfirmDeleteImage(null);
    try {
      await productsService.deleteProductImage(image.id, image.storagePath);
      setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
      notify.success('Imagen eliminada.');
    } catch (err) {
      notify.fromError(err);
    } finally {
      setDeletingImageId(null);
    }
  }

  const totalImages = existingImages.length + pendingFiles.length;

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (productNotFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-gray-600">Este {entitySingular} ya no existe.</p>
        <Link to={`/admin/stores/${storeId}/products`} className="text-sm font-medium text-indigo-600 hover:underline">
          Volver a {isMenu ? 'menú' : 'productos'}
        </Link>
      </div>
    );
  }

  return (
    <AdminPanelShell
      top={(
        <>
          <div className="mb-4">
            <Link
              to={`/admin/stores/${storeId}/products`}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a {isMenu ? 'menú' : 'productos'}
            </Link>
          </div>

          <PageHeader
            title={isEditing ? `Editar ${entitySingular}` : `Nuevo ${entitySingular}`}
            description={
              isEditing
                ? `Modifica los datos de este ${entitySingular}.`
                : `Completa el formulario para crear un ${entitySingular}.`
            }
            sticky={false}
            className="mb-4"
          />
        </>
      )}
    >
      <form onSubmit={formik.handleSubmit} noValidate className="max-w-4xl space-y-6 pb-8">
        {/* Basic info */}
        <Card>
          <CardBody>
            <SectionHeader
              title={`Información principal del ${entitySingular}`}
              description="Agrega la información principal que verá el cliente en la tienda."
            />
            <div className="space-y-4">
              {/* Product type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
                <div className="flex gap-2 flex-wrap">
                  {(isMenu
                    ? [{ value: 'menu_item', label: 'Plato / Ítem de menú' }]
                    : [
                        { value: 'physical_product', label: 'Producto físico' },
                        { value: 'service', label: 'Servicio' },
                      ]
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void formik.setFieldValue('productType', value)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                        formik.values.productType === value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                id="name"
                label="Nombre"
                placeholder={labels.namePlaceholder}
                {...formik.getFieldProps('name')}
                onChange={handleNameChange}
                error={formik.touched.name ? formik.errors.name : undefined}
              />

              <Input
                id="slug"
                label="URL del producto (slug)"
                placeholder="bandeja-paisa"
                hint="/p/bandeja-paisa"
                {...formik.getFieldProps('slug')}
                onChange={handleSlugChange}
                error={formik.touched.slug ? formik.errors.slug : undefined}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  rows={4}
                  placeholder="Descripción completa del producto..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  {...formik.getFieldProps('description')}
                />
                {formik.touched.description && formik.errors.description && (
                  <p className="mt-1 text-xs text-red-600">{formik.errors.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción corta
                  <span className="text-gray-400 font-normal ml-1">(máx. 160 caracteres)</span>
                </label>
                <textarea
                  id="shortDescription"
                  rows={2}
                  placeholder="Resumen breve para mostrar en tarjetas..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  {...formik.getFieldProps('shortDescription')}
                />
                {formik.touched.shortDescription && formik.errors.shortDescription && (
                  <p className="mt-1 text-xs text-red-600">{formik.errors.shortDescription}</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Visibility */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-2">Qué se verá en tu catálogo</h3>
            <p className="mb-4 text-sm text-gray-600">
              Define si este {entitySingular} estará publicado, disponible temporalmente o destacado en la tienda.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado de publicación
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {(
                    [
                      { value: 'active', label: 'Publicado', desc: 'Visible en la tienda pública' },
                      { value: 'draft', label: 'Borrador', desc: 'Guardado, no visible al cliente' },
                    ] as const
                  ).map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void formik.setFieldValue('status', value)}
                      className={[
                        'flex-1 flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                        formik.values.status === value
                          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0',
                          formik.values.status === value
                            ? 'border-indigo-600 bg-indigo-600'
                            : 'border-gray-300 bg-white',
                        ].join(' ')}
                      />
                      <span>
                        <span className={`block text-sm font-medium ${formik.values.status === value ? 'text-indigo-700' : 'text-gray-800'}`}>
                          {label}
                        </span>
                        <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <ToggleField
                label={isMenu ? 'Disponible para pedidos' : 'Disponible para pedir'}
                description={isMenu
                  ? 'Desactívalo para marcarlo como “Agotado por el momento” sin ocultarlo ni eliminarlo.'
                  : 'Desactívalo temporalmente si el producto no está disponible sin eliminarlo'}
                checked={formik.values.isAvailable}
                onChange={(v) => void formik.setFieldValue('isAvailable', v)}
              />
              <ToggleField
                label="Producto destacado"
                description="Aparece en la sección de destacados de la tienda"
                checked={formik.values.isFeatured}
                onChange={(v) => void formik.setFieldValue('isFeatured', v)}
              />
            </div>
          </CardBody>
        </Card>

        {storeId ? (
          <ProductCategorySelect
            storeId={storeId}
            categories={storeCategories}
            selectedCategoryId={selectedCategoryId}
            onChange={setSelectedCategoryId}
            onCategoriesChange={setStoreCategories}
          />
        ) : null}

        {storeId ? (
          <ProductCollectionsMultiSelect
            storeId={storeId}
            collections={storeCollections}
            selectedCollectionIds={selectedCollectionIds}
            onChange={setSelectedCollectionIds}
            onCollectionsChange={setStoreCollections}
          />
        ) : null}

        <Card>
          <CardBody>
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-2xl bg-violet-50 p-2 text-violet-700">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Imágenes del producto</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Galería principal del producto. Se usa siempre para productos simples y como imagen de
                  respaldo cuando una variante no tiene foto propia.
                </p>
              </div>
            </div>

            <p className="mb-4 text-xs text-gray-500">
              Máximo {MAX_IMAGES} imágenes.
            </p>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {existingImages.map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 group"
                >
                  <img src={img.imageUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteImage(img)}
                    disabled={deletingImageId === img.id}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    {deletingImageId === img.id ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </button>
                  {img.isPrimary && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-xs text-white">
                      Principal
                    </span>
                  )}
                </div>
              ))}

              {pendingPreviews.map((url, i) => (
                <div
                  key={url}
                  className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 group"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePendingFile(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-amber-500/80 px-1 text-xs text-white">
                    Por subir
                  </span>
                </div>
              ))}

              {totalImages < MAX_IMAGES && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50">
                  <Upload className="mb-1 h-5 w-5 text-gray-400" />
                  <span className="text-xs text-gray-400">Subir</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Pricing & discount */}
        <Card>
          <CardBody>
            <SectionHeader
              title={labels.pricingTitle}
              description="Define el precio y una promoción si aplica."
            />
            <div className="space-y-4">
              {/* Regular price */}
              <MoneyInput
                id="regularPrice"
                name="regularPrice"
                label={`${labels.priceLabel} *`}
                currency={currency}
                value={formik.values.regularPrice}
                onChange={(val) => void formik.setFieldValue('regularPrice', val)}
                onBlur={() => void formik.setFieldTouched('regularPrice', true)}
                error={formik.touched.regularPrice ? formik.errors.regularPrice : undefined}
              />

              {/* Discount mode selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Descuento
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DISCOUNT_MODES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleDiscountModeChange(value)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                        formik.values.discountMode === value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opción 1 — Precio promocional directo */}
              {formik.values.discountMode === 'direct_price' && (
                <MoneyInput
                  id="salePrice"
                  name="salePrice"
                  label="Precio promocional"
                  currency={currency}
                  value={formik.values.salePrice}
                  onChange={(val) => void formik.setFieldValue('salePrice', val)}
                  onBlur={() => void formik.setFieldTouched('salePrice', true)}
                  error={formik.touched.salePrice ? formik.errors.salePrice : undefined}
                />
              )}

              {/* Opción 2 — Porcentaje de descuento */}
              {formik.values.discountMode === 'percentage' && (
                <IntegerInput
                  id="discountValue"
                  label="Porcentaje de descuento"
                  min={1}
                  max={99}
                  placeholder="Ej: 20"
                  hint="%"
                  value={formik.values.discountValue}
                  onChange={handleDiscountValueChange}
                  onBlur={() => void formik.setFieldTouched('discountValue', true)}
                  error={formik.touched.discountValue ? formik.errors.discountValue : undefined}
                />
              )}

              {/* Opción 3 — Valor fijo de descuento */}
              {formik.values.discountMode === 'fixed_amount' && (
                <MoneyInput
                  id="discountValue"
                  name="discountValue"
                  label="Descuento en valor"
                  currency={currency}
                  value={formik.values.discountValue}
                  onChange={handleFixedDiscountChange}
                  onBlur={() => void formik.setFieldTouched('discountValue', true)}
                  error={formik.touched.discountValue ? formik.errors.discountValue : undefined}
                />
              )}

              {/* Preview de descuento en vivo */}
              {discountPreview && (
                <div className="flex items-center gap-2 flex-wrap bg-green-50 border border-green-100 rounded-lg px-3 py-2.5 text-sm">
                  <span className="text-gray-400 line-through text-xs">
                    {formatCurrency(discountPreview.regular, 'es-CO', currency)}
                  </span>
                  <span className="font-bold text-green-700">
                    {formatCurrency(discountPreview.sale, 'es-CO', currency)}
                  </span>
                  <DiscountBadge percentage={discountPreview.pct} />
                  <span className="text-green-600 text-xs">
                    Ahorras {formatCurrency(discountPreview.savings, 'es-CO', currency)}
                  </span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Type-specific fields */}
        {isMenu ? (
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Preparación y disponibilidad
              </h3>
              <div className="space-y-5">
                <IntegerInput
                  id="preparationTimeMinutes"
                  label="Tiempo de preparación (minutos)"
                  min={1}
                  placeholder="Ej: 20"
                  value={formik.values.preparationTimeMinutes}
                  onChange={(value) => void formik.setFieldValue('preparationTimeMinutes', value)}
                  onBlur={() => void formik.setFieldTouched('preparationTimeMinutes', true)}
                  error={
                    formik.touched.preparationTimeMinutes
                      ? formik.errors.preparationTimeMinutes
                      : undefined
                  }
                />

                <div className="border-t border-gray-100 pt-5">
                  <p className="text-sm font-medium text-gray-800">Control de unidades</p>
                  {hasVariants ? (
                    <p className="mt-1 text-sm text-gray-500">
                      La disponibilidad se configura por tamaño o variante en la sección “Variantes”.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            {
                              value: false,
                              label: 'Disponible sin límite',
                              description: 'Recomendado para platos preparados bajo pedido.',
                            },
                            {
                              value: true,
                              label: 'Cantidad limitada',
                              description: 'Úsalo solo si preparas un número exacto de unidades.',
                            },
                          ] as const
                        ).map((option) => (
                          <button
                            key={String(option.value)}
                            type="button"
                            onClick={() => void formik.setFieldValue('trackInventory', option.value)}
                            className={[
                              'rounded-xl border px-4 py-3 text-left transition-colors',
                              formik.values.trackInventory === option.value
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                                : 'border-gray-200 bg-white hover:border-gray-300',
                            ].join(' ')}
                          >
                            <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-gray-500">{option.description}</span>
                          </button>
                        ))}
                      </div>

                      {formik.values.trackInventory && !isEditing && (
                        <IntegerInput
                          id="stockQuantity"
                          label="Unidades disponibles al publicar"
                          hint="Al llegar a 0, el plato se mostrará como agotado y no podrá agregarse al pedido."
                          min={0}
                          placeholder="0"
                          value={formik.values.stockQuantity}
                          onChange={(value) => void formik.setFieldValue('stockQuantity', value)}
                          onBlur={() => void formik.setFieldTouched('stockQuantity', true)}
                          error={formik.touched.stockQuantity ? formik.errors.stockQuantity : undefined}
                        />
                      )}

                      {formik.values.trackInventory && isEditing && (
                        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Unidades disponibles</p>
                            <p className="text-lg font-bold text-gray-900">
                              {currentStock}{' '}
                              <span className="text-sm font-normal text-gray-400">unidades</span>
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            leftIcon={<Layers className="w-3.5 h-3.5" />}
                            onClick={() => setAdjustStockOpen(true)}
                          >
                            Ajustar unidades
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 mb-2">Inventario</h3>
              <p className="mb-4 text-sm text-gray-600">
                Configura el control interno de stock. Esto no afecta checkout, pedidos ni movimientos fuera del flujo actual.
              </p>
              {hasVariants ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  El SKU y el stock de este producto se gestionan por variante en la sección "Variantes" de abajo.
                </div>
              ) : (
              <div className="space-y-4">
                <Input
                  id="sku"
                  label="SKU (código interno)"
                  placeholder="Ej: CAM-001"
                  {...formik.getFieldProps('sku')}
                />
                <ToggleField
                  label="Rastrear inventario"
                  description="Limita la compra a las unidades registradas"
                  checked={formik.values.trackInventory}
                  onChange={(v) => void formik.setFieldValue('trackInventory', v)}
                />
                {formik.values.trackInventory && !isEditing && (
                  <IntegerInput
                    id="stockQuantity"
                    label="Inventario inicial"
                    hint="Cantidad disponible al momento de crear el producto."
                    min={0}
                    placeholder="0"
                    value={formik.values.stockQuantity}
                    onChange={(value) => void formik.setFieldValue('stockQuantity', value)}
                    onBlur={() => void formik.setFieldTouched('stockQuantity', true)}
                    error={
                      formik.touched.stockQuantity ? formik.errors.stockQuantity : undefined
                    }
                  />
                )}
                {formik.values.trackInventory && isEditing && (
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Stock actual</p>
                      <p className="text-lg font-bold text-gray-900">
                        {currentStock}{' '}
                        <span className="text-sm font-normal text-gray-400">unidades</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      leftIcon={<Layers className="w-3.5 h-3.5" />}
                      onClick={() => setAdjustStockOpen(true)}
                    >
                      Ajustar stock
                    </Button>
                  </div>
                )}
              </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Variantes de venta: disponibles para cualquier tipo de tienda —
            un restaurante puede necesitar Tamaño (Sencilla/Doble) con su
            propio stock/precio, igual que ropa necesita Color/Talla. */}
        {storeId ? (
          <ProductVariantsEditor
            storeId={storeId}
            productId={productId}
            hasVariants={hasVariants}
            onHasVariantsChange={setHasVariants}
            showVariantsAsCards={showVariantsAsCards}
            onShowVariantsAsCardsChange={setShowVariantsAsCards}
            options={variantOptions}
            onOptionsChange={setVariantOptions}
            variants={variantDrafts}
            onVariantsChange={setVariantDrafts}
            baseSku={formik.values.sku}
            basePrice={formik.values.regularPrice}
            isMenu={isMenu}
          />
        ) : null}

        {/* Modificadores/adiciones: solo para tiendas tipo menú — no crean
            stock ni variant_id, para no explotar combinaciones (queso,
            tocineta, sin cebolla...) en variantes exactas. */}
        {isMenu ? (
          <ProductOptionsEditor
            currency={currency}
            groups={optionGroups}
            onChange={setOptionGroups}
          />
        ) : null}

        {storeId ? (
          <ProductFacetAssignments
            storeId={storeId}
            facets={storeFacets}
            categories={storeCategories}
            selectedFacetValueIds={selectedFacetValueIds}
            selectedCategory={selectedCategory}
            onChange={setSelectedFacetValueIds}
            onFacetsChange={setStoreFacets}
          />
        ) : null}

        {/* Description sections */}
        <Card>
          <CardBody>
            <SectionHeader
              title="Descripción avanzada"
              description="Bloques opcionales para enriquecer la página del producto."
            />
            <ProductDescriptionSectionsEditor
              sections={descriptionSections}
              onChange={setDescriptionSections}
              vertical={store?.businessVertical ?? null}
              subcategory={store?.businessSubcategory ?? null}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="mb-2 font-semibold text-gray-900">
              {labels.specialInstructions.sectionTitle}
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Úsalo solo si el cliente necesita dejar comentarios o preferencias al momento de pedir.
            </p>
            <div className="space-y-4">
              <ToggleField
                label={labels.specialInstructions.toggleLabel}
                description={labels.specialInstructions.toggleDescription}
                checked={formik.values.allowsSpecialInstructions}
                onChange={handleToggleSpecialInstructions}
              />

              {formik.values.allowsSpecialInstructions && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    id="specialInstructionsLabel"
                    label="Título del campo"
                    placeholder={labels.specialInstructions.labelDefault}
                    {...formik.getFieldProps('specialInstructionsLabel')}
                    error={formik.touched.specialInstructionsLabel ? formik.errors.specialInstructionsLabel : undefined}
                  />
                  <IntegerInput
                    id="specialInstructionsMaxLength"
                    label="Máximo de caracteres"
                    min={40}
                    max={500}
                    value={formik.values.specialInstructionsMaxLength}
                    onChange={(value) => void formik.setFieldValue('specialInstructionsMaxLength', value)}
                    onBlur={() => void formik.setFieldTouched('specialInstructionsMaxLength', true)}
                    error={formik.touched.specialInstructionsMaxLength ? formik.errors.specialInstructionsMaxLength : undefined}
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      id="specialInstructionsPlaceholder"
                      label="Texto de ayuda (placeholder)"
                      rows={2}
                      placeholder={labels.specialInstructions.placeholderDefault}
                      {...formik.getFieldProps('specialInstructionsPlaceholder')}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Availability by location */}
        {activeLocations.length > 1 && (
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" />
                Disponibilidad por sucursal
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Por defecto el {entitySingular} está disponible en todas las sucursales activas.
                Desactívalo en las sedes donde no deba aparecer.
              </p>
              <div className="space-y-3">
                {activeLocations.map(loc => (
                  <ToggleField
                    key={loc.id}
                    label={loc.name}
                    description={[loc.addressLine, loc.city].filter(Boolean).join(', ') || undefined}
                    checked={locationAvailability[loc.id] ?? true}
                    onChange={v => setLocationAvailability(prev => ({ ...prev, [loc.id]: v }))}
                  />
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {typeof formik.status === 'string' && (
          <FormErrorAlert message={formik.status} />
        )}
        {formik.submitCount > 0 && Object.keys(formik.errors).length > 0 && !formik.isSubmitting && (
          <FormErrorAlert message="Hay campos con errores. Revisa los campos marcados en rojo." />
        )}

        <div className="flex items-center gap-3 pb-8">
          <Button type="submit" isLoading={formik.isSubmitting}>
            {isEditing ? 'Guardar cambios' : `Crear ${entitySingular}`}
          </Button>
          <Link to={`/admin/stores/${storeId}/products`}>
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDeleteImage !== null}
        title="Eliminar imagen"
        message="¿Estás seguro de que quieres eliminar esta imagen? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteImage) void handleDeleteExistingConfirmed(confirmDeleteImage);
        }}
        onCancel={() => setConfirmDeleteImage(null)}
      />

      <ImageCropDialog
        open={activeCrop !== null}
        file={activeCrop}
        preset={IMAGE_ASSET_PRESETS.product_image}
        onCancel={() => setActiveCrop(null)}
        onConfirm={appendPendingFile}
      />

      {isEditing && productId && storeId && (
        <StockAdjustmentModal
          open={adjustStockOpen}
          storeId={storeId}
          productId={productId}
          productName={formik.values.name}
          currentStock={currentStock}
          onClose={() => setAdjustStockOpen(false)}
          onStockUpdated={(_id, newStock) => setCurrentStock(newStock)}
          restaurantMode={isMenu}
        />
      )}
    </AdminPanelShell>
  );
}
