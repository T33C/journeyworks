import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import axios from 'axios';

const logger = new Logger('Bootstrap');

async function seedDemoData(port: number | string): Promise<void> {
  const apiUrl = `http://localhost:${port}/api/synthetic/seed?size=medium`;
  logger.log('🌱 DEMO_MODE: Seeding database with demo data...');

  try {
    const response = await axios.post(apiUrl, {}, { timeout: 60000 });
    if (response.data?.success) {
      const { customers, communications } = response.data.result;
      logger.log(
        `✅ Demo data seeded: ${customers} customers, ${communications} communications`,
      );
    }
  } catch (error) {
    // Seeding may fail if data already exists or services unavailable - that's OK
    logger.warn(
      '⚠️  Demo seeding skipped (may already have data or services unavailable)',
    );
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:4280'],
    credentials: true,
  });

  // Configure WebSocket adapter for Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global validation pipe
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('JourneyWorks API')
    .setDescription(
      `
## AI-Powered Customer Communications Analysis Platform

JourneyWorks provides intelligent analysis of customer communications across multiple channels, 
with AI-driven insights and research capabilities.

### Key Features:
- **Communications**: CRUD operations, search, and sentiment analysis
- **Customers**: Customer management with portfolio tracking
- **Analysis**: Dashboard APIs for timeline, sentiment bubbles, journey stages, and priority quadrants
- **Research**: AI-powered research agent with context-aware insights
- **Synthetic Data**: Generate demo data for testing and demos

### Authentication
Currently open for PoC. Production will use OAuth 2.0 / JWT.
    `,
    )
    .setVersion('1.0.0')
    .addTag('communications', 'Customer communication operations')
    .addTag('customers', 'Customer management')
    .addTag('analysis', 'Dashboard and analytics APIs')
    .addTag('research', 'AI research agent')
    .addTag('synthetic-data', 'Synthetic data generation')
    .addTag('rag', 'Retrieval-Augmented Generation')
    .addTag('rrg', 'Research-Retrieval-Generation')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'JourneyWorks API Documentation',
  });

  const port = process.env.PORT ?? 3080;
  await app.listen(port);

  const demoMode = process.env.DEMO_MODE === 'true';
  const seedOnStartup = process.env.SEED_ON_STARTUP === 'true';

  console.log(`
🚀 JourneyWorks API is running!
   
   API:     http://localhost:${port}/api
   Swagger: http://localhost:${port}/docs
   Mode:    ${demoMode ? '🎭 DEMO' : 'Standard'}
  `);

  // Auto-seed in demo mode if enabled
  if (demoMode && seedOnStartup) {
    // Small delay to ensure app is fully ready
    setTimeout(() => seedDemoData(port), 2000);
  }
}
bootstrap();
