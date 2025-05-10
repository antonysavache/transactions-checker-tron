/**
 * Основная точка входа приложения - NestJS bootstrap
 */
import './register-paths'; // Импортируем поддержку алиасов
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import 'reflect-metadata';
import dotenv from 'dotenv';
import { AppModule } from './app.module';

// Загружаем переменные окружения
dotenv.config();

// NestJS Logger
const logger = new Logger('Main');

/**
 * Bootstrap функция для запуска NestJS приложения
 */
async function bootstrap() {
  try {
    // Создаем NestJS приложение
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Обработчики для корректного завершения
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

    // Логируем успешный запуск
    logger.log('Application successfully started');
  } catch (error: any) {
    logger.error(`Error during application startup: ${(error as Error).message}`, error.stack);
    process.exit(1);
  }
}

// Запускаем приложение
bootstrap();
