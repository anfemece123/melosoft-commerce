import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const launchWhatsAppEmbeddedSignupMock = vi.fn();

vi.mock('@/lib/whatsapp/embeddedSignup', () => ({
  launchWhatsAppEmbeddedSignup: launchWhatsAppEmbeddedSignupMock,
}));

vi.mock('@/lib/storefront/storefrontDomainContext', () => ({
  useStorefrontDomain: () => ({ mode: 'platform' }),
  isStorefrontHostnameMode: () => false,
}));

vi.mock('@/features/whatsapp/whatsappService', () => ({
  whatsappService: {
    getSettings: vi.fn().mockResolvedValue(null),
    getConnection: vi.fn().mockResolvedValue(null),
    getRecentNotifications: vi.fn().mockResolvedValue([]),
    completeEmbeddedSignup: vi.fn(),
    upsertSettings: vi.fn(),
    syncTemplate: vi.fn(),
    disconnect: vi.fn(),
    sendTestMessage: vi.fn(),
  },
}));

vi.mock('@/lib/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), fromError: vi.fn() },
}));

// Loading must end on EVERY path launchWhatsAppEmbeddedSignup can take —
// this is the guarantee the production incident violated (FB.login()
// never settling left `connecting` stuck at true forever). Covering one
// representative rejection here proves the try/catch/finally wiring
// itself is sound; embeddedSignup.test.ts proves every one of those
// rejection paths (CANCEL, ERROR, popup closed, timeout, disallowed
// origin) actually fires instead of hanging.
describe('WhatsappSettingsPage — Conectar WhatsApp Business button', () => {
  it('always leaves the loading state when launchWhatsAppEmbeddedSignup rejects', async () => {
    
    launchWhatsAppEmbeddedSignupMock.mockRejectedValueOnce(new Error('EMBEDDED_SIGNUP_POPUP_CLOSED'));

    const { WhatsappSettingsPage } = await import('./WhatsappSettingsPage');
    const { notify } = await import('@/lib/notifications');

    render(
      <MemoryRouter initialEntries={['/admin/stores/store-1/whatsapp']}>
        <Routes>
          <Route path="/admin/stores/:storeId/whatsapp" element={<WhatsappSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const connectButton = await screen.findByRole<HTMLButtonElement>('button', { name: /conectar whatsapp business/i });
    expect(connectButton.disabled).toBe(false);

    fireEvent.click(connectButton);

    // The button must return to its normal, clickable state — never
    // stuck disabled/spinning — once the promise settles.
    await waitFor(() => expect(connectButton.disabled).toBe(false));
    expect(notify.error).toHaveBeenCalledWith(
      'La ventana de Meta se cerró antes de terminar. Intenta de nuevo sin cerrarla manualmente.',
    );
  });

  it('always leaves the loading state when the Edge Function call rejects after a successful Meta login', async () => {
    
    launchWhatsAppEmbeddedSignupMock.mockResolvedValueOnce({
      code: 'auth-code',
      session: { wabaId: '880579344939347', phoneNumberId: null, businessId: null },
    });

    const { WhatsappSettingsPage } = await import('./WhatsappSettingsPage');
    const { whatsappService } = await import('@/features/whatsapp/whatsappService');
    (whatsappService.completeEmbeddedSignup as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('NO_PHONE_NUMBER_FOUND'),
    );
    const { notify } = await import('@/lib/notifications');

    render(
      <MemoryRouter initialEntries={['/admin/stores/store-1/whatsapp']}>
        <Routes>
          <Route path="/admin/stores/:storeId/whatsapp" element={<WhatsappSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const connectButton = await screen.findByRole<HTMLButtonElement>('button', { name: /conectar whatsapp business/i });
    fireEvent.click(connectButton);

    await waitFor(() => expect(connectButton.disabled).toBe(false));
    expect(notify.error).toHaveBeenCalledWith('La cuenta de WhatsApp Business no tiene ningún número registrado.');
  });
});
