import { Injectable, Inject, Optional } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { ILogger } from '../interfaces/logger.interface';

export enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

@Injectable()
export class LoggingService implements ILogger {
  private readonly logSheet = 'logs';
  private sheetsService: GoogleSheetsService | null = null;

  constructor(@Optional() googleSheetsService?: GoogleSheetsService) {
    this.sheetsService = googleSheetsService || null;
  }

  /**
   * Записывает лог в Google Sheets и консоль
   * @param message Сообщение лога
   * @param level Уровень логирования
   * @param source Источник лога (сервис или компонент)
   */
  log(message: string, level: LogLevel = LogLevel.INFO, source: string = ''): void {
    // Создаем строку для логирования
    const logRow = [
      // Текущая дата и время в формате ISO
      `'${new Date().toISOString()}`,
      // Уровень логирования
      level,
      // Источник лога
      source,
      // Сообщение
      message
    ];

    // Логируем в консоль для удобства отладки
    switch(level) {
      case LogLevel.INFO:
        console.log(`[${level}] ${source ? `[${source}] ` : ''}${message}`);
        break;
      case LogLevel.WARNING:
        console.warn(`[${level}] ${source ? `[${source}] ` : ''}${message}`);
        break;
      case LogLevel.ERROR:
        console.error(`[${level}] ${source ? `[${source}] ` : ''}${message}`);
        break;
      case LogLevel.DEBUG:
        console.debug(`[${level}] ${source ? `[${source}] ` : ''}${message}`);
        break;
    }

    // Записываем в Google Sheets, если сервис доступен
    if (this.sheetsService) {
      this.sheetsService.appendRow(this.logSheet, logRow)
        .subscribe({
          next: () => {
            // Успешно записано, но не логируем это, чтобы избежать рекурсии
            if (level === LogLevel.DEBUG) {
              console.debug(`Log written to Google Sheets: ${message}`);
            }
          },
          error: err => {
            // В случае ошибки записи, логируем только в консоль
            console.error(`Failed to write log to Google Sheets: ${err.message}`);
          }
        });
    }
  }

  /**
   * Записывает информационный лог
   */
  info(message: string, source: string = ''): void {
    this.log(message, LogLevel.INFO, source);
  }

  /**
   * Записывает предупреждение
   */
  warn(message: string, source: string = ''): void {
    this.log(message, LogLevel.WARNING, source);
  }

  /**
   * Записывает ошибку
   */
  error(message: string, source: string = ''): void {
    this.log(message, LogLevel.ERROR, source);
  }

  /**
   * Записывает отладочную информацию
   */
  debug(message: string, source: string = ''): void {
    this.log(message, LogLevel.DEBUG, source);
  }
}