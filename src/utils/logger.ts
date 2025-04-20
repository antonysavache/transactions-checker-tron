import fs from 'fs';
import path from 'path';
import { format } from 'util';

enum LogLevel {
  INFO = 'INFO',
  ERROR = 'ERROR',
  WARN = 'WARN',
  DEBUG = 'DEBUG'
}

export class Logger {
  private logDir: string;
  private logFile: string;
  private isProduction: boolean;

  constructor(logFile: string = 'app.log') {
    this.logDir = path.resolve(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, logFile);
    this.isProduction = process.env.NODE_ENV === 'production';
    
    if (!this.isProduction) {
      this.ensureLogDir();
    }
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeLog(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = args.length ? format(message, ...args) : message;
    const logEntry = `[${timestamp}] [${level}] ${formattedMessage}\n`;
    
    // В production среде (Railway) записываем только в консоль
    if (this.isProduction) {
      console.log(`[${level}] ${formattedMessage}`);
    } else {
      // В dev среде пишем и в файл, и в консоль
      fs.appendFileSync(this.logFile, logEntry);
      console.log(`[${level}] ${formattedMessage}`);
    }
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