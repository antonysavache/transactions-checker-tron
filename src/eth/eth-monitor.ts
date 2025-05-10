/**
 * Основной модуль для мониторинга ETH транзакций
 */
import dotenv from 'dotenv';
import { IProcessedTransaction, ISourceData } from '@core/types';
import { apiLogger, transactionLogger } from '@core/logger';
import { EthInputAdapter } from '@eth/adapters/eth-input-adapter';
import { EthTransactionService } from '@eth/services/extended-eth-transaction-service';
import { EthOutputAdapter } from '@eth/adapters/eth-output-adapter';

dotenv.config();

// Конфигурация ETH-мониторинга
const ETH_CONFIG = {
  ETH_API_URL: process.env.ETH_API_URL || 'https://api.etherscan.io/api',
  ETH_API_KEY: process.env.ETH_API_KEY || '',
  REQUEST_DELAY: parseInt(process.env.REQUEST_DELAY || '300'),
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
  DEFAULT_TIME_INTERVAL: parseInt(process.env.DEFAULT_TIME_INTERVAL || '1')
};

/**
 * Мониторинг ETH транзакций
 * @param inputData Входные данные для мониторинга
 * @returns Массив обработанных транзакций
 */
export async function monitorEthTransactions(inputData: ISourceData): Promise<IProcessedTransaction[]> {
  apiLogger.info('Starting ETH transaction monitoring...');
  
  try {
    // Адаптер для обработки входных данных
    const inputAdapter = new EthInputAdapter({
      defaultTimeIntervalHours: ETH_CONFIG.DEFAULT_TIME_INTERVAL
    });
    
    // Получаем данные для мониторинга
    const monitoringData = inputAdapter.getMonitoringData(inputData);
    
    apiLogger.info(`Monitoring ${monitoringData.wallets.length} ETH wallets from ${new Date(monitoringData.timeFrame.startTime).toISOString()} to ${new Date(monitoringData.timeFrame.endTime).toISOString()}`);
    
    // Создаем сервис для работы с ETH транзакциями
    const ethService = new EthTransactionService({
      apiUrl: ETH_CONFIG.ETH_API_URL,
      apiKey: ETH_CONFIG.ETH_API_KEY,
      requestDelay: ETH_CONFIG.REQUEST_DELAY,
      maxRetries: ETH_CONFIG.MAX_RETRIES,
      etherscanApiKey: ETH_CONFIG.ETH_API_KEY
    });
    
    // Получаем транзакции для всех кошельков
    const transactionsData = await ethService.getTransactionsForWallets(
      monitoringData.wallets,
      monitoringData.timeFrame.startTime,
      monitoringData.timeFrame.endTime
    );
    
    // Адаптер для обработки выходных данных
    const outputAdapter = new EthOutputAdapter({
      includeRawData: false
    });
    
    // Обрабатываем полученные транзакции
    const processedTransactions = outputAdapter.processTransactions(transactionsData);
    
    apiLogger.info(`ETH monitoring complete! Found ${processedTransactions.length} transactions.`);
    
    if (processedTransactions.length > 0) {
      transactionLogger.info(`Found ${processedTransactions.length} transactions for ${monitoringData.wallets.length} ETH wallets`);
      processedTransactions.forEach(tx => {
        transactionLogger.debug(`Transaction: ${tx.fromAddress} -> ${tx.toAddress}, Amount: ${tx.amount} ${tx.ticker}, Network: ${tx.network}, Date: ${tx.date}`);
      });
    } else {
      transactionLogger.info('No ETH transactions found in specified time period');
    }
    
    return processedTransactions;
  } catch (error) {
    apiLogger.error(`Error during ETH transaction monitoring: ${(error as Error).message}`);
    throw error;
  }
}
