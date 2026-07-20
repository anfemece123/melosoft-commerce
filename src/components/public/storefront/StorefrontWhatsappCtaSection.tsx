import { MessageCircle } from 'lucide-react';
import type { StorefrontTheme } from './storefrontTheme';
import { StorefrontActionButton } from './StorefrontActionButton';

interface StorefrontWhatsappCtaSectionProps {
  theme: StorefrontTheme;
  whatsappHref: string | null;
  supportEmail: string | null;
  showPrimaryCta: boolean;
  showFallbackLink: boolean;
}

/** WhatsApp CTA — like the campaign offers grid, this is automatic
 * storefront behavior driven by commerce settings, not a Home Builder
 * section type, so it always renders after the sections/legacy body. */
export function StorefrontWhatsappCtaSection({
  theme,
  whatsappHref,
  supportEmail,
  showPrimaryCta,
  showFallbackLink,
}: StorefrontWhatsappCtaSectionProps) {
  if (showPrimaryCta && whatsappHref) {
    return (
      <section className="py-12 px-4" style={{ backgroundColor: theme.background }}>
        <div className="max-w-5xl mx-auto text-center">
          <StorefrontActionButton
            as="a"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            variant="whatsapp"
            theme={theme}
            className="gap-2 px-6 py-3"
          >
            <MessageCircle className="w-5 h-5" />
            Contáctanos por WhatsApp
          </StorefrontActionButton>
          {supportEmail && (
            <p className="text-xs mt-3" style={{ color: theme.mutedText }}>
              {supportEmail}
            </p>
          )}
        </div>
      </section>
    );
  }

  if (showFallbackLink && whatsappHref) {
    return (
      <section className="py-10 px-4" style={{ backgroundColor: theme.background }}>
        <div className="max-w-5xl mx-auto text-center">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm underline underline-offset-2"
            style={{ color: theme.mutedText }}
          >
            <MessageCircle className="w-4 h-4" />
            Contáctanos por WhatsApp
          </a>
        </div>
      </section>
    );
  }

  return null;
}
