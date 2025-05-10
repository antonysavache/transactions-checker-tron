/**
 * Сервис для работы с транзакциями TRON
 */
import axios from 'axios';
import TronWeb from 'tronweb';
import { ITransactionsResult } from '../../core/types';
import { ITronServiceConfig } from '../types';
import { apiLogger } from '../../shared/utils/logger';

export class TronTransactionService {
  private apiUrl: string;
  private requestDelay: number;
  private maxRetries: number;
  private tronWeb: any;

  constructor(options: ITronServiceConfig = {}) {
    this.apiUrl = options.apiUrl || 'https://api.trongrid.io';
    this.requestDelay = options.requestDelay || 300;
    this.maxRetries = options.maxRetries || 3;
    
    try {
      // Инициализация TronWeb
      const fullNode = this.apiUrl;
      const solidityNode = this.apiUrl;
      const eventServer = this.apiUrl;
      
      this.tronWeb = new TronWeb({
        fullHost: fullNode,
        solidityNode: solidityNode,
        eventServer: eventServer
      });
      
      apiLogger.info('TronTransactionService initialized with API URL: %s', this.apiUrl);
    } catch (error) {
      apiLogger.error('Failed to initialize TRON provider: %s', (error as Error).message);
      throw error;
    }
  }

  private async getTransactions(walletAddress: string, startTime: number, endTime: number): Promise<any[]> {
    try {
      apiLogger.info('Fetching TRON transactions for wallet %s from %s to %s', 
        walletAddress, new Date(startTime).toISOString(), new Date(endTime).toISOString());
      
      // Проверка валидности TRON-адреса
      if (!walletAddress.startsWith('T') || walletAddress.length !== 34) {
        const error = `Invalid TRON address: ${walletAddress}`;
        apiLogger.error(error);
        throw new Error(error);
      }
      
      // Получаем TRX транзакции
      apiLogger.debug('Fetching TRX transactions for %s', walletAddress);
      const trxTransactions = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions`
      );
      
      // Получаем TRC20 транзакции
      apiLogger.debug('Fetching TRC20 token transactions for %s', walletAddress);
      const trc20Transactions = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions/trc20`
      );
      
      // Собираем все транзакции
      let allTransactions: any[] = [];
      
      if (trxTransactions && trxTransactions.success && trxTransactions.data) {
        // Фильтруем по времени
        const filteredTrxTxs = trxTransactions.data.filter((tx: any) => {
          const txTimestamp = tx.block_timestamp;
          return txTimestamp >= startTime && txTimestamp <= endTime;
        });
        
        apiLogger.debug('Found %d TRX transactions in time range', filteredTrxTxs.length);
        allTransactions = [...allTransactions, ...filteredTrxTxs];
      } else {
        apiLogger.debug('No TRX transactions found or error: %s', 
          trxTransactions && trxTransactions.error ? trxTransactions.error : 'Unknown error');
      }
      
      if (trc20Transactions && trc20Transactions.success && trc20Transactions.data) {
        // Фильтруем по времени
        const filteredTrc20Txs = trc20Transactions.data.filter((tx: any) => {
          const txTimestamp = tx.block_timestamp;
          return txTimestamp >= startTime && txTimestamp <= endTime;
        });
        
        apiLogger.debug('Found %d TRC20 token transactions in time range', filteredTrc20Txs.length);
        allTransactions = [...allTransactions, ...filteredTrc20Txs];
      } else {
        apiLogger.debug('No TRC20 transactions found or error: %s', 
          trc20Transactions && trc20Transactions.error ? trc20Transactions.error : 'Unknown error');
      }
      
      apiLogger.info('Successfully fetched %d total transactions for wallet %s', 
        allTransactions.length, walletAddress);
      
      return allTransactions;
    } catch (error) {
      apiLogger.error('Error fetching transactions for wallet %s: %s', 
        walletAddress, (error as Error).message);
      throw error;
    }
  }

  public async getTransactionsForWallets(
    walletAddresses: string[], 
    startTime: number, 
    endTime: number
  ): Promise<ITransactionsResult> {
    apiLogger.info('Fetching TRON transactions for %d wallets', walletAddresses.length);
    
    const results: ITransactionsResult = {};
    
    for (const walletAddress of walletAddresses) {
      try {
        if (Object.keys(results).length > 0) {
          apiLogger.debug('Adding delay of %dms before next request', this.requestDelay);
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
        
        const transactions = await this.getTransactions(walletAddress, startTime, endTime);
        results[walletAddress] = transactions;
        
        apiLogger.info('Successfully fetched %d TRON transactions for %s', transactions.length, walletAddress);
      } catch (error) {
        apiLogger.error('Failed to fetch TRON transactions for %s: %s', 
          walletAddress, (error as Error).message);
        results[walletAddress] = { error: (error as Error).message };
      }
    }
    
    return results;
  }

  private async _fetchTransactionsWithRetry(url: string, retryCount = 0): Promise<any> {
    try {
      apiLogger.debug('Making TRON API request to %s', url);
      
      // Добавляем timeout к запросу, чтобы избежать зависания
      const response = await axios.get(url, { timeout: 30000 });
      
      apiLogger.debug('TRON API request successful');
      return response.data;
    } catch (error: any) {
      // Логируем ошибку и пытаемся повторить запрос
      const isTimeout = error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'));
      
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * this.requestDelay;
        apiLogger.warn('TRON API request failed (%s), retrying after %dms (attempt %d/%d): %s', 
          isTimeout ? 'timeout' : 'error',
          delay, retryCount + 1, this.maxRetries, (error as Error).message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._fetchTransactionsWithRetry(url, retryCount + 1);
      } else {
        apiLogger.error('TRON API request failed after %d attempts: %s', 
          this.maxRetries, (error as Error).message);
        throw new Error(`Failed after ${this.maxRetries} attempts: ${(error as Error).message}`);
      }
    }
  }
}
