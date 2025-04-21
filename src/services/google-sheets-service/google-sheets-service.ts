import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { IProcessedTransaction } from '../../types';
import { apiLogger } from '../../utils/logger';

export interface IGoogleSheetsConfig {
  credentialsFile?: string;
  credentialsJson?: string;
  walletsSpreadsheetId?: string;
  walletsRange?: string;
  transactionsSpreadsheetId?: string;
  transactionsRange?: string;
  logsSpreadsheetId?: string;
  logsRange?: string;
}

export enum LogLevel {
  INFO = 'INFO',
  ERROR = 'ERROR',
  WARN = 'WARN',
  DEBUG = 'DEBUG'
}

export class GoogleSheetsService {
  public static LogLevel = LogLevel;
  private auth: JWT | null = null;
  private sheets: sheets_v4.Sheets | null = null;
  private walletsSpreadsheetId: string;
  private walletsRange: string;
  private transactionsSpreadsheetId: string;
  private transactionsRange: string;
  private logsSpreadsheetId: string;
  private logsRange: string;

  constructor(config: IGoogleSheetsConfig = {}) {
    this.walletsSpreadsheetId = config.walletsSpreadsheetId || process.env.GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID || '';
    this.walletsRange = config.walletsRange || process.env.GOOGLE_SHEETS_WALLETS_RANGE || 'Sheet1!A2:A';
    this.transactionsSpreadsheetId = config.transactionsSpreadsheetId || process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID || '';
    this.transactionsRange = config.transactionsRange || process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE || 'Sheet1!A:H';
    this.logsSpreadsheetId = config.logsSpreadsheetId || process.env.GOOGLE_SHEETS_LOGS_SPREADSHEET_ID || this.transactionsSpreadsheetId;
    this.logsRange = config.logsRange || process.env.GOOGLE_SHEETS_LOGS_RANGE || 'logs!A:C';
    
    if (!this.walletsSpreadsheetId || !this.transactionsSpreadsheetId) {
      apiLogger.warn('GoogleSheetsService: Spreadsheet IDs not provided');
    }
  }

  /**
   * Initialize Google Sheets API client
   * @param credentialsJson JSON string with service account credentials
   */
  public async initialize(credentialsJson?: string): Promise<void> {
    try {
      let credentials: any;
      
      if (credentialsJson) {
        credentials = JSON.parse(credentialsJson);
      } else if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
        credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      } else {
        throw new Error('Google Sheets credentials not provided');
      }
      
      this.auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      apiLogger.info('GoogleSheetsService initialized successfully');
    } catch (error) {
      apiLogger.error('Failed to initialize GoogleSheetsService: %s', (error as Error).message);
      throw error;
    }
  }

  /**
   * Get wallet addresses from Google Sheets
   * @returns Array of wallet addresses
   */
  public async getWallets(): Promise<string[]> {
    if (!this.sheets) {
      throw new Error('GoogleSheetsService not initialized');
    }
    
    if (!this.walletsSpreadsheetId) {
      throw new Error('Wallets spreadsheet ID not provided');
    }
    
    try {
      apiLogger.info('Fetching wallets from Google Sheets: %s range %s', 
        this.walletsSpreadsheetId, this.walletsRange);
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.walletsSpreadsheetId,
        range: this.walletsRange,
      });
      
      const values = response.data.values || [];
      
      // Extract wallet addresses from the sheet (assuming one wallet per row)
      const wallets = values
        .map(row => row[0]?.toString().trim())
        .filter(wallet => wallet && wallet.length > 0 && !wallet.startsWith('#'));
      
      apiLogger.info('Successfully fetched %d wallets from Google Sheets', wallets.length);
      
      return wallets;
    } catch (error) {
      apiLogger.error('Error fetching wallets from Google Sheets: %s', (error as Error).message);
      throw error;
    }
  }

  /**
   * Save transactions to Google Sheets
   * @param transactions Array of processed transactions
   */
  public async saveTransactions(transactions: IProcessedTransaction[]): Promise<void> {
    if (!this.sheets) {
      throw new Error('GoogleSheetsService not initialized');
    }
    
    if (!this.transactionsSpreadsheetId) {
      throw new Error('Transactions spreadsheet ID not provided');
    }
    
    if (!transactions || transactions.length === 0) {
      apiLogger.info('No transactions to save to Google Sheets');
      return;
    }
    
    try {
      // Convert transactions to rows for the sheet according to the headers:
      // A: Дата, B: Гаманець, звідки прийшло, C: Гаманець, куди прийшло, D: Хеш транзакції
      // E: Сума (USDT/TRX), F: Валюта (USDT/TRX), G: Сума в дол
      const rows = transactions.map(tx => [
        tx.date, // A: Дата
        tx.fromAddress, // B: Гаманець, звідки прийшло
        tx.toAddress, // C: Гаманець, куди прийшло
        tx.id, // D: Хеш транзакції
        tx.amount.toString(), // E: Сума
        tx.ticker, // F: Валюта (USDT/TRX)
        tx.ticker === 'USDT' ? tx.amount.toString() : '' // G: Сума в дол (для USDT такая же сумма)
        // Убираем статус, чтобы не отображать его в таблице
      ]);
      
      apiLogger.info('Saving %d transactions to Google Sheets: %s', 
        transactions.length, this.transactionsSpreadsheetId);
      
      // Append transactions to the sheet, starting from row 2 (after headers)
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.transactionsSpreadsheetId,
        range: this.transactionsRange,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: rows
        }
      });
      
      apiLogger.info('Successfully saved %d transactions to Google Sheets', transactions.length);
    } catch (error) {
      apiLogger.error('Error saving transactions to Google Sheets: %s', (error as Error).message);
      throw error;
    }
  }

  /**
   * Save log entry to Google Sheets
   * @param level Log level (INFO, ERROR, WARN, DEBUG)
   * @param message Log message
   */
  public async saveLog(level: LogLevel, message: string): Promise<void> {
    if (!this.sheets) {
      // Cannot log to sheets if not initialized - just log to console
      console.log(`[${level}] ${message}`);
      return;
    }
    
    try {
      const timestamp = new Date().toISOString();
      
      // Log format: Timestamp | Log Level | Message
      const logRow = [[timestamp, level, message]];
      
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.logsSpreadsheetId,
        range: this.logsRange,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: logRow
        }
      });
      
      // Also log to console for immediate feedback
      console.log(`[${level}] ${message}`);
    } catch (error) {
      // If logging fails, just log to console and don't throw
      console.error(`Failed to save log to Google Sheets: ${(error as Error).message}`);
      console.log(`[${level}] ${message}`);
      
      // Do not re-throw the error to avoid breaking the application flow
    }
  }
}