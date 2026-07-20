import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, X, Eye, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { homeSectionsService } from '@/features/homeSections/homeSectionsService';
import { HOME_SECTION_TYPE_LABELS, type StoreHomeSection } from '@/features/homeSections/homeSections.types';
import { notify } from '@/lib/notifications';
import type { PublicProductPage, HomeSectionType, PublicStoreCategory } from '@/types/common.types';
import type { StorefrontTheme } from '@/components/public/storefront/storefrontTheme';
import {
  createDefaultDraft,
  draftFromExistingSection,
  effectiveDraftItems,
  type HomeSectionDraft,
  type HomeSectionDraftItem,
} from './homeSectionDraft';
import { getWizardSteps } from './sectionWizardConfig';
import { WizardLivePreview } from './WizardLivePreview';
import type { PreviewDevice } from '@/components/admin/homeBuilder/previewFrame/StorefrontSectionPreviewFrame';

interface SectionWizardModalProps {
  open: boolean;
  storeId: string;
  sectionType: HomeSectionType;
  /** Present in edit mode — the wizard loads its items and only persists
   * changes when "Guardar sección" is pressed, same as create mode. */
  existingSection?: StoreHomeSection;
  /** Preloaded once by HomeBuilderPage (same fetch StoreHomePage itself
   * uses) — threaded into the live preview panel so it can render the
   * *real* public section renderer (real theme, real product cards, real
   * currency) without firing its own fetch per wizard open. */
  categories: PublicStoreCategory[];
  publicProducts: PublicProductPage[];
  theme: StorefrontTheme;
  storeSlug: string;
  currency: string;
  isMenu: boolean;
  showCartButton: boolean;
  productCardCtaLabel: string;
  /** Starts the wizard's own Escritorio/Celular toggle synced with
   * whatever the canvas is currently showing — purely an initial value,
   * the wizard's own toggle then runs independently. */
  initialPreviewDevice: PreviewDevice;
  onClose: () => void;
  onSaved: (section: StoreHomeSection) => void;
}

async function resolveItemImage(
  item: HomeSectionDraftItem,
  storeId: string,
  sectionId: string
): Promise<HomeSectionDraftItem> {
  if (!item.pendingImageFile) return item;
  const imageUrl = await homeSectionsService.uploadHomeSectionImage(storeId, sectionId, item.pendingImageFile);
  return { ...item, imageUrl, pendingImageFile: null };
}

export function SectionWizardModal({
  open,
  storeId,
  sectionType,
  existingSection,
  categories,
  publicProducts,
  theme,
  storeSlug,
  currency,
  isMenu,
  showCartButton,
  productCardCtaLabel,
  initialPreviewDevice,
  onClose,
  onSaved,
}: SectionWizardModalProps) {
  const isEditMode = Boolean(existingSection);
  // Callers key this component by existingSection?.id ?? sectionType, so a
  // fresh instance mounts whenever the wizard's target changes — draft/
  // stepIndex only ever need their lazy initial value, never a reset effect.
  const [draft, setDraft] = useState<HomeSectionDraft>(() => createDefaultDraft(sectionType));
  const [stepIndex, setStepIndex] = useState(0);
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form');

  // Object URLs (item images, image_text's content image) are created via
  // URL.createObjectURL purely for local preview — the actual upload later
  // uses the File object directly (pendingImageFile), never the URL, so
  // revoking them on unmount is always safe and never affects a save that
  // already kicked off. Read through a ref so the cleanup always sees the
  // final draft, not the one from whichever render registered the effect.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  });
  useEffect(() => {
    return () => {
      const finalDraft = draftRef.current;
      const urls = new Set<string>();
      for (const item of finalDraft.items) {
        if (item.imageUrl?.startsWith('blob:')) urls.add(item.imageUrl);
      }
      if (finalDraft.content.sectionType === 'image_text' && finalDraft.content.imageUrl?.startsWith('blob:')) {
        urls.add(finalDraft.content.imageUrl);
      }
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!existingSection) return;
    let cancelled = false;
    homeSectionsService
      .getStoreHomeSectionItems(existingSection.id)
      .then((items) => {
        if (cancelled) return;
        setDraft(draftFromExistingSection(existingSection, items));
      })
      .catch((err) => notify.fromError(err))
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingSection?.id]);

  if (!open) return null;

  const steps = getWizardSteps(sectionType);
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const canGoNext = currentStep.isValid ? currentStep.isValid(draft) : true;

  function updateDraft(patch: Partial<HomeSectionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const sectionId = isEditMode ? existingSection!.id : null;

      // Content-level pending image (image_text) needs a real sectionId to
      // build its storage path — only resolvable once the section exists.
      async function resolveContent(forSectionId: string) {
        if (!draft.pendingContentImageFile) return draft.content;
        const imageUrl = await homeSectionsService.uploadHomeSectionImage(
          storeId,
          forSectionId,
          draft.pendingContentImageFile
        );
        return { ...draft.content, imageUrl } as typeof draft.content;
      }

      // Only the items the chosen count actually shows/uses right now —
      // for promo_banners, anything beyond that count is inert draft-only
      // state (see effectiveDraftItems) and must never be persisted, even
      // though it's still sitting in draft.items so raising the count
      // again would restore it within this same editing session.
      const itemsToSave = effectiveDraftItems(draft);

      if (isEditMode) {
        const content = await resolveContent(sectionId!);
        const resolvedItems = await Promise.all(itemsToSave.map((item) => resolveItemImage(item, storeId, sectionId!)));

        const updated = await homeSectionsService.updateStoreHomeSection(sectionId!, {
          heading: draft.heading,
          subheading: draft.subheading,
          isActive: draft.isActive,
          content,
        });
        await homeSectionsService.replaceStoreHomeSectionItems(
          sectionId!,
          storeId,
          resolvedItems.map((item) => itemToInsertPayload(item))
        );
        onSaved(updated);
        onClose();
        notify.success('Sección actualizada');
        return;
      }

      // Create mode: section first (need its id for image paths + items),
      // then images + items. Any failure past this point rolls the whole
      // section back so nothing half-created is left active.
      const created = await homeSectionsService.createStoreHomeSection({
        storeId,
        sectionType,
        sortOrder: 0,
        isActive: draft.isActive,
        heading: draft.heading,
        subheading: draft.subheading,
        content: draft.content,
      });

      try {
        const content = await resolveContent(created.id);
        const resolvedItems = await Promise.all(itemsToSave.map((item) => resolveItemImage(item, storeId, created.id)));

        const finalSection =
          content === draft.content ? created : await homeSectionsService.updateStoreHomeSection(created.id, { content });

        if (resolvedItems.length > 0) {
          await homeSectionsService.replaceStoreHomeSectionItems(
            created.id,
            storeId,
            resolvedItems.map((item) => itemToInsertPayload(item))
          );
        }

        onSaved(finalSection);
        onClose();
        notify.success('Sección creada');
      } catch (innerErr) {
        await homeSectionsService.deleteStoreHomeSection(created.id).catch(() => { /* best-effort rollback */ });
        throw innerErr;
      }
    } catch (err) {
      notify.fromError(err);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              {isEditMode ? 'Editar sección' : 'Nueva sección'}
            </p>
            <h2 className="text-lg font-semibold text-gray-900">{HOME_SECTION_TYPE_LABELS[sectionType]}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-3">
          {steps.map((step, index) => (
            <div key={step.key} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  index < stepIndex
                    ? 'bg-indigo-600 text-white'
                    : index === stepIndex
                    ? 'border-2 border-indigo-600 text-indigo-600'
                    : 'border border-gray-300 text-gray-400'
                }`}
              >
                {index < stepIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span className={`text-xs font-medium ${index === stepIndex ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.label}
              </span>
              {index < steps.length - 1 && <div className="h-px flex-1 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Mobile form/preview toggle — desktop shows both side by side,
            so this bar only renders below lg. */}
        <div className="flex border-b border-gray-100 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileView('form')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${
              mobileView === 'form' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400'
            }`}
          >
            <PenLine className="h-3.5 w-3.5" />
            Formulario
          </button>
          <button
            type="button"
            onClick={() => setMobileView('preview')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${
              mobileView === 'preview' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Vista previa
          </button>
        </div>

        {/* Body — form on the left, live preview on the right (desktop);
            tab-switched (mobile). */}
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className={`flex-1 overflow-y-auto px-6 py-5 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
            {loadingExisting ? (
              <p className="py-10 text-center text-sm text-gray-400">Cargando sección…</p>
            ) : (
              <currentStep.component key={`${sectionType}-${currentStep.key}`} draft={draft} updateDraft={updateDraft} storeId={storeId} />
            )}
          </div>
          <div
            className={`w-full shrink-0 overflow-y-auto border-gray-100 bg-gray-100/60 px-5 py-5 lg:w-[480px] lg:border-l ${
              mobileView === 'form' ? 'hidden lg:block' : ''
            }`}
          >
            {loadingExisting ? (
              <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
            ) : (
              <WizardLivePreview
                draft={draft}
                storeId={storeId}
                storeSlug={storeSlug}
                theme={theme}
                currency={currency}
                isMenu={isMenu}
                showCartButton={showCartButton}
                productCardCtaLabel={productCardCtaLabel}
                publicProducts={publicProducts}
                categories={categories}
                initialDevice={initialPreviewDevice}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button
                type="button"
                variant="secondary"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
                onClick={() => setStepIndex((i) => i - 1)}
                disabled={saving}
              >
                Atrás
              </Button>
            )}
            {isLastStep ? (
              <Button
                type="button"
                onClick={() => void handleSave()}
                isLoading={saving}
                leftIcon={!saving ? <Check className="h-4 w-4" /> : undefined}
                disabled={loadingExisting}
              >
                Guardar sección
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setStepIndex((i) => i + 1)}
                disabled={!canGoNext || loadingExisting}
              >
                Siguiente
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function itemToInsertPayload(item: HomeSectionDraftItem) {
  return {
    isActive: item.isActive,
    linkedEntityType: item.linkedEntityType,
    linkedEntityId: item.linkedEntityId,
    title: item.title,
    subtitle: item.subtitle,
    body: item.body,
    imageUrl: item.imageUrl,
    linkUrl: item.linkUrl,
    linkLabel: item.linkLabel,
    rating: item.rating,
    settings: item.settings,
  };
}
