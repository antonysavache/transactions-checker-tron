import { IProcessedTransaction } from '../types';
import { transactionLogger } from './logger';
import { transactionSheetsLogger } from './sheets-logger';

export class FileStorage {
  constructor() {
    // Пустой конструктор, так как файлы не используются
  }

  public async saveTransactions(transactions: IProcessedTransaction[]): Promise<void> {
    if (!transactions || transactions.length === 0) {
      transactionLogger.info('No transactions to save');
      return;
    }

    try {
      // Только логируем информацию о транзакциях
      transactionLogger.info('Successfully processed %d transactions', transactions.length);
      
      // Логируем несколько транзакций для информации
      if (transactions.length > 0) {
        transactionLogger.info('Sample transaction: %s -> %s | %s %s', 
          transactions[0].fromAddress, 
          transactions[0].toAddress,
          transactions[0].amount,
          transactions[0].ticker);
        
        // Логируем в Google Sheets - добавляем обработку ошибок
        try {
          await transactionSheetsLogger.info('Processed %d transactions', transactions.length);
        } catch (sheetError) {
          // Если не удалось записать в Google Sheets, продолжаем работу
          console.error(`Failed to log to Google Sheets: ${(sheetError as Error).message}`);
        }
      }
    } catch (error) {
      transactionLogger.error('Error processing transactions: %s', (error as Error).message);
      // Не используем await, чтобы не прерывать работу при ошибке логирования
      transactionSheetsLogger.error('Error processing transactions: %s', (error as Error).message)
        .catch(logError => console.error(`Failed to log error to Google Sheets: ${logError.message}`));
    }
  }
}

export const transactionStorage = new FileStorage();