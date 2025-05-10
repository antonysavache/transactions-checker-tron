/**
 * Логгеры для работы с Google Sheets
 */
import { GoogleSheetsService, LogLevel } from '../services/google-sheets-service/google-sheets-service';
import dotenv from 'dotenv';

dotenv.config();

// Класс для логирования в Google Sheets
class SheetsLogger {
  private service: GoogleSheetsService | null = null;
  private initialized: boolean = false;
  private logLevel: LogLevel;
  
  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
  }
  
  public async initialize(): Promise<void> {
    try {
      this.service = new GoogleSheetsService();
      await this.service.initialize();
      this.initialized = true;
    } catch (error) {
      console.error(`Failed to initialize Google Sheets logger: ${(error as Error).message}`);
      this.service = null;
      this.initialized = false;
      throw error;
    }
  }
  
  public async info(message: string, ...args: any[]): Promise<void> {
    if (this.logLevel <= LogLevel.INFO) {
      await this.log(LogLevel.INFO, message, args);
    }
  }
  
  public async debug(message: string, ...args: any[]): Promise<void> {
    if (this.logLevel <= LogLevel.DEBUG) {
      await this.log(LogLevel.DEBUG, message, args);
    }
  }
  
  public async warn(message: string, ...args: any[]): Promise<void> {
    if (this.logLevel <= LogLevel.WARN) {
      await this.log(LogLevel.WARN, message, args);
    }
  }
  
  public async error(message: string, ...args: any[]): Promise<void> {
    if (this.logLevel <= LogLevel.ERROR) {
      await this.log(LogLevel.ERROR, message, args);
    }
  }
  
  private async log(level: LogLevel, message: string, args: any[]): Promise<void> {
    if (!this.initialized || !this.service) {
      console.log(`[${level}] ${formatMessage(message, args)}`);
      return;
    }
    
    try {
      await this.service.saveLog(level, formatMessage(message, args));
    } catch (error) {
      console.error(`Failed to log to Google Sheets: ${(error as Error).message}`);
      console.log(`[${level}] ${formatMessage(message, args)}`);
    }
  }
}

// Вспомогательная функция для форматирования сообщений
function formatMessage(message: string, args: any[]): string {
  if (args.length === 0) return message;
  
  let formattedMessage = message;
  for (const arg of args) {
    formattedMessage = formattedMessage.replace(/%[sdj%]/, toString(arg));
  }
  return formattedMessage;
}

function toString(obj: any): string {
  if (typeof obj === 'object') {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      return String(obj);
    }
  }
  return String(obj);
}

// Экспортируем логгеры для разных компонентов
export const apiSheetsLogger = new SheetsLogger(LogLevel.INFO);
export const transactionSheetsLogger = new SheetsLogger(LogLevel.INFO);
