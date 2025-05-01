import axios from 'axios';
import { ethers } from 'ethers';
import { IEthServiceConfig, ITransactionsResult } from '../../types';
import { apiLogger } from '../../utils/logger';

export class EthTransactionService {
  private apiUrl: string;
  private apiKey: string;
  private requestDelay: number;
  private maxRetries: number;
  private provider: ethers.JsonRpcProvider | null;

  constructor(options: IEthServiceConfig = {}) {
    this.apiUrl = options.apiUrl || 'https://api.etherscan.io/api';
    this.apiKey = options.apiKey || '';
    this.requestDelay = options.requestDelay || 300;
    this.maxRetries = options.maxRetries || 3;
    
    try {
      // Для Etherscan API не требуется провайдер ethers.js
      this.provider = null;
      apiLogger.info('EthTransactionService initialized with API URL: %s', this.apiUrl);
    } catch (error) {
      apiLogger.error('Failed to initialize Ethereum provider: %s', (error as Error).message);
      this.provider = null;
    }
  }

  private async getTransactions(walletAddress: string, startTime: number, endTime: number): Promise<any[]> {
    try {
      apiLogger.info('Fetching ETH transactions for wallet %s from %s to %s', 
        walletAddress, new Date(startTime).toISOString(), new Date(endTime).toISOString());
      
      if (!ethers.isAddress(walletAddress)) {
        const error = `Invalid Ethereum address: ${walletAddress}`;
        apiLogger.error(error);
        throw new Error(error);
      }

      const currentTime = Date.now();
      // Etherscan API работает с блоками, но мы используем временные метки
      // Начальный блок 0 означает, что API вернет все транзакции
      const startBlock = 0;
      const endBlock = 999999999;
      
      // Получаем обычные транзакции ETH
      apiLogger.debug('Fetching normal ETH transactions for %s', walletAddress);
      const normalTxsUrl = `${this.apiUrl}?module=account&action=txlist&address=${walletAddress}&startblock=${startBlock}&endblock=${endBlock}&sort=desc&apikey=${this.apiKey}`;
      const normalTxs = await this._fetchTransactionsWithRetry(normalTxsUrl);

      // Получаем ERC20 транзакции
      apiLogger.debug('Fetching ERC20 token transactions for %s', walletAddress);
      const erc20TxsUrl = `${this.apiUrl}?module=account&action=tokentx&address=${walletAddress}&startblock=${startBlock}&endblock=${endBlock}&sort=desc&apikey=${this.apiKey}`;
      const erc20Txs = await this._fetchTransactionsWithRetry(erc20TxsUrl);

      // Собираем все транзакции
      let allTransactions: any[] = [];
      
      if (normalTxs && normalTxs.status === '1' && normalTxs.result) {
        // Фильтруем по времени
        const filteredNormalTxs = normalTxs.result.filter((tx: any) => {
          const txTimestamp = parseInt(tx.timeStamp) * 1000;
          return txTimestamp >= startTime && txTimestamp <= endTime;
        });
        
        apiLogger.debug('Found %d normal ETH transactions in time range', filteredNormalTxs.length);
        allTransactions = [...allTransactions, ...filteredNormalTxs];
      } else {
        apiLogger.debug('No normal ETH transactions found or error: %s', 
          normalTxs && normalTxs.message ? normalTxs.message : 'Unknown error');
      }
      
      if (erc20Txs && erc20Txs.status === '1' && erc20Txs.result) {
        // Фильтруем по времени
        const filteredErc20Txs = erc20Txs.result.filter((tx: any) => {
          const txTimestamp = parseInt(tx.timeStamp) * 1000;
          return txTimestamp >= startTime && txTimestamp <= endTime;
        });
        
        apiLogger.debug('Found %d ERC20 token transactions in time range', filteredErc20Txs.length);
        allTransactions = [...allTransactions, ...filteredErc20Txs];
      } else {
        apiLogger.debug('No ERC20 transactions found or error: %s', 
          erc20Txs && erc20Txs.message ? erc20Txs.message : 'Unknown error');
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
    apiLogger.info('Fetching ETH transactions for %d wallets', walletAddresses.length);
    
    const results: ITransactionsResult = {};
    
    for (const walletAddress of walletAddresses) {
      try {
        if (Object.keys(results).length > 0) {
          apiLogger.debug('Adding delay of %dms before next request', this.requestDelay);
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
        
        const transactions = await this.getTransactions(walletAddress, startTime, endTime);
        results[walletAddress] = transactions;
        
        apiLogger.info('Successfully fetched %d ETH transactions for %s', transactions.length, walletAddress);
      } catch (error) {
        apiLogger.error('Failed to fetch ETH transactions for %s: %s', 
          walletAddress, (error as Error).message);
        results[walletAddress] = { error: (error as Error).message };
      }
    }
    
    return results;
  }

  private async _fetchTransactionsWithRetry(url: string, retryCount = 0): Promise<any> {
    try {
      apiLogger.debug('Making ETH API request to %s', url);
      
      // Добавляем timeout к запросу, чтобы избежать зависания
      const response = await axios.get(url, { timeout: 30000 });
      
      apiLogger.debug('ETH API request successful');
      return response.data;
    } catch (error: any) {
      // Логируем ошибку и пытаемся повторить запрос
      const isTimeout = error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'));
      
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * this.requestDelay;
        apiLogger.warn('ETH API request failed (%s), retrying after %dms (attempt %d/%d): %s', 
          isTimeout ? 'timeout' : 'error',
          delay, retryCount + 1, this.maxRetries, (error as Error).message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._fetchTransactionsWithRetry(url, retryCount + 1);
      } else {
        apiLogger.error('ETH API request failed after %d attempts: %s', 
          this.maxRetries, (error as Error).message);
        throw new Error(`Failed after ${this.maxRetries} attempts: ${(error as Error).message}`);
      }
    }
  }
}