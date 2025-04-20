import { format } from 'util';

enum LogLevel {
  INFO = 'INFO',
  ERROR = 'ERROR',
  WARN = 'WARN',
  DEBUG = 'DEBUG'
}

export class Logger {
  private logFile: string;

  constructor(logFile: string = 'app.log') {
    this.logFile = logFile;
    // Не создаем директорию для логов, так как она больше не нужна
  }

  private writeLog(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = args.length ? format(message, ...args) : message;
    
    // Только вывод в консоль, без записи в файл
    console.log(`[${timestamp}] [${level}] ${formattedMessage}`);
  }

  public info(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.INFO, message, ...args);
  }

  public error(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.ERROR, message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.WARN, message, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.DEBUG, message, ...args);
  }
}

export const apiLogger = new Logger('api.log');
export const transactionLogger = new Logger('transactions.log');