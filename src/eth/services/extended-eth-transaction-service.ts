/**
 * Сервис для работы с ETH транзакциями
 */
import moment from 'moment';
import { IEthServiceConfig } from '../types';
import { EthTransactionService as BaseEthTransactionService } from './eth-transaction-service';

export class EthTransactionService extends BaseEthTransactionService {
  constructor(config: IEthServiceConfig) {
    super(config);
  }

  /**
   * Получить транзакции для нескольких кошельков в указанном временном интервале
   * @param wallets Массив адресов ETH кошельков
   * @param startTime Начальное время в миллисекундах
   * @param endTime Конечное время в миллисекундах
   * @returns Объект с транзакциями по кошелькам
   */
  public async getTransactionsForWallets(
    wallets: string[],
    startTime: number,
    endTime: number
  ): Promise<{ [wallet: string]: any[] | { error: string } }> {
    const result: { [wallet: string]: any[] | { error: string } } = {};
    
    // Преобразуем временные метки в формат блоков (необязательно, можно использовать временные фильтры)
    const startBlock = 0; // Можно получить через this.getBlockNumberAtTime(startTime)
    const endBlock = 99999999; // Последний блок
    
    // Получаем транзакции для каждого кошелька
    for (const wallet of wallets) {
      try {
        // Получаем все типы транзакций
        const transactions = await this.getAllTransactions(wallet, startBlock, endBlock);
        
        // Фильтруем транзакции по временному интервалу
        const filteredTransactions = transactions.filter(tx => {
          const txTimestamp = parseInt(tx.timeStamp) * 1000; // В миллисекундах
          return txTimestamp >= startTime && txTimestamp <= endTime;
        });
        
        result[wallet] = filteredTransactions;
      } catch (error) {
        console.error(`Error fetching transactions for wallet ${wallet}:`, (error as Error).message);
        result[wallet] = { error: (error as Error).message };
      }
    }
    
    return result;
  }
}
