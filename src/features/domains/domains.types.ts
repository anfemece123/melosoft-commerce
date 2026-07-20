export type StoreDomainStatus =
  | 'pending_dns'
  | 'pending_ssl'
  | 'active'
  | 'error'
  | 'disabled';

export interface DomainDnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
}

export interface StoreDomain {
  id: string;
  storeId: string;
  hostname: string;
  status: StoreDomainStatus;
  isPrimary: boolean;
  dnsRecord: DomainDnsRecord;
  dnsTarget: string;
  provider: 'vercel';
  ownershipVerification: DomainDnsRecord | null;
  sslValidationRecords: DomainDnsRecord[];
  failureReason: string | null;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicDomainResolution {
  storeId: string;
  storeSlug: string;
  storeName: string;
  hostname: string;
}

export interface DomainManagementResponse {
  domains?: StoreDomain[];
  domain?: StoreDomain;
}
