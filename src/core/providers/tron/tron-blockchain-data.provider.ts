import { Injectable } from '@nestjs/common';
import { Observable, from, forkJoin } from 'rxjs';
import { map, catchError, mergeMap } from 'rxjs/operators';
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
 * Результат получения internal транзакций
 */
interface IInternalTransactionsResult {
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
    
    try {
      this.tronWeb = new TronWeb({
        fullHost: this.apiUrl
      });
      console.log('TronBlockchainDataProvider initialized with API URL:', this.apiUrl);
    } catch (error) {
      console.error('Error initializing TronWeb:', error);
    }
  }

  /**
   * Безопасно извлекает комиссию транзакции из всех возможных полей
   * Избегает дублирования, проверяя различные источники данных о комиссии
   */
  private extractTransactionFee(tx: any): number {
    let totalFee = 0;
    
    // ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
    const txHash = tx.txID || tx.transaction_id;
    const isUsdt = tx.token_info && tx.token_info.symbol === 'USDT';
    
    if (isUsdt) {
      console.log('=== EXTRACT FEE DEBUG FOR USDT ===');
      console.log('Checking tx:', txHash);
      console.log('tx.cost:', tx.cost);
      console.log('tx.net_fee:', tx.net_fee);
      console.log('tx.energy_fee:', tx.energy_fee);
      console.log('tx.energy_penalty_total:', tx.energy_penalty_total);
      console.log('tx.ret:', tx.ret);
    }
    
    // Для предотвращения дублирования проверяем поля в определенном порядке приоритета
    
    // 1. Проверяем структуру cost (для данных от TronScan API)
    if (tx.cost) {
      const costFees = [
        tx.cost.net_fee_cost,     // Стоимость bandwidth
        tx.cost.energy_fee_cost,  // Стоимость energy
        tx.cost.energy_fee,       // Дополнительная energy комиссия
        tx.cost.energy_penalty_total, // Штраф за недостаток energy
        tx.cost.fee               // Общая комиссия
      ];
      
      costFees.forEach((fee, index) => {
        const names = ['net_fee_cost', 'energy_fee_cost', 'energy_fee', 'energy_penalty_total', 'fee'];
        if (fee && !isNaN(parseFloat(fee)) && parseFloat(fee) > 0) {
          totalFee += parseFloat(fee);
        }
      });
      
      // Если нашли комиссии в структуре cost, используем их (они уже в SUN)
      if (totalFee > 0) {
        return totalFee / 1000000; // Конвертируем SUN в TRX
      }
    }
    
    // 2. Если cost нет, проверяем прямые поля (для данных от TronGrid API)
    const directFees = [
      { name: 'net_fee', value: tx.net_fee },
      { name: 'energy_fee', value: tx.energy_fee },
      { name: 'energy_penalty_total', value: tx.energy_penalty_total }
    ];
    
    directFees.forEach(({ name, value }) => {
      if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 0) {
        totalFee += parseFloat(value);
      }
    });
    
    // 3. Проверяем ret массив (для некоторых типов транзакций)
    if (totalFee === 0 && tx.ret && Array.isArray(tx.ret) && tx.ret[0] && tx.ret[0].fee) {
      const retFee = parseFloat(tx.ret[0].fee);
      if (!isNaN(retFee) && retFee > 0) {
        totalFee = retFee;
      }
    }
    
    // Логируем итоговый результат
    if (totalFee > 0) {
      console.log(`Fee found: ${totalFee} SUN (${totalFee / 1000000} TRX) for tx: ${txHash}`);
    } else if (isUsdt) {
      console.log(`NO FEE FOUND for USDT transaction: ${txHash}`);
    }
    
    // Возвращаем комиссию в TRX (конвертируем из SUN)
    return totalFee / 1000000;
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
    
    // Параллельно получаем обычные и internal транзакции
    const regularTxs$ = from(this.getTransactionsForWallets(wallets, startTime, endTime));
    const internalTxs$ = from(this.getInternalTransactionsForWallets(wallets, startTime, endTime));
    
    return forkJoin({
      regular: regularTxs$,
      internal: internalTxs$
    }).pipe(
      mergeMap(async ({ regular, internal }) => {
        const regularTransactions = await this.processTransactionsResults(regular);
        const internalTransactions = this.processInternalTransactionsResults(internal);
        
        console.log(`TronBlockchainDataProvider: Found ${regularTransactions.length} regular and ${internalTransactions.length} internal transactions`);
        
        // Объединяем результаты
        return [...regularTransactions, ...internalTransactions];
      }),
      catchError(error => {
        console.error('Error in TronBlockchainDataProvider:', error);
        return from([]);
      })
    );
  }

  /**
   * Обрабатывает результаты запроса транзакций
   */
  private async processTransactionsResults(results: ITransactionsResult): Promise<CompleteTransaction[]> {
    const transactions: CompleteTransaction[] = [];
    
    // Обрабатываем результаты для каждого кошелька
    for (const [walletAddress, walletTransactions] of Object.entries(results)) {
      // Пропускаем кошельки с ошибками
      if ('error' in walletTransactions) {
        continue;
      }
      
      // Создаем карту хешей -> транзакций для быстрого поиска комиссий
      const txMap = new Map<string, any>();
      walletTransactions.forEach(tx => {
        const hash = tx.txID || tx.transaction_id;
        if (hash) txMap.set(hash, tx);
      });
      
      // Обрабатываем транзакции
      for (const tx of walletTransactions) {
        try {
          const txHash = tx.txID || tx.transaction_id;
          if (!txHash) {
            console.error('Transaction hash not found:', tx);
            continue;
          }
          
          console.log(`Processing tx hash: ${txHash}`);
          
          // Получаем комиссию
          let feeAmount = this.extractTransactionFee(tx);
          
          // Если это TRC20 и комиссия не найдена, ищем в обычных транзакциях
          if (tx.token_info && feeAmount === 0) {
            const normalTx = txMap.get(txHash);
            if (normalTx && !normalTx.token_info) {
              console.log(`Found corresponding normal transaction for TRC20: ${txHash}`);
              feeAmount = this.extractTransactionFee(normalTx);
              console.log(`Fee from normal tx: ${feeAmount} TRX`);
            }
          }
          
          // Обрабатываем различные типы транзакций
          if (tx.token_info) {
            // TRC20 транзакция
            const transaction = this.processTrc20Transaction(tx, walletAddress);
            transactions.push(transaction);
            
            // Добавляем комиссию, если это исходящая транзакция
            if (tx.from && tx.from.toLowerCase() === walletAddress.toLowerCase() && feeAmount > 0) {
              console.log(`Adding fee for TRC20: ${feeAmount} TRX`);
              const feeTransaction: CompleteTransaction = {
                data: transaction.data,
                walletSender: transaction.walletSender,
                walletReceiver: 'fee_payment',
                hash: txHash + '_fee',
                amount: feeAmount,
                currency: 'TRX_FEE'
              };
              transactions.push(feeTransaction);
            }
          } else if (tx.raw_data && tx.raw_data.contract) {
            // Обычная TRX транзакция (пропускаем если это дубликат TRC20)
            const hasTokenVersion = txMap.has(txHash) && 
              Array.from(txMap.values()).some(t => t.transaction_id === txHash && t.token_info);
            
            if (!hasTokenVersion) {
              const transaction = this.processTrxTransaction(tx, walletAddress);
              if (transaction) {
                transactions.push(transaction);
                
                // Добавляем комиссию для TRX
                if (transaction.walletSender.toLowerCase() === walletAddress.toLowerCase() && feeAmount > 0) {
                  const feeTransaction: CompleteTransaction = {
                    data: transaction.data,
                    walletSender: transaction.walletSender,
                    walletReceiver: transaction.walletReceiver,
                    hash: txHash + '_fee',
                    amount: feeAmount,
                    currency: 'TRX_FEE'
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
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_to=true&min_timestamp=${startTime}&max_timestamp=${endTime}&limit=50`
      );
      
      console.log(`Incoming TRC20 response structure:`, {
        success: incomingTrc20Txs.success,
        dataLength: incomingTrc20Txs.data?.length || 0,
        firstTx: incomingTrc20Txs.data?.[0] ? Object.keys(incomingTrc20Txs.data[0]) : 'no data'
      });
      
      // ДОБАВЛЯЕМ ЗАДЕРЖКУ МЕЖДУ ЗАПРОСАМИ TRC20
      console.log(`Adding delay of ${this.requestDelay}ms between TRC20 requests`);
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      
      console.log(`Fetching outgoing TRC20 transactions for ${walletAddress}`);
      const outgoingTrc20Txs = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions/trc20?only_from=true&min_timestamp=${startTime}&max_timestamp=${endTime}&limit=50`
      );

      console.log(`Outgoing TRC20 response structure:`, {
        success: outgoingTrc20Txs.success,
        dataLength: outgoingTrc20Txs.data?.length || 0,
        firstTx: outgoingTrc20Txs.data?.[0] ? Object.keys(outgoingTrc20Txs.data[0]) : 'no data'
      });

      // ДОБАВЛЯЕМ ЗАДЕРЖКУ ПЕРЕД ОБЫЧНЫМИ ТРАНЗАКЦИЯМИ
      console.log(`Adding delay of ${this.requestDelay}ms between TRC20 and normal transactions`);
      await new Promise(resolve => setTimeout(resolve, this.requestDelay));

      const normalTxs = await this._fetchTransactionsWithRetry(
        `${this.apiUrl}/v1/accounts/${walletAddress}/transactions?min_timestamp=${startTime}&max_timestamp=${endTime}`
      );

      // ОТЛАДКА СТРУКТУРЫ ОБЫЧНЫХ ТРАНЗАКЦИЙ
      console.log('=== NORMAL TRANSACTIONS DEBUG ===');
      console.log(`Found ${normalTxs.data?.length || 0} normal transactions`);
      if (normalTxs.data && normalTxs.data.length > 0) {
        normalTxs.data.forEach((tx: any, index: number) => {
          const txHash = tx.txID || tx.transaction_id;
          console.log(`Normal tx ${index + 1}: ${txHash}`);
          console.log('Full structure:', JSON.stringify(tx, null, 2));
          console.log('---');
        });
      }
      console.log('=== END NORMAL TRANSACTIONS ===');

      const allTransactions = [
        ...(incomingTrc20Txs.data.filter((tx: any) => tx.type === 'Transfer') || []),
        ...(outgoingTrc20Txs.data.filter((tx: any) => tx.type === 'Transfer') || []),
        ...(normalTxs.data || [])
      ];

      console.log(`Successfully fetched ${allTransactions.length} total transactions for wallet ${walletAddress}`);
      
      // Логи с количеством транзакций только выводятся в консоль
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
   * Получает комиссию транзакции по хешу из детального API
   */
  private async getTransactionFee(txHash: string): Promise<number> {
    try {
      console.log(`Trying to get fee for transaction: ${txHash}`);
      
      // Пробуем разные API endpoints
      const endpoints = [
        `${this.apiUrl}/v1/transactions/${txHash}`,
        `${this.apiUrl}/wallet/gettransactionbyid`,
        `https://apilist.tronscanapi.com/api/transaction-info?hash=${txHash}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          
          let response;
          if (endpoint.includes('gettransactionbyid')) {
            // POST запрос для wallet API
            response = await axios.post(endpoint, {
              value: txHash
            }, { timeout: 10000 });
          } else {
            // GET запрос
            response = await axios.get(endpoint, { timeout: 10000 });
          }
          
          if (response.data) {
            console.log(`Success with endpoint: ${endpoint}`);
            const fee = this.extractTransactionFee(response.data);
            if (fee > 0) {
              console.log(`Fee found: ${fee} TRX`);
              return fee;
            }
          }
        } catch (error: any) {
          console.log(`Failed with endpoint ${endpoint}: ${error.message}`);
          continue; // Пробуем следующий endpoint
        }
      }
      
      console.log(`No fee found for transaction ${txHash} in any endpoint`);
      return 0;
    } catch (error) {
      console.error(`Error fetching fee for ${txHash}:`, error);
      return 0;
    }
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
   * Получает internal транзакции для списка кошельков
   */
  public async getInternalTransactionsForWallets(
    walletAddresses: string[], 
    startTime: number, 
    endTime: number
  ): Promise<IInternalTransactionsResult> {
    console.log(`Fetching internal transactions for ${walletAddresses.length} wallets`);
    
    const results: IInternalTransactionsResult = {};
    
    for (const walletAddress of walletAddresses) {
      try {
        if (Object.keys(results).length > 0) {
          console.log(`Adding delay of ${this.requestDelay}ms before next internal request`);
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
        
        const transactions = await this.getInternalTransactions(walletAddress, startTime, endTime);
        results[walletAddress] = transactions;
        
        console.log(`Successfully fetched ${transactions.length} internal transactions for ${walletAddress}`);
      } catch (error) {
        console.error(`Failed to fetch internal transactions for ${walletAddress}:`, error);
        results[walletAddress] = { error: (error as Error).message };
      }
    }
    
    return results;
  }

  /**
   * Получает internal транзакции для указанного кошелька
   */
  private async getInternalTransactions(walletAddress: string, startTime: number, endTime: number): Promise<any[]> {
    try {
      console.log(`Fetching internal transactions for wallet ${walletAddress} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
      
      if (!this.tronWeb.isAddress(walletAddress)) {
        const error = `Invalid TRON address: ${walletAddress}`;
        console.error(error);
        throw new Error(error);
      }

      // Используем TronScan API для internal transactions
      const response = await this._fetchTransactionsWithRetry(
        `https://apilist.tronscanapi.com/api/internal-transaction?limit=50&start=0&address=${walletAddress}`
      );

      // Фильтруем по времени (API может не поддерживать параметры времени)
      const filteredTransactions = response.data ? response.data.filter((tx: any) => {
        return tx.timestamp >= startTime && tx.timestamp <= endTime;
      }) : [];

      console.log(`Successfully fetched ${filteredTransactions.length} internal transactions for wallet ${walletAddress}`);
      
      return filteredTransactions;
    } catch (error) {
      console.error(`Error fetching internal transactions for wallet ${walletAddress}:`, error);
      throw error;
    }
  }

  /**
   * Обрабатывает результаты internal транзакций
   */
  private processInternalTransactionsResults(results: IInternalTransactionsResult): CompleteTransaction[] {
    const transactions: CompleteTransaction[] = [];
    
    // Обрабатываем результаты для каждого кошелька
    for (const [walletAddress, walletTransactions] of Object.entries(results)) {
      // Пропускаем кошельки с ошибками
      if ('error' in walletTransactions) {
        continue;
      }
      
      // Обрабатываем internal транзакции
      for (const tx of walletTransactions) {
        try {
          const transaction = this.processInternalTransaction(tx, walletAddress);
          if (transaction) {
            transactions.push(transaction);
          }
        } catch (error) {
          console.error('Error processing internal transaction:', error);
        }
      }
    }
    
    console.log(`TronBlockchainDataProvider: Processed ${transactions.length} internal transactions`);
    return transactions;
  }

  /**
   * Обрабатывает одну internal транзакцию
   */
  private processInternalTransaction(tx: any, walletAddress: string): CompleteTransaction | null {
    try {
      const timestamp = tx.timestamp;
      const date = new Date(timestamp);
      const formattedDate = this.formatDate(date);
      
      // Получаем сумму из call_value
      let amount = 0;
      try {
        if (tx.call_value) {
          // call_value уже учитывает decimals согласно tokenInfo
          amount = parseFloat(tx.call_value);
          if (tx.token_list?.tokenInfo?.tokenDecimal) {
            amount = amount / Math.pow(10, tx.token_list.tokenInfo.tokenDecimal);
          }
        }
        if (isNaN(amount)) amount = 0;
      } catch (e) {
        console.error('Error converting internal transaction amount to number:', e);
        amount = 0;
      }
      
      return {
        data: formattedDate,
        walletSender: tx.from,
        walletReceiver: tx.to,
        hash: tx.hash,
        amount: amount,
        currency: 'TRX'
      };
    } catch (error) {
      console.error('Error processing internal transaction:', error);
      return null;
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