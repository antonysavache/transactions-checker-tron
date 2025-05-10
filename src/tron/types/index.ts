/**
 * Типы и интерфейсы специфичные для сети TRON
 */
import { IProcessedTransaction, ITransactionsResult } from '../../core/types';

export interface ITronServiceConfig {
  apiUrl?: string;
  requestDelay?: number;
  maxRetries?: number;
}

export interface ITronConfig {
  TRON_API_URL: string;
  REQUEST_DELAY: number;
  MAX_RETRIES: number;
  DEFAULT_TIME_INTERVAL: number;
}

export interface ITRC20Transaction {
  transaction_id: string;
  token_info?: {
    symbol: string;
    decimals: number;
    name?: string;
  };
  block_timestamp: number;
  from: string;
  to: string;
  value?: number | string;
  type?: string;
  status?: string;
}

export interface ITRXTransaction {
  txID: string;
  raw_data: {
    timestamp: number;
    contract: {
      type: string;
      parameter: {
        value: {
          amount?: number;
          owner_address?: string;
          to_address?: string;
        };
      };
    }[];
  };
  ret?: {
    contractRet: string;
  }[];
}

export interface ITronProcessedTransaction extends IProcessedTransaction {
  // Можно добавить дополнительные поля, специфичные для TRON, если потребуется
}

export interface ITronMonitorConfig {
  intervalHours: number;
  useGoogleSheets: boolean;
  initialHistoricalHours?: number | null;
  wallets?: string[];
}
