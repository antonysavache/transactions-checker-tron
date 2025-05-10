/**
 * Типы и интерфейсы специфичные для сети Ethereum
 */
import { IProcessedTransaction, ITransactionsResult } from '../../core/types';

export interface IEthServiceConfig {
  apiUrl?: string;
  apiKey?: string;
  requestDelay?: number;
  maxRetries?: number;
  providerUrl?: string;
  etherscanApiKey?: string;
}

export interface IEthConfig {
  ETH_API_URL: string;
  ETH_API_KEY: string;
  REQUEST_DELAY: number;
  MAX_RETRIES: number;
  DEFAULT_TIME_INTERVAL: number;
}

export interface IEthTransaction {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  nonce: string;
  blockNumber: string;
  blockHash: string;
  confirmations: string;
  isError?: string;
  txreceipt_status?: string;
}

export interface IERC20Transaction extends IEthTransaction {
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

export interface IEthProcessedTransaction extends IProcessedTransaction {
  // Можно добавить дополнительные поля, специфичные для Ethereum, если потребуется
}

export interface IEthMonitorConfig {
  intervalHours: number;
  useGoogleSheets: boolean;
  initialHistoricalHours?: number | null;
  wallets?: string[];
}
