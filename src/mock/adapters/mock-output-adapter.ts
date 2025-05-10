/**
 * Адаптер для обработки тестовых транзакций Mock
 */
import moment from 'moment';
import { IOutputConfig, IProcessedTransaction } from '../../core/types';

export class MockOutputAdapter {
  private includeRawData: boolean;

  constructor(options: IOutputConfig = {}) {
    this.includeRawData = options.includeRawData || false;
  }

  public processTransactions(transactionsData: any): IProcessedTransaction[] {
    if (!transactionsData || typeof transactionsData !== 'object') {
      throw new Error('Invalid transactions data');
    }

    const processedTransactions: IProcessedTransaction[] = [];

    Object.keys(transactionsData).forEach(walletAddress => {
      const walletTransactions = transactionsData[walletAddress];
      
      if ('error' in walletTransactions) {
        console.error(`Skipping processing for wallet ${walletAddress} due to error:`, walletTransactions.error);
        return;
      }

      walletTransactions.forEach((transaction: any) => {
        try {
          const mappedTransaction = this._mapTransaction(transaction);
          
          if (mappedTransaction) {
            if (this.includeRawData) {
              mappedTransaction.rawData = transaction;
            }
            
            processedTransactions.push(mappedTransaction);
          }
        } catch (error) {
          console.error('Error processing transaction:', (error as Error).message);
        }
      });
    });

    // Безопасная сортировка с проверкой на undefined timestamp
    return processedTransactions.sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return timeB - timeA;
    });
  }

  private _mapTransaction(transaction: any): IProcessedTransaction {
    // Простой маппинг тестовой транзакции в IProcessedTransaction
    return {
      id: transaction.id,
      timestamp: transaction.timestamp,
      date: moment(transaction.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      amount: transaction.amount,
      ticker: transaction.token,
      type: transaction.token === 'MOCK_TOKEN' ? 'MOCK' : 'TEST',
      status: transaction.status,
      network: 'MOCK',
      fee: transaction.fee,
      feeCurrency: transaction.feeCurrency
    };
  }
}
