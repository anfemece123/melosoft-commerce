import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Palette, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AdminPanelShell } from '@/components/admin/AdminPanelShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { useAppSelector } from '@/app/hooks';
import { selectAuthProfile } from '@/features/auth/auth.selectors';
import { selectCurrentBusinessLimits, selectCurrentStore, selectMyMemberships } from '@/features/stores/stores.selectors';
import { categoriesService } from '@/features/categories/categoriesService';
import { categoryExperiencesService } from '@/features/categoryExperiences/categoryExperiencesService';
import type { StoreCategoryExperience } from '@/features/categoryExperiences/categoryExperiences.types';
import type { PublicStoreCategory, ThemeMode } from '@/types/common.types';
import { canManageStore } from '@/utils/permissions';
import { notify } from '@/lib/notifications';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { ExperienceAmbienceFields } from '@/components/admin/experiences/ExperienceAmbienceFields';
import { ExperienceGatewayCard } from '@/components/admin/experiences/ExperienceGatewayCard';
import { ExperiencePreview } from '@/components/admin/experiences/ExperiencePreview';
import type { StoreExperienceGateway } from '@/features/categoryExperiences/categoryExperiences.types';
import type {
  ExperienceBackgroundPattern,
  ExperienceBackgroundStyle,
  ExperienceHeadingFont,
} from '@/types/common.types';
import { buildExperienceBackdropStyle, EXPERIENCE_HEADING_FONTS } from '@/lib/storefront/experienceAmbience';
import type { ExperienceStylePreset } from '@/lib/storefront/experiencePresets';

interface ExperienceForm {
  categoryId: string;
  displayName: string;
  tagline: string;
  description: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  themeMode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonRadius: string;
  backgroundStyle: ExperienceBackgroundStyle;
  backgroundPattern: ExperienceBackgroundPattern;
  backgroundImageUrl: string | null;
  backgroundIntensity: number;
  headingFont: ExperienceHeadingFont;
}

const DEFAULT_FORM: ExperienceForm = {
  categoryId: '',
  displayName: '',
  tagline: '',
  description: '',
  logoUrl: null,
  coverImageUrl: null,
  themeMode: 'light',
  primaryColor: '#4f46e5',
  secondaryColor: '#eef2ff',
  accentColor: '#7c3aed',
  backgroundColor: '#ffffff',
  textColor: '#111827',
  buttonRadius: '24px',
  backgroundStyle: 'solid',
  backgroundPattern: 'dots',
  backgroundImageUrl: null,
  backgroundIntensity: 50,
  headingFont: 'default',
};

function toForm(experience?: StoreCategoryExperience | null): ExperienceForm {
  if (!experience) return DEFAULT_FORM;
  return {
    categoryId: experience.categoryId,
    displayName: experience.displayName,
    tagline: experience.tagline ?? '',
    description: experience.description ?? '',
    logoUrl: experience.logoUrl,
    coverImageUrl: experience.coverImageUrl,
    themeMode: experience.themeMode,
    primaryColor: experience.primaryColor,
    secondaryColor: experience.secondaryColor,
    accentColor: experience.accentColor,
    backgroundColor: experience.backgroundColor,
    textColor: experience.textColor,
    buttonRadius: experience.buttonRadius,
    backgroundStyle: experience.backgroundStyle,
    backgroundPattern: experience.backgroundPattern,
    backgroundImageUrl: experience.backgroundImageUrl,
    backgroundIntensity: experience.backgroundIntensity,
    headingFont: experience.headingFont,
  };
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function categoryLabel(category: PublicStoreCategory): string {
  return category.parentId ? `Subcategoría · ${category.name}` : category.name;
}

export function CategoryExperiencesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const profile = useAppSelector(selectAuthProfile);
  const memberships = useAppSelector(selectMyMemberships);
  const store = useAppSelector(selectCurrentStore);
  const limits = useAppSelector(selectCurrentBusinessLimits);
  const [categories, setCategories] = useState<PublicStoreCategory[]>([]);
  const [experiences, setExperiences] = useState<StoreCategoryExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StoreCategoryExperience | null>(null);
  const [form, setForm] = useState<ExperienceForm>(DEFAULT_FORM);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState<string | null>(null);
  const [pendingBackgroundFile, setPendingBackgroundFile] = useState<File | null>(null);
  const [pendingBackgroundPreview, setPendingBackgroundPreview] = useState<string | null>(null);
  const [gateway, setGateway] = useState<StoreExperienceGateway | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canManage = Boolean(storeId) && canManageStore(profile, memberships, storeId as string);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const availableCategories = useMemo(() => {
    const configured = new Set(experiences.filter((item) => item.id !== editing?.id).map((item) => item.categoryId));
    return categories.filter((category) => !category.parentId && !configured.has(category.id));
  }, [categories, editing?.id, experiences]);

  useEffect(() => () => {
    if (pendingLogoPreview?.startsWith('blob:')) URL.revokeObjectURL(pendingLogoPreview);
    if (pendingCoverPreview?.startsWith('blob:')) URL.revokeObjectURL(pendingCoverPreview);
    if (pendingBackgroundPreview?.startsWith('blob:')) URL.revokeObjectURL(pendingBackgroundPreview);
  }, [pendingLogoPreview, pendingCoverPreview, pendingBackgroundPreview]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    // This route can be reused when switching companies without unmounting;
    // reset the loading state before replacing the previous company's data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      categoriesService.getStoreCategories(storeId, { activeOnly: true }),
      categoryExperiencesService.getStoreExperiences(storeId),
      categoryExperiencesService.getGateway(storeId).catch(() => null),
    ]).then(([loadedCategories, loadedExperiences, loadedGateway]) => {
      if (cancelled) return;
      setCategories(loadedCategories);
      setExperiences(loadedExperiences);
      setGateway(loadedGateway);
      setError(null);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar las experiencias.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [storeId]);

  if (!storeId || !store) return <LoadingScreen label="Cargando empresa…" />;

  function openCreate() {
    setEditing(null);
    setForm({ ...DEFAULT_FORM, categoryId: availableCategories[0]?.id ?? '' });
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
    setPendingCoverFile(null);
    setPendingCoverPreview(null);
    setPendingBackgroundFile(null);
    setPendingBackgroundPreview(null);
    setModalOpen(true);
  }

  function openEdit(experience: StoreCategoryExperience) {
    setEditing(experience);
    setForm(toForm(experience));
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
    setPendingCoverFile(null);
    setPendingCoverPreview(null);
    setPendingBackgroundFile(null);
    setPendingBackgroundPreview(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
    setPendingCoverFile(null);
    setPendingCoverPreview(null);
    setPendingBackgroundFile(null);
    setPendingBackgroundPreview(null);
  }

  function handleLogoSelect(file: File | null) {
    setPendingLogoFile(file);
    setPendingLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleCoverSelect(file: File | null) {
    setPendingCoverFile(file);
    setPendingCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleBackgroundSelect(file: File | null) {
    setPendingBackgroundFile(file);
    setPendingBackgroundPreview(file ? URL.createObjectURL(file) : null);
  }

  function applyPreset(preset: ExperienceStylePreset) {
    setForm((current) => ({
      ...current,
      themeMode: preset.themeMode,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      textColor: preset.textColor,
      buttonRadius: preset.buttonRadius,
      backgroundStyle: preset.backgroundStyle,
      backgroundPattern: preset.backgroundPattern,
      backgroundIntensity: preset.backgroundIntensity,
      headingFont: preset.headingFont,
    }));
  }

  function setField<K extends keyof ExperienceForm>(field: K, value: ExperienceForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveExperience() {
    if (!storeId || !form.categoryId || !form.displayName.trim()) {
      notify.error('Selecciona una categoría y escribe un nombre para la experiencia.');
      return;
    }
    const colors = [form.primaryColor, form.secondaryColor, form.accentColor, form.backgroundColor, form.textColor];
    if (colors.some((color) => !isHexColor(color))) {
      notify.error('Usa colores hexadecimales válidos, por ejemplo #4f46e5.');
      return;
    }
    if (form.backgroundStyle === 'image' && !form.backgroundImageUrl && !pendingBackgroundFile) {
      notify.error('Sube la imagen de fondo o elige otro estilo de fondo.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        categoryId: form.categoryId,
        displayName: form.displayName,
        tagline: form.tagline || null,
        description: form.description || null,
        logoUrl: form.logoUrl,
        coverImageUrl: form.coverImageUrl,
        themeMode: form.themeMode,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        backgroundColor: form.backgroundColor,
        textColor: form.textColor,
        buttonRadius: form.buttonRadius,
        backgroundStyle: form.backgroundStyle,
        backgroundPattern: form.backgroundPattern,
        backgroundImageUrl: form.backgroundImageUrl,
        backgroundIntensity: form.backgroundIntensity,
        headingFont: form.headingFont,
      };
      let saved: StoreCategoryExperience;
      if (editing) {
        saved = await categoryExperiencesService.updateExperience(editing.id, payload);
      } else {
        saved = await categoryExperiencesService.createExperience({ storeId, ...payload });
      }

      if (pendingLogoFile) {
        const logoUrl = await categoryExperiencesService.uploadExperienceLogo(storeId, saved.id, pendingLogoFile);
        saved = await categoryExperiencesService.updateExperience(saved.id, { logoUrl });
      }
      if (pendingCoverFile) {
        const coverImageUrl = await categoryExperiencesService.uploadExperienceCover(storeId, saved.id, pendingCoverFile);
        saved = await categoryExperiencesService.updateExperience(saved.id, { coverImageUrl });
      }
      if (pendingBackgroundFile) {
        const backgroundImageUrl = await categoryExperiencesService.uploadExperienceBackground(storeId, saved.id, pendingBackgroundFile);
        saved = await categoryExperiencesService.updateExperience(saved.id, { backgroundImageUrl });
      }

      if (editing) {
        setExperiences((current) => current.map((item) => item.id === saved.id ? saved : item));
        notify.success('Experiencia actualizada.');
      } else {
        setExperiences((current) => [...current, saved].sort((a, b) => a.sortOrder - b.sortOrder));
        notify.success('Experiencia creada.');
      }
      closeModal();
    } catch (saveError) {
      notify.fromError(saveError, 'No pudimos guardar la experiencia.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleExperience(experience: StoreCategoryExperience) {
    try {
      const updated = await categoryExperiencesService.updateExperience(experience.id, { isActive: !experience.isActive });
      setExperiences((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify.success(updated.isActive ? 'Experiencia publicada.' : 'Experiencia pausada.');
    } catch (toggleError) {
      notify.fromError(toggleError, 'No pudimos cambiar el estado.');
    }
  }

  async function deleteExperience(experience: StoreCategoryExperience) {
    if (!window.confirm(`¿Eliminar la experiencia “${experience.displayName}”? La categoría y sus productos no se eliminarán.`)) return;
    setDeletingId(experience.id);
    try {
      await categoryExperiencesService.deleteExperience(experience.id);
      setExperiences((current) => current.filter((item) => item.id !== experience.id));
      notify.success('Experiencia eliminada.');
    } catch (deleteError) {
      notify.fromError(deleteError, 'No pudimos eliminar la experiencia.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminPanelShell
      top={(
        <PageHeader
          title="Experiencias por categoría"
          description="Crea una identidad visual distinta —nombre, logo, colores, fondo y tipografía— para cada línea o marca de tu catálogo."
          action={canManage && limits?.canUseCategoryExperiences && availableCategories.length > 0 ? (
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Nueva experiencia</Button>
          ) : undefined}
        />
      )}
    >
      <div className="max-w-5xl pb-8">
        {!limits?.canUseCategoryExperiences ? (
          <Card>
            <CardBody className="flex items-start gap-4">
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><Sparkles className="h-6 w-6" /></div>
              <div>
                <h2 className="font-semibold text-gray-900">Módulo no habilitado</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                  Este módulo permite cambiar nombre, logo, colores y estilo según la categoría activa del catálogo. El Super Admin puede habilitarlo para esta empresa desde su ficha.
                </p>
                {canManage && <Link to={`/admin/stores/${storeId}`} className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">Volver a la empresa</Link>}
              </div>
            </CardBody>
          </Card>
        ) : (
          <>
            {!loading && (
              <ExperienceGatewayCard
                key={gateway?.storeId ?? 'new-gateway'}
                storeId={storeId}
                storeSlug={store.slug}
                gateway={gateway}
                activeExperienceCount={experiences.filter((item) => item.isActive).length}
                canManage={canManage}
                onSaved={setGateway}
              />
            )}

            <Card className="mb-6 border-indigo-100 bg-indigo-50/60">
              <CardBody className="flex items-start gap-4">
                <div className="rounded-xl bg-white p-3 text-indigo-600 shadow-sm"><Palette className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-semibold text-gray-900">Una experiencia, un contexto</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
                    Asigna una experiencia a una categoría principal. Cuando un cliente entre en esa categoría, verá únicamente sus productos y la tienda adaptará automáticamente su nombre, logo y colores. Si la desactivas, la categoría seguirá existiendo con el tema general de la empresa.
                  </p>
                </div>
              </CardBody>
            </Card>

            {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {loading ? <LoadingScreen label="Cargando experiencias…" /> : experiences.length === 0 ? (
              <Card>
                <CardBody className="py-12 text-center">
                  <Sparkles className="mx-auto h-9 w-9 text-indigo-300" />
                  <h2 className="mt-3 font-semibold text-gray-900">Todavía no hay experiencias configuradas</h2>
                  <p className="mx-auto mt-1 max-w-lg text-sm text-gray-500">Empieza con una categoría como “Pádel”, “Gym”, “Mujer” o “Temporada escolar”. Los productos se filtrarán usando la categoría real del catálogo.</p>
                  {canManage && availableCategories.length > 0 && <Button className="mt-5" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Crear primera experiencia</Button>}
                  {availableCategories.length === 0 && <p className="mt-4 text-xs text-amber-700">Primero crea categorías activas desde Productos → Categorías.</p>}
                </CardBody>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {experiences.map((experience) => {
                  const category = categoryById.get(experience.categoryId);
                  const previewHref = category ? buildStorefrontPath(store.slug, `/catalog?cat=${encodeURIComponent(category.slug)}`) : null;
                  return (
                    <Card key={experience.id} className={`overflow-hidden ${!experience.isActive ? 'opacity-65' : ''}`}>
                      <div
                        aria-hidden="true"
                        className="flex h-16 items-end px-5 pb-2"
                        style={buildExperienceBackdropStyle({
                          ...experience,
                          backgroundStyle: experience.backgroundStyle === 'solid' ? 'gradient' : experience.backgroundStyle,
                          backgroundIntensity: Math.max(experience.backgroundIntensity, 60),
                        })}
                      >
                        <span
                          className="truncate text-lg font-bold"
                          style={{ color: experience.textColor, fontFamily: EXPERIENCE_HEADING_FONTS[experience.headingFont].family ?? undefined }}
                        >
                          {experience.tagline || experience.displayName}
                        </span>
                      </div>
                      <CardBody>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white shadow-sm"
                              style={{ background: `linear-gradient(135deg, ${experience.primaryColor}, ${experience.accentColor})` }}
                            >
                              {experience.logoUrl ? <img src={experience.logoUrl} alt="" className="h-full w-full object-contain" /> : null}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-gray-900">{experience.displayName}</h3>
                              <p className="text-xs text-gray-500">Categoría: {category?.name ?? 'No encontrada'}</p>
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${experience.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {experience.isActive ? 'Activa' : 'Pausada'}
                          </span>
                        </div>
                        {experience.coverImageUrl && (
                          <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                            <img src={experience.coverImageUrl} alt={`Portada de ${experience.displayName}`} className="h-24 w-full object-cover" />
                          </div>
                        )}
                        <div className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Paleta de colores">
                          {[experience.primaryColor, experience.secondaryColor, experience.accentColor, experience.backgroundColor, experience.textColor].map((color) => <span key={color} className="h-6 rounded-md border border-black/5" style={{ backgroundColor: color }} title={color} />)}
                        </div>
                        {experience.description && <p className="mt-3 line-clamp-2 text-sm text-gray-500">{experience.description}</p>}
                        <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                          {previewHref && <a href={previewHref} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>Ver categoría</Button></a>}
                          {canManage && <Button variant="ghost" size="sm" onClick={() => openEdit(experience)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>Editar</Button>}
                          {canManage && <Button variant="ghost" size="sm" onClick={() => void toggleExperience(experience)}>{experience.isActive ? 'Pausar' : 'Publicar'}</Button>}
                          {canManage && <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={deletingId === experience.id} onClick={() => void deleteExperience(experience)} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>Eliminar</Button>}
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar experiencia' : 'Nueva experiencia'}
        description="Define cómo se verá la tienda cuando el cliente explore esta categoría."
        onClose={closeModal}
        maxWidth="2xl"
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeModal}>Cancelar</Button>
            <Button isLoading={saving} onClick={() => void saveExperience()}>{editing ? 'Guardar cambios' : 'Crear experiencia'}</Button>
          </div>
        )}
      >
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Categoría del catálogo" value={form.categoryId} onChange={(event) => setField('categoryId', event.target.value)} options={availableCategories.map((category) => ({ value: category.id, label: categoryLabel(category) }))} placeholder="Selecciona una categoría" disabled={Boolean(editing)} hint="Los productos se filtran por esta categoría real." />
              <Input label="Nombre visible" value={form.displayName} onChange={(event) => setField('displayName', event.target.value)} placeholder="Ej. Sakura Sushi Bar" hint="Aparece en el header, la portada de selección y la cabecera." />
            </div>
            <Input label="Frase corta (opcional)" value={form.tagline} maxLength={80} onChange={(event) => setField('tagline', event.target.value)} placeholder="Ej. Cocina japonesa · Robata" hint="Se muestra en mayúsculas pequeñas sobre el nombre." />
            <Textarea label="Descripción breve (opcional)" value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="Ej. Rolls de autor, nigiris y ramen al estilo Tokio." rows={3} />
          </section>

          <section className="space-y-4 border-t border-gray-100 pt-5">
            <ImageUploadField
              id="category-experience-logo"
              label="Logo (opcional)"
              assetKind="store_logo"
              previewUrl={pendingLogoPreview ?? form.logoUrl}
              onFileSelect={handleLogoSelect}
              onClear={() => {
                setPendingLogoFile(null);
                setPendingLogoPreview(null);
                setField('logoUrl', null);
              }}
              uploading={saving && Boolean(pendingLogoFile)}
              hint="Si lo dejas vacío, se usará el logo general de la empresa."
              aspectClassName="h-24 w-24 rounded-2xl"
            />
            <ImageUploadField
              id="category-experience-cover"
              label="Foto de portada (opcional)"
              assetKind="store_hero_background"
              previewUrl={pendingCoverPreview ?? form.coverImageUrl}
              onFileSelect={handleCoverSelect}
              onClear={() => {
                setPendingCoverFile(null);
                setPendingCoverPreview(null);
                setField('coverImageUrl', null);
              }}
              uploading={saving && Boolean(pendingCoverFile)}
              hint="Se usa arriba del catálogo y en la portada de selección. Mantén el plato o ambiente principal al centro de la foto."
              aspectClassName="h-28 w-full max-w-md rounded-2xl"
            />
          </section>

          <section className="border-t border-gray-100 pt-5">
            <ExperienceAmbienceFields
              primaryColor={isHexColor(form.primaryColor) ? form.primaryColor : '#4f46e5'}
              accentColor={isHexColor(form.accentColor) ? form.accentColor : '#7c3aed'}
              secondaryColor={isHexColor(form.secondaryColor) ? form.secondaryColor : '#eef2ff'}
              backgroundColor={isHexColor(form.backgroundColor) ? form.backgroundColor : '#ffffff'}
              themeMode={form.themeMode}
              backgroundStyle={form.backgroundStyle}
              backgroundPattern={form.backgroundPattern}
              backgroundIntensity={form.backgroundIntensity}
              headingFont={form.headingFont}
              onPresetApply={applyPreset}
              onBackgroundStyleChange={(value) => setField('backgroundStyle', value)}
              onBackgroundPatternChange={(value) => setField('backgroundPattern', value)}
              onBackgroundIntensityChange={(value) => setField('backgroundIntensity', value)}
              onHeadingFontChange={(value) => setField('headingFont', value)}
              imageField={(
                <ImageUploadField
                  id="category-experience-background"
                  label="Imagen de fondo"
                  assetKind="store_hero_background"
                  previewUrl={pendingBackgroundPreview ?? form.backgroundImageUrl}
                  onFileSelect={handleBackgroundSelect}
                  onClear={() => {
                    setPendingBackgroundFile(null);
                    setPendingBackgroundPreview(null);
                    setField('backgroundImageUrl', null);
                  }}
                  uploading={saving && Boolean(pendingBackgroundFile)}
                  hint="Texturas funcionan mejor que fotos con mucho detalle: madera, mármol, pizarra, lino. Se suaviza con el color de fondo para que todo se lea bien."
                  aspectClassName="h-28 w-full max-w-md rounded-2xl"
                />
              )}
            />
          </section>

          <section className="space-y-4 border-t border-gray-100 pt-5">
            <Select label="Contraste del tema" value={form.themeMode} onChange={(event) => setField('themeMode', event.target.value as ThemeMode)} options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} hint="Afecta la lectura del encabezado, superficies y controles." />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Paleta visual</h3>
              <p className="mt-1 text-xs text-gray-500">Usa colores hexadecimales de seis dígitos.</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {([
                  ['primaryColor', 'Color principal', 'Botones, enlaces y acciones'],
                  ['secondaryColor', 'Color secundario', 'Superficies y fondos suaves'],
                  ['accentColor', 'Color de acento', 'Frase corta y destacados'],
                  ['backgroundColor', 'Color de fondo', 'Base del fondo de la página'],
                  ['textColor', 'Color del texto', 'Títulos y contenido principal'],
                ] as const).map(([field, label, hint]) => (
                  <div key={field} className="flex items-end gap-2">
                    <Input label={label} value={form[field]} onChange={(event) => setField(field, event.target.value)} hint={hint} />
                    <input aria-label={`Selector ${label}`} type="color" value={isHexColor(form[field]) ? form[field] : '#000000'} onChange={(event) => setField(field, event.target.value)} className="mb-1 h-10 w-12 cursor-pointer rounded-lg border border-gray-300 bg-white p-1" />
                  </div>
                ))}
              </div>
            </div>
            <Select label="Radio de botones" value={form.buttonRadius} onChange={(event) => setField('buttonRadius', event.target.value)} options={[{ value: '8px', label: 'Compacto' }, { value: '14px', label: 'Suave' }, { value: '24px', label: 'Redondeado' }, { value: '9999px', label: 'Píldora' }]} />
          </section>

          <section className="border-t border-gray-100 pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Vista previa</p>
            <ExperiencePreview
              values={{
                ...form,
                logoUrl: pendingLogoPreview ?? form.logoUrl,
                backgroundImageUrl: pendingBackgroundPreview ?? form.backgroundImageUrl,
              }}
            />
          </section>
        </div>
      </Modal>
    </AdminPanelShell>
  );
}
