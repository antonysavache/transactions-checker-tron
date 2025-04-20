export interface IInputConfig {
  defaultTimeIntervalHours?: number;
}

export interface ISourceData {
  wallets: string[] | string;
  timeFrame?: {
    startTime?: number;
    endTime?: number;
  };
  timeIntervalHours?: number;
}

export interface IMonitoringData {
  wallets: string[];
  timeFrame: {
    startTime: number;
    endTime: number;
  };
}

export interface ITronServiceConfig {
  apiUrl?: string;
  requestDelay?: number;
  maxRetries?: number;
}

export interface IOutputConfig {
  includeRawData?: boolean;
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

export interface IProcessedTransaction {
  id: string;
  timestamp: number;
  date: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  ticker: string;
  type: string;
  status: string;
  rawData?: any;
}

export interface ITransactionsResult {
  [walletAddress: string]: any[] | { error: string };
}

export interface IAppConfig {
  TRON_API_URL: string;
  REQUEST_DELAY: number;
  MAX_RETRIES: number;
  DEFAULT_TIME_INTERVAL: number;
  GOOGLE_SHEETS_ENABLED?: boolean;
}

export interface IGoogleSheetsData {
  walletsSpreadsheetId?: string;
  walletsRange?: string;
  transactionsSpreadsheetId?: string;
  transactionsRange?: string;
}