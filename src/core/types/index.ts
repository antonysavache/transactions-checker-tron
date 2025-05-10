/**
 * Основные типы и интерфейсы для работы приложения
 * Не должны содержать специфики конкретной сети
 */

// Базовые типы для входных данных
export interface IInputConfig {
  defaultTimeIntervalHours?: number;
  defaultNetwork?: 'TRON' | 'ETH' | 'MOCK' | 'ALL';
}

export interface ISourceData {
  wallets: string[] | string;
  timeFrame?: {
    startTime?: number;
    endTime?: number;
  };
  timeIntervalHours?: number;
  network?: 'TRON' | 'ETH' | 'MOCK' | 'ALL';
}

export interface IMonitoringData {
  wallets: string[];
  timeFrame: {
    startTime: number;
    endTime: number;
  };
  network: 'TRON' | 'ETH' | 'MOCK' | 'ALL';
}

// Общие интерфейсы для адаптеров
export interface IOutputConfig {
  includeRawData?: boolean;
}

// Общий интерфейс для обработанных транзакций
export interface IProcessedTransaction {
  id: string;
  timestamp?: number;
  date: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  ticker: string;
  type?: string;
  status: string;
  network: 'TRON' | 'ETH' | 'MOCK';
  fee?: number;
  feeCurrency?: string;
  rawData?: any;
}

export interface ITransactionsResult {
  [walletAddress: string]: any[] | { error: string };
}

// Конфигурация для приложения
export interface IAppConfig {
  REQUEST_DELAY: number;
  MAX_RETRIES: number;
  DEFAULT_TIME_INTERVAL: number;
  DEFAULT_NETWORK: 'TRON' | 'ETH' | 'MOCK' | 'ALL';
  GOOGLE_SHEETS_ENABLED?: boolean;
}

// Интерфейс для Google Sheets
export interface IGoogleSheetsData {
  walletsSpreadsheetId?: string;
  walletsRange?: string;
  ethWalletsRange?: string;
  transactionsSpreadsheetId?: string;
  transactionsRange?: string;
  ethTransactionsRange?: string;
}
