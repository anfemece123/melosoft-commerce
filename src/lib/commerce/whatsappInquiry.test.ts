import { describe, expect, it } from 'vitest';
import { buildProductInquiryMessage, buildProductInquiryUrl } from './whatsappInquiry';

describe('buildProductInquiryMessage', () => {
  it('greets the store and asks for price, availability and presentations', () => {
    const message = buildProductInquiryMessage({
      storeName: 'Velaire',
      productName: 'Dolce & Gabbana Light Blue',
      productUrl: 'https://velaire.melosoftapp.com/p/dolce-gabbana-light-blue',
    });

    expect(message).toContain('¡Hola, Velaire! 👋');
    expect(message).toContain('*Dolce & Gabbana Light Blue*');
    expect(message).toContain('precio, la disponibilidad y las presentaciones');
    expect(message).toContain('Lo vi aquí: https://velaire.melosoftapp.com/p/dolce-gabbana-light-blue');
  });

  it('includes the selected variant and omits empty parts', () => {
    const message = buildProductInquiryMessage({
      storeName: '  ',
      productName: 'Light Blue',
      variantLabel: 'Tamaño: 100 ml',
    });

    expect(message.startsWith('¡Hola! 👋')).toBe(true);
    expect(message).toContain('Tamaño: 100 ml');
    expect(message).not.toContain('Lo vi aquí');
  });
});

describe('buildProductInquiryUrl', () => {
  it('builds an encoded wa.me link for a Colombian number', () => {
    const url = buildProductInquiryUrl('3185839777', { storeName: 'Velaire', productName: 'Light Blue' });
    expect(url?.startsWith('https://wa.me/573185839777?text=')).toBe(true);
    expect(url).toContain(encodeURIComponent('*Light Blue*'));
  });

  it('returns null without a valid store number', () => {
    expect(buildProductInquiryUrl(null, { storeName: 'Velaire', productName: 'Light Blue' })).toBeNull();
  });
});
