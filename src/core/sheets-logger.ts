/**
 * Логгеры для записи в Google Sheets
 */
import { GoogleSheetsService } from './services/google-sheets-service/google-sheets-service';
import { apiLogger } from './logger';
import { LogLevel } from './services/google-sheets-service/google-sheets-service';

// Логгер для API, записывающий в Google Sheets
class SheetsLogger {
  private googleSheetsService: GoogleSheetsService | null = null;
  private readonly name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  async initialize(): Promise<void> {
    if (this.googleSheetsService) {
      return;
    }
    
    try {
      this.googleSheetsService = new GoogleSheetsService();
      await this.googleSheetsService.initialize();
      apiLogger.log(`${this.name} Sheets Logger initialized successfully`);
    } catch (error) {
      apiLogger.error(`Failed to initialize ${this.name} Sheets Logger: ${(error as Error).message}`);
      this.googleSheetsService = null;
    }
  }
  
  async info(message: string, ...args: any[]): Promise<void> {
    await this.log(LogLevel.INFO, message, ...args);
  }
  
  async error(message: string, ...args: any[]): Promise<void> {
    await this.log(LogLevel.ERROR, message, ...args);
  }
  
  async warn(message: string, ...args: any[]): Promise<void> {
    await this.log(LogLevel.WARN, message, ...args);
  }
  
  async debug(message: string, ...args: any[]): Promise<void> {
    await this.log(LogLevel.DEBUG, message, ...args);
  }
  
  private async log(level: LogLevel, message: string, ...args: any[]): Promise<void> {
    if (!this.googleSheetsService) {
      apiLogger.debug(`${this.name} Sheets Logger not initialized for ${level}: ${message}`);
      return;
    }
    
    try {
      // Форматируем сообщение с аргументами
      let formattedMessage = message;
      for (const arg of args) {
        formattedMessage = formattedMessage.replace(/%[sdj]/, String(arg));
      }
      
      await this.googleSheetsService.saveLog(level, `[${this.name}] ${formattedMessage}`);
    } catch (error) {
      apiLogger.error(`${this.name} Sheets Logger error: ${(error as Error).message}`);
    }
  }
}

// Создаем экземпляры логгеров
export const apiSheetsLogger = new SheetsLogger('API');
export const transactionSheetsLogger = new SheetsLogger('Transactions');
