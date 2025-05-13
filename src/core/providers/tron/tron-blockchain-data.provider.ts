import { Injectable } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import axios from 'axios';
import TronWeb from 'tronweb';
import { IBlockchainDataProvider } from '@shared/models/blockchain-data-provider.interface';
import { CompleteTransaction } from '@shared/models/transaction.interface';

/**
 * Конфигурация для сервиса TRON
 */
export interface ITronServiceConfig {
  apiUrl?: string;
  requestDelay?: number;
  maxRetries?: number;
}

/**
 * Результат получения транзакций
 */
interface ITransactionsResult {
  [walletAddress: string]: any[] | { error: string };
}

/**
 * Провайдер данных для блокчейна TRON
 */
@Injectable()
export class TronBlockchainDataProvider implements IBlockchainDataProvider {
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
    
    console.log('TronBlockchainDataProvider initialized with API URL:', this.apiUrl);
  }

  /**
   * Получает транзакции для списка кошельков
   * @param wallets Массив адресов кошельков
   * @returns Observable с транзакциями
   */
  fetch(wallets: string[], intervalHours: number = 24): Observable<CompleteTransaction[]> {
    if (!wallets || wallets.length === 0) {
      console.log('TronBlockchainDataProvider: No wallets provided');
      return from([]);
    }

    console.log(`TronBlockchainDataProvider: Fetching transactions for ${wallets.length} wallets (looking back ${intervalHours} hours)`);
    
    // Получаем текущее время в миллисекундах
    const endTime = Date.now();
    // Получаем время intervalHours часов назад
    const startTime = endTime - intervalHours * 60 * 60 * 1000;
    
    console.log(`TronBlockchainDataProvider: Time range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
    
    // Получаем транзакции для кошельков
    return from(this.getTransactionsForWallets(wallets, startTime, endTime)).pipe(
      map(results => this.processTransactionsResults(results)),
      catchError(error => {
        console.error('Error in TronBlockchainDataProvider:', error);
        return from([]);
      })
    );
  }

  /**
   * Обрабатывает результаты запроса транзакций
   */
  private processTransactionsResults(results: ITransactionsResult): CompleteTransaction[] {
    const transactions: CompleteTransaction[] = [];
    
    // Обрабатываем результаты для каждого кошелька
    for (const [walletAddress, walletTransactions] of Object.entries(results)) {
      // Пропускаем кошельки с ошибками
      if ('error' in walletTransactions) {
        continue;
      }
      
      // Обрабатываем транзакции
      for (const tx of walletTransactions) {
        try {
          const txHash = tx.txID || tx.transaction_id;
          if (!txHash) {
            console.error('Transaction hash not found:', tx);
            continue;
          }
          
          // Получаем комиссию, если она доступна
          let feeAmount = 0;
          if (tx.net_fee) {
            try {
              feeAmount = parseFloat(tx.net_fee) / 1000000; // Конвертируем SUN в TRX
              if (isNaN(feeAmount)) feeAmount = 0;
            } catch (e) {
              console.error('Error converting TRX fee to number:', e);
            }
          }
          
          // Обрабатываем различные типы транзакций (TRC20 и обычные TRX)
          if (tx.token_info) {
            // Это TRC20 транзакция
            const transaction = this.processTrc20Transaction(tx, walletAddress);
            
            // Если сумма перевода 0, но есть комиссия, и это исходящая транзакция
            if (transaction.amount <= 0 && feeAmount > 0 && tx.from && tx.from.toLowerCase() === walletAddress.toLowerCase()) {
              // Создаем только одну транзакцию для комиссии, используя исходный хеш
              const feeOnlyTransaction: CompleteTransaction = {
                data: transaction.data,
                walletSender: transaction.walletSender,
                walletReceiver: transaction.walletReceiver || 'contract_interaction',
                hash: transaction.hash, // Используем тот же хеш, без суффикса -fee
                amount: feeAmount,
                currency: 'TRX_FEE'
              };
              
              transactions.push(feeOnlyTransaction);
            } else {
              // Иначе добавляем обычную транзакцию
              transactions.push(transaction);
              
              // И отдельную транзакцию для комиссии, если это исходящая транзакция и комиссия > 0
              if (tx.from && tx.from.toLowerCase() === walletAddress.toLowerCase() && feeAmount > 0) {
                const feeTransaction: CompleteTransaction = {
                  data: transaction.data,
                  walletSender: transaction.walletSender,
                  walletReceiver: transaction.walletReceiver,
                  hash: txHash, // Используем тот же хеш
                  amount: feeAmount,
                  currency: 'TRX_FEE' // Специальная валюта для комиссии
                };
                
                transactions.push(feeTransaction);
              }
            }
          } else if (tx.raw_data && tx.raw_data.contract) {
            // Это обычная TRX транзакция
            const transaction = this.processTrxTransaction(tx, walletAddress);
            if (transaction) {
              // Если сумма перевода 0, но есть комиссия, и это исходящая транзакция
              if (transaction.amount <= 0 && feeAmount > 0 && 
                  transaction.walletSender.toLowerCase() === walletAddress.toLowerCase()) {
                // Создаем только одну транзакцию для комиссии, используя исходный хеш
                const feeOnlyTransaction: CompleteTransaction = {
                  data: transaction.data,
                  walletSender: transaction.walletSender,
                  walletReceiver: transaction.walletReceiver || 'contract_interaction',
                  hash: transaction.hash, // Используем тот же хеш, без суффикса -fee
                  amount: feeAmount,
                  currency: 'TRX_FEE'
                };
                
                transactions.push(feeOnlyTransaction);
              } else {
                // Иначе добавляем обычную транзакцию
                transactions.push(transaction);
                
                // И отдельную транзакцию для комиссии, если это исходящая транзакция и комиссия > 0
                if (transaction.walletSender.toLowerCase() === walletAddress.toLowerCase() && feeAmount > 0) {
                  const feeTransaction: CompleteTransaction = {
                    data: transaction.data,
                    walletSender: transaction.walletSender,
                    walletReceiver: transaction.walletReceiver,
                    hash: txHash, // Используем тот же хеш
                    amount: feeAmount,
                    currency: 'TRX_FEE' // Специальная валюта для комиссии
                  };
                  
                  transactions.push(feeTransaction);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing transaction:', error);
        }
      }
    }
    
    console.log(`TronBlockchainDataProvider: Processed ${transactions.length} transactions`);
    return transactions;
  }

  /**
   * Обрабатывает TRC20 транзакцию
   */
  private processTrc20Transaction(tx: any, walletAddress: string): CompleteTransaction {
    const isSender = tx.from === walletAddress;
    const timestamp = tx.block_timestamp;
    const date = new Date(timestamp);
    const formattedDate = this.formatDate(date);
    
    // Получаем количество токенов с учетом десятичных знаков
    let amount = 0;
    try {
      amount = parseFloat(tx.value);
      if (tx.token_info && tx.token_info.decimals) {
        amount = amount / Math.pow(10, tx.token_info.decimals);
      }
      // Убедимся, что amount является числом
      if (isNaN(amount)) amount = 0;
    } catch (e) {
      console.error('Error converting amount to number:', e);
      amount = 0;
    }
    
    return {
      data: formattedDate,
      walletSender: tx.from,
      walletReceiver: tx.to,
      hash: tx.transaction_id,
      amount: amount,
      currency: tx.token_info?.symbol || 'TRC20'
    };
  }

  /**
   * Обрабатывает обычную TRX транзакцию
   */
  private processTrxTransaction(tx: any, walletAddress: string): CompleteTransaction | null {
    try {
      // Проверяем, что это транзакция TRX перевода
      if (!tx.raw_data?.contract?.[0]?.parameter?.value) {
        return null;
      }
      
      const contractValue = tx.raw_data.contract[0].parameter.value;
      const timestamp = tx.raw_data.timestamp;
      const date = new Date(timestamp);
      const formattedDate = this.formatDate(date);
      
      // Проверяем тип контракта
      if (tx.raw_data.contract[0].type !== 'TransferContract') {
        return null;
      }
      
      // Получаем адреса отправителя и получателя
      const fromAddress = this.tronWeb.address.fromHex(contractValue.owner_address);
      const toAddress = this.tronWeb.address.fromHex(contractValue.to_address);
      
      // Получаем сумму (в TRX)
      let amount = 0;
      try {
        amount = parseFloat(contractValue.amount) / 1000000; // Конвертируем из Sun в TRX
        if (isNaN(amount)) amount = 0;
      } catch (e) {
        console.error('Error converting TRX amount to number:', e);
        amount = 0;
      }
      
      return {
        data: formattedDate,
        walletSender: fromAddress,
        walletReceiver: toAddress,
        hash: tx.txID,
        amount: amount,
        currency: 'TRX'
      };
    } catch (error) {
      console.error('Error processing TRX transaction:', error);
      return null;
    }
  }

  /**
   * Получает транзакции для указанного кошелька
   */
  private async getTransactions(walletAddress: string, startTime: number, endTime: number): Promise<any[]> {
    try {
      console.log(`Fetching transactions for wallet ${walletAddress} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
      
      if (!this.tronWeb.isAddress(walletAddress)) {
        const error = `Invalid TRON address: ${walletAddress}`;
        console.error(error);
        throw new Error(error);
      }

      console.log(`Fetching incoming TRC20 transactions for ${walletAddress}`);
      const incomingTrc20Txs = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_to=true&min_timestamp=${startTime}&max_timestamp=${endTime}`
      );
      
      console.log(`Fetching outgoing TRC20 transactions for ${walletAddress}`);
      const outgoingTrc20Txs = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_from=true&min_timestamp=${startTime}&max_timestamp=${endTime}`
      );

      const normalTxs = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions?min_timestamp=${startTime}&max_timestamp=${endTime}`
      );

      const allTransactions = [
        ...(incomingTrc20Txs.data.filter((tx: any) => tx.type === 'Transfer') || []),
        ...(outgoingTrc20Txs.data.filter((tx: any) => tx.type === 'Transfer') || []),
        ...(normalTxs.data || [])
      ];

      console.log(`Successfully fetched ${allTransactions.length} total transactions for wallet ${walletAddress}`);
      
      return allTransactions;
    } catch (error) {
      console.error(`Error fetching transactions for wallet ${walletAddress}:`, error);
      throw error;
    }
  }

  /**
   * Получает транзакции для списка кошельков
   */
  public async getTransactionsForWallets(
    walletAddresses: string[], 
    startTime: number, 
    endTime: number
  ): Promise<ITransactionsResult> {
    console.log(`Fetching transactions for ${walletAddresses.length} wallets`);
    
    const results: ITransactionsResult = {};
    
    for (const walletAddress of walletAddresses) {
      try {
        if (Object.keys(results).length > 0) {
          console.log(`Adding delay of ${this.requestDelay}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
        
        const transactions = await this.getTransactions(walletAddress, startTime, endTime);
        results[walletAddress] = transactions;
        
        console.log(`Successfully fetched ${transactions.length} transactions for ${walletAddress}`);
      } catch (error) {
        console.error(`Failed to fetch transactions for ${walletAddress}:`, error);
        results[walletAddress] = { error: (error as Error).message };
      }
    }
    
    return results;
  }

  /**
   * Выполняет HTTP-запрос с повторными попытками
   */
  private async _fetchTransactionsWithRetry(url: string, retryCount = 0): Promise<any> {
    try {
      console.log(`Making API request to ${url}`);
      
      // Добавляем timeout к запросу, чтобы избежать зависания
      const response = await axios.get(url, { timeout: 30000 });
      
      console.log('API request successful');
      return response.data;
    } catch (error: any) {
      // Логируем ошибку и пытаемся повторить запрос
      const isTimeout = error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'));
      
      if (retryCount < this.maxRetries) {
        const delay = Math.pow(2, retryCount) * this.requestDelay;
        console.warn(`API request failed (${isTimeout ? 'timeout' : 'error'}), retrying after ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries}):`, error.message);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._fetchTransactionsWithRetry(url, retryCount + 1);
      } else {
        console.error(`API request failed after ${this.maxRetries} attempts:`, error.message);
        throw new Error(`Failed after ${this.maxRetries} attempts: ${error.message}`);
      }
    }
  }

  /**
   * Форматирует дату в строку с явным текстовым форматированием для Google Sheets
   */
  private formatDate(date: Date): string {
    const pad = (num: number) => num.toString().padStart(2, '0');
    
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    
    // Используем апостроф в начале, чтобы Google Sheets точно распознал как текст
    return `'${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}