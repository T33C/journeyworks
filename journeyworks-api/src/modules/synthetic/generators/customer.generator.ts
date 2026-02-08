/**
 * Customer Generator
 *
 * Generates synthetic customer data for retail banking context.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SyntheticCustomer } from '../synthetic-data.types';
import {
  randomChoice,
  weightedChoice,
  randomDateUniform,
  randomDate,
} from '../utils/random.util';

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
  private usedIds = new Set<string>();

  /**
   * Generate a single retail customer
   */
  generate(): SyntheticCustomer {
    const firstName = randomChoice(FIRST_NAMES);
    const lastName = randomChoice(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const email = this.generateEmail(firstName, lastName);

    // Retail banking tiers — use canonical tier names directly
    const tier = weightedChoice([
      ['platinum', 0.15],
      ['gold', 0.25],
      ['silver', 0.4],
      ['bronze', 0.2],
    ]) as SyntheticCustomer['tier'];

    // Balance ranges for retail
    const balanceRanges: Record<string, [number, number]> = {
      platinum: [25000, 150000],
      gold: [10000, 50000],
      silver: [2000, 15000],
      bronze: [50, 3000],
    };

    const [minBalance, maxBalance] = balanceRanges[tier] || [1000, 10000];
    const portfolioValue = Math.floor(
      Math.random() * (maxBalance - minBalance) + minBalance,
    );

    const joinedDate = randomDateUniform(
      new Date('2010-01-01'),
      new Date('2024-06-01'),
    );

    // Last contact date: most customers recent, but some dormant (up to 2 years ago)
    const lastContactDate = randomDate(
      new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
      new Date(),
    );

    return {
      id: `CUST-${this.generateCustomerId()}`,
      name,
      email,
      phone: this.generateUKPhone(),
      company: '',
      tier,
      relationshipManager: randomChoice(ACCOUNT_MANAGERS),
      accountType: randomChoice(ACCOUNT_TYPES),
      portfolioValue,
      riskProfile: weightedChoice([
        ['conservative', 0.5],
        ['moderate', 0.4],
        ['aggressive', 0.1],
      ]) as 'conservative' | 'moderate' | 'aggressive',
      region: randomChoice(REGIONS),
      joinedDate: joinedDate.toISOString(),
      lastContactDate: lastContactDate.toISOString(),
      communicationPreference: weightedChoice([
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
    let id: string;
    let attempts = 0;
    do {
      id = String(10000 + Math.floor(Math.random() * 90000));
      attempts++;
    } while (this.usedIds.has(id) && attempts < 10);
    this.usedIds.add(id);
    return id;
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
      const domain = randomChoice(domains);
      const separator = randomChoice(['.', '_', '']);
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
    let phone = randomChoice(formats);
    while (phone.includes('#')) {
      phone = phone.replace('#', String(Math.floor(Math.random() * 10)));
    }
    return phone;
  }
}
