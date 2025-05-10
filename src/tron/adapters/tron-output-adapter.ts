/**
 * Адаптер для обработки TRON транзакций
 */
import moment from 'moment';
import { IOutputConfig, IProcessedTransaction } from '../../core/types';

export class TronOutputAdapter {
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
          const mappedTransaction = this._mapTransaction(transaction, walletAddress);
          
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

  private _mapTransaction(transaction: any, walletAddress: string): IProcessedTransaction | null {
    // TRON транзакции из TRON Grid API
    if (transaction.txID) {
      // Для TRC20 транзакций
      if (transaction.contractData && 
         (transaction.contractData.type === 'TriggerSmartContract' || 
          transaction.contractData.call_value)) {
        return this._mapTrc20Transaction(transaction, walletAddress);
      } else {
        return this._mapTrxTransaction(transaction, walletAddress);
      }
    }
    
    return null;
  }

  private _mapTrxTransaction(transaction: any, walletAddress: string): IProcessedTransaction {
    // Получаем временную метку (в миллисекундах)
    const timestamp = transaction.block_timestamp;
    
    // Определяем направление транзакции
    const isOutgoing = transaction.ownerAddress === walletAddress;
    
    // Определяем fromAddress и toAddress на основе направления
    const fromAddress = isOutgoing ? walletAddress : transaction.ownerAddress;
    let toAddress = isOutgoing ? transaction.toAddress : walletAddress;
    
    // Если toAddress не определен (может быть при некоторых типах контрактов)
    if (!toAddress && transaction.contractData && transaction.contractData.to_address) {
      toAddress = transaction.contractData.to_address;
    }
    
    // Для суммы транзакции
    let amount = 0;
    if (transaction.contractData && transaction.contractData.amount) {
      amount = transaction.contractData.amount / 1_000_000;  // Конвертируем sun в TRX
    }
    
    // Для комиссии
    let fee = 0;
    if (transaction.cost?.fee) {
      fee = transaction.cost.fee / 1_000_000;  // Конвертируем sun в TRX
    }
    
    // Определяем статус транзакции
    const status = transaction.ret && transaction.ret[0] && transaction.ret[0].contractRet === 'SUCCESS'
      ? 'SUCCESS'
      : 'FAIL';
    
    return {
      id: transaction.txID,
      timestamp: timestamp,
      date: moment(timestamp).format('YYYY-MM-DD HH:mm:ss'),
      fromAddress: fromAddress,
      toAddress: toAddress || 'Unknown',
      amount: amount,
      ticker: 'TRX',
      type: 'TRX',
      status: status,
      network: 'TRON',
      fee: fee,
      feeCurrency: 'TRX'
    };
  }

  private _mapTrc20Transaction(transaction: any, walletAddress: string): IProcessedTransaction | null {
    // Проверяем, что это транзакция с TRC20 токеном
    if (!transaction.contractData || 
        !transaction.contractData.function_selector || 
        transaction.contractData.function_selector !== 'transfer(address,uint256)') {
      return null;
    }
    
    // Получаем данные контракта
    const contractData = transaction.contractData;
    
    // Проверяем, что это USDT или USDC
    const validTokenContracts = {
      // Официальные адреса токенов в TRON
      'usdt': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',  // Tether USD (USDT)
      'usdc': 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',  // USD Coin (USDC)
    };
    
    // Проверяем, что это один из официальных токенов
    const contractAddress = contractData.contract_address;
    let isValidToken = false;
    let validTokenSymbol = '';
    
    // Проверяем соответствие адреса контракта
    if (contractAddress === validTokenContracts['usdt']) {
      isValidToken = true;
      validTokenSymbol = 'USDT';
    } else if (contractAddress === validTokenContracts['usdc']) {
      isValidToken = true;
      validTokenSymbol = 'USDC';
    }
    
    // Если это не USDT или USDC, пропускаем транзакцию
    if (!isValidToken) {
      return null;
    }
    
    // Получаем временную метку (в миллисекундах)
    const timestamp = transaction.block_timestamp;
    
    // Определяем направление транзакции и адреса
    const isOutgoing = transaction.ownerAddress === walletAddress;
    
    // Из транзакции не всегда можно понять to_address для TRC20, так что используем данные из параметров
    let toAddress = 'Unknown';
    
    if (contractData.parameter && contractData.parameter._value && contractData.parameter._to) {
      toAddress = contractData.parameter._to;
    } else if (contractData.parameter && contractData.parameter._value && contractData.parameter.to) {
      toAddress = contractData.parameter.to;
    } else if (contractData.parameter && contractData.parameter.value && contractData.parameter.value.to) {
      toAddress = contractData.parameter.value.to;
    }
    
    // Для суммы транзакции
    let amount = 0;
    
    // TRC20 суммы могут быть в разных форматах в зависимости от API
    if (contractData.parameter && contractData.parameter._value) {
      amount = parseInt(contractData.parameter._value) / 1_000_000;  // USDT/USDC имеют 6 десятичных знаков
    } else if (contractData.parameter && contractData.parameter.value && contractData.parameter.value.amount) {
      amount = parseInt(contractData.parameter.value.amount) / 1_000_000;
    }
    
    // Для комиссии
    let fee = 0;
    if (transaction.cost?.fee) {
      fee = transaction.cost.fee / 1_000_000;  // Конвертируем sun в TRX
    }
    
    // Определяем статус транзакции
    const status = transaction.ret && transaction.ret[0] && transaction.ret[0].contractRet === 'SUCCESS'
      ? 'SUCCESS'
      : 'FAIL';
    
    return {
      id: transaction.txID,
      timestamp: timestamp,
      date: moment(timestamp).format('YYYY-MM-DD HH:mm:ss'),
      fromAddress: transaction.ownerAddress,
      toAddress: toAddress,
      amount: amount,
      ticker: validTokenSymbol, // Используем проверенный символ токена
      type: 'TRC20',
      status: status,
      network: 'TRON',
      fee: fee,
      feeCurrency: 'TRX'
    };
  }
}
