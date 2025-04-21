import moment from 'moment';
import { 
  IOutputConfig,
  IProcessedTransaction, 
  ITRC20Transaction, 
  ITRXTransaction, 
  ITransactionsResult 
} from '../../types';
import TronWeb from 'tronweb';

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
    if (transaction.token_info) {
      return this._mapTrc20Transaction(transaction as ITRC20Transaction);
    } else if (transaction.raw_data && transaction.raw_data.contract) {
      return this._mapTrxTransaction(transaction as ITRXTransaction);
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
      status: transaction.status || 'UNKNOWN'
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
      status: transaction.ret?.[0]?.contractRet || 'UNKNOWN'
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