import axios from 'axios';
import TronWeb from 'tronweb';
import { ITronServiceConfig, ITransactionsResult } from '../../types';
import { apiLogger } from '../../utils/logger';

export class TronTransactionService {
  private apiUrl: string;
  private requestDelay: number;
  private maxRetries: number;
  private tronWeb: any;

  constructor(options: ITronServiceConfig = {}) {
    this.apiUrl = options.apiUrl || 'https://api.trongrid.io';
    this.requestDelay = options.requestDelay || 300;
    this.maxRetries = options.maxRetries || 3;
    
    this.tronWeb = new TronWeb({
      fullHost: this.apiUrl
    });
    
    apiLogger.info('TronTransactionService initialized with API URL: %s', this.apiUrl);
  }

  private async getTransactions(walletAddress: string, startTime: number, endTime: number): Promise<any[]> {
    try {
      apiLogger.info('Fetching transactions for wallet %s from %s to %s', 
        walletAddress, new Date(startTime).toISOString(), new Date(endTime).toISOString());
      
      if (!this.tronWeb.isAddress(walletAddress)) {
        const error = `Invalid TRON address: ${walletAddress}`;
        apiLogger.error(error);
        throw new Error(error);
      }

      apiLogger.debug('Fetching incoming TRC20 transactions for %s', walletAddress);
      const incomingTrc20Txs = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_to=true&min_timestamp=${startTime}&max_timestamp=${endTime}`
      );
      
      apiLogger.debug('Fetching outgoing TRC20 transactions for %s', walletAddress);
      const outgoingTrc20Txs = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_from=true&min_timestamp=${startTime}&max_timestamp=${endTime}`
      );

      apiLogger.debug('Fetching TRX transactions for %s', walletAddress);
      const normalTxs = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions?min_timestamp=${startTime}&max_timestamp=${endTime}`
      );

      const allTransactions = [
        ...(incomingTrc20Txs.data || []),
        ...(outgoingTrc20Txs.data || []),
        ...(normalTxs.data || [])
      ];

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
    apiLogger.info('Fetching transactions for %d wallets', walletAddresses.length);
    
    const results: ITransactionsResult = {};
    
    for (const walletAddress of walletAddresses) {
      try {
        if (Object.keys(results).length > 0) {
          apiLogger.debug('Adding delay of %dms before next request', this.requestDelay);
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
        
        const transactions = await this.getTransactions(walletAddress, startTime, endTime);
        results[walletAddress] = transactions;
        
        apiLogger.info('Successfully fetched %d transactions for %s', transactions.length, walletAddress);
      } catch (error) {
        apiLogger.error('Failed to fetch transactions for %s: %s', 
          walletAddress, (error as Error).message);
        results[walletAddress] = { error: (error as Error).message };
      }
    }
    
    return results;
  }

  private async _fetchTransactionsWithRetry(url: string, retryCount = 0): Promise<any> {
    try {
      apiLogger.debug('Making API request to %s', url);
      const response = await axios.get(url);
      apiLogger.debug('API request successful');
      return response.data;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * this.requestDelay;
        apiLogger.warn('API request failed, retrying after %dms (attempt %d/%d): %s', 
          delay, retryCount + 1, this.maxRetries, (error as Error).message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._fetchTransactionsWithRetry(url, retryCount + 1);
      } else {
        apiLogger.error('API request failed after %d attempts: %s', 
          this.maxRetries, (error as Error).message);
        throw new Error(`Failed after ${this.maxRetries} attempts: ${(error as Error).message}`);
      }
    }
  }
}