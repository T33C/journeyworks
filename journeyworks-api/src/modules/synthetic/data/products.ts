/**
 * Known Products — HSBC-style UK Retail Banking Product Catalogue
 *
 * Single source of truth for product names used across all synthetic
 * data generators and the RRG glossary. Based on real HSBC UK product
 * shelf to ensure realistic customer communications.
 *
 * Each product has:
 *  - name:     Human-readable name (used in comms content / templates)
 *  - slug:     kebab-case identifier (used in AI classification, ES fields)
 *  - category: Product family for grouping
 *  - aliases:  Short-hand names customers might use in conversation
 */

export interface KnownProduct {
  name: string;
  slug: string;
  category: ProductCategory;
  aliases: string[];
}

export type ProductCategory =
  | 'current-accounts'
  | 'savings'
  | 'mortgages'
  | 'cards'
  | 'loans'
  | 'insurance'
  | 'digital'
  | 'international';

/**
 * The canonical product catalogue.
 * Inspired by HSBC UK's retail product shelf.
 */
export const KNOWN_PRODUCTS: KnownProduct[] = [
  // ── Current Accounts ──────────────────────────────────────────────────────
  {
    name: 'Advance Account',
    slug: 'advance-account',
    category: 'current-accounts',
    aliases: ['advance', 'advance current account'],
  },
  {
    name: 'Premier Account',
    slug: 'premier-account',
    category: 'current-accounts',
    aliases: ['premier', 'premier current account'],
  },
  {
    name: 'Bank Account',
    slug: 'bank-account',
    category: 'current-accounts',
    aliases: ['basic account', 'current account', 'standard account'],
  },
  {
    name: 'Graduate Account',
    slug: 'graduate-account',
    category: 'current-accounts',
    aliases: ['graduate', 'grad account'],
  },
  {
    name: 'Student Account',
    slug: 'student-account',
    category: 'current-accounts',
    aliases: ['student', 'student bank account'],
  },
  {
    name: 'Joint Account',
    slug: 'joint-account',
    category: 'current-accounts',
    aliases: ['joint', 'shared account'],
  },

  // ── Savings ───────────────────────────────────────────────────────────────
  {
    name: 'Online Bonus Saver',
    slug: 'online-bonus-saver',
    category: 'savings',
    aliases: ['bonus saver', 'online saver'],
  },
  {
    name: 'Flexible Saver',
    slug: 'flexible-saver',
    category: 'savings',
    aliases: ['flexible savings', 'easy access saver'],
  },
  {
    name: 'Fixed Rate Saver',
    slug: 'fixed-rate-saver',
    category: 'savings',
    aliases: ['fixed saver', 'fixed rate', 'fixed term'],
  },
  {
    name: 'Regular Saver',
    slug: 'regular-saver',
    category: 'savings',
    aliases: ['regular savings', 'monthly saver'],
  },
  {
    name: 'Cash ISA',
    slug: 'cash-isa',
    category: 'savings',
    aliases: ['ISA', 'individual savings account', 'tax-free saver'],
  },
  {
    name: 'Lifetime ISA',
    slug: 'lifetime-isa',
    category: 'savings',
    aliases: ['LISA', 'lifetime savings'],
  },

  // ── Mortgages ─────────────────────────────────────────────────────────────
  {
    name: 'Fixed Rate Mortgage',
    slug: 'fixed-rate-mortgage',
    category: 'mortgages',
    aliases: ['fixed mortgage', 'fixed rate'],
  },
  {
    name: 'Tracker Mortgage',
    slug: 'tracker-mortgage',
    category: 'mortgages',
    aliases: ['tracker', 'variable rate mortgage'],
  },
  {
    name: 'First Time Buyer Mortgage',
    slug: 'first-time-buyer-mortgage',
    category: 'mortgages',
    aliases: ['first time buyer', 'FTB mortgage'],
  },
  {
    name: 'Buy to Let Mortgage',
    slug: 'buy-to-let-mortgage',
    category: 'mortgages',
    aliases: ['buy to let', 'BTL mortgage', 'rental mortgage'],
  },
  {
    name: 'Green Mortgage',
    slug: 'green-mortgage',
    category: 'mortgages',
    aliases: ['green home mortgage', 'eco mortgage'],
  },
  {
    name: 'Remortgage',
    slug: 'remortgage',
    category: 'mortgages',
    aliases: ['remortgaging', 'mortgage switch'],
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  {
    name: 'Balance Transfer Credit Card',
    slug: 'balance-transfer-card',
    category: 'cards',
    aliases: ['balance transfer', 'BT card'],
  },
  {
    name: 'Purchase Credit Card',
    slug: 'purchase-credit-card',
    category: 'cards',
    aliases: ['purchase card', 'credit card'],
  },
  {
    name: 'Reward Credit Card',
    slug: 'reward-credit-card',
    category: 'cards',
    aliases: ['rewards card', 'cashback card'],
  },
  {
    name: 'Debit Card',
    slug: 'debit-card',
    category: 'cards',
    aliases: ['bank card', 'visa debit'],
  },

  // ── Loans ─────────────────────────────────────────────────────────────────
  {
    name: 'Personal Loan',
    slug: 'personal-loan',
    category: 'loans',
    aliases: ['loan', 'unsecured loan'],
  },
  {
    name: 'Car Finance',
    slug: 'car-finance',
    category: 'loans',
    aliases: ['car loan', 'vehicle finance', 'auto loan'],
  },
  {
    name: 'Overdraft',
    slug: 'overdraft',
    category: 'loans',
    aliases: ['arranged overdraft', 'overdraft facility'],
  },

  // ── Insurance ─────────────────────────────────────────────────────────────
  {
    name: 'Home Insurance',
    slug: 'home-insurance',
    category: 'insurance',
    aliases: ['buildings insurance', 'contents insurance', 'house insurance'],
  },
  {
    name: 'Travel Insurance',
    slug: 'travel-insurance',
    category: 'insurance',
    aliases: ['travel cover', 'holiday insurance'],
  },
  {
    name: 'Life Insurance',
    slug: 'life-insurance',
    category: 'insurance',
    aliases: ['life cover', 'life assurance'],
  },

  // ── Digital ───────────────────────────────────────────────────────────────
  {
    name: 'Mobile Banking App',
    slug: 'mobile-app',
    category: 'digital',
    aliases: ['mobile app', 'banking app', 'phone app'],
  },
  {
    name: 'Online Banking',
    slug: 'online-banking',
    category: 'digital',
    aliases: ['internet banking', 'web banking'],
  },
  {
    name: 'Connected Money',
    slug: 'connected-money',
    category: 'digital',
    aliases: ['money management', 'open banking', 'account aggregator'],
  },

  // ── International ─────────────────────────────────────────────────────────
  {
    name: 'Global Money Account',
    slug: 'global-money-account',
    category: 'international',
    aliases: ['global money', 'multi-currency', 'international account'],
  },
];

// ─── Derived Constants (used by generators) ─────────────────────────────────

/** Human-readable product names for use in communication templates */
export const PRODUCT_NAMES: string[] = KNOWN_PRODUCTS.map((p) => p.name);

/** Kebab-case slugs for use in AI classification and ES fields */
export const PRODUCT_SLUGS: string[] = KNOWN_PRODUCTS.map((p) => p.slug);

/**
 * All known terms for a product: name + aliases.
 * Used by entity extraction to detect product mentions in free text.
 */
export const ALL_PRODUCT_TERMS: string[] = KNOWN_PRODUCTS.flatMap((p) => [
  p.name.toLowerCase(),
  ...p.aliases.map((a) => a.toLowerCase()),
]);

/** Product names grouped by category */
export const PRODUCTS_BY_CATEGORY: Record<ProductCategory, KnownProduct[]> =
  KNOWN_PRODUCTS.reduce(
    (acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    },
    {} as Record<ProductCategory, KnownProduct[]>,
  );

/**
 * Lookup a KnownProduct by slug.
 */
export function findProductBySlug(slug: string): KnownProduct | undefined {
  return KNOWN_PRODUCTS.find((p) => p.slug === slug);
}

/**
 * Lookup a KnownProduct by any alias or name (case-insensitive).
 */
export function findProductByTerm(term: string): KnownProduct | undefined {
  const lower = term.toLowerCase();
  return KNOWN_PRODUCTS.find(
    (p) =>
      p.name.toLowerCase() === lower ||
      p.slug === lower ||
      p.aliases.some((a) => a.toLowerCase() === lower),
  );
}
