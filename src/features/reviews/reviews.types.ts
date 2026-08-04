export type StoreReviewMode = 'disabled' | 'collect_only' | 'public';
export type ReviewPublicationStatus = 'pending' | 'published' | 'hidden' | 'removed';
export type ReviewModerationStatus = 'approved' | 'flagged' | 'rejected';

export interface StoreReviewSettings {
  storeId: string;
  mode: StoreReviewMode;
  autoPublish: boolean;
  showRatingOnCards: boolean;
  showProductReviews: boolean;
  showReviewPhotos: boolean;
  invitationExpiryDays: number;
  invitationMessage: string;
}

export interface ReviewDashboard {
  total: number;
  average: number;
  published: number;
  pending: number;
  hidden: number;
  removed: number;
  withReply: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  bestProducts: ReviewProductInsight[];
  attentionProducts: ReviewProductInsight[];
}

export interface ReviewProductInsight {
  productId: string;
  productName: string;
  average: number;
  count: number;
}

export interface AdminProductReview {
  id: string;
  storeId: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  orderNumber: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  customerDisplayName: string;
  publicationStatus: ReviewPublicationStatus;
  moderationStatus: ReviewModerationStatus;
  ratingIncluded: boolean;
  hiddenReason: string | null;
  reply: string | null;
  replyUpdatedAt: string | null;
  images: ReviewImage[];
  createdAt: string;
}

export interface ReviewImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface AdminReviewsPage {
  items: AdminProductReview[];
  total: number;
}

export interface ReviewInvitationAdmin {
  id: string;
  token: string;
  expiresAt: string;
  submittedAt: string | null;
  mode: StoreReviewMode;
  invitationMessage: string;
}

export type PublicReviewInvitationState = 'ready' | 'invalid' | 'expired' | 'disabled' | 'submitted' | 'unavailable';

export interface PublicReviewInvitationItem {
  orderItemId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  imageUrl: string | null;
}

export interface PublicReviewInvitation {
  state: PublicReviewInvitationState;
  storeId: string | null;
  storeSlug: string | null;
  storeName: string | null;
  logoUrl: string | null;
  customerName: string | null;
  orderNumber: string | null;
  expiresAt: string | null;
  showReviewPhotos: boolean;
  items: PublicReviewInvitationItem[];
}

export interface SubmitProductReviewInput {
  productId: string;
  orderItemId: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
}

export interface SubmittedReviewReference {
  productId: string;
  reviewId: string;
}

export interface PublicReviewConfig {
  mode: StoreReviewMode;
  showRatingOnCards: boolean;
  showProductReviews: boolean;
  showReviewPhotos: boolean;
}

export interface ProductReviewSummary {
  productId: string;
  averageRating: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface PublicProductReview {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  customerDisplayName: string;
  createdAt: string;
  merchantReply: string | null;
  merchantRepliedAt: string | null;
  images: ReviewImage[];
}
