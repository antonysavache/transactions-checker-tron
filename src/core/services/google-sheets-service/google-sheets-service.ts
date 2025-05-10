/**
 * Сервис для работы с Google Sheets
 */
import { Injectable } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { IProcessedTransaction } from '../../types';
import {apiLogger} from "@shared/utils/logger";

export interface IGoogleSheetsConfig {
  credentialsFile?: string;
  credentialsJson?: string;
  walletsSpreadsheetId?: string;
  walletsRange?: string;
  ethWalletsRange?: string;
  transactionsSpreadsheetId?: string;
  transactionsRange?: string;
  ethTransactionsRange?: string;
  logsSpreadsheetId?: string;
  logsRange?: string;
}

export enum LogLevel {
  INFO = 'INFO',
  ERROR = 'ERROR',
  WARN = 'WARN',
  DEBUG = 'DEBUG'
}

@Injectable()
export class GoogleSheetsService {
  public static LogLevel = LogLevel;
  private auth: JWT | null = null;
  private sheets: sheets_v4.Sheets | null = null;
  private walletsSpreadsheetId: string;
  private walletsRange: string;
  private ethWalletsRange: string;
  private transactionsSpreadsheetId: string;
  private transactionsRange: string;
  private ethTransactionsRange: string;
  private logsSpreadsheetId: string;
  private logsRange: string;
  private initialized: boolean = false;

  constructor(config: IGoogleSheetsConfig = {}) {
    this.walletsSpreadsheetId = config.walletsSpreadsheetId || process.env.GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID || '';
    this.walletsRange = config.walletsRange || process.env.GOOGLE_SHEETS_WALLETS_RANGE || 'wallets!A:A';
    this.ethWalletsRange = config.ethWalletsRange || process.env.GOOGLE_SHEETS_ETH_WALLETS_RANGE || 'wallets!B:B';
    this.transactionsSpreadsheetId = config.transactionsSpreadsheetId || process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID || '';
    this.transactionsRange = config.transactionsRange || process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE || 'trans!A:H';
    this.ethTransactionsRange = config.ethTransactionsRange || process.env.GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE || 'trans-erc!A:K';
    this.logsSpreadsheetId = config.logsSpreadsheetId || process.env.GOOGLE_SHEETS_LOGS_SPREADSHEET_ID || this.transactionsSpreadsheetId;
    this.logsRange = config.logsRange || process.env.GOOGLE_SHEETS_LOGS_RANGE || 'logs!A:C';
    
    if (!this.walletsSpreadsheetId || !this.transactionsSpreadsheetId) {
      apiLogger.warn('GoogleSheetsService: Spreadsheet IDs not provided');
    }
  }

  /**
   * Проверяет, инициализирован ли сервис, и если нет - инициализирует
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Initialize Google Sheets API client
   * @param credentialsJson JSON string with service account credentials
   */
  public async initialize(credentialsJson?: string): Promise<void> {
    if (this.initialized) {
      return;
    }
    
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
      this.initialized = true;
      
      apiLogger.info('GoogleSheetsService initialized successfully');
    } catch (error) {
      apiLogger.error('Failed to initialize GoogleSheetsService: %s', (error as Error).message);
      throw error;
    }
  }

  /**
   * Get wallet addresses from Google Sheets
   * @param network Optional network type to filter wallets (TRON or ETH)
   * @returns Array of wallet addresses
   */
  public async getWallets(network?: 'TRON' | 'ETH' | 'MOCK'): Promise<string[]> {
    await this.ensureInitialized();
    
    if (!this.sheets) {
      throw new Error('GoogleSheetsService not initialized');
    }
    
    if (!this.walletsSpreadsheetId) {
      throw new Error('Wallets spreadsheet ID not provided');
    }
    
    try {
      if (network === 'ETH') {
        // Получаем ETH-кошельки из колонки B
        apiLogger.info('Fetching ETH wallets from Google Sheets: %s range %s', 
          this.walletsSpreadsheetId, this.ethWalletsRange);
        
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.walletsSpreadsheetId,
          range: this.ethWalletsRange,
        });
        
        const values = response.data.values || [];
        
        // Извлекаем адреса ETH-кошельков (один кошелек на строку)
        const wallets = values
          .map(row => row[0]?.toString().trim())
          .filter(wallet => wallet && wallet.length > 0 && !wallet.startsWith('#') && wallet.startsWith('0x'));
        
        apiLogger.info('Successfully fetched %d ETH wallets from Google Sheets', wallets.length);
        
        return wallets;
      } else if (network === 'TRON') {
        // Получаем TRON-кошельки из колонки A
        apiLogger.info('Fetching TRON wallets from Google Sheets: %s range %s', 
          this.walletsSpreadsheetId, this.walletsRange);
        
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.walletsSpreadsheetId,
          range: this.walletsRange,
        });
        
        const values = response.data.values || [];
        
        // Извлекаем адреса TRON-кошельков (один кошелек на строку)
        const wallets = values
          .map(row => row[0]?.toString().trim())
          .filter(wallet => wallet && wallet.length > 0 && !wallet.startsWith('#') && wallet.startsWith('T'));
        
        apiLogger.info('Successfully fetched %d TRON wallets from Google Sheets', wallets.length);
        
        return wallets;
      } else if (network === 'MOCK') {
        // Для MOCK используем третью колонку (С)
        const mockWalletsRange = 'wallets!C:C';
        
        apiLogger.info('Fetching MOCK wallets from Google Sheets: %s range %s', 
          this.walletsSpreadsheetId, mockWalletsRange);
        
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.walletsSpreadsheetId,
          range: mockWalletsRange,
        });
        
        const values = response.data.values || [];
        
        // Извлекаем адреса MOCK-кошельков (один кошелек на строку)
        const wallets = values
          .map(row => row[0]?.toString().trim())
          .filter(wallet => wallet && wallet.length > 0 && !wallet.startsWith('#'));
        
        apiLogger.info('Successfully fetched %d MOCK wallets from Google Sheets', wallets.length);
        
        return wallets;
      } else {
        // Если сеть не указана, получаем все кошельки
        const tronWallets = await this.getWallets('TRON');
        const ethWallets = await this.getWallets('ETH');
        const mockWallets = await this.getWallets('MOCK');
        
        apiLogger.info('Successfully fetched %d total wallets from Google Sheets (%d TRON, %d ETH, %d MOCK)', 
          tronWallets.length + ethWallets.length + mockWallets.length, 
          tronWallets.length, ethWallets.length, mockWallets.length);
        
        return [...tronWallets, ...ethWallets, ...mockWallets];
      }
    } catch (error) {
      apiLogger.error('Error fetching wallets from Google Sheets: %s', (error as Error).message);
      throw error;
    }
  }

  /**
   * Save transactions to Google Sheets
   * @param transactions Array of processed transactions
   * @param network Network type to determine the range ('ETH', 'TRON', 'MOCK')
   */
  public async saveTransactions(transactions: IProcessedTransaction[], network: string): Promise<void> {
    await this.ensureInitialized();
    
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
    
    // Определяем диапазон в зависимости от сети
    let range;
    if (network === 'ETH') {
      range = this.ethTransactionsRange;
    } else if (network === 'TRON') {
      range = this.transactionsRange;
    } else if (network === 'MOCK') {
      range = 'trans-mock!A:K';
    } else {
      range = this.transactionsRange;
    }
    
    const isEthSheet = range.toLowerCase().includes('erc') || network === 'ETH';
    
    try {
      // Convert transactions to rows for the sheet according to the headers
      // Для ETH и MOCK транзакций (trans-erc, trans-mock):
      // A: Дата, B: Гаманець, звідки прийшло, C: Гаманець, куди прийшло, D: Хеш транзакції
      // E: Сума (USDT/ETH/ERC20), F: Валюта (USDT/ETH/ERC20), G: Сума в дол, H: Статус, I: Сеть, J: Комиссия, K: Валюта комиссии
      const rows = transactions.map(tx => {
        // Убедимся, что числовые значения передаются как числа, а не строки
        const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
        const usdAmount = tx.ticker === 'USDT' || tx.ticker === 'USDC' ? amount : '';
        
        // Базовые поля для всех транзакций
        const baseRow = [
          tx.date, // A: Дата
          tx.fromAddress, // B: Гаманець, звідки прийшло
          tx.toAddress, // C: Гаманець, куди прийшло
          tx.id, // D: Хеш транзакції
          amount, // E: Сума (числовой формат)
          tx.ticker, // F: Валюта (USDT/TRX/ETH/ERC20)
          usdAmount, // G: Сума в дол (числовой формат для USDT/USDC)
          tx.status, // H: Статус
          tx.network // I: Сеть (TRON/ETH/MOCK)
        ];
        
        // Если это ETH транзакции и в транзакции есть комиссия, добавляем комиссию
        if ((isEthSheet || network === 'MOCK') && tx.fee !== undefined) {
          return [
            ...baseRow,
            tx.fee, // J: Комиссия
            tx.feeCurrency || 'ETH' // K: Валюта комиссии
          ];
        }
        
        return baseRow;
      });
      
      apiLogger.info('Saving %d transactions to Google Sheets: %s range %s', 
        transactions.length, this.transactionsSpreadsheetId, range);
      
      // Append transactions to the sheet, starting from row 2 (after headers)
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.transactionsSpreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
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
    await this.ensureInitialized();
    
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
        valueInputOption: 'USER_ENTERED',
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
