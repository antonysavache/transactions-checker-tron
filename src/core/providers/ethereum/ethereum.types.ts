/**
 * Конфигурация для сервиса Ethereum
 */
export interface IEthServiceConfig {
  apiUrl?: string;
  apiKey?: string;
  requestDelay?: number;
  maxRetries?: number;
}

/**
 * Результат получения транзакций
 */
export interface ITransactionsResult {
  [walletAddress: string]: any[] | { error: string };
}
