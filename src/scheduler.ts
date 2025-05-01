import { monitorTransactions } from './index';
import { MONITORED_WALLETS } from './config/wallets';
import { transactionStorage } from './utils/file-storage';
import { apiLogger } from './utils/logger';
import { GoogleSheetsService } from './services/google-sheets-service';
import { apiSheetsLogger, transactionSheetsLogger } from './utils/sheets-logger';

export class TransactionMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalHours: number;
  private googleSheetsService: GoogleSheetsService | null = null;
  private useGoogleSheets: boolean;
  private network: 'TRON' | 'ETH' | 'ALL';

  constructor(intervalHours: number = 1, useGoogleSheets: boolean = false, network: 'TRON' | 'ETH' | 'ALL' = 'TRON') {
    this.intervalHours = intervalHours;
    this.useGoogleSheets = useGoogleSheets;
    this.network = network;
    
    if (this.useGoogleSheets) {
      this.initGoogleSheets();
    }
  }
  
  private async initGoogleSheets(): Promise<void> {
    try {
      // Инициализируем основной сервис Google Sheets
      this.googleSheetsService = new GoogleSheetsService();
      await this.googleSheetsService.initialize();
      apiLogger.info('Google Sheets integration initialized successfully');
      
      // Инициализируем логгеры Google Sheets
      await apiSheetsLogger.initialize();
      await transactionSheetsLogger.initialize();
      
      // Записываем первое сообщение в лог
      await apiSheetsLogger.info('Transaction monitor started');
    } catch (error) {
      apiLogger.error('Failed to initialize Google Sheets integration: %s', (error as Error).message);
      this.googleSheetsService = null;
    }
  }

  public async start(): Promise<void> {
    apiLogger.info('Starting transaction monitor for %s network, checking every %d hours', this.network, this.intervalHours);
    
    // Логируем запуск в Google Sheets
    if (this.useGoogleSheets) {
      await apiSheetsLogger.info('Starting transaction monitor for %s network, checking every %d hours', this.network, this.intervalHours);
    }
    
    await this.runMonitor();
    
    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => this.runMonitor(), intervalMs);
  }

  public async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      apiLogger.info('Transaction monitor stopped');
      
      // Логируем остановку в Google Sheets
      if (this.useGoogleSheets) {
        await apiSheetsLogger.info('Transaction monitor stopped');
      }
    }
  }

  private async runMonitor(): Promise<void> {
    try {
      // Determine which wallets to monitor based on network type
      let walletsToMonitor: string[] = [];
      
      if (this.useGoogleSheets && this.googleSheetsService) {
        try {
          // Получаем кошельки из соответствующих колонок в зависимости от сети
          if (this.network === 'TRON') {
            const tronWallets = await this.googleSheetsService.getWallets('TRON');
            if (tronWallets.length > 0) {
              walletsToMonitor = tronWallets;
              apiLogger.info('Using %d TRON wallets from Google Sheets', walletsToMonitor.length);
              try {
                await apiSheetsLogger.info('Using %d TRON wallets from Google Sheets', walletsToMonitor.length);
              } catch (logError) {
                apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
              }
            } else {
              apiLogger.warn('No TRON wallets found in Google Sheets, falling back to config file');
              try {
                await apiSheetsLogger.warn('No TRON wallets found in Google Sheets, falling back to config file');
              } catch (logError) {
                apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
              }
              walletsToMonitor = MONITORED_WALLETS.filter(wallet => wallet.startsWith('T'));
            }
          } else if (this.network === 'ETH') {
            const ethWallets = await this.googleSheetsService.getWallets('ETH');
            if (ethWallets.length > 0) {
              walletsToMonitor = ethWallets;
              apiLogger.info('Using %d ETH wallets from Google Sheets', walletsToMonitor.length);
              try {
                await apiSheetsLogger.info('Using %d ETH wallets from Google Sheets', walletsToMonitor.length);
              } catch (logError) {
                apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
              }
            } else {
              apiLogger.warn('No ETH wallets found in Google Sheets, falling back to config file');
              try {
                await apiSheetsLogger.warn('No ETH wallets found in Google Sheets, falling back to config file');
              } catch (logError) {
                apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
              }
              walletsToMonitor = MONITORED_WALLETS.filter(wallet => wallet.startsWith('0x'));
            }
          } else {
            // ALL - получаем оба типа кошельков
            const allWallets = await this.googleSheetsService.getWallets();
            if (allWallets.length > 0) {
              walletsToMonitor = allWallets;
              apiLogger.info('Using %d wallets from Google Sheets', walletsToMonitor.length);
              try {
                await apiSheetsLogger.info('Using %d wallets from Google Sheets', walletsToMonitor.length);
              } catch (logError) {
                apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
              }
            } else {
              apiLogger.warn('No wallets found in Google Sheets, falling back to config file');
              try {
                await apiSheetsLogger.warn('No wallets found in Google Sheets, falling back to config file');
              } catch (logError) {
                apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
              }
              walletsToMonitor = MONITORED_WALLETS;
            }
          }
        } catch (error) {
          apiLogger.error('Error fetching wallets from Google Sheets: %s, falling back to config file', (error as Error).message);
          try {
            await apiSheetsLogger.error('Error fetching wallets from Google Sheets: %s, falling back to config file', (error as Error).message);
          } catch (logError) {
            apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
          }
          // Фильтруем кошельки из конфиг-файла в зависимости от сети
          if (this.network === 'TRON') {
            walletsToMonitor = MONITORED_WALLETS.filter(wallet => wallet.startsWith('T'));
          } else if (this.network === 'ETH') {
            walletsToMonitor = MONITORED_WALLETS.filter(wallet => wallet.startsWith('0x'));
          } else {
            walletsToMonitor = MONITORED_WALLETS;
          }
        }
      } else {
        // Если Google Sheets не используется, берем кошельки из конфиг-файла
        if (this.network === 'TRON') {
          walletsToMonitor = MONITORED_WALLETS.filter(wallet => wallet.startsWith('T'));
        } else if (this.network === 'ETH') {
          walletsToMonitor = MONITORED_WALLETS.filter(wallet => wallet.startsWith('0x'));
        } else {
          walletsToMonitor = MONITORED_WALLETS;
        }
      }
      
      apiLogger.info('Running transaction monitoring for %d wallets', walletsToMonitor.length);
      try {
        await apiSheetsLogger.info('Running transaction monitoring for %d wallets', walletsToMonitor.length);
      } catch (logError) {
        apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
      }
      
      const transactions = await monitorTransactions({
        wallets: walletsToMonitor,
        timeIntervalHours: 1,
        network: this.network
      });
      
      apiLogger.info('Monitoring complete, found %d transactions in %s network(s)', transactions.length, this.network);
      try {
        await apiSheetsLogger.info('Monitoring complete, found %d transactions in %s network(s)', transactions.length, this.network);
      } catch (logError) {
        apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
      }
      
      // Сохраняем информацию о транзакциях
      await transactionStorage.saveTransactions(transactions);
      
      // Определяем правильный диапазон для сохранения транзакций в зависимости от сети
      let transactionsRange = '';
      if (this.network === 'TRON') {
        transactionsRange = process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE || 'trans!A:H';
      } else if (this.network === 'ETH') {
        transactionsRange = process.env.GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE || 'trans-erc!A:I';
      } else {
        // Для 'ALL' сортируем транзакции по сети и сохраняем в соответствующие диапазоны
        const tronTx = transactions.filter(tx => tx.network === 'TRON');
        const ethTx = transactions.filter(tx => tx.network === 'ETH');
        
        if (tronTx.length > 0 && this.useGoogleSheets && this.googleSheetsService) {
          try {
            const tronRange = process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE || 'trans!A:H';
            await this.googleSheetsService.saveTransactions(tronTx, tronRange);
            apiLogger.info('%d TRON transactions saved to Google Sheets', tronTx.length);
          } catch (error) {
            apiLogger.error('Error saving TRON transactions to Google Sheets: %s', (error as Error).message);
          }
        }
        
        if (ethTx.length > 0 && this.useGoogleSheets && this.googleSheetsService) {
          try {
            const ethRange = process.env.GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE || 'trans-erc!A:I';
            await this.googleSheetsService.saveTransactions(ethTx, ethRange);
            apiLogger.info('%d ETH transactions saved to Google Sheets', ethTx.length);
          } catch (error) {
            apiLogger.error('Error saving ETH transactions to Google Sheets: %s', (error as Error).message);
          }
        }
        
        // После отдельного сохранения нет необходимости в общем сохранении
        transactionsRange = '';
      }
      
      // Сохраняем транзакции в Google Sheets только если не режим ALL или нужно сохранить в одну вкладку
      if (this.useGoogleSheets && this.googleSheetsService && transactionsRange && transactions.length > 0) {
        try {
          await this.googleSheetsService.saveTransactions(transactions, transactionsRange);
          apiLogger.info('Transactions saved to Google Sheets');
          try {
            await apiSheetsLogger.info('Transactions saved to Google Sheets');
          } catch (logError) {
            apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
          }
        } catch (error) {
          apiLogger.error('Error saving transactions to Google Sheets: %s', (error as Error).message);
          try {
            await apiSheetsLogger.error('Error saving transactions to Google Sheets: %s', (error as Error).message);
          } catch (logError) {
            apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
          }
        }
      }
    } catch (error) {
      apiLogger.error('Error in monitor execution: %s', (error as Error).message);
      if (this.useGoogleSheets) {
        try {
          await apiSheetsLogger.error('Error in monitor execution: %s', (error as Error).message);
        } catch (logError) {
          apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
        }
      }
    }
  }
}

if (require.main === module) {
  // Check if Google Sheets integration is enabled
  const useGoogleSheets = process.env.GOOGLE_SHEETS_ENABLED === 'true';
  
  // Определяем сеть для мониторинга
  const network = (process.env.DEFAULT_NETWORK as 'TRON' | 'ETH' | 'ALL') || 'TRON';
  
  // Объявляем монитор в глобальной области видимости
  let monitor: TransactionMonitor;
  
  // Обработчик для graceful shutdown
  const handleShutdown = async (signal: string) => {
    apiLogger.info(`Process received ${signal}, stopping monitor...`);
    if (monitor) {
      try {
        await monitor.stop();
        apiLogger.info('Monitor stopped successfully');
      } catch (error) {
        apiLogger.error(`Error stopping monitor: ${(error as Error).message}`);
      }
    }
    process.exit(0);
  };
  
  // Сначала проверяем возможность использования Google Sheets для логирования
  if (useGoogleSheets) {
    // Инициализируем логгер Google Sheets
    apiSheetsLogger.initialize()
      .then(() => {
        // Запускаем монитор с Google Sheets
        monitor = new TransactionMonitor(1, useGoogleSheets, network);
        monitor.start()
          .then(() => {
            process.on('SIGINT', () => handleShutdown('SIGINT'));
            process.on('SIGTERM', () => handleShutdown('SIGTERM'));
            
            apiLogger.info('Monitor started and running (press Ctrl+C to stop)');
          })
          .catch(error => {
            apiLogger.error(`Failed to start monitor: ${(error as Error).message}`);
            process.exit(1);
          });
      })
      .catch(error => {
        apiLogger.error(`Failed to initialize Google Sheets logger: ${(error as Error).message}`);
        
        // Запускаем монитор без Google Sheets как fallback
        apiLogger.info('Falling back to non-Google Sheets mode');
        monitor = new TransactionMonitor(1, false, network);
        monitor.start()
          .then(() => {
            process.on('SIGINT', () => handleShutdown('SIGINT'));
            process.on('SIGTERM', () => handleShutdown('SIGTERM'));
            
            apiLogger.info('Monitor started in fallback mode and running');
          })
          .catch(startError => {
            apiLogger.error(`Failed to start monitor in fallback mode: ${startError.message}`);
            process.exit(1);
          });
      });
  } else {
    // Запускаем монитор без Google Sheets
    monitor = new TransactionMonitor(1, false, network);
    monitor.start()
      .then(() => {
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        
        apiLogger.info('Monitor started in local mode and running');
      })
      .catch(error => {
        apiLogger.error(`Failed to start monitor: ${(error as Error).message}`);
        process.exit(1);
      });
  }
}