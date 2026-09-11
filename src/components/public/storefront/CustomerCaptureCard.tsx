import { useState } from 'react';
import { CheckCircle2, Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { customersService } from '@/features/customers/customersService';
import type { PublicStorePage } from '@/types/common.types';
import { buildStorefrontPath } from '@/lib/storefront/storefrontPaths';
import type { StorefrontTheme } from './storefrontTheme';

interface CustomerCaptureCardProps {
  branding: PublicStorePage;
  theme: StorefrontTheme;
}

export function CustomerCaptureCard({ branding, theme }: CustomerCaptureCardProps) {
  const emailEnabled = branding.customerEmailMarketingEnabled !== false;
  const whatsappEnabled = branding.customerWhatsappMarketingEnabled === true;
  const collectPhone = branding.customerCaptureCollectPhone === true || whatsappEnabled;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!branding.customerCaptureEnabled) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!emailOptIn && !whatsappOptIn) {
      setError('Selecciona al menos un canal para autorizar las comunicaciones.');
      return;
    }
    setSubmitting(true);
    try {
      await customersService.captureContact({
        storeSlug: branding.storeSlug,
        fullName,
        email,
        phone: collectPhone ? phone : undefined,
        marketingEmailOptIn: emailEnabled && emailOptIn,
        marketingWhatsappOptIn: whatsappEnabled && whatsappOptIn,
      });
      setSubmitted(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No pudimos guardar tus datos.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section
        className="rounded-2xl border p-6 shadow-sm sm:p-8"
        style={{ backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.text }}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" style={{ color: theme.primary }} aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">Listo, ya estás registrado</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: theme.mutedText }}>
              {branding.customerCaptureSuccessMessage || 'Gracias. Guardamos tus datos y tendremos en cuenta tus preferencias.'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border p-6 shadow-sm sm:p-8"
      style={{ backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.text }}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.primary }}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Beneficios de {branding.storeName}
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{branding.customerCaptureTitle || 'Recibe novedades y beneficios'}</h2>
          <p className="mt-3 text-sm leading-7" style={{ color: theme.mutedText }}>
            {branding.customerCaptureDescription || 'Déjanos tus datos y te enviaremos beneficios de esta empresa.'}
          </p>
          {branding.customerCaptureIncentiveText && (
            <p className="mt-4 rounded-xl border px-4 py-3 text-sm font-medium" style={{ borderColor: theme.border, backgroundColor: theme.softPrimary }}>
              {branding.customerCaptureIncentiveText}
            </p>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium sm:col-span-2">
              Nombre <span className="font-normal" style={{ color: theme.mutedText }}>(opcional)</span>
              <input
                type="text"
                value={fullName}
                maxLength={200}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Tu nombre"
                className="mt-1.5 block w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-sm outline-none transition focus:ring-2"
                style={{ borderColor: theme.border, color: theme.text, outlineColor: theme.primary }}
              />
            </label>
            <label className="block text-sm font-medium sm:col-span-2">
              Correo electrónico {emailOptIn ? <span style={{ color: theme.primary }}>*</span> : <span className="font-normal" style={{ color: theme.mutedText }}>(opcional)</span>}
              <span className="relative mt-1.5 block">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4" style={{ color: theme.mutedText }} aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  required={emailOptIn}
                  maxLength={254}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  className="block w-full rounded-xl border bg-white/80 py-2.5 pl-9 pr-3.5 text-sm outline-none transition focus:ring-2"
                  style={{ borderColor: theme.border, color: theme.text, outlineColor: theme.primary }}
                />
              </span>
            </label>
            {collectPhone && (
              <label className="block text-sm font-medium sm:col-span-2">
                Teléfono {whatsappOptIn ? <span style={{ color: theme.primary }}>*</span> : <span className="font-normal" style={{ color: theme.mutedText }}>(opcional)</span>}
                <span className="relative mt-1.5 block">
                  <MessageCircle className="pointer-events-none absolute left-3 top-3 h-4 w-4" style={{ color: theme.mutedText }} aria-hidden="true" />
                  <input
                    type="tel"
                    value={phone}
                    required={whatsappOptIn}
                    maxLength={30}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="300 000 0000"
                    className="block w-full rounded-xl border bg-white/80 py-2.5 pl-9 pr-3.5 text-sm outline-none transition focus:ring-2"
                    style={{ borderColor: theme.border, color: theme.text, outlineColor: theme.primary }}
                  />
                </span>
              </label>
            )}
          </div>

          {(emailEnabled || whatsappEnabled) && (
            <div className="space-y-2 rounded-xl border p-3.5" style={{ borderColor: theme.border }}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: theme.mutedText }}>Elige cómo contactarte</p>
              {emailEnabled && (
                <label className="flex items-start gap-2.5 text-xs leading-5" style={{ color: theme.mutedText }}>
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded" checked={emailOptIn} onChange={(event) => setEmailOptIn(event.target.checked)} style={{ accentColor: theme.primary }} />
                  <span>Quiero recibir novedades y beneficios por correo electrónico.</span>
                </label>
              )}
              {whatsappEnabled && (
                <label className="flex items-start gap-2.5 text-xs leading-5" style={{ color: theme.mutedText }}>
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded" checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} style={{ accentColor: theme.primary }} />
                  <span>Quiero recibir novedades y beneficios por WhatsApp.</span>
                </label>
              )}
              <p className="pt-1 text-[11px] leading-5" style={{ color: theme.mutedText }}>
                Puedes retirar tu autorización en cualquier momento. Consulta la <a className="underline underline-offset-2" href={buildStorefrontPath(branding.storeSlug, '/policies')}>política de privacidad</a>.
              </p>
            </div>
          )}

          {error && <p role="alert" className="text-sm" style={{ color: '#b91c1c' }}>{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: theme.primary }}
          >
            {submitting ? 'Guardando…' : 'Quiero recibir beneficios'}
          </button>
        </form>
      </div>
    </section>
  );
}
