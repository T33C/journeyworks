/**
 * Customer Generator
 *
 * Generates synthetic customer data for retail banking context.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SyntheticCustomer } from '../synthetic-data.types';

// Retail banking customer data - UK-focused individual customers
const FIRST_NAMES = [
  'James',
  'Emma',
  'Robert',
  'Sarah',
  'David',
  'Lisa',
  'Michael',
  'Rachel',
  'Thomas',
  'Sophie',
  'William',
  'Charlotte',
  'Oliver',
  'Emily',
  'Harry',
  'Jessica',
  'Jack',
  'Hannah',
  'George',
  'Amy',
  'Daniel',
  'Lauren',
  'Matthew',
  'Rebecca',
  'Christopher',
  'Victoria',
  'Andrew',
  'Natalie',
  'Joseph',
  'Samantha',
  'Benjamin',
  'Catherine',
  'Samuel',
  'Jennifer',
  'Ryan',
  'Megan',
  'Nathan',
  'Holly',
  'Alex',
  'Chloe',
  'Priya',
  'Raj',
  'Wei',
  'Chen',
  'Fatima',
  'Mohammed',
  'Yuki',
  'Kenji',
];

const LAST_NAMES = [
  'Morrison',
  'Richardson',
  'Williams',
  'Thompson',
  'Chen',
  'Patel',
  "O'Brien",
  'Green',
  'Wilson',
  'Brown',
  'Taylor',
  'Davies',
  'Evans',
  'Thomas',
  'Roberts',
  'Johnson',
  'Walker',
  'Wright',
  'Robinson',
  'Hall',
  'Clarke',
  'Jackson',
  'White',
  'Harris',
  'Martin',
  'Lewis',
  'Young',
  'King',
  'Turner',
  'Hill',
  'Moore',
  'Baker',
  'Collins',
  'Hughes',
  'Kelly',
  'Shah',
  'Khan',
  'Singh',
  'Lee',
  'Tanaka',
];

// Retail banking account managers
const ACCOUNT_MANAGERS = [
  'Sarah Johnson',
  'David Thompson',
  'Emma Roberts',
  'James Wilson',
  'Sophie Turner',
  'Michael Chen',
  'Victoria Hughes',
  'Christopher Lee',
  'Rachel Green',
  'Daniel Martinez',
];

// Retail account types
const ACCOUNT_TYPES = [
  'Current Account',
  'Everyday Saver',
  'Premium Current',
  'Student Account',
  'Graduate Account',
  'Joint Account',
  'Basic Account',
];

// UK regions/cities
const REGIONS = [
  'London',
  'Manchester',
  'Birmingham',
  'Leeds',
  'Glasgow',
  'Liverpool',
  'Bristol',
  'Sheffield',
  'Edinburgh',
  'Cardiff',
  'Newcastle',
  'Brighton',
  'Nottingham',
  'Southampton',
  'Oxford',
  'Cambridge',
  'Reading',
  'Milton Keynes',
];

@Injectable()
export class CustomerGenerator {
  private usedEmails = new Set<string>();

  /**
   * Generate a single retail customer
   */
  generate(): SyntheticCustomer {
    const firstName = this.randomChoice(FIRST_NAMES);
    const lastName = this.randomChoice(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const email = this.generateEmail(firstName, lastName);
    
    // Retail banking tiers
    const tierChoice = this.weightedChoice([
      ['premium', 0.15],
      ['standard', 0.60],
      ['basic', 0.20],
      ['student', 0.05],
    ]);

    // Balance ranges for retail
    const balanceRanges: Record<string, [number, number]> = {
      premium: [25000, 150000],
      standard: [2000, 30000],
      basic: [100, 3000],
      student: [50, 2000],
    };

    // Map to type system
    const tierMapping: Record<string, 'platinum' | 'gold' | 'silver' | 'bronze'> = {
      premium: 'platinum',
      standard: 'silver',
      basic: 'bronze',
      student: 'bronze',
    };
    const mappedTier = tierMapping[tierChoice] || 'silver';

    const [minBalance, maxBalance] = balanceRanges[tierChoice] || [1000, 10000];
    const portfolioValue = Math.floor(
      Math.random() * (maxBalance - minBalance) + minBalance,
    );

    const joinedDate = this.randomDate(
      new Date('2010-01-01'),
      new Date('2024-06-01'),
    );

    const lastContactDate = this.randomDate(new Date('2025-01-01'), new Date());

    return {
      id: `CUST-${this.generateCustomerId()}`,
      name,
      email,
      phone: this.generateUKPhone(),
      company: '',
      tier: mappedTier,
      relationshipManager: this.randomChoice(ACCOUNT_MANAGERS),
      accountType: this.randomChoice(ACCOUNT_TYPES),
      portfolioValue,
      riskProfile: this.weightedChoice([
        ['conservative', 0.5],
        ['moderate', 0.4],
        ['aggressive', 0.1],
      ]) as 'conservative' | 'moderate' | 'aggressive',
      region: this.randomChoice(REGIONS),
      joinedDate: joinedDate.toISOString(),
      lastContactDate: lastContactDate.toISOString(),
      communicationPreference: this.weightedChoice([
        ['email', 0.4],
        ['phone', 0.3],
        ['both', 0.3],
      ]) as 'email' | 'phone' | 'both',
    };
  }

  generateMany(count: number): SyntheticCustomer[] {
    const customers: SyntheticCustomer[] = [];
    for (let i = 0; i < count; i++) {
      customers.push(this.generate());
    }
    return customers;
  }

  private generateCustomerId(): string {
    return String(10000 + Math.floor(Math.random() * 90000));
  }

  private generateEmail(firstName: string, lastName: string): string {
    const domains = [
      'gmail.com',
      'yahoo.co.uk',
      'outlook.com',
      'hotmail.co.uk',
      'btinternet.com',
      'icloud.com',
      'sky.com',
    ];

    let email: string;
    let attempts = 0;

    do {
      const domain = this.randomChoice(domains);
      const separator = this.randomChoice(['.', '_', '']);
      const suffix = attempts > 0 ? Math.floor(Math.random() * 999) : '';
      const cleanLastName = lastName.replace(/'/g, '');
      email = `${firstName.toLowerCase()}${separator}${cleanLastName.toLowerCase()}${suffix}@${domain}`;
      attempts++;
    } while (this.usedEmails.has(email) && attempts < 10);

    this.usedEmails.add(email);
    return email;
  }

  private generateUKPhone(): string {
    const formats = ['+44 7### ### ###', '+44 7### ######', '07### ######'];
    let phone = this.randomChoice(formats);
    while (phone.includes('#')) {
      phone = phone.replace('#', String(Math.floor(Math.random() * 10)));
    }
    return phone;
  }

  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private weightedChoice(options: Array<[string, number]>): string {
    const random = Math.random();
    let cumulative = 0;
    for (const [value, weight] of options) {
      cumulative += weight;
      if (random < cumulative) {
        return value;
      }
    }
    return options[options.length - 1][0];
  }

  private randomDate(start: Date, end: Date): Date {
    const diff = end.getTime() - start.getTime();
    return new Date(start.getTime() + Math.random() * diff);
  }
}
