import { describe, expect, it } from 'vitest';
import { resolveSingleWhatsappWaba } from './whatsappTokenTargets';

describe('resolveSingleWhatsappWaba', () => {
  it('resolves one management target and deduplicates repeated target IDs', () => {
    expect(resolveSingleWhatsappWaba({
      app_id: 123,
      is_valid: true,
      granular_scopes: [
        { scope: 'whatsapp_business_management', target_ids: ['waba-1', 'waba-1'] },
        { scope: 'whatsapp_business_messaging', target_ids: ['other-value'] },
      ],
    }, '123')).toEqual({ ok: true, wabaId: 'waba-1' });
  });

  it('uses the messaging target when Meta omits management targets', () => {
    expect(resolveSingleWhatsappWaba({
      app_id: '123',
      is_valid: true,
      granular_scopes: [
        { scope: 'whatsapp_business_messaging', target_ids: ['waba-2'] },
      ],
    }, '123')).toEqual({ ok: true, wabaId: 'waba-2' });
  });

  it('rejects a token issued for another app', () => {
    expect(resolveSingleWhatsappWaba({
      app_id: 'different-app',
      is_valid: true,
      granular_scopes: [
        { scope: 'whatsapp_business_management', target_ids: ['waba-1'] },
      ],
    }, '123')).toEqual({ ok: false, reason: 'invalid_token', candidateCount: 0 });
  });

  it('fails closed when no WhatsApp target is present', () => {
    expect(resolveSingleWhatsappWaba({
      app_id: '123',
      is_valid: true,
      granular_scopes: [],
    }, '123')).toEqual({ ok: false, reason: 'missing_targets', candidateCount: 0 });
  });

  it('fails closed when more than one WABA is authorized', () => {
    expect(resolveSingleWhatsappWaba({
      app_id: '123',
      is_valid: true,
      granular_scopes: [
        { scope: 'whatsapp_business_management', target_ids: ['waba-1', 'waba-2'] },
      ],
    }, '123')).toEqual({ ok: false, reason: 'multiple_targets', candidateCount: 2 });
  });
});
