/**
 * Тестовый скрипт для мониторинга ETH транзакций по указанным кошелькам
 * с фильтрацией только официальных USDT/USDC
 */
import dotenv from 'dotenv';
import { InputAdapter } from './adapters/input-adapter';
import { EthTransactionService } from './services/eth-transaction-service';
import { OutputAdapter } from './adapters/output-adapter';
import { GoogleSheetsService } from './services/google-sheets-service';
import { IProcessedTransaction } from './types';
import { apiLogger, transactionLogger } from './utils/logger';

dotenv.config();

// Заменим жесткий список кошельков на запрос из Google Sheets
// Эти кошельки будут использоваться только если не доступен Google Sheets
const FALLBACK_ETH_WALLETS = [
  '0xcf5e80D86a1727971eD343fE22b1F303EC2f35d9',
  '0xd5461490B1Bdb956C120EdF497B55e255868703c',
  '0x227AC2208dA4C56d19Ddb25db9B2bDEc7b0B77D3'
];

// Параметры для мониторинга
const HOURS_TO_MONITOR = 48;

// Настройки для сохранения в Google Sheets
const TRANSACTIONS_RANGE = 'trans-erc!A:I';

// Официальные адреса контрактов
const VALID_TOKEN_CONTRACTS = {
  'USDT': '0xdac17f958d2ee523a2206206994597c13d831ec7',
  'USDC': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
};

async function monitorEthereumWallets() {
  apiLogger.info(`Starting ETH transaction monitoring for the last ${HOURS_TO_MONITOR} hours`);
  apiLogger.info(`Only official USDT and USDC tokens will be tracked with the following contract addresses:`);
  apiLogger.info(`USDT: ${VALID_TOKEN_CONTRACTS.USDT}`);
  apiLogger.info(`USDC: ${VALID_TOKEN_CONTRACTS.USDC}`);
  
  try {
    // Получаем кошельки из Google Sheets (из колонки B)
    let ethWallets: string[] = [];
    const useGoogleSheets = process.env.GOOGLE_SHEETS_ENABLED === 'true';
    
    if (useGoogleSheets) {
      try {
        const googleSheetsService = new GoogleSheetsService();
        await googleSheetsService.initialize();
        
        // Получаем ETH кошельки из колонки B (используем метод с фильтром по сети ETH)
        ethWallets = await googleSheetsService.getWallets('ETH');
        apiLogger.info(`Successfully fetched ${ethWallets.length} ETH wallets from Google Sheets`);
        
        if (ethWallets.length === 0) {
          apiLogger.warn('No ETH wallets found in Google Sheets, using fallback list');
          ethWallets = FALLBACK_ETH_WALLETS;
        }
      } catch (error) {
        apiLogger.error(`Error fetching ETH wallets from Google Sheets: ${(error as Error).message}`);
        apiLogger.warn('Using fallback ETH wallet list');
        ethWallets = FALLBACK_ETH_WALLETS;
      }
    } else {
      ethWallets = FALLBACK_ETH_WALLETS;
    }
    
    // Определяем временной интервал
    const inputAdapter = new InputAdapter({
      defaultTimeIntervalHours: HOURS_TO_MONITOR,
      defaultNetwork: 'ETH'
    });
    
    const monitoringData = inputAdapter.getMonitoringData({
      wallets: ethWallets,
      timeIntervalHours: HOURS_TO_MONITOR,
      network: 'ETH'
    });
    
    apiLogger.info(`Monitoring ${monitoringData.wallets.length} ETH wallets from ${new Date(monitoringData.timeFrame.startTime).toISOString()} to ${new Date(monitoringData.timeFrame.endTime).toISOString()}`);
    
    // Создаем экземпляр сервиса Ethereum
    const ethService = new EthTransactionService({
      apiUrl: process.env.ETH_API_URL || 'https://api.etherscan.io/api',
      apiKey: process.env.ETH_API_KEY || '',
      requestDelay: parseInt(process.env.REQUEST_DELAY || '300'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3')
    });
    
    // Получаем транзакции
    const transactionsData = await ethService.getTransactionsForWallets(
      monitoringData.wallets,
      monitoringData.timeFrame.startTime,
      monitoringData.timeFrame.endTime
    );
    
    // Обрабатываем транзакции (теперь с фильтрацией только официальных USDT/USDC)
    const outputAdapter = new OutputAdapter({
      includeRawData: false
    });
    
    const processedTransactions = outputAdapter.processTransactions(transactionsData);
    
    apiLogger.info(`Monitoring complete! Found ${processedTransactions.length} ETH transactions (after filtering non-official tokens).`);
    
    if (processedTransactions.length > 0) {
      transactionLogger.info(`Found ${processedTransactions.length} ETH transactions for ${monitoringData.wallets.length} wallets (only official USDT/USDC)`);
      
      // Сводная статистика по токенам
      const tokenCounts = processedTransactions.reduce((acc, tx) => {
        acc[tx.ticker] = (acc[tx.ticker] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      apiLogger.info('Transaction breakdown by token type:');
      Object.entries(tokenCounts).forEach(([token, count]) => {
        apiLogger.info(`- ${token}: ${count} transactions`);
      });
      
      processedTransactions.forEach(tx => {
        transactionLogger.debug(`Transaction: ${tx.fromAddress} -> ${tx.toAddress}, Amount: ${tx.amount} ${tx.ticker}, Network: ${tx.network}, Date: ${tx.date}`);
      });
      
      // Сохраняем в Google Sheets
      if (useGoogleSheets) {
        await saveToGoogleSheets(processedTransactions);
      }
    } else {
      apiLogger.info('No official USDT/USDC transactions found in specified time period');
    }
    
    return processedTransactions;
  } catch (error) {
    apiLogger.error(`Error during ETH transaction monitoring: ${(error as Error).message}`);
    throw error;
  }
}

async function saveToGoogleSheets(transactions: IProcessedTransaction[]) {
  try {
    apiLogger.info(`Saving ${transactions.length} ETH transactions to Google Sheets...`);
    
    const googleSheetsService = new GoogleSheetsService({
      transactionsRange: TRANSACTIONS_RANGE
    });
    
    // Инициализируем сервис Google Sheets
    await googleSheetsService.initialize();
    
    // Сохраняем транзакции
    await googleSheetsService.saveTransactions(transactions);
    
    apiLogger.info(`Successfully saved ${transactions.length} ETH transactions to Google Sheets (${TRANSACTIONS_RANGE})`);
  } catch (error) {
    apiLogger.error(`Failed to save ETH transactions to Google Sheets: ${(error as Error).message}`);
    throw error;
  }
}

// Запускаем мониторинг
monitorEthereumWallets()
  .then(transactions => {
    console.log(`Found ${transactions.length} official USDT/USDC transactions`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });