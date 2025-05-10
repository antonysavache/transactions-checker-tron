/**
 * Адаптер для обработки ETH транзакций
 */
import moment from 'moment';
import { ethers } from 'ethers';
import { IOutputConfig, IProcessedTransaction } from '../../core/types';
import { IERC20Transaction, IEthTransaction } from '../types';

export class EthOutputAdapter {
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

  private _mapTransaction(transaction: any): IProcessedTransaction | null {
    // ETH транзакции из Etherscan API
    if (transaction.hash && transaction.timeStamp) {
      // ERC20 транзакции имеют поле tokenSymbol
      if (transaction.tokenSymbol) {
        return this._mapErc20Transaction(transaction as IERC20Transaction);
      } else {
        return this._mapEthTransaction(transaction as IEthTransaction);
      }
    }
    
    return null;
  }

  private _mapEthTransaction(transaction: IEthTransaction): IProcessedTransaction {
    // Переводим значение из wei в ETH (1 ETH = 10^18 wei)
    const amount = parseFloat(ethers.formatEther(transaction.value));
    
    // Проверяем, есть ли информация о комиссии
    let fee = 0;
    if (transaction.gasPrice && transaction.gasUsed) {
      // Рассчитываем комиссию (Transaction Fee) из gasPrice * gasUsed
      const gasPrice = BigInt(transaction.gasPrice);
      const gasUsed = BigInt(transaction.gasUsed);
      fee = parseFloat(ethers.formatEther(gasPrice * gasUsed));
    }
    
    // Timestamp в Etherscan API указан в секундах
    const timestamp = parseInt(transaction.timeStamp) * 1000;
    
    // Определяем статус транзакции
    const status = transaction.txreceipt_status === '1' || transaction.isError === '0' 
      ? 'SUCCESS' 
      : transaction.isError === '1' ? 'FAIL' : 'UNKNOWN';
    
    return {
      id: transaction.hash,
      timestamp: timestamp,
      date: moment(timestamp).format('YYYY-MM-DD HH:mm:ss'),
      fromAddress: transaction.from,
      toAddress: transaction.to,
      amount: amount,
      ticker: 'ETH',
      type: 'ETH',
      status: status,
      network: 'ETH',
      fee: fee,
      feeCurrency: 'ETH'
    };
  }

  private _mapErc20Transaction(transaction: IERC20Transaction): IProcessedTransaction | null {
    // Проверка адреса контракта для подтверждения, что это настоящий USDT или USDC
    const validTokenContracts = {
      // Официальные адреса токенов (в нижнем регистре)
      'usdt': '0xdac17f958d2ee523a2206206994597c13d831ec7',  // Tether USD
      'usdc': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',  // USD Coin
    };
    
    // Проверяем, что это один из официальных токенов
    const contractAddress = transaction.contractAddress.toLowerCase();
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
    
    // Преобразование значения с учетом decimals токена
    const decimals = parseInt(transaction.tokenDecimal);
    const amount = parseFloat(transaction.value) / Math.pow(10, decimals);
    
    // Проверяем, есть ли информация о комиссии
    let fee = 0;
    if (transaction.gasPrice && transaction.gasUsed) {
      // Рассчитываем комиссию (Transaction Fee) из gasPrice * gasUsed
      const gasPrice = BigInt(transaction.gasPrice);
      const gasUsed = BigInt(transaction.gasUsed);
      fee = parseFloat(ethers.formatEther(gasPrice * gasUsed));
    }
    
    // Timestamp в Etherscan API указан в секундах
    const timestamp = parseInt(transaction.timeStamp) * 1000;
    
    // Определяем статус транзакции
    const status = transaction.txreceipt_status === '1' || transaction.isError === '0' 
      ? 'SUCCESS' 
      : transaction.isError === '1' ? 'FAIL' : 'UNKNOWN';
    
    return {
      id: transaction.hash,
      timestamp: timestamp,
      date: moment(timestamp).format('YYYY-MM-DD HH:mm:ss'),
      fromAddress: transaction.from,
      toAddress: transaction.to,
      amount: amount,
      ticker: validTokenSymbol, // Используем проверенный символ токена
      type: 'ERC20',
      status: status,
      network: 'ETH',
      fee: fee,
      feeCurrency: 'ETH'
    };
  }
}
