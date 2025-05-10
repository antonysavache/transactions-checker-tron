/**
 * Сервис для генерации тестовых транзакций в сети Mock
 */
import { v4 as uuidv4 } from 'uuid';
import { ITransactionsResult } from '../../core/types';
import { IMockServiceConfig } from '../types';
import { apiLogger } from '../../shared/utils/logger';

export class MockTransactionService {
  private delayMs: number;
  private errorRate: number;
  private transactionsPerWallet: number;

  constructor(options: IMockServiceConfig = {}) {
    this.delayMs = options.delayMs || 500;
    this.errorRate = options.errorRate || 10; // 10% ошибок по умолчанию
    this.transactionsPerWallet = options.transactionsPerWallet || 5;
  }

  private async getTransactions(walletAddress: string, startTime: number, endTime: number): Promise<any[]> {
    try {
      apiLogger.info('Fetching MOCK transactions for wallet %s from %s to %s', 
        walletAddress, new Date(startTime).toISOString(), new Date(endTime).toISOString());
      
      // Симулируем задержку запроса
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
      
      // Симулируем случайную ошибку с заданной вероятностью
      if (Math.random() * 100 < this.errorRate) {
        throw new Error(`Random error for wallet ${walletAddress} (simulated error)`);
      }
      
      // Генерируем случайное количество транзакций для этого кошелька
      const transactionsCount = Math.floor(Math.random() * this.transactionsPerWallet) + 1;
      
      // Генерируем тестовые транзакции
      const transactions = [];
      for (let i = 0; i < transactionsCount; i++) {
        // Рассчитываем временную метку в диапазоне от startTime до endTime
        const timestamp = startTime + Math.floor(Math.random() * (endTime - startTime));
        
        // Случайно определяем, входящая или исходящая транзакция
        const isIncoming = Math.random() > 0.5;
        
        // Генерируем случайную сумму от 0.001 до 10
        const amount = parseFloat((Math.random() * 10 + 0.001).toFixed(6));
        
        // Выбираем случайный токен
        const tokens = ['MOCK_TOKEN', 'TEST_TOKEN', 'USDT', 'ETH'];
        const token = tokens[Math.floor(Math.random() * tokens.length)];
        
        // Генерируем транзакцию
        const transaction = {
          id: `tx_${uuidv4().replace(/-/g, '')}`,
          timestamp: timestamp,
          fromAddress: isIncoming ? `MOCK_EXTERNAL_${Math.floor(Math.random() * 1000)}` : walletAddress,
          toAddress: isIncoming ? walletAddress : `MOCK_EXTERNAL_${Math.floor(Math.random() * 1000)}`,
          amount: amount,
          token: token,
          status: Math.random() > 0.1 ? 'SUCCESS' : 'FAIL', // 10% неудачных транзакций
          fee: parseFloat((Math.random() * 0.01).toFixed(8)),
          feeCurrency: 'GAS'
        };
        
        transactions.push(transaction);
      }
      
      apiLogger.info('Successfully generated %d mock transactions for wallet %s', 
        transactions.length, walletAddress);
      
      return transactions;
    } catch (error) {
      apiLogger.error('Error generating mock transactions for wallet %s: %s', 
        walletAddress, (error as Error).message);
      throw error;
    }
  }

  public async getTransactionsForWallets(
    walletAddresses: string[], 
    startTime: number, 
    endTime: number
  ): Promise<ITransactionsResult> {
    apiLogger.info('Fetching MOCK transactions for %d wallets', walletAddresses.length);
    
    const results: ITransactionsResult = {};
    
    for (const walletAddress of walletAddresses) {
      try {
        const transactions = await this.getTransactions(walletAddress, startTime, endTime);
        results[walletAddress] = transactions;
        
        apiLogger.info('Successfully fetched %d MOCK transactions for %s', transactions.length, walletAddress);
      } catch (error) {
        apiLogger.error('Failed to fetch MOCK transactions for %s: %s', 
          walletAddress, (error as Error).message);
        results[walletAddress] = { error: (error as Error).message };
      }
    }
    
    return results;
  }
}
