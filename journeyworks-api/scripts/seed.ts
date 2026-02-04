/**
 * Seed Script
 *
 * Seeds the database with synthetic retail banking data for PoC demos.
 *
 * Usage:
 *   npm run seed          # Medium dataset (50 customers, ~500 communications)
 *   npm run seed:small    # Small dataset (10 customers, ~50 communications)
 *   npm run seed:large    # Large dataset (100 customers, ~2000 communications)
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3080/api';

type DatasetSize = 'small' | 'medium' | 'large';

async function seed(size: DatasetSize = 'medium'): Promise<void> {
  console.log('🌱 JourneyWorks Data Seeding');
  console.log('============================\n');
  console.log(`📊 Dataset size: ${size}`);
  console.log(`🔗 API URL: ${API_BASE_URL}\n`);

  try {
    // Check if API is running
    console.log('⏳ Checking API availability...');
    try {
      await axios.get(`${API_BASE_URL}`, { timeout: 5000 });
      console.log('✅ API is running\n');
    } catch {
      console.error('❌ API is not running!');
      console.error(`   Please start the API first: npm run start:dev\n`);
      process.exit(1);
    }

    // Seed the database
    console.log('⏳ Seeding database with synthetic data...');
    const startTime = Date.now();

    const response = await axios.post<{
      success: boolean;
      result: {
        customers: number;
        communications: number;
        cases?: number;
        socialMentions?: number;
        events?: number;
        surveys?: number;
        chunks?: number;
      };
      message: string;
    }>(`${API_BASE_URL}/synthetic/seed?size=${size}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (response.data.success) {
      const { result } = response.data;
      console.log('\n✅ Seeding completed successfully!\n');
      console.log('📈 Data Summary:');
      console.log(`   • Customers:      ${result.customers}`);
      console.log(`   • Communications: ${result.communications}`);
      if (result.cases) {
        console.log(`   • Cases:          ${result.cases}`);
      }
      if (result.socialMentions) {
        console.log(`   • Social Mentions: ${result.socialMentions}`);
      }
      if (result.events) {
        console.log(`   • Events:         ${result.events}`);
      }
      if (result.surveys) {
        console.log(`   • NPS Surveys:    ${result.surveys}`);
      }
      console.log(`\n⏱️  Completed in ${duration}s`);
    } else {
      console.error('❌ Seeding failed:', response.data);
      process.exit(1);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        '❌ Seeding failed:',
        error.response?.data || error.message,
      );
    } else {
      console.error('❌ Seeding failed:', error);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const size = (process.argv[2] as DatasetSize) || 'medium';
const validSizes: DatasetSize[] = ['small', 'medium', 'large'];

if (!validSizes.includes(size)) {
  console.error(`❌ Invalid size: ${size}`);
  console.error(`   Valid sizes: ${validSizes.join(', ')}`);
  process.exit(1);
}

seed(size);
