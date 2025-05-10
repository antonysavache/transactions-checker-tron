/**
 * Сервис для мониторинга тестовых транзакций Mock
 */
import { IMockMonitorConfig } from './types';
import { monitorMockTransactions } from './mock-monitor';
import { apiLogger } from '../shared/utils/logger';
import { transactionStorage } from '../shared/utils/file-storage';
import { GoogleSheetsService } from '../shared/services/google-sheets-service/google-sheets-service';
import { apiSheetsLogger, transactionSheetsLogger } from '../shared/utils/sheets-logger';

export class MockMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalHours: number;
  private googleSheetsService: GoogleSheetsService | null = null;
  private useGoogleSheets: boolean;
  private initialHistoricalHours: number | null;
  private wallets: string[];

  constructor(config: IMockMonitorConfig) {
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
      await apiSheetsLogger.info('MOCK monitor started');
    } catch (error) {
      apiLogger.error('Failed to initialize Google Sheets integration: %s', (error as Error).message);
      this.googleSheetsService = null;
    }
  }

  public async start(): Promise<void> {
    apiLogger.info('Starting MOCK transaction monitor, checking every %d hours', this.intervalHours);
    
    // Логируем запуск в Google Sheets
    if (this.useGoogleSheets) {
      await apiSheetsLogger.info('Starting MOCK transaction monitor, checking every %d hours', this.intervalHours);
    }
    
    await this.runMonitor();
    
    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => this.runMonitor(), intervalMs);
  }

  public async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      apiLogger.info('MOCK transaction monitor stopped');
      
      // Логируем остановку в Google Sheets
      if (this.useGoogleSheets) {
        await apiSheetsLogger.info('MOCK transaction monitor stopped');
      }
    }
  }

  private async runMonitor(): Promise<void> {
    try {
      // Определяем интервал для текущего запуска
      // Если это первый запуск и задан initialHistoricalHours, используем его
      let currentIntervalHours = this.intervalHours;
      
      if (this.initialHistoricalHours !== null) {
        currentIntervalHours = this.initialHistoricalHours;
        apiLogger.info('Using historical data interval: %d hours', currentIntervalHours);
        // Сбрасываем исторический интервал, чтобы в следующих запусках использовался обычный интервал
        this.initialHistoricalHours = null;
      }
      
      apiLogger.info('Running MOCK transaction monitoring for %d wallets with interval %d hours', this.wallets.length, currentIntervalHours);
      try {
        await apiSheetsLogger.info('Running MOCK transaction monitoring for %d wallets with interval %d hours', this.wallets.length, currentIntervalHours);
      } catch (logError) {
        apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
      }
      
      // Запускаем мониторинг MOCK транзакций
      const transactions = await monitorMockTransactions({
        wallets: this.wallets,
        timeIntervalHours: currentIntervalHours,
        network: 'MOCK' as any // Приведение типа
      });
      
      apiLogger.info('Monitoring complete, found %d MOCK transactions', transactions.length);
      try {
        await apiSheetsLogger.info('Monitoring complete, found %d MOCK transactions', transactions.length);
      } catch (logError) {
        apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
      }
      
      // Сохраняем информацию о транзакциях
      await transactionStorage.saveTransactions(transactions);
      
      // Сохраняем транзакции в Google Sheets
      if (this.useGoogleSheets && this.googleSheetsService && transactions.length > 0) {
        try {
          const mockRange = process.env.GOOGLE_SHEETS_MOCK_TRANSACTIONS_RANGE || 'trans-mock!A:K';
          await this.googleSheetsService.saveTransactions(transactions, mockRange);
          
          apiLogger.info('MOCK transactions saved to Google Sheets');
          try {
            await apiSheetsLogger.info('MOCK transactions saved to Google Sheets');
          } catch (logError) {
            apiLogger.warn('Failed to log to Google Sheets: %s', (logError as Error).message);
          }
        } catch (error) {
          apiLogger.error('Error saving MOCK transactions to Google Sheets: %s', (error as Error).message);
          try {
            await apiSheetsLogger.error('Error saving MOCK transactions to Google Sheets: %s', (error as Error).message);
          } catch (logError) {
            apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
          }
        }
      }
    } catch (error) {
      apiLogger.error('Error in MOCK monitor execution: %s', (error as Error).message);
      if (this.useGoogleSheets) {
        try {
          await apiSheetsLogger.error('Error in MOCK monitor execution: %s', (error as Error).message);
        } catch (logError) {
          apiLogger.warn('Failed to log error to Google Sheets: %s', (logError as Error).message);
        }
      }
    }
  }
}
