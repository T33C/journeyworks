/**
 * JourneyWorks UI - Shared Constants
 *
 * Centralized constants for dropdowns, filters, and display values.
 * Update these once to affect all components that use them.
 */

// =============================================================================
// COMMUNICATION CHANNELS
// =============================================================================

export const CHANNELS = ['email', 'phone', 'chat', 'social', 'letter'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: 'Email',
  phone: 'Phone',
  chat: 'Chat',
  social: 'Social Media',
  letter: 'Letter',
};

export const CHANNEL_ICONS: Record<Channel, string> = {
  email: 'email',
  phone: 'phone',
  chat: 'chat',
  social: 'public',
  letter: 'mail',
};

// =============================================================================
// COMMUNICATION STATUS
// =============================================================================

export const STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'escalated',
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

// =============================================================================
// PRIORITY LEVELS
// =============================================================================

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

// =============================================================================
// SENTIMENT
// =============================================================================

export const SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  mixed: 'Mixed',
};

// =============================================================================
// URGENCY LEVELS (AI Classification)
// =============================================================================

export const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// =============================================================================
// PRODUCT TYPES
// =============================================================================

export const PRODUCTS = [
  'credit-card',
  'current-account',
  'savings-account',
  'mortgage',
  'personal-loan',
  'mobile-app',
  'online-banking',
  'insurance',
] as const;
export type Product = (typeof PRODUCTS)[number];

export const PRODUCT_LABELS: Record<Product, string> = {
  'credit-card': 'Credit Card',
  'current-account': 'Current Account',
  'savings-account': 'Savings Account',
  mortgage: 'Mortgage',
  'personal-loan': 'Personal Loan',
  'mobile-app': 'Mobile App',
  'online-banking': 'Online Banking',
  insurance: 'Insurance',
};

// =============================================================================
// CATEGORY TYPES
// =============================================================================

export const CATEGORIES = [
  'fraud',
  'service-quality',
  'fees-charges',
  'technical-issue',
  'account-access',
  'payment-issue',
  'communication',
  'product-feature',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  fraud: 'Fraud',
  'service-quality': 'Service Quality',
  'fees-charges': 'Fees & Charges',
  'technical-issue': 'Technical Issue',
  'account-access': 'Account Access',
  'payment-issue': 'Payment Issue',
  communication: 'Communication',
  'product-feature': 'Product Feature',
};

// =============================================================================
// JOURNEY STAGES
// =============================================================================

export const JOURNEY_STAGES = [
  'initial-contact',
  'triage',
  'investigation',
  'resolution',
  'post-resolution',
] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  'initial-contact': 'Initial Contact',
  triage: 'Triage',
  investigation: 'Investigation',
  resolution: 'Resolution',
  'post-resolution': 'Post-Resolution',
};

// =============================================================================
// QUADRANT TYPES
// =============================================================================

export const QUADRANTS = ['critical', 'watch', 'strength', 'noise'] as const;
export type Quadrant = (typeof QUADRANTS)[number];

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  critical: 'Critical',
  watch: 'Watch',
  strength: 'Strength',
  noise: 'Noise',
};

// =============================================================================
// TIME RANGES
// =============================================================================

export const TIME_RANGES = ['7d', '30d', '90d', '1y', 'all'] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  '1y': 'Last Year',
  all: 'All Time',
};

// =============================================================================
// CUSTOMER TIERS
// =============================================================================

export const CUSTOMER_TIERS = ['standard', 'premium', 'enterprise'] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  standard: 'Standard',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

// =============================================================================
// RISK LEVELS
// =============================================================================

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
};
