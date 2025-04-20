import { monitorTransactions } from './index';
import { MONITORED_WALLETS } from './config/wallets';
import { transactionStorage } from './utils/file-storage';
import { apiLogger } from './utils/logger';
import { GoogleSheetsService } from './services/google-sheets-service';

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
      this.googleSheetsService = new GoogleSheetsService();
      await this.googleSheetsService.initialize();
      apiLogger.info('Google Sheets integration initialized successfully');
    } catch (error) {
      apiLogger.error('Failed to initialize Google Sheets integration: %s', (error as Error).message);
      this.googleSheetsService = null;
    }
  }

  public start(): void {
    apiLogger.info('Starting transaction monitor, checking every %d hours', this.intervalHours);
    
    this.runMonitor();
    
    const intervalMs = this.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => this.runMonitor(), intervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      apiLogger.info('Transaction monitor stopped');
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
          } else {
            apiLogger.warn('No wallets found in Google Sheets, falling back to config file');
          }
        } catch (error) {
          apiLogger.error('Error fetching wallets from Google Sheets: %s, falling back to config file', (error as Error).message);
        }
      }
      
      apiLogger.info('Running transaction monitoring for %d wallets', walletsToMonitor.length);
      
      const transactions = await monitorTransactions({
        wallets: walletsToMonitor,
        timeIntervalHours: 48  // Установить 48 часов для проверки
      });
      
      apiLogger.info('Monitoring complete, found %d transactions', transactions.length);
      
      // Save transactions to file
      transactionStorage.saveTransactions(transactions);
      
      // Save transactions to Google Sheets if enabled
      if (this.useGoogleSheets && this.googleSheetsService && transactions.length > 0) {
        try {
          await this.googleSheetsService.saveTransactions(transactions);
          apiLogger.info('Transactions saved to Google Sheets');
        } catch (error) {
          apiLogger.error('Error saving transactions to Google Sheets: %s', (error as Error).message);
        }
      }
    } catch (error) {
      apiLogger.error('Error in monitor execution: %s', (error as Error).message);
    }
  }
}

if (require.main === module) {
  // Check if Google Sheets integration is enabled
  const useGoogleSheets = process.env.GOOGLE_SHEETS_ENABLED === 'true';
  
  const monitor = new TransactionMonitor(1, useGoogleSheets);
  monitor.start();
  
  process.on('SIGINT', () => {
    apiLogger.info('Process interrupted, stopping monitor...');
    monitor.stop();
    process.exit(0);
  });
}