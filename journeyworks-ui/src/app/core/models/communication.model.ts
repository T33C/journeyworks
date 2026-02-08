export interface Communication {
  id: string;
  customerId: string;
  customerName: string;
  channel: CommunicationChannel;
  direction: 'inbound' | 'outbound';
  subject?: string;
  content: string;
  summary?: string;
  timestamp: string;
  status: CommunicationStatus;
  priority: Priority;
  sentiment?: SentimentAnalysis;
  intent?: {
    primary: string;
    secondary?: string[];
    confidence: number;
  };
  entities?: Array<{ type: string; value: string; confidence?: number }>;
  tags?: string[];
  caseId?: string;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;

  // AI Classification fields
  aiClassification?: AIClassification;
  messages?: CommunicationMessage[];
  threadId?: string;

  // Search result fields
  score?: number;
  highlights?: Record<string, string[]>;
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
  | 'letter';
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
  emotionalTones?: string[];
}

export interface CommunicationSearchParams {
  query?: string;
  channels?: CommunicationChannel[];
  statuses?: CommunicationStatus[];
  priorities?: Priority[];
  sentiments?: string[];
  direction?: 'inbound' | 'outbound';
  customerId?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  product?: string;
  from?: number;
  size?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  from: number;
  size: number;
  hasMore: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  tier: string;
  accountManager?: string;
  relationshipManager?: string;
  accountType?: string;
  portfolioValue?: number;
  riskProfile?: string;
  healthScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  totalCommunications?: number;
  openCases?: number;
  region?: string;
  joinedDate?: string;
  lastContactDate?: string;
  communicationPreference?: string;
}
