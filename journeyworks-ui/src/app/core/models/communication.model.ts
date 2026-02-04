export interface Communication {
  id: string;
  customerId: string;
  customerName: string;
  channel: CommunicationChannel;
  direction: 'inbound' | 'outbound';
  subject?: string;
  content: string;
  timestamp: string;
  status: CommunicationStatus;
  priority: Priority;
  sentiment?: SentimentAnalysis;
  topics?: string[];
  caseId?: string;
  assignedTo?: string;
  metadata?: Record<string, unknown>;

  // AI Classification fields
  aiClassification?: AIClassification;
  messages?: CommunicationMessage[];
  threadId?: string;
}

export interface AIClassification {
  category: CategoryType;
  confidence: number;
  product: ProductType;
  issueType: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  rootCause: string;
  suggestedAction: string;
  regulatoryFlags: string[];
}

export interface CommunicationMessage {
  id: string;
  timestamp: string;
  sender: 'customer' | 'agent' | 'system';
  channel: CommunicationChannel;
  content: string;
  sentiment?: number;
}

export type ProductType =
  | 'credit-card'
  | 'current-account'
  | 'savings-account'
  | 'mortgage'
  | 'personal-loan'
  | 'mobile-app'
  | 'online-banking'
  | 'insurance';

export type CategoryType =
  | 'fraud'
  | 'service-quality'
  | 'fees-charges'
  | 'technical-issue'
  | 'account-access'
  | 'payment-issue'
  | 'communication'
  | 'product-feature';

export type CommunicationChannel =
  | 'email'
  | 'phone'
  | 'chat'
  | 'social'
  | 'portal';
export type CommunicationStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'escalated';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface SentimentAnalysis {
  score: number;
  label: 'positive' | 'neutral' | 'negative' | 'mixed';
  confidence: number;
}

export interface CommunicationSearchParams {
  query?: string;
  channel?: CommunicationChannel;
  status?: CommunicationStatus;
  priority?: Priority;
  sentiment?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company?: string;
  tier: 'standard' | 'premium' | 'enterprise';
  accountManager?: string;
  healthScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  totalCommunications: number;
  openCases: number;
  lastContactDate?: string;
}
