
import dotenv from 'dotenv';
import {MockOutputAdapter} from "@mock/adapters/mock-output-adapter";
import {IProcessedTransaction, ISourceData} from "@core/types";
import {apiLogger, transactionLogger} from "@shared/utils/logger";
import {MockInputAdapter} from "@mock/adapters/mock-input-adapter";
import {MockTransactionService} from "@mock/services/mock-transaction-service";


dotenv.config();

const MOCK_CONFIG = {
  MOCK_DELAY_MS: parseInt(process.env.MOCK_DELAY_MS || '500'),
  MOCK_ERROR_RATE: parseInt(process.env.MOCK_ERROR_RATE || '10'),
  MOCK_TRANSACTIONS_PER_WALLET: parseInt(process.env.MOCK_TRANSACTIONS_PER_WALLET || '5'),
  DEFAULT_TIME_INTERVAL: parseInt(process.env.DEFAULT_TIME_INTERVAL || '1')
};

/**
 * Мониторинг тестовых транзакций Mock
 * @param inputData Входные данные для мониторинга
 * @returns Массив обработанных транзакций
 */
export async function monitorMockTransactions(inputData: ISourceData): Promise<IProcessedTransaction[]> {
  apiLogger.info('Starting MOCK transaction monitoring...');
  
  try {
    const inputAdapter = new MockInputAdapter({
      defaultTimeIntervalHours: MOCK_CONFIG.DEFAULT_TIME_INTERVAL
    });
    
    const monitoringData = inputAdapter.getMonitoringData(inputData);
    
    apiLogger.info(`Monitoring ${monitoringData.wallets.length} MOCK wallets from ${new Date(monitoringData.timeFrame.startTime).toISOString()} to ${new Date(monitoringData.timeFrame.endTime).toISOString()}`);
    
    // Создаем сервис для работы с MOCK транзакциями
    const mockService = new MockTransactionService({
      delayMs: MOCK_CONFIG.MOCK_DELAY_MS,
      errorRate: MOCK_CONFIG.MOCK_ERROR_RATE,
      transactionsPerWallet: MOCK_CONFIG.MOCK_TRANSACTIONS_PER_WALLET
    });
    
    const transactionsData = await mockService.getTransactionsForWallets(
      monitoringData.wallets,
      monitoringData.timeFrame.startTime,
      monitoringData.timeFrame.endTime
    );
    
    const outputAdapter = new MockOutputAdapter({
      includeRawData: false
    });
    
    const processedTransactions = outputAdapter.processTransactions(transactionsData);
    
    apiLogger.info(`MOCK monitoring complete! Found ${processedTransactions.length} transactions.`);
    
    if (processedTransactions.length > 0) {
      transactionLogger.info(`Found ${processedTransactions.length} transactions for ${monitoringData.wallets.length} MOCK wallets`);
      processedTransactions.forEach(tx => {
        transactionLogger.debug(`Transaction: ${tx.fromAddress} -> ${tx.toAddress}, Amount: ${tx.amount} ${tx.ticker}, Network: ${tx.network}, Date: ${tx.date}`);
      });
    } else {
      transactionLogger.info('No MOCK transactions found in specified time period');
    }
    
    return processedTransactions;
  } catch (error) {
    apiLogger.error(`Error during MOCK transaction monitoring: ${(error as Error).message}`);
    throw error;
  }
}
