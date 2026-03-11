export interface SuggestedContact {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  domain: string | null;
  companyName: string | null;
  score: number;
  signals: ContactSignals;
  status: "pending" | "accepted" | "dismissed";
  emailCount: number;
  lastEmailDate: string | null;
}

export interface ContactSignals {
  isBidirectional: boolean;
  emailCount: number;
  threadCount: number;
  hasSignature: boolean;
  domainType: "business" | "personal" | "unknown";
  latestInteraction: string | null;
  hasBulkHeaders: boolean;
  senderNameQuality: "full_name" | "partial" | "automated" | "none";
}

export interface SyncedEmail {
  id: number;
  gmailMessageId: string;
  gmailThreadId: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  fromEmail: string;
  fromName: string | null;
  toAddresses: { email: string; name?: string }[];
  ccAddresses: { email: string; name?: string }[];
  date: string;
  isRead: boolean;
  role?: string;
}

export interface EmailSyncStatus {
  syncStatus: "idle" | "syncing" | "error" | "not_started";
  lastSyncedAt: string | null;
  totalSynced: number;
  pendingSuggestions: number;
  pendingDealSuggestions: number;
  settings: EmailSyncSettings;
}

export interface EmailSyncSettings {
  syncPeriodDays: number;
  enrichWithAi: boolean;
  autoAcceptThreshold: number | null;
  dealCriteriaText?: string | null;
}

export interface SuggestedDeal {
  id: number;
  gmailThreadId: string | null;
  dealName: string | null;
  founderName: string | null;
  founderEmail: string | null;
  companyName: string | null;
  companyDomain: string | null;
  companyCategory: string | null;
  description: string | null;
  score: number;
  signals: DealSignals;
  status: "pending" | "accepted" | "dismissed";
  createdDealId: number | null;
  createdContactId: number | null;
  createdCompanyId: number | null;
  createdAt: string;
}

export interface DealSignals {
  emailCount: number;
  threadCount: number;
  isBidirectional: boolean;
  isIntroEmail: boolean;
  hasFounderSignals: boolean;
  confidence: number;
}

export interface EmailParticipant {
  email: string;
  name: string | null;
  domain: string | null;
  emailCount: number;
  lastEmailDate: string | null;
  isBidirectional: boolean;
  status: "new" | "in_crm" | "suggested" | "dismissed";
  contactId?: number;
  suggestionId?: number;
  score?: number;
}
