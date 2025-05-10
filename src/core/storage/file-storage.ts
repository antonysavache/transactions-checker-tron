/**
 * Утилита для сохранения данных транзакций в файл
 */
import fs from 'fs';
import path from 'path';
import { IProcessedTransaction } from '../types';
import {apiLogger} from "@shared/utils/logger";

class TransactionStorage {
  private storagePath: string;
  
  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.join(process.cwd(), 'data', 'transactions');
    this.ensureDirectoryExists();
  }
  
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
      apiLogger.info('Created storage directory: %s', this.storagePath);
    }
  }
  
  public async saveTransactions(transactions: IProcessedTransaction[]): Promise<void> {
    if (!transactions || transactions.length === 0) {
      apiLogger.info('No transactions to save');
      return;
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `transactions_${timestamp}.json`;
      const filePath = path.join(this.storagePath, filename);
      
      fs.writeFileSync(filePath, JSON.stringify(transactions, null, 2));
      apiLogger.info('Saved %d transactions to %s', transactions.length, filePath);
    } catch (error) {
      apiLogger.error('Error saving transactions to file: %s', (error as Error).message);
      throw error;
    }
  }
  
  public getTransactions(filename: string): IProcessedTransaction[] {
    try {
      const filePath = path.join(this.storagePath, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filePath} does not exist`);
      }
      
      const rawData = fs.readFileSync(filePath, 'utf8');
      const transactions: IProcessedTransaction[] = JSON.parse(rawData);
      
      apiLogger.info('Loaded %d transactions from %s', transactions.length, filePath);
      return transactions;
    } catch (error) {
      apiLogger.error('Error loading transactions from file: %s', (error as Error).message);
      return [];
    }
  }
  
  public getTransactionFiles(): string[] {
    try {
      const files = fs.readdirSync(this.storagePath)
        .filter(file => file.startsWith('transactions_') && file.endsWith('.json'));
      
      apiLogger.info('Found %d transaction files', files.length);
      return files;
    } catch (error) {
      apiLogger.error('Error reading transaction files: %s', (error as Error).message);
      return [];
    }
  }
}

export const transactionStorage = new TransactionStorage();
