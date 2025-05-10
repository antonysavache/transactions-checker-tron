import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

interface LogEntry {
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  args: any[];
  timestamp: number;
  destination: 'api' | 'sheets' | 'both';
  network?: string;
}

@Injectable()
export class AsyncLoggerService implements OnModuleDestroy {
  private buffer: LogEntry[] = [];
  private isProcessing = false;
  private readonly logger = new Logger('AsyncLogger');
  private processInterval: NodeJS.Timeout;
  private shutdownPromise: Promise<void> | null = null;
  private resolveShutdown: (() => void) | null = null;

  constructor() {
    // Периодически обрабатываем буфер логов
    this.processInterval = setInterval(() => this.processBuffer(), 1000);
  }

  onModuleDestroy() {
    clearInterval(this.processInterval);
    // Создаем промис для ожидания завершения всех логов при остановке
    if (!this.shutdownPromise) {
      this.shutdownPromise = new Promise<void>(resolve => {
        this.resolveShutdown = resolve;
      });
      
      // Запускаем финальную обработку буфера
      this.processBuffer(true);
    }
    
    return this.shutdownPromise;
  }

  // Основные методы логирования
  info(message: string, ...args: any[]) {
    this.addToBuffer('info', 'api', message, args);
  }

  error(message: string, ...args: any[]) {
    this.addToBuffer('error', 'api', message, args);
  }

  warn(message: string, ...args: any[]) {
    this.addToBuffer('warn', 'api', message, args);
  }

  debug(message: string, ...args: any[]) {
    this.addToBuffer('debug', 'api', message, args);
  }

  // Методы для Google Sheets
  async sheetsInfo(message: string, ...args: any[]) {
    this.addToBuffer('info', 'sheets', message, args);
  }

  async sheetsError(message: string, ...args: any[]) {
    this.addToBuffer('error', 'sheets', message, args);
  }

  async sheetsWarn(message: string, ...args: any[]) {
    this.addToBuffer('warn', 'sheets', message, args);
  }

  // Методы для логирования в оба места
  async bothInfo(message: string, ...args: any[]) {
    this.addToBuffer('info', 'both', message, args);
  }

  async bothError(message: string, ...args: any[]) {
    this.addToBuffer('error', 'both', message, args);
  }

  async bothWarn(message: string, ...args: any[]) {
    this.addToBuffer('warn', 'both', message, args);
  }

  private addToBuffer(level: 'info' | 'error' | 'warn' | 'debug', destination: 'api' | 'sheets' | 'both', message: string, args: any[]) {
    // Извлекаем network из аргументов, если есть
    const network = args.find(arg => typeof arg === 'string' && (arg === 'ETH' || arg === 'TRON' || arg === 'MOCK'));
    
    this.buffer.push({
      level,
      message,
      args,
      timestamp: Date.now(),
      destination,
      network
    });
    
    // Если это критическая ошибка, обрабатываем буфер немедленно
    if (level === 'error') {
      this.processBuffer();
    }
  }

  private async processBuffer(isFinal = false) {
    if (this.isProcessing || this.buffer.length === 0) {
      if (isFinal && this.buffer.length === 0 && this.resolveShutdown) {
        this.resolveShutdown();
      }
      return;
    }

    this.isProcessing = true;
    
    // Берем до 100 записей из буфера
    const batch = this.buffer.splice(0, 100);
    
    try {
      // Группируем логи по назначению
      const apiLogs = batch.filter(log => log.destination === 'api' || log.destination === 'both');
      const sheetsLogs = batch.filter(log => log.destination === 'sheets' || log.destination === 'both');
      
      // Обрабатываем API логи
      if (apiLogs.length > 0) {
        for (const log of apiLogs) {
          this.processApiLog(log);
        }
      }
      
      // Обрабатываем Google Sheets логи
      if (sheetsLogs.length > 0) {
        await this.processSheetsLogs(sheetsLogs);
      }
    } catch (error: any) {
      // При ошибке возвращаем записи в буфер для повторной обработки
      this.logger.error(`Error processing log buffer: ${error.message}`);
      this.buffer.unshift(...batch);
    } finally {
      this.isProcessing = false;
      
      // Если это финальная обработка и буфер пуст, разрешаем промис завершения
      if (isFinal && this.buffer.length === 0 && this.resolveShutdown) {
        this.resolveShutdown();
      } else if (this.buffer.length > 0) {
        // Если остались записи, продолжаем обработку
        setImmediate(() => this.processBuffer(isFinal));
      }
    }
  }

  private processApiLog(log: LogEntry) {
    // Используем стандартный логгер NestJS
    const nestLogger = new Logger(log.network || 'API');
    
    switch (log.level) {
      case 'info':
        nestLogger.log(log.message, ...log.args);
        break;
      case 'error':
        nestLogger.error(log.message, ...log.args);
        break;
      case 'warn':
        nestLogger.warn(log.message, ...log.args);
        break;
      case 'debug':
        nestLogger.debug(log.message, ...log.args);
        break;
    }
  }

  private async processSheetsLogs(logs: LogEntry[]) {
    try {
      // Импортируем сервисы для Google Sheets
      const { apiSheetsLogger } = await import('../../sheets-logger');
      
      // Пакетная обработка логов
      for (const log of logs) {
        try {
          switch (log.level) {
            case 'info':
              await apiSheetsLogger.info(log.message, ...log.args);
              break;
            case 'error':
              await apiSheetsLogger.error(log.message, ...log.args);
              break;
            case 'warn':
              await apiSheetsLogger.warn(log.message, ...log.args);
              break;
            case 'debug':
              await apiSheetsLogger.debug(log.message, ...log.args);
              break;
          }
        } catch (e: any) {
          // Продолжаем обработку других логов
          this.logger.warn(`Failed to send log to Google Sheets: ${e.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`Error initializing sheets logger: ${e.message}`);
      throw e;
    }
  }
}
