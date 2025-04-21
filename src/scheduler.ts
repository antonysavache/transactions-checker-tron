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

  constructor(intervalHours: number = 1, useGoogleSheets: boolean = false) {
    this.intervalHours = intervalHours;
    this.useGoogleSheets = useGoogleSheets;
    
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
    apiLogger.info('Starting transaction monitor, checking every %d hours', this.intervalHours);
    
    // Логируем запуск в Google Sheets
    if (this.useGoogleSheets) {
      await apiSheetsLogger.info('Starting transaction monitor, checking every %d hours', this.intervalHours);
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
      // Determine which wallets to monitor (Google Sheets or config file)
      let walletsToMonitor = MONITORED_WALLETS;
      
      if (this.useGoogleSheets && this.googleSheetsService) {
        try {
          const googleWallets = await this.googleSheetsService.getWallets();
          if (googleWallets.length > 0) {
            walletsToMonitor = googleWallets;
            apiLogger.info('Using %d wallets from Google Sheets', walletsToMonitor.length);
            // Используем try-catch для логирования в Google Sheets
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
          }
        } catch (error) {
          apiLogger.error('Error fetching wallets from Google Sheets: %s, falling back to config file', (error as Error).message);
          try {
            await apiSheetsLogger.error('Error fetching wallets from Google Sheets: %s, falling back to config file', (error as Error).message);
          } catch (logError) {
            apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
          }
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
        timeIntervalHours: 1  // Настраиваем на 1 час бесперерывной работы
      });
      
      apiLogger.info('Monitoring complete, found %d transactions', transactions.length);
      try {
        await apiSheetsLogger.info('Monitoring complete, found %d transactions', transactions.length);
      } catch (logError) {
        apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
      }
      
      // Сохраняем информацию о транзакциях
      await transactionStorage.saveTransactions(transactions);
      
      // Сохраняем транзакции в Google Sheets
      if (this.useGoogleSheets && this.googleSheetsService && transactions.length > 0) {
        try {
          await this.googleSheetsService.saveTransactions(transactions);
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
        monitor = new TransactionMonitor(1, useGoogleSheets);
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
        monitor = new TransactionMonitor(1, false);
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
    monitor = new TransactionMonitor(1, false);
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