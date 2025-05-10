/**
 * Основные логгеры для приложения
 */
import { Logger } from '@nestjs/common';

// Создаем класс-обертку для совместимости со старым API
class CompatLogger extends Logger {
  constructor(context: string) {
    super(context);
  }

  info(message: string, ...args: any[]): void {
    this.log(message, ...args);
  }

  error(message: string, ...args: any[]): void {
    super.error(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    super.warn(message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    super.debug(message, ...args);
  }
}

// Логгер для API и основных операций
export const apiLogger = new CompatLogger('API');

// Логгер для транзакций
export const transactionLogger = new CompatLogger('Transactions');
