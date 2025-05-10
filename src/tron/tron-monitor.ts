import dotenv from 'dotenv';
import {IProcessedTransaction, ISourceData} from "@core/types";
import {TronInputAdapter} from "@tron/adapters/tron-input-adapter";
import {TronTransactionService} from "@tron/services/tron-transaction-service";
import {TronOutputAdapter} from "@tron/adapters/tron-output-adapter";
import {apiLogger, transactionLogger} from "@shared/utils/logger";


dotenv.config();

const TRON_CONFIG = {
  TRON_API_URL: process.env.TRON_API_URL || 'https://api.trongrid.io',
  REQUEST_DELAY: parseInt(process.env.REQUEST_DELAY || '300'),
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
  DEFAULT_TIME_INTERVAL: parseInt(process.env.DEFAULT_TIME_INTERVAL || '1')
};

/**
 * Мониторинг TRON транзакций
 * @param inputData Входные данные для мониторинга
 * @returns Массив обработанных транзакций
 */
export async function monitorTronTransactions(inputData: ISourceData): Promise<IProcessedTransaction[]> {
  apiLogger.info('Starting TRON transaction monitoring...');
  
  try {
    const inputAdapter = new TronInputAdapter({
      defaultTimeIntervalHours: TRON_CONFIG.DEFAULT_TIME_INTERVAL
    });
    
    const monitoringData = inputAdapter.getMonitoringData(inputData);
    
    apiLogger.info(`Monitoring ${monitoringData.wallets.length} TRON wallets from ${new Date(monitoringData.timeFrame.startTime).toISOString()} to ${new Date(monitoringData.timeFrame.endTime).toISOString()}`);
    
    const tronService = new TronTransactionService({
      apiUrl: TRON_CONFIG.TRON_API_URL,
      requestDelay: TRON_CONFIG.REQUEST_DELAY,
      maxRetries: TRON_CONFIG.MAX_RETRIES
    });
    
    const transactionsData = await tronService.getTransactionsForWallets(
      monitoringData.wallets,
      monitoringData.timeFrame.startTime,
      monitoringData.timeFrame.endTime
    );
    
    const outputAdapter = new TronOutputAdapter({
      includeRawData: false
    });
    
    const processedTransactions = outputAdapter.processTransactions(transactionsData);
    
    apiLogger.info(`TRON monitoring complete! Found ${processedTransactions.length} transactions.`);
    
    if (processedTransactions.length > 0) {
      transactionLogger.info(`Found ${processedTransactions.length} transactions for ${monitoringData.wallets.length} TRON wallets`);
      processedTransactions.forEach(tx => {
        transactionLogger.debug(`Transaction: ${tx.fromAddress} -> ${tx.toAddress}, Amount: ${tx.amount} ${tx.ticker}, Network: ${tx.network}, Date: ${tx.date}`);
      });
    } else {
      transactionLogger.info('No TRON transactions found in specified time period');
    }
    
    return processedTransactions;
  } catch (error) {
    apiLogger.error(`Error during TRON transaction monitoring: ${(error as Error).message}`);
    throw error;
  }
}
