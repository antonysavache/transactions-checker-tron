import { GoogleSheetsService } from '../services/google-sheets-service';
import { apiLogger } from './logger';
import { apiSheetsLogger } from './sheets-logger';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Setup Google Sheets for wallet tracking
 * This utility helps to initialize and verify Google Sheets integration
 */
async function setupGoogleSheets(): Promise<void> {
  apiLogger.info('Setting up Google Sheets integration...');

  try {
    // Ensure Google Sheets is enabled
    if (process.env.GOOGLE_SHEETS_ENABLED !== 'true') {
      apiLogger.error('Google Sheets integration is not enabled in .env file');
      apiLogger.info('Please set GOOGLE_SHEETS_ENABLED=true in your .env file');
      return;
    }

    // Ensure we have the credentials
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
      apiLogger.error('Google Sheets credentials not found in .env file');
      apiLogger.info('Please add your service account credentials to GOOGLE_SHEETS_CREDENTIALS in .env file');
      return;
    }

    // Check spreadsheet IDs
    if (!process.env.GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID) {
      apiLogger.error('Wallets spreadsheet ID not found in .env file');
      apiLogger.info('Please set GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID in your .env file');
      return;
    }

    if (!process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID) {
      apiLogger.error('Transactions spreadsheet ID not found in .env file');
      apiLogger.info('Please set GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID in your .env file');
      return;
    }

    // Initialize Google Sheets service
    const sheetsService = new GoogleSheetsService();
    await sheetsService.initialize();
    
    // Инициализируем логгер
    await apiSheetsLogger.initialize();

    // Записать первую запись в лог
    await apiSheetsLogger.info('Sheets integration setup started');

    // Test connectivity by trying to fetch wallets
    const wallets = await sheetsService.getWallets();
    apiLogger.info('Successfully connected to Google Sheets!');
    apiLogger.info('Found %d wallets in the spreadsheet', wallets.length);
    
    // Запись в лог Google Sheets
    await apiSheetsLogger.info('Connected to Google Sheets, found %d wallets', wallets.length);

    // Test writing to transactions sheet with a test record
    const testTransaction = {
      id: 'test-transaction-' + Date.now(),
      timestamp: Date.now(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      fromAddress: 'TEST_FROM_ADDRESS',
      toAddress: 'TEST_TO_ADDRESS',
      amount: 100,
      ticker: 'USDT',
      type: 'TEST',
      status: 'SUCCESS'
    };

    await sheetsService.saveTransactions([testTransaction]);
    apiLogger.info('Successfully wrote test transaction to Google Sheets!');
    await apiSheetsLogger.info('Test transaction saved successfully');
    
    // Тестирование логирования в листе logs
    await sheetsService.saveLog(GoogleSheetsService.LogLevel.INFO, 'Test log entry');
    apiLogger.info('Successfully wrote test log entry to Google Sheets!');
    
    apiLogger.info('Google Sheets integration is properly configured and working!');
    await apiSheetsLogger.info('Google Sheets integration setup completed successfully');

  } catch (error) {
    apiLogger.error('Error setting up Google Sheets: %s', (error as Error).message);
    apiLogger.error('Please check your Google Sheets configuration and credentials');
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupGoogleSheets()
    .then(() => {
      apiLogger.info('Google Sheets setup complete');
      process.exit(0);
    })
    .catch(error => {
      apiLogger.error('Google Sheets setup failed: %s', (error as Error).message);
      process.exit(1);
    });
}

export { setupGoogleSheets };