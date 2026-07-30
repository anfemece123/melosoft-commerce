import type { WhatsappButtonLayout } from '@/types/common.types';
import { STOREFRONT_CONTAINER_CLASS, type StorefrontTheme } from './storefrontTheme';
import { WhatsappLogoIcon } from './WhatsappLogoIcon';

const DEFAULT_WHATSAPP_COLOR = '#25D366';

interface WhatsappFloatingButtonProps {
  href: string;
  color?: string | null;
  layout?: WhatsappButtonLayout | null;
  storeName: string;
  theme: StorefrontTheme;
}

/** Site-wide WhatsApp contact entry point. It intentionally has no autonomous
 * animation: movement can look like a rendering flicker and is distracting on
 * long catalog pages. */
export function WhatsappFloatingButton({
  href,
  color,
  layout = 'floating',
  storeName,
  theme,
}: WhatsappFloatingButtonProps) {
  const bg = color?.trim() || DEFAULT_WHATSAPP_COLOR;

  if (layout === 'inline') {
    return (
      <section
        aria-label="Contacto por WhatsApp"
        className="px-4 py-8 sm:px-6 lg:px-8"
        style={{ backgroundColor: theme.background }}
      >
        <div
          className={`mx-auto flex w-full ${STOREFRONT_CONTAINER_CLASS} flex-col gap-5 rounded-2xl border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7`}
          style={{
            backgroundColor: theme.surfaceAlt,
            borderColor: theme.border,
            boxShadow: `0 14px 35px ${theme.shadow}`,
          }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: bg }}
            >
              <WhatsappLogoIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold" style={{ color: theme.text }}>
                ¿Necesitas ayuda?
              </p>
              <p className="mt-1 text-sm leading-6" style={{ color: theme.mutedText }}>
                Habla directamente con {storeName} por WhatsApp.
              </p>
            </div>
          </div>

          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Escribir a ${storeName} por WhatsApp`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: bg, borderRadius: theme.radius }}
          >
            <WhatsappLogoIcon className="h-5 w-5" />
            Escribir por WhatsApp
          </a>
        </div>
      </section>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escribir a ${storeName} por WhatsApp`}
      className="group fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
      style={{ backgroundColor: bg, boxShadow: `0 12px 30px -8px ${bg}aa` }}
    >
      <span
        className="pointer-events-none absolute right-full mr-3 hidden translate-x-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold text-white opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block"
        style={{ backgroundColor: bg }}
        aria-hidden="true"
      >
        Chatea con nosotros
      </span>
      <WhatsappLogoIcon className="h-7 w-7 shrink-0" />
    </a>
  );
}
