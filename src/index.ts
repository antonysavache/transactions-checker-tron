import dotenv from 'dotenv';
import { InputAdapter } from './adapters/input-adapter';
import { TronTransactionService } from './services/tron-transaction-service';
import { OutputAdapter } from './adapters/output-adapter';
import { GoogleSheetsService } from './services/google-sheets-service';
import { IAppConfig, IProcessedTransaction, ISourceData } from './types';
import { apiLogger, transactionLogger } from './utils/logger';

dotenv.config();

const CONFIG: IAppConfig = {
  TRON_API_URL: process.env.TRON_API_URL || 'https://api.trongrid.io',
  REQUEST_DELAY: parseInt(process.env.REQUEST_DELAY || '300'),
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
  DEFAULT_TIME_INTERVAL: parseInt(process.env.DEFAULT_TIME_INTERVAL || '1'),
  GOOGLE_SHEETS_ENABLED: process.env.GOOGLE_SHEETS_ENABLED === 'true'
};

export async function monitorTransactions(inputData: ISourceData): Promise<IProcessedTransaction[]> {
  apiLogger.info('Starting transaction monitoring...');
  
  try {
    const inputAdapter = new InputAdapter({
      defaultTimeIntervalHours: CONFIG.DEFAULT_TIME_INTERVAL
    });
    
    const monitoringData = inputAdapter.getMonitoringData(inputData);
    apiLogger.info(`Monitoring ${monitoringData.wallets.length} wallets from ${new Date(monitoringData.timeFrame.startTime).toISOString()} to ${new Date(monitoringData.timeFrame.endTime).toISOString()}`);
    
    const tronService = new TronTransactionService({
      apiUrl: CONFIG.TRON_API_URL,
      requestDelay: CONFIG.REQUEST_DELAY,
      maxRetries: CONFIG.MAX_RETRIES
    });
    
    const transactionsData = await tronService.getTransactionsForWallets(
      monitoringData.wallets,
      monitoringData.timeFrame.startTime,
      monitoringData.timeFrame.endTime
    );
    
    const outputAdapter = new OutputAdapter({
      includeRawData: false
    });
    
    const processedTransactions = outputAdapter.processTransactions(transactionsData);
    
    apiLogger.info(`Monitoring complete! Found ${processedTransactions.length} transactions.`);
    
    if (processedTransactions.length > 0) {
      transactionLogger.info(`Found ${processedTransactions.length} transactions for ${monitoringData.wallets.length} wallets`);
      processedTransactions.forEach(tx => {
        transactionLogger.debug(`Transaction: ${tx.fromAddress} -> ${tx.toAddress}, Amount: ${tx.amount} ${tx.ticker}, Date: ${tx.date}`);
      });
    } else {
      transactionLogger.info('No transactions found in specified time period');
    }
    
    return processedTransactions;
  } catch (error) {
    apiLogger.error(`Error during transaction monitoring: ${(error as Error).message}`);
    throw error;
  }
}

if (require.main === module) {
  apiLogger.info('Main module executed directly');
  
  import('./config/wallets').then(({ MONITORED_WALLETS }) => {
    apiLogger.info(`Loading ${MONITORED_WALLETS.length} wallets from config`);
    
    monitorTransactions({
      wallets: MONITORED_WALLETS,
      timeIntervalHours: 1
    })
      .then(results => {
        apiLogger.info('Monitoring results obtained');
        console.log(JSON.stringify(results, null, 2));
      })
      .catch(error => {
        apiLogger.error(`Monitoring failed: ${(error as Error).message}`);
        process.exit(1);
      });
  });
}