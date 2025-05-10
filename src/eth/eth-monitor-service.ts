/**
 * Сервис для мониторинга ETH транзакций
 */
import { IEthMonitorConfig } from './types';
import { monitorEthTransactions } from './eth-monitor';
import { apiLogger } from '../shared/utils/logger';
import { transactionStorage } from '../shared/utils/file-storage';
import { GoogleSheetsService } from '../shared/services/google-sheets-service/google-sheets-service';
import { apiSheetsLogger, transactionSheetsLogger } from '../shared/utils/sheets-logger';

export class EthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalHours: number;
  private googleSheetsService: GoogleSheetsService | null = null;
  private useGoogleSheets: boolean;
  private initialHistoricalHours: number | null;
  private wallets: string[];

  constructor(config: IEthMonitorConfig) {
    this.intervalHours = config.intervalHours || 1;
    this.useGoogleSheets = config.useGoogleSheets || false;
    this.initialHistoricalHours = config.initialHistoricalHours || null;
    this.wallets = config.wallets || [];
    
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
      await apiSheetsLogger.info('ETH monitor started');
    } catch (error) {
      apiLogger.error('Failed to initialize Google Sheets integration: %s', (error as Error).message);
      this.googleSheetsService = null;
    }
  }

  public async start(): Promise<void> {
    apiLogger.info('Starting ETH transaction monitor, checking every %d hours', this.intervalHours);
    
    // Логируем запуск в Google Sheets
    if (this.useGoogleSheets) {
      await apiSheetsLogger.info('Starting ETH transaction monitor, checking every %d hours', this.intervalHours);
    }
    
    await this.runMonitor();
    
    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => this.runMonitor(), intervalMs);
  }

  public async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      apiLogger.info('ETH transaction monitor stopped');
      
      // Логируем остановку в Google Sheets
      if (this.useGoogleSheets) {
        await apiSheetsLogger.info('ETH transaction monitor stopped');
      }
    }
  }

  private async runMonitor(): Promise<void> {
    try {
      // Определяем список кошельков для мониторинга
      let walletsToMonitor: string[] = [];
      
      // Определяем интервал для текущего запуска
      // Если это первый запуск и задан initialHistoricalHours, используем его
      let currentIntervalHours = this.intervalHours;
      
      if (this.initialHistoricalHours !== null) {
        currentIntervalHours = this.initialHistoricalHours;
        apiLogger.info('Using historical data interval: %d hours', currentIntervalHours);
        // Сбрасываем исторический интервал, чтобы в следующих запусках использовался обычный интервал
        this.initialHistoricalHours = null;
      }
      
      if (this.useGoogleSheets && this.googleSheetsService) {
        try {
          // Получаем ETH-кошельки из Google Sheets
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
            apiLogger.warn('No ETH wallets found in Google Sheets, falling back to configured wallets');
            try {
              await apiSheetsLogger.warn('No ETH wallets found in Google Sheets, falling back to configured wallets');
            } catch (logError) {
              apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
            }
            walletsToMonitor = this.wallets;
          }
        } catch (error) {
          apiLogger.error('Error fetching wallets from Google Sheets: %s, falling back to configured wallets', (error as Error).message);
          try {
            await apiSheetsLogger.error('Error fetching wallets from Google Sheets: %s, falling back to configured wallets', (error as Error).message);
          } catch (logError) {
            apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
          }
          walletsToMonitor = this.wallets;
        }
      } else {
        // Если Google Sheets не используется, берем кошельки из конфигурации
        walletsToMonitor = this.wallets;
      }
      
      apiLogger.info('Running ETH transaction monitoring for %d wallets with interval %d hours', walletsToMonitor.length, currentIntervalHours);
      try {
        await apiSheetsLogger.info('Running ETH transaction monitoring for %d wallets with interval %d hours', walletsToMonitor.length, currentIntervalHours);
      } catch (logError) {
        apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
      }
      
      // Запускаем мониторинг ETH транзакций
      const transactions = await monitorEthTransactions({
        wallets: walletsToMonitor,
        timeIntervalHours: currentIntervalHours,
        network: 'ETH'
      });
      
      apiLogger.info('Monitoring complete, found %d ETH transactions', transactions.length);
      try {
        await apiSheetsLogger.info('Monitoring complete, found %d ETH transactions', transactions.length);
      } catch (logError) {
        apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
      }
      
      // Сохраняем информацию о транзакциях
      await transactionStorage.saveTransactions(transactions);
      
      // Сохраняем транзакции в Google Sheets
      if (this.useGoogleSheets && this.googleSheetsService && transactions.length > 0) {
        try {
          const ethRange = process.env.GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE || 'trans-erc!A:K';
          await this.googleSheetsService.saveTransactions(transactions, ethRange);
          
          apiLogger.info('ETH transactions saved to Google Sheets');
          try {
            await apiSheetsLogger.info('ETH transactions saved to Google Sheets');
          } catch (logError) {
            apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
          }
        } catch (error) {
          apiLogger.error('Error saving ETH transactions to Google Sheets: %s', (error as Error).message);
          try {
            await apiSheetsLogger.error('Error saving ETH transactions to Google Sheets: %s', (error as Error).message);
          } catch (logError) {
            apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
          }
        }
      }
    } catch (error) {
      apiLogger.error('Error in ETH monitor execution: %s', (error as Error).message);
      if (this.useGoogleSheets) {
        try {
          await apiSheetsLogger.error('Error in ETH monitor execution: %s', (error as Error).message);
        } catch (logError) {
          apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
        }
      }
    }
  }
}
