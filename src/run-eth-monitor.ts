/**
 * Скрипт для запуска мониторинга транзакций только в сети ETH
 */
import dotenv from 'dotenv';
import { TransactionMonitor } from './scheduler';
import { apiLogger } from './utils/logger';

dotenv.config();

// Получаем настройки из переменных окружения
const useGoogleSheets = process.env.GOOGLE_SHEETS_ENABLED === 'true';
const intervalHours = parseInt(process.env.DEFAULT_TIME_INTERVAL || '1');

// Запускаем мониторинг
const runEthMonitor = async () => {
  apiLogger.info('Starting ETH transaction monitoring service');
  
  try {
    // Создаем монитор со стратегией ETH
    const monitor = new TransactionMonitor(intervalHours, useGoogleSheets, 'ETH');
    
    // Запускаем мониторинг
    await monitor.start();
    
    apiLogger.info('ETH monitoring service started successfully');
    
    // Обработчики для корректного завершения
    process.on('SIGINT', async () => {
      apiLogger.info('Process received SIGINT, stopping monitor...');
      await monitor.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      apiLogger.info('Process received SIGTERM, stopping monitor...');
      await monitor.stop();
      process.exit(0);
    });
  } catch (error) {
    apiLogger.error(`Failed to start ETH monitoring service: ${(error as Error).message}`);
    process.exit(1);
  }
};

// Запускаем скрипт
runEthMonitor().catch(error => {
  apiLogger.error(`Unexpected error in runEthMonitor: ${error.message}`);
  process.exit(1);
});
