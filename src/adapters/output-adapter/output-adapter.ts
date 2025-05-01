import moment from 'moment';
import { 
  IOutputConfig,
  IProcessedTransaction, 
  ITRC20Transaction, 
  ITRXTransaction,
  IEthTransaction,
  IERC20Transaction,
  ITransactionsResult 
} from '../../types';
import TronWeb from 'tronweb';
import { ethers } from 'ethers';

export class OutputAdapter {
  private includeRawData: boolean;
  private tronWeb: any;

  constructor(options: IOutputConfig = {}) {
    this.includeRawData = options.includeRawData || false;
    
    // Инициализация TronWeb
    const fullNode = 'https://api.trongrid.io';
    const solidityNode = 'https://api.trongrid.io';
    const eventServer = 'https://api.trongrid.io';
    
    this.tronWeb = new TronWeb({
      fullHost: fullNode,
      solidityNode: solidityNode,
      eventServer: eventServer
    });
  }

  public processTransactions(transactionsData: ITransactionsResult): IProcessedTransaction[] {
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

    return processedTransactions.sort((a, b) => b.timestamp - a.timestamp);
  }

  private _mapTransaction(transaction: any): IProcessedTransaction | null {
    // TRON транзакции
    if (transaction.token_info) {
      return this._mapTrc20Transaction(transaction as ITRC20Transaction);
    } else if (transaction.raw_data && transaction.raw_data.contract) {
      return this._mapTrxTransaction(transaction as ITRXTransaction);
    }
    
    // ETH транзакции из Etherscan API
    else if (transaction.hash && transaction.timeStamp) {
      // ERC20 транзакции имеют поле tokenSymbol
      if (transaction.tokenSymbol) {
        return this._mapErc20Transaction(transaction as IERC20Transaction);
      } else {
        return this._mapEthTransaction(transaction as IEthTransaction);
      }
    }
    
    return null;
  }

  private _mapTrc20Transaction(transaction: ITRC20Transaction): IProcessedTransaction {
    const ticker = transaction.token_info?.symbol || 'UNKNOWN';
    const decimals = transaction.token_info?.decimals || 0;
    
    const value = transaction.value 
      ? (typeof transaction.value === 'string' 
        ? parseFloat(transaction.value) / Math.pow(10, decimals) 
        : transaction.value / Math.pow(10, decimals))
      : 0;
    
    // Проверяем и преобразуем адреса, если они в hex формате
    const fromAddress = transaction.from.startsWith('41') ? 
      this._addressFromHex(transaction.from) : transaction.from;
    
    const toAddress = transaction.to.startsWith('41') ? 
      this._addressFromHex(transaction.to) : transaction.to;
    
    return {
      id: transaction.transaction_id,
      timestamp: transaction.block_timestamp,
      date: moment(transaction.block_timestamp).format('YYYY-MM-DD HH:mm:ss'),
      fromAddress: fromAddress,
      toAddress: toAddress,
      amount: value,
      ticker: ticker,
      type: 'TRC20',
      status: transaction.status || 'UNKNOWN',
      network: 'TRON'
    };
  }

  private _mapTrxTransaction(transaction: ITRXTransaction): IProcessedTransaction | null {
    const contract = transaction.raw_data.contract[0];
    
    if (contract.type !== 'TransferContract') {
      return null;
    }
    
    const value = contract.parameter?.value || {};
    
    // Convert amount from SUN to TRX (1 TRX = 1,000,000 SUN)
    const amount = value.amount ? value.amount / 1000000 : 0;
    
    // Конвертируем адреса из hex в Base58 формат
    const fromAddress = this._addressFromHex(value.owner_address);
    const toAddress = this._addressFromHex(value.to_address);
    
    return {
      id: transaction.txID,
      timestamp: transaction.raw_data.timestamp,
      date: moment(transaction.raw_data.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      fromAddress: fromAddress,
      toAddress: toAddress,
      amount: amount,
      ticker: 'TRX',
      type: 'TRX',
      status: transaction.ret?.[0]?.contractRet || 'UNKNOWN',
      network: 'TRON'
    };
  }
  
  private _mapEthTransaction(transaction: IEthTransaction): IProcessedTransaction {
    // Переводим значение из wei в ETH (1 ETH = 10^18 wei)
    const amount = parseFloat(ethers.formatEther(transaction.value));
    
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
      network: 'ETH'
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
      network: 'ETH'
    };
  }

  private _addressFromHex(hexAddress?: string): string {
    if (!hexAddress) {
      return 'UNKNOWN';
    }
    
    try {
      // Используем экземпляр tronWeb вместо глобального объекта
      if (this.tronWeb) {
        // Если адрес не начинается с '41', добавляем префикс
        const formattedHexAddress = hexAddress.startsWith('41') ? hexAddress : `41${hexAddress}`;
        return this.tronWeb.address.fromHex(formattedHexAddress);
      }
      
      return hexAddress;
    } catch (error) {
      console.error('Error converting address from hex:', (error as Error).message);
      return hexAddress;
    }
  }
}