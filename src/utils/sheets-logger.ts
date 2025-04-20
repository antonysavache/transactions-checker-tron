import { GoogleSheetsService, LogLevel } from '../services/google-sheets-service/google-sheets-service';
import { format } from 'util';

export class SheetsLogger {
  private googleSheetsService: GoogleSheetsService;
  private serviceName: string;
  private isInitialized: boolean = false;

  constructor(serviceName: string = 'default') {
    this.serviceName = serviceName;
    this.googleSheetsService = new GoogleSheetsService();
  }

  public async initialize(): Promise<void> {
    if (!this.isInitialized) {
      try {
        await this.googleSheetsService.initialize();
        this.isInitialized = true;
        console.log(`SheetsLogger initialized for service: ${this.serviceName}`);
      } catch (error) {
        console.error(`Failed to initialize SheetsLogger: ${(error as Error).message}`);
      }
    }
  }

  private async log(level: LogLevel, message: string, ...args: any[]): Promise<void> {
    if (!this.isInitialized) {
      // Если логгер не инициализирован, только выводим в консоль
      console.log(`[${level}] ${format(message, ...args)}`);
      return;
    }

    try {
      const formattedMessage = args.length ? format(message, ...args) : message;
      const logMessage = `[${this.serviceName}] ${formattedMessage}`;
      await this.googleSheetsService.saveLog(level, logMessage);
    } catch (error) {
      // Если что-то пошло не так, выводим в консоль
      console.error(`Error logging to sheets: ${(error as Error).message}`);
      console.log(`[${level}] [${this.serviceName}] ${format(message, ...args)}`);
    }
  }

  public async info(message: string, ...args: any[]): Promise<void> {
    await this.log(LogLevel.INFO, message, ...args);
  }

  public async error(message: string, ...args: any[]): Promise<void> {
    await this.log(LogLevel.ERROR, message, ...args);
  }

  public async warn(message: string, ...args: any[]): Promise<void> {
    await this.log(LogLevel.WARN, message, ...args);
  }

  public async debug(message: string, ...args: any[]): Promise<void> {
    await this.log(LogLevel.DEBUG, message, ...args);
  }
}

// Создаем инстансы логгеров для разных частей приложения
export const apiSheetsLogger = new SheetsLogger('API');
export const transactionSheetsLogger = new SheetsLogger('Transactions');