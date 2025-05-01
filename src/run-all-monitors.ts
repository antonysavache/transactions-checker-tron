/**
 * Скрипт для запуска мониторинга транзакций в обеих сетях (TRON и ETH)
 */
import dotenv from 'dotenv';
import { TransactionMonitor } from './scheduler';
import { apiLogger } from './utils/logger';

dotenv.config();

// Получаем настройки из переменных окружения
const useGoogleSheets = process.env.GOOGLE_SHEETS_ENABLED === 'true';
const defaultNetwork = (process.env.DEFAULT_NETWORK as 'TRON' | 'ETH' | 'ALL') || 'ALL';
const intervalHours = parseInt(process.env.DEFAULT_TIME_INTERVAL || '1');

// Запускаем мониторинг
const runAllMonitors = async () => {
  apiLogger.info('Starting both TRON and ETH transaction monitoring services');
  
  try {
    // Создаем монитор со стратегией ALL для мониторинга обеих сетей одновременно
    const monitor = new TransactionMonitor(intervalHours, useGoogleSheets, defaultNetwork);
    
    // Запускаем мониторинг
    await monitor.start();
    
    apiLogger.info('Monitoring services started successfully');
    
    // Обработчики для корректного завершения
    process.on('SIGINT', async () => {
      apiLogger.info('Process received SIGINT, stopping monitors...');
      await monitor.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      apiLogger.info('Process received SIGTERM, stopping monitors...');
      await monitor.stop();
      process.exit(0);
    });
  } catch (error) {
    apiLogger.error(`Failed to start monitoring services: ${(error as Error).message}`);
    process.exit(1);
  }
};

// Запускаем скрипт
runAllMonitors().catch(error => {
  apiLogger.error(`Unexpected error in runAllMonitors: ${error.message}`);
  process.exit(1);
});
