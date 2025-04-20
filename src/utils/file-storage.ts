import fs from 'fs';
import path from 'path';
import { IProcessedTransaction } from '../types';
import { transactionLogger } from './logger';

export class FileStorage {
  private resultsFile: string;
  private isProduction: boolean;

  constructor(fileName: string = 'transactions.txt') {
    this.resultsFile = path.resolve(process.cwd(), fileName);
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  public saveTransactions(transactions: IProcessedTransaction[]): void {
    if (!transactions || transactions.length === 0) {
      transactionLogger.info('No transactions to save to file');
      return;
    }

    try {
      const formattedTransactions = transactions.map(tx => {
        return `[${tx.date}] ${tx.fromAddress} -> ${tx.toAddress} | ${tx.amount} ${tx.ticker} | TxID: ${tx.id}`;
      });

      const timestamp = new Date().toISOString();
      const header = `\n===== Transactions detected at ${timestamp} =====\n`;
      
      const content = header + formattedTransactions.join('\n') + '\n';
      
      // В production среде (Railway) только логируем
      if (this.isProduction) {
        transactionLogger.info('Successfully processed %d transactions (not saving to file in production)', transactions.length);
        // Можно вывести несколько транзакций для информации
        if (transactions.length > 0) {
          transactionLogger.info('Sample transaction: %s -> %s | %s %s', 
            transactions[0].fromAddress, 
            transactions[0].toAddress,
            transactions[0].amount,
            transactions[0].ticker);
        }
      } else {
        // В dev среде пишем в файл
        fs.appendFileSync(this.resultsFile, content);
        transactionLogger.info('Successfully saved %d transactions to %s', transactions.length, this.resultsFile);
      }
    } catch (error) {
      transactionLogger.error('Error saving transactions to file: %s', (error as Error).message);
      throw error;
    }
  }
}

export const transactionStorage = new FileStorage();