import type { AsyncStatus, OfferStatus, CountdownMode } from '@/types/common.types';

export interface OfferImage {
  id: string;
  storeId: string;
  offerId: string;
  ownerId: string;
  imageUrl: string;
  storagePath: string | null;
  altText: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Offer {
  id: string;
  storeId: string;
  ownerId: string;
  productId: string | null;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  regularPrice: number;
  offerPrice: number;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  countdownMode: CountdownMode;
  showCountdown: boolean;
  isVisibleInStore: boolean;
  sortOrder: number;
  status: OfferStatus;
  whatsappNumber: string | null;
  whatsappMessage: string | null;
  ctaLabel: string;
  heroImageUrl: string | null;
  termsAndConditions: string | null;
  images?: OfferImage[];
  createdAt: string;
  updatedAt: string;
}

export type OfferInsert = Omit<Offer, 'id' | 'ownerId' | 'images' | 'createdAt' | 'updatedAt'>;
export type OfferUpdate = Partial<Omit<OfferInsert, 'storeId'>>;

export interface OffersState {
  items: Offer[];
  current: Offer | null;
  status: AsyncStatus;
  error: string | null;
}
