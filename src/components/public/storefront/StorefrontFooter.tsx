import { Link } from 'react-router-dom';
import { Clock3, FileText, Globe, Mail, MapPin, MessageCircle } from 'lucide-react';
import type { PublicStoreLocation } from '@/features/locations/locations.types';
import type { PublicStorePage } from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from './storefrontTheme';
import { PublicStoreLogo } from './PublicStoreLogo';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import { useSelectedLocation } from '@/lib/locations/locationContext';
import { summarizeWeeklySchedule } from '@/lib/locations/schedule.utils';

interface StorefrontFooterProps {
  theme: StorefrontTheme;
  branding: PublicStorePage;
  locations: PublicStoreLocation[];
}

function withAlpha(color: string, alpha: number) {
  const value = color.trim();
  if (!value.startsWith('#')) return color;

  const hex = value.slice(1);
  const normalized = hex.length === 3
    ? hex.split('').map((char) => `${char}${char}`).join('')
    : hex.slice(0, 6);

  if (normalized.length !== 6) return color;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildLocationSummary(location: PublicStoreLocation) {
  return [location.addressLine, location.city, location.department]
    .filter(Boolean)
    .join(', ');
}

function buildCompanySummary(branding: PublicStorePage) {
  return branding.slogan || branding.description || 'Conoce nuestras sucursales, productos y canales de atención.';
}

export function StorefrontFooter({ theme, branding, locations }: StorefrontFooterProps) {
  const { selectedLocation, businessHours, businessStatus, scheduleLoading } = useSelectedLocation();
  const hasPolicies = Boolean(
    branding.shippingPolicy
    || branding.returnsPolicy
    || branding.warrantyPolicy
    || branding.privacyPolicy
    || branding.termsAndConditions
  );
  const footerBackground = theme.mode === 'dark' ? withAlpha(theme.background, 0.96) : '#171717';
  const footerText = '#f5f5f5';
  const footerMuted = 'rgba(245, 245, 245, 0.62)';
  const footerSoft = 'rgba(245, 245, 245, 0.32)';
  const footerDivider = 'rgba(255, 255, 255, 0.12)';
  const socialBorder = withAlpha(theme.primary, 0.85);
  const primaryLocations = locations.slice(0, 3);
  const scheduleSummary = summarizeWeeklySchedule(businessHours);
  const whatsappHref = branding.whatsappNumber
    ? `https://wa.me/${branding.whatsappNumber.replace(/\D/g, '')}`
    : null;
  const socialLinks = [
    whatsappHref
      ? { href: whatsappHref, label: 'WhatsApp', icon: MessageCircle }
      : null,
    branding.supportEmail
      ? { href: `mailto:${branding.supportEmail}`, label: 'Email', icon: Mail }
      : null,
    { href: buildStorefrontPath(branding.storeSlug), label: 'Sitio', icon: Globe, internal: true },
    hasPolicies
      ? { href: buildStorefrontPath(branding.storeSlug, '/policies'), label: 'Políticas', icon: FileText, internal: true }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    icon: typeof MessageCircle;
    internal?: boolean;
  }>;

  return (
    <footer
      className="mt-0 border-t"
      style={{ borderColor: footerDivider, backgroundColor: footerBackground }}
    >
      <div className={`mx-auto w-full ${STOREFRONT_CONTAINER_CLASS} px-4 sm:px-6 lg:px-8`}>
        <div className="grid gap-10 py-12 md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1.05fr]">
          <section className="max-w-sm">
            <div className="flex items-center gap-3">
              <PublicStoreLogo
                logoUrl={branding.logoUrl}
                storeName={branding.storeName}
                sizeClassName="h-12 w-12"
                fallbackColor={theme.primary}
                outerStyle={{ boxShadow: `0 0 0 1px ${footerDivider} inset` }}
              />
              <h2 className="text-[1.9rem] font-semibold tracking-[-0.04em]" style={{ color: footerText }}>
                {branding.storeName}
              </h2>
            </div>

            <p className="mt-5 max-w-xs text-sm leading-7" style={{ color: footerMuted }}>
              {buildCompanySummary(branding)}
            </p>

            <div className="mt-6 flex items-center gap-3">
              {socialLinks.map(({ href, label, icon: Icon, internal }, index) => (
                internal ? (
                  <Link
                    key={`${label}-${index}`}
                    to={href}
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:-translate-y-0.5"
                    style={{
                      borderColor: index === 0 ? socialBorder : footerDivider,
                      color: index === 0 ? theme.primary : footerText,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                ) : (
                  <a
                    key={`${label}-${index}`}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:-translate-y-0.5"
                    style={{
                      borderColor: index === 0 ? socialBorder : footerDivider,
                      color: index === 0 ? theme.primary : footerText,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                )
              ))}
            </div>
          </section>

          <section>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em]" style={{ color: footerSoft }}>
              Sucursales
            </p>
            <div className="mt-5 space-y-4">
              {(primaryLocations.length > 0 ? primaryLocations : [{
                locationId: branding.storeId,
                name: branding.storeName,
                addressLine: branding.locationAddress,
                city: branding.locationCity ?? branding.city,
                department: branding.locationDepartment,
              }]).map((location) => (
                <div key={location.locationId}>
                  <p className="text-sm font-medium" style={{ color: footerText }}>
                    {location.name}
                  </p>
                  <p className="mt-1 text-sm leading-6" style={{ color: footerMuted }}>
                    {buildLocationSummary(location as PublicStoreLocation) || 'Información disponible en tienda'}
                  </p>
                  {selectedLocation?.locationId === location.locationId && (
                    <div className="mt-3 border-l pl-3" style={{ borderColor: footerDivider }}>
                      <div className="flex items-center gap-2 text-xs font-medium" style={{ color: businessStatus?.isOpen ? theme.primary : footerText }}>
                        <Clock3 className="h-3.5 w-3.5" />
                        {scheduleLoading
                          ? 'Consultando horario…'
                          : businessStatus?.isOpen
                            ? 'Local abierto ahora'
                            : 'Local cerrado ahora'}
                      </div>
                      {!scheduleLoading && scheduleSummary.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {scheduleSummary.map((row) => (
                            <div key={`${row.days}-${row.hours}`} className="flex justify-between gap-4 text-xs" style={{ color: footerMuted }}>
                              <span>{row.days}</span>
                              <span className="text-right">{row.hours}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em]" style={{ color: footerSoft }}>
              Información de la empresa
            </p>
            <div className="mt-5 flex flex-col gap-4 text-sm" style={{ color: footerMuted }}>
              {branding.supportEmail && (
                <a href={`mailto:${branding.supportEmail}`} className="inline-flex items-center gap-2 transition-opacity hover:opacity-100">
                  <Mail className="h-4 w-4" />
                  {branding.supportEmail}
                </a>
              )}
              {whatsappHref && branding.whatsappNumber && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition-opacity hover:opacity-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  {branding.whatsappNumber}
                </a>
              )}
              {(branding.city || branding.locationCity) && (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {branding.locationCity ?? branding.city}
                </span>
              )}
              <div className="flex flex-col gap-3 pt-2">
                <Link to={buildStorefrontPath(branding.storeSlug)} className="transition-colors hover:opacity-100" style={{ color: footerText }}>
                  Inicio
                </Link>
                <Link to={buildStorefrontPath(branding.storeSlug)} className="transition-colors hover:opacity-100" style={{ color: footerText }}>
                  Menú
                </Link>
                {hasPolicies && (
                  <Link to={buildStorefrontPath(branding.storeSlug, '/policies')} className="transition-colors hover:opacity-100" style={{ color: footerText }}>
                    Políticas
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>

        <div
          className="flex flex-col gap-4 border-t py-5 text-sm md:flex-row md:items-center md:justify-between"
          style={{ borderColor: footerDivider, color: footerMuted }}
        >
          <p>© {new Date().getFullYear()} · {branding.storeName}</p>
          <div className="flex flex-wrap items-center gap-5">
            <span>Melosoft Commerce</span>
            <span style={{ color: footerSoft }}>Web</span>
            <span style={{ color: footerSoft }}>WhatsApp</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
