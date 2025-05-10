import './register-paths';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import 'reflect-metadata';
import dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config();

const logger = new Logger('Main');

async function bootstrap() {
  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    process.on('SIGINT', async () => {
      logger.log('Process received SIGINT, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.log('Process received SIGTERM, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    logger.log('Application successfully started');
  } catch (error: any) {
    logger.error(`Error during application startup: ${(error as Error).message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();
