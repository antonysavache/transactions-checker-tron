import { Injectable, OnModuleInit } from '@nestjs/common';
import { Observable } from "rxjs";
import { CompleteTransaction } from "@shared/models";
import { BlockchainTransaction, BlockchainType } from "@core/services/blockchain-transaction.service";
import { Repository } from "@shared/repository";

@Injectable()
export class EthereumMonitorService implements OnModuleInit {
  // Вкладка с кошельками Ethereum
  private readonly walletsSheet = 'eth-wallets';
  // Вкладка для сохранения транзакций Ethereum
  private readonly transactionsSheet = 'trans-erc';
  // Интервал мониторинга в часах
  public intervalHours: number = parseInt(process.env.DEFAULT_TIME_INTERVAL || '100');
  // Список кошельков
  private wallets: string[] = [];
  // Имя сервиса для логов
  private readonly serviceName = 'EthereumMonitor';

  constructor(
    private repository: Repository,
    private blockChainTransaction: BlockchainTransaction
  ) {
    console.log(`EthereumMonitorService: Using intervalHours=${this.intervalHours} (from env: ${process.env.DEFAULT_TIME_INTERVAL || 'not set'})`);
  }

  onModuleInit() {
    this.start();
  }

  /**
   * Запускает мониторинг Ethereum транзакций
   */
  public start(): void {
    console.log(
      `Starting Ethereum monitor service (wallets from ${this.walletsSheet}, saving to ${this.transactionsSheet})`
    );
    
    this.fetchWalletsFromSheets().subscribe({
      next: wallets => {
        console.log(`EthereumMonitorService: Fetched ${wallets.length} wallets from ${this.walletsSheet}`);
        this.wallets = wallets;
        this.runMonitor();
        const intervalMs = this.intervalHours * 60 * 60 * 1000;
        setInterval(() => this.runMonitor(), intervalMs);
      },
      error: error => {
        console.error(`EthereumMonitorService: Error fetching Ethereum wallets: ${error.message}`);
      }
    });
  }

  /**
   * Выполняет один цикл мониторинга
   */
  private runMonitor(): void {
    if (this.wallets.length === 0) {
      console.warn('EthereumMonitorService: No wallets to monitor');
      return;
    }
    
    console.log(`EthereumMonitorService: Running monitor for ${this.wallets.length} Ethereum wallets`);
    
    this.blockChainTransaction
      .getTransactions(this.wallets, this.intervalHours, BlockchainType.ETH)
      .subscribe({
        next: transactions => {
          console.log(`EthereumMonitorService: Fetched ${transactions.length} Ethereum transactions`);
          this.saveTransactions(transactions);
        },
        error: error => {
          console.error(`EthereumMonitorService: Error fetching Ethereum transactions: ${error.message}`);
        }
      });
  }

  /**
   * Получает кошельки Ethereum из Google Sheets
   */
  private fetchWalletsFromSheets(): Observable<string[]> {
    return this.repository.getWallets(this.walletsSheet);
  }

  /**
   * Сохраняет транзакции Ethereum в Google Sheets
   */
  private saveTransactions(transactions: CompleteTransaction[]): void {
    console.log(`EthereumMonitorService: Saving ${transactions.length} Ethereum transactions to ${this.transactionsSheet}`);
    this.repository.saveTransactions(transactions, this.transactionsSheet);
  }
}