import { Injectable } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import axios from 'axios';
import { ethers } from 'ethers';
import { IBlockchainDataProvider } from '@shared/models/blockchain-data-provider.interface';
import { CompleteTransaction } from '@shared/models/transaction.interface';
import { IEthServiceConfig, ITransactionsResult } from './ethereum.types';

/**
 * Провайдер данных для блокчейна Ethereum
 */
@Injectable()
export class EthereumBlockchainDataProvider implements IBlockchainDataProvider {
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
      console.log('EthereumBlockchainDataProvider initialized with API URL:', this.apiUrl);
    } catch (error) {
      console.error('Failed to initialize Ethereum provider:', (error as Error).message);
      this.provider = null;
    }
  }

  /**
   * Получает транзакции для списка кошельков
   * @param wallets Массив адресов кошельков
   * @param intervalHours Интервал в часах, за который нужно получить транзакции
   * @returns Observable с транзакциями
   */
  fetch(wallets: string[], intervalHours: number = 24): Observable<CompleteTransaction[]> {
    if (!wallets || wallets.length === 0) {
      console.log('EthereumBlockchainDataProvider: No wallets provided');
      return from([]);
    }

    console.log(`EthereumBlockchainDataProvider: Fetching transactions for ${wallets.length} wallets (looking back ${intervalHours} hours)`);
    
    // Получаем текущее время в миллисекундах
    const endTime = Date.now();
    // Получаем время intervalHours часов назад
    const startTime = endTime - intervalHours * 60 * 60 * 1000;
    
    console.log(`EthereumBlockchainDataProvider: Time range: ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
    
    // Получаем транзакции для кошельков
    return from(this.getTransactionsForWallets(wallets, startTime, endTime)).pipe(
      map(results => this.processTransactionsResults(results)),
      catchError(error => {
        console.error('Error in EthereumBlockchainDataProvider:', error);
        return from([]);
      })
    );
  }

  /**
   * Получает информацию о конкретной транзакции по хешу
   * @param txHash Хеш транзакции
   * @returns Observable с информацией о транзакции
   */
  getTransactionByHash(txHash: string): Observable<any> {
    if (!txHash) {
      console.error('EthereumBlockchainDataProvider: No transaction hash provided');
      // @ts-ignore
      return from({ error: 'No transaction hash provided' });
    }

    console.log(`EthereumBlockchainDataProvider: Fetching transaction ${txHash}`);
    
    // Делаем запрос к Etherscan API
    const url = `${this.apiUrl}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${this.apiKey}`;
    
    return from(this._fetchTransactionsWithRetry(url)).pipe(
      map(result => {
        if (result && result.result) {
          // Форматируем результат
          const tx = result.result;
          return {
            hash: tx.hash,
            blockNumber: parseInt(tx.blockNumber, 16),
            from: tx.from,
            to: tx.to,
            value: parseInt(tx.value, 16) / 1e18, // Wei в ETH
            gasPrice: parseInt(tx.gasPrice, 16) / 1e9, // Wei в Gwei
            gas: parseInt(tx.gas, 16),
            input: tx.input,
            raw: tx
          };
        } else {
          console.error('Error fetching transaction:', result?.message || 'No data returned');
          return { error: result?.message || 'No data returned' };
        }
      }),
      catchError(error => {
        console.error('Error in getTransactionByHash:', error);
        // @ts-ignore
        return from({ error: error.message });
      })
    );
  }

  /**
   * Получает дополнительную информацию о транзакции (receipt) по хешу
   * @param txHash Хеш транзакции
   * @returns Observable с информацией о транзакции
   */
  getTransactionReceiptByHash(txHash: string): Observable<any> {
    if (!txHash) {
      console.error('EthereumBlockchainDataProvider: No transaction hash provided');
      // @ts-ignore
      return from({ error: 'No transaction hash provided' });
    }

    console.log(`EthereumBlockchainDataProvider: Fetching transaction receipt ${txHash}`);
    
    // Делаем запрос к Etherscan API
    const url = `${this.apiUrl}?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}&apikey=${this.apiKey}`;
    
    return from(this._fetchTransactionsWithRetry(url)).pipe(
      map(result => {
        if (result && result.result) {
          // Форматируем результат
          const receipt = result.result;
          return {
            blockNumber: parseInt(receipt.blockNumber, 16),
            gasUsed: parseInt(receipt.gasUsed, 16),
            cumulativeGasUsed: parseInt(receipt.cumulativeGasUsed, 16),
            status: receipt.status === '0x1' ? 'Success' : 'Failed',
            logs: receipt.logs,
            raw: receipt
          };
        } else {
          console.error('Error fetching transaction receipt:', result?.message || 'No data returned');
          return { error: result?.message || 'No data returned' };
        }
      }),
      catchError(error => {
        console.error('Error in getTransactionReceiptByHash:', error);
        // @ts-ignore
        return from({ error: error.message });
      })
    );
  }

  /**
   * Получает полную информацию о транзакции (транзакция + receipt) по хешу
   * @param txHash Хеш транзакции
   * @returns Observable с полной информацией о транзакции
   */
  getFullTransactionInfo(txHash: string): Observable<any> {
    return this.getTransactionByHash(txHash).pipe(
      switchMap(txInfo => {
        if (txInfo.error) {
          return from(txInfo);
        }
        
        return this.getTransactionReceiptByHash(txHash).pipe(
          map(receiptInfo => {
            if (receiptInfo.error) {
              return { ...txInfo, receiptError: receiptInfo.error };
            }
            
            // Вычисляем fee (gasUsed * gasPrice)
            const gasUsed = receiptInfo.gasUsed;
            const gasPrice = txInfo.gasPrice * 1e9; // Gwei в Wei
            const fee = (gasUsed * gasPrice) / 1e18; // Wei в ETH
            
            return {
              ...txInfo,
              receipt: receiptInfo,
              success: receiptInfo.status === 'Success',
              fee: fee
            };
          })
        );
      })
    );
  }

  /**
   * Обрабатывает результаты запроса транзакций
   */
  private processTransactionsResults(results: ITransactionsResult): CompleteTransaction[] {
    const transactions: CompleteTransaction[] = [];
    const processedHashes = new Set<string>(); // Для отслеживания обработанных хешей
    
    // Обрабатываем результаты для каждого кошелька
    for (const [walletAddress, walletTransactions] of Object.entries(results)) {
      // Пропускаем кошельки с ошибками
      if ('error' in walletTransactions) {
        continue;
      }
      
      // Обрабатываем транзакции
      for (const tx of walletTransactions) {
        try {
          // Создаем уникальный идентификатор для транзакции, включая тип и хеш
          const txType = tx.tokenSymbol ? 'ERC20' : 'ETH';
          const txKey = `${tx.hash}-${txType}`;
          
          // Проверяем, была ли эта транзакция уже обработана
          if (processedHashes.has(txKey)) {
            continue;
          }
          
          // Отмечаем транзакцию как обработанную
          processedHashes.add(txKey);
          
          // Получаем основную транзакцию
          if (tx.tokenSymbol) {
            // Это ERC20 транзакция
            const transaction = this.processErc20Transaction(tx, walletAddress);
            transactions.push(transaction);
          } else {
            // Это обычная ETH транзакция
            const timestamp = parseInt(tx.timeStamp) * 1000;
            const date = new Date(timestamp);
            const formattedDate = this.formatDate(date);
            
            // Вычисляем сумму перевода (в ETH)
            let transferAmount = 0;
            try {
              transferAmount = parseFloat(tx.value) / 1e18; // Конвертируем wei в ETH
              if (isNaN(transferAmount)) transferAmount = 0;
            } catch (e) {
              console.error('Error converting ETH amount to number:', e);
            }
            
            // Вычисляем комиссию, если это исходящая транзакция
            let feeAmount = 0;
            if (tx.from.toLowerCase() === walletAddress.toLowerCase() && tx.gasPrice && tx.gasUsed) {
              try {
                feeAmount = parseFloat(tx.gasPrice) * parseFloat(tx.gasUsed) / 1e18; // Конвертируем wei в ETH
                if (isNaN(feeAmount)) feeAmount = 0;
              } catch (e) {
                console.error('Error calculating ETH fee:', e);
              }
            }
            
            // Если есть сумма перевода, используем её
            if (transferAmount > 0) {
              const transaction: CompleteTransaction = {
                data: formattedDate,
                walletSender: tx.from,
                walletReceiver: tx.to || 'contract_interaction',
                hash: tx.hash,
                amount: transferAmount,
                currency: 'ETH'
              };
              transactions.push(transaction);
            }
            // Если это исходящая транзакция и есть комиссия, добавляем транзакцию с комиссией
            else if (tx.from.toLowerCase() === walletAddress.toLowerCase() && feeAmount > 0) {
              const feeTransaction: CompleteTransaction = {
                data: formattedDate,
                walletSender: tx.from,
                walletReceiver: tx.to || 'contract_interaction',
                hash: tx.hash,
                amount: feeAmount,
                currency: 'ETH_FEE'
              };
              transactions.push(feeTransaction);
            }
          }
        } catch (error) {
          console.error('Error processing transaction:', error);
        }
      }
    }
    
    console.log(`EthereumBlockchainDataProvider: Processed ${transactions.length} transactions`);
    return transactions;
  }

  /**
   * Обрабатывает ERC20 транзакцию
   */
  private processErc20Transaction(tx: any, walletAddress: string): CompleteTransaction {
    const timestamp = parseInt(tx.timeStamp) * 1000;
    const date = new Date(timestamp);
    const formattedDate = this.formatDate(date);
    
    // Получаем количество токенов с учетом десятичных знаков
    let amount = 0;
    try {
      amount = parseFloat(tx.value);
      if (tx.tokenDecimal) {
        amount = amount / Math.pow(10, parseInt(tx.tokenDecimal));
      }
      if (isNaN(amount)) amount = 0;
    } catch (e) {
      console.error('Error converting ERC20 amount to number:', e);
      amount = 0;
    }
    
    return {
      data: formattedDate,
      walletSender: tx.from,
      walletReceiver: tx.to,
      hash: tx.hash,
      amount: amount,
      currency: tx.tokenSymbol || 'ERC20'
    };
  }

  /**
   * Получает транзакции для указанного кошелька
   */
  private async getTransactions(walletAddress: string, startTime: number, endTime: number): Promise<any[]> {
    try {
      console.log(`Fetching transactions for wallet ${walletAddress} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
      
      if (!ethers.isAddress(walletAddress)) {
        const error = `Invalid Ethereum address: ${walletAddress}`;
        console.error(error);
        throw new Error(error);
      }

      // Etherscan API работает с блоками, но мы используем временные метки
      // Начальный блок 0 означает, что API вернет все транзакции
      const startBlock = 0;
      const endBlock = 999999999;
      
      // Получаем обычные транзакции ETH
      console.log(`Fetching normal ETH transactions for ${walletAddress}`);
      const normalTxsUrl = `${this.apiUrl}?module=account&action=txlist&address=${walletAddress}&startblock=${startBlock}&endblock=${endBlock}&sort=desc&apikey=${this.apiKey}`;
      const normalTxs = await this._fetchTransactionsWithRetry(normalTxsUrl);

      // Получаем ERC20 транзакции
      console.log(`Fetching ERC20 token transactions for ${walletAddress}`);
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
        
        console.log(`Found ${filteredNormalTxs.length} normal ETH transactions in time range`);
        allTransactions = [...allTransactions, ...filteredNormalTxs];
      } else {
        console.log(`No normal ETH transactions found or error: ${
          normalTxs && normalTxs.message ? normalTxs.message : 'Unknown error'
        }`);
      }
      
      if (erc20Txs && erc20Txs.status === '1' && erc20Txs.result) {
        // Фильтруем по времени
        const filteredErc20Txs = erc20Txs.result.filter((tx: any) => {
          const txTimestamp = parseInt(tx.timeStamp) * 1000;
          return txTimestamp >= startTime && txTimestamp <= endTime;
        });
        
        console.log(`Found ${filteredErc20Txs.length} ERC20 token transactions in time range`);
        allTransactions = [...allTransactions, ...filteredErc20Txs];
      } else {
        console.log(`No ERC20 transactions found or error: ${
          erc20Txs && erc20Txs.message ? erc20Txs.message : 'Unknown error'
        }`);
      }

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