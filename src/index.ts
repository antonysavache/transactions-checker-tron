import dotenv from 'dotenv';
import { InputAdapter } from './adapters/input-adapter';
import { TronTransactionService } from './services/tron-transaction-service';
import { EthTransactionService } from './services/eth-transaction-service';
import { OutputAdapter } from './adapters/output-adapter';
import { GoogleSheetsService } from './services/google-sheets-service';
import { IAppConfig, IProcessedTransaction, ISourceData, ITransactionsResult } from './types';
import { apiLogger, transactionLogger } from './utils/logger';

dotenv.config();

const CONFIG: IAppConfig = {
  TRON_API_URL: process.env.TRON_API_URL || 'https://api.trongrid.io',
  ETH_API_URL: process.env.ETH_API_URL || 'https://mainnet.infura.io/v3/',
  ETH_API_KEY: process.env.ETH_API_KEY || '',
  REQUEST_DELAY: parseInt(process.env.REQUEST_DELAY || '300'),
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
  DEFAULT_TIME_INTERVAL: parseInt(process.env.DEFAULT_TIME_INTERVAL || '1'),
  DEFAULT_NETWORK: (process.env.DEFAULT_NETWORK as 'TRON' | 'ETH' | 'ALL') || 'TRON',
  GOOGLE_SHEETS_ENABLED: process.env.GOOGLE_SHEETS_ENABLED === 'true'
};

export async function monitorTransactions(inputData: ISourceData): Promise<IProcessedTransaction[]> {
  apiLogger.info('Starting transaction monitoring...');
  
  try {
    const inputAdapter = new InputAdapter({
      defaultTimeIntervalHours: CONFIG.DEFAULT_TIME_INTERVAL,
      defaultNetwork: CONFIG.DEFAULT_NETWORK
    });
    
    const monitoringData = inputAdapter.getMonitoringData(inputData);
    apiLogger.info(`Monitoring ${monitoringData.wallets.length} wallets from ${new Date(monitoringData.timeFrame.startTime).toISOString()} to ${new Date(monitoringData.timeFrame.endTime).toISOString()} for network: ${monitoringData.network}`);
    
    let transactionsData: ITransactionsResult = {};
    
    // Процесс получения TRON транзакций
    if (monitoringData.network === 'TRON' || monitoringData.network === 'ALL') {
      apiLogger.info('Getting TRON transactions...');
      const tronService = new TronTransactionService({
        apiUrl: CONFIG.TRON_API_URL,
        requestDelay: CONFIG.REQUEST_DELAY,
        maxRetries: CONFIG.MAX_RETRIES
      });
      
      const tronTransactionsData = await tronService.getTransactionsForWallets(
        monitoringData.wallets,
        monitoringData.timeFrame.startTime,
        monitoringData.timeFrame.endTime
      );
      
      transactionsData = {...transactionsData, ...tronTransactionsData};
    }
    
    // Процесс получения ETH транзакций
    if (monitoringData.network === 'ETH' || monitoringData.network === 'ALL') {
      apiLogger.info('Getting ETH transactions...');
      const ethService = new EthTransactionService({
        apiUrl: CONFIG.ETH_API_URL,
        apiKey: CONFIG.ETH_API_KEY,
        requestDelay: CONFIG.REQUEST_DELAY,
        maxRetries: CONFIG.MAX_RETRIES
      });
      
      const ethTransactionsData = await ethService.getTransactionsForWallets(
        monitoringData.wallets,
        monitoringData.timeFrame.startTime,
        monitoringData.timeFrame.endTime
      );
      
      transactionsData = {...transactionsData, ...ethTransactionsData};
    }
    
    const outputAdapter = new OutputAdapter({
      includeRawData: false
    });
    
    const processedTransactions = outputAdapter.processTransactions(transactionsData);
    
    apiLogger.info(`Monitoring complete! Found ${processedTransactions.length} transactions.`);
    
    if (processedTransactions.length > 0) {
      transactionLogger.info(`Found ${processedTransactions.length} transactions for ${monitoringData.wallets.length} wallets in ${monitoringData.network} network(s)`);
      processedTransactions.forEach(tx => {
        transactionLogger.debug(`Transaction: ${tx.fromAddress} -> ${tx.toAddress}, Amount: ${tx.amount} ${tx.ticker}, Network: ${tx.network}, Date: ${tx.date}`);
      });
    } else {
      transactionLogger.info(`No transactions found in specified time period for ${monitoringData.network} network(s)`);
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