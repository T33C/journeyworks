/**
 * Synthetic Data Types
 *
 * These types are internal to the synthetic module and use inline
 * literals to avoid conflicts with DTO exports.
 */

export interface SyntheticCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  relationshipManager: string;
  accountType: string;
  portfolioValue: number;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  region: string;
  joinedDate: string;
  lastContactDate: string;
  communicationPreference: 'email' | 'phone' | 'both';
}

// Inline type literals to avoid export conflicts with DTOs
type SyntheticCommunicationStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'escalated';
type SyntheticPriority = 'low' | 'medium' | 'high' | 'urgent';
type SyntheticProductType =
  | 'credit-card'
  | 'current-account'
  | 'savings-account'
  | 'mortgage'
  | 'personal-loan'
  | 'mobile-app'
  | 'online-banking'
  | 'insurance';
type SyntheticCategoryType =
  | 'account-opening'
  | 'call-handling'
  | 'cdd-remediation'
  | 'fees-charges'
  | 'payment-processing';

export interface SyntheticAIClassification {
  category: SyntheticCategoryType;
  confidence: number;
  product: SyntheticProductType;
  issueType: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  rootCause: string;
  suggestedAction: string;
  regulatoryFlags: string[];
}

export interface SyntheticCommunicationMessage {
  id: string;
  timestamp: string;
  sender: 'customer' | 'agent' | 'system';
  channel: 'email' | 'phone' | 'chat' | 'letter' | 'social';
  content: string;
  sentiment?: number;
}

export interface SyntheticCommunication {
  id: string;
  channel: 'email' | 'phone' | 'chat' | 'letter' | 'social';
  chatMode?: 'chatbot' | 'human-agent'; // For chat channel: distinguishes bot vs human
  escalatedFrom?: 'chatbot' | 'email' | 'chat'; // Tracks if this is an escalation
  direction: 'inbound' | 'outbound';
  customerId: string;
  customerName: string;
  caseId?: string;
  subject?: string;
  content: string;
  summary?: string;
  timestamp: string;
  status: SyntheticCommunicationStatus;
  priority: SyntheticPriority;
  sentiment: {
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    confidence: number;
    emotionalTones: string[];
  };
  intent: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  tags: string[];
  metadata: {
    duration?: number; // For phone calls
    agentId?: string;
    resolved?: boolean;
  };
  // AI-enhanced fields
  aiClassification?: SyntheticAIClassification;
  messages?: SyntheticCommunicationMessage[];
  threadId?: string;
  relatedEventId?: string;
}

export interface SyntheticCase {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  product: string; // Product derived from linked communications
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  slaDeadline: string;
  slaBreached: boolean;
  communicationIds: string[];
  tags: string[];
  resolution?: string;
}

export interface SyntheticSocialMention {
  id: string;
  platform: 'twitter' | 'linkedin' | 'reddit' | 'trustpilot';
  author: string;
  authorHandle: string;
  content: string;
  timestamp: string;
  sentiment: {
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    confidence: number;
  };
  engagement: {
    likes: number;
    shares: number;
    comments: number;
  };
  url: string;
  mentionedProducts: string[];
  tags: string[];
  requiresResponse: boolean;
  responded: boolean;
  linkedCustomerId?: string;
}

export interface GenerationConfig {
  customerCount: number;
  communicationsPerCustomer: { min: number; max: number };
  casesPercentage: number; // Percentage of customers with cases
  casesPerCustomer: { min: number; max: number };
  socialMentionsCount: number;
  eventsCount: number; // Number of timeline events to generate
  dateRange: {
    start: string;
    end: string;
  };
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  channelDistribution: {
    email: number;
    phone: number;
    chat: number;
    letter: number;
    social: number;
  };
}

export interface GenerationResult {
  customers: number;
  communications: number;
  cases: number;
  surveys: number;
  socialMentions: number;
  events: number;
  chunks: number;
  duration: number;
}

export interface SyntheticEvent {
  id: string;
  type: 'outage' | 'launch' | 'policy_change' | 'incident' | 'promotion';
  label: string;
  description: string;
  startDate: string;
  endDate?: string;
  product?: string;
  channels?: string[];
  affectedRegions?: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact?: {
    customersAffected?: number;
    communicationIncrease?: number;
    sentimentImpact?: number;
  };
  status: 'planned' | 'active' | 'resolved' | 'cancelled';
  correlatedCommunications?: number;
  sentimentDuringEvent?: number;
  source: 'manual' | 'automated' | 'external';
  createdAt: string;
  updatedAt: string;
}

export interface SyntheticChunk {
  chunkId: string;
  communicationId: string;
  content: string;
  context?: string;
  position: number;
  chunkType: 'paragraph' | 'sentence' | 'section';
  tokenCount: number;
  overlap?: number;
  denseEmbedding?: number[];
  sparseEmbedding?: Record<string, number>;
  metadata: {
    channel?: string;
    timestamp?: string;
    customerId?: string;
    product?: string;
    category?: string;
    sentiment?: number;
    npsScore?: number;
  };
  createdAt: string;
}
