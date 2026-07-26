import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const launchWhatsAppEmbeddedSignupMock = vi.fn();

vi.mock('@/lib/whatsapp/embeddedSignup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/whatsapp/embeddedSignup')>();
  return {
    ...actual, // keeps the real EmbeddedSignupError class
    launchWhatsAppEmbeddedSignup: launchWhatsAppEmbeddedSignupMock,
  };
});

vi.mock('@/lib/storefront/storefrontDomainContext', () => ({
  useStorefrontDomain: () => ({ mode: 'platform' }),
  isStorefrontHostnameMode: () => false,
}));

vi.mock('@/features/whatsapp/whatsappService', () => ({
  whatsappService: {
    getSettings: vi.fn().mockResolvedValue(null),
    getConnection: vi.fn().mockResolvedValue(null),
    subscribeToConnection: vi.fn(() => () => undefined),
    getRecentNotifications: vi.fn().mockResolvedValue([]),
    completeEmbeddedSignup: vi.fn(),
    upsertSettings: vi.fn(),
    syncTemplate: vi.fn(),
    registerPhone: vi.fn(),
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
  it('always leaves the loading state when launchWhatsAppEmbeddedSignup rejects, and shows the correlation id', async () => {
    const { EmbeddedSignupError } = await import('@/lib/whatsapp/embeddedSignup');
    launchWhatsAppEmbeddedSignupMock.mockRejectedValueOnce(
      new EmbeddedSignupError('EMBEDDED_SIGNUP_POPUP_CLOSED', 'corr-abc123'),
    );

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
      'La ventana de Meta se cerró antes de terminar. Intenta de nuevo sin cerrarla manualmente. (Referencia: corr-abc123)',
    );
  });

  it('POSTs the OAuth code to the Edge Function when Meta omits all browser session info', async () => {
    launchWhatsAppEmbeddedSignupMock.mockResolvedValueOnce({
      code: 'auth-code-without-session',
      session: { wabaId: null, phoneNumberId: null, businessId: null },
    });

    const { WhatsappSettingsPage } = await import('./WhatsappSettingsPage');
    const { whatsappService } = await import('@/features/whatsapp/whatsappService');
    (whatsappService.completeEmbeddedSignup as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      connectionStatus: 'connected',
      registrationStatus: 'registered',
      displayPhoneNumber: '+57 321 3706466',
      verifiedName: 'MelosoftApp',
      onboardingType: 'coexistence',
    });
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

    await waitFor(() => expect(whatsappService.completeEmbeddedSignup).toHaveBeenCalledWith({
      storeId: 'store-1',
      code: 'auth-code-without-session',
      wabaId: null,
      phoneNumberId: null,
      businessId: null,
      coexistence: false,
    }));
    await waitFor(() => expect(connectButton.disabled).toBe(false));
    expect(notify.success).toHaveBeenCalledWith('WhatsApp Business conectado y listo para enviar');
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

  // When session has code + wabaId (even without phoneNumberId
  // — the FINISH_ONLY_WABA case), the POST to whatsapp-embedded-signup
  // must actually happen. completeEmbeddedSignup is the only thing in
  // this codebase that calls supabase.functions.invoke('whatsapp-embedded-signup', ...) —
  // asserting it was called with the right payload is the unit-level
  // equivalent of confirming the Network request fires.
  it('POSTs to whatsapp-embedded-signup with wabaId even without phoneNumberId', async () => {
    launchWhatsAppEmbeddedSignupMock.mockResolvedValueOnce({
      code: 'auth-code-only-waba',
      session: { wabaId: '880579344939347', phoneNumberId: null, businessId: 'biz-1' },
    });

    const { WhatsappSettingsPage } = await import('./WhatsappSettingsPage');
    const { whatsappService } = await import('@/features/whatsapp/whatsappService');
    (whatsappService.completeEmbeddedSignup as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      connectionStatus: 'connected',
      registrationStatus: 'registered',
      displayPhoneNumber: '+57 321 3706466',
      verifiedName: 'MelosoftApp',
      onboardingType: 'new_number',
    });
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

    await waitFor(() => expect(whatsappService.completeEmbeddedSignup).toHaveBeenCalledWith({
      storeId: 'store-1',
      code: 'auth-code-only-waba',
      wabaId: '880579344939347',
      phoneNumberId: null,
      businessId: 'biz-1',
      coexistence: false,
    }));
    await waitFor(() => expect(connectButton.disabled).toBe(false));
    expect(notify.success).toHaveBeenCalledWith('WhatsApp Business conectado y listo para enviar');
  });
});

describe('WhatsappSettingsPage — configuración de envíos', () => {
  it('allows the owner to explicitly activate automatic notifications', async () => {
    const currentSettings = {
      id: 'settings-1',
      storeId: 'store-1',
      enabled: false,
      senderMode: 'dedicated' as const,
      customerOrderConfirmationEnabled: true,
      orderConfirmedEnabled: false,
      paymentApprovedEnabled: false,
      paymentDeclinedEnabled: false,
      orderPreparingEnabled: false,
      orderReadyForPickupEnabled: false,
      orderShippedEnabled: false,
      orderDeliveredEnabled: false,
      orderCancelledEnabled: false,
      locale: 'es_CO',
      timezone: 'America/Bogota',
      finalMessage: null,
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
    };
    const { whatsappService } = await import('@/features/whatsapp/whatsappService');
    (whatsappService.getSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce(currentSettings);
    (whatsappService.upsertSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...currentSettings,
      enabled: true,
    });

    const { WhatsappSettingsPage } = await import('./WhatsappSettingsPage');

    render(
      <MemoryRouter initialEntries={['/admin/stores/store-1/whatsapp']}>
        <Routes>
          <Route path="/admin/stores/:storeId/whatsapp" element={<WhatsappSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const enabledCheckbox = await screen.findByRole<HTMLInputElement>('checkbox', {
      name: /activar notificaciones automáticas/i,
    });
    expect(enabledCheckbox.checked).toBe(false);

    fireEvent.click(enabledCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /guardar configuración/i }));

    await waitFor(() => expect(whatsappService.upsertSettings).toHaveBeenCalledWith({
      storeId: 'store-1',
      enabled: true,
      senderMode: 'dedicated',
      customerOrderConfirmationEnabled: true,
      orderConfirmedEnabled: false,
      paymentApprovedEnabled: false,
      paymentDeclinedEnabled: false,
      orderPreparingEnabled: false,
      orderReadyForPickupEnabled: false,
      orderShippedEnabled: false,
      orderDeliveredEnabled: false,
      orderCancelledEnabled: false,
      locale: 'es_CO',
      timezone: 'America/Bogota',
      finalMessage: null,
    }));
  });
});

describe('WhatsappSettingsPage — estado de plantilla', () => {
  it('recovers an already-approved template that was still stored as pending', async () => {
    const pendingConnection = {
      id: 'connection-1',
      storeId: 'store-1',
      metaBusinessId: 'business-1',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
      displayPhoneNumber: '+57 321 3706466',
      verifiedName: 'MelosoftApp',
      connectionStatus: 'connected' as const,
      onboardingType: 'new_number' as const,
      coexistenceEnabled: false,
      templateName: 'melosoft_order_confirmation_v1',
      templateLanguage: 'es_CO',
      templateStatus: 'pending' as const,
      templateRejectedReason: null,
      registrationStatus: 'registered' as const,
      registeredAt: '2026-07-25T00:00:00.000Z',
      registrationLastErrorCode: null,
      registrationLastErrorMessage: null,
      connectedAt: '2026-07-25T00:00:00.000Z',
      lastVerifiedAt: '2026-07-25T00:00:00.000Z',
      disconnectedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T00:00:00.000Z',
    };
    const { whatsappService } = await import('@/features/whatsapp/whatsappService');
    const getConnection = whatsappService.getConnection as ReturnType<typeof vi.fn>;
    const syncTemplate = whatsappService.syncTemplate as ReturnType<typeof vi.fn>;
    getConnection.mockReset()
      .mockResolvedValueOnce(pendingConnection)
      .mockResolvedValueOnce({ ...pendingConnection, templateStatus: 'approved' });
    syncTemplate.mockResolvedValueOnce({
      ok: true,
      orderConfirmationTemplate: {
        name: 'melosoft_order_confirmation_v1',
        status: 'approved',
        rejectedReason: null,
      },
      testTemplate: { name: 'melosoft_whatsapp_test_v1', status: 'approved' },
    });

    const { WhatsappSettingsPage } = await import('./WhatsappSettingsPage');
    render(
      <MemoryRouter initialEntries={['/admin/stores/store-1/whatsapp']}>
        <Routes>
          <Route path="/admin/stores/:storeId/whatsapp" element={<WhatsappSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Aprobada')).toBeTruthy();
    expect(syncTemplate).toHaveBeenCalledWith('store-1');
  });
});

describe('WhatsappSettingsPage — recuperación de coexistencia', () => {
  it('does not retry a failed coexistence connection in the background', async () => {
    const failedConnection = {
      id: 'connection-coexistence',
      storeId: 'store-1',
      metaBusinessId: 'business-1',
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
      displayPhoneNumber: '+57 314 6014269',
      verifiedName: 'Melosoft',
      connectionStatus: 'connected' as const,
      onboardingType: 'coexistence' as const,
      coexistenceEnabled: true,
      templateName: 'melosoft_order_confirmation_v1',
      templateLanguage: 'es_CO',
      templateStatus: 'approved' as const,
      templateRejectedReason: null,
      registrationStatus: 'failed' as const,
      registeredAt: null,
      registrationLastErrorCode: 'COEXISTENCE_ONBOARDING_INCOMPLETE',
      registrationLastErrorMessage: 'Meta no confirmó la coexistencia.',
      connectedAt: '2026-07-25T00:00:00.000Z',
      lastVerifiedAt: '2026-07-25T00:00:00.000Z',
      disconnectedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T00:00:00.000Z',
    };
    const { whatsappService } = await import('@/features/whatsapp/whatsappService');
    const getConnection = whatsappService.getConnection as ReturnType<typeof vi.fn>;
    const registerPhone = whatsappService.registerPhone as ReturnType<typeof vi.fn>;
    getConnection.mockReset().mockResolvedValue(failedConnection);
    registerPhone.mockReset();

    const { WhatsappSettingsPage } = await import('./WhatsappSettingsPage');
    render(
      <MemoryRouter initialEntries={['/admin/stores/store-1/whatsapp']}>
        <Routes>
          <Route path="/admin/stores/:storeId/whatsapp" element={<WhatsappSettingsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /reintentar conexión/i })).toBeTruthy();
    await waitFor(() => expect(getConnection).toHaveBeenCalled());
    expect(registerPhone).not.toHaveBeenCalled();
  });
});
