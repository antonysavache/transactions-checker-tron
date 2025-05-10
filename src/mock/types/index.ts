/**
 * Типы и интерфейсы для тестовой сети Mock
 */
import { IProcessedTransaction, ITransactionsResult } from '../../core/types';

export interface IMockServiceConfig {
  delayMs?: number;
  errorRate?: number; // Процент ошибок (0-100)
  transactionsPerWallet?: number;
}

export interface IMockConfig {
  MOCK_DELAY_MS: number;
  MOCK_ERROR_RATE: number;
  MOCK_TRANSACTIONS_PER_WALLET: number;
}

export interface IMockTransaction {
  id: string;
  timestamp: number;
  fromAddress: string;
  toAddress: string;
  amount: number;
  token: string;
  status: string;
}

export interface IMockMonitorConfig {
  intervalHours: number;
  useGoogleSheets: boolean;
  initialHistoricalHours?: number | null;
  wallets?: string[];
}
