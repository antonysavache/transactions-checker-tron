import { Injectable, OnModuleInit } from '@nestjs/common';
import { Observable } from "rxjs";
import { CompleteTransaction } from "@shared/models";
import { BlockchainTransaction, BlockchainType } from "@core/services/blockchain-transaction.service";
import { Repository } from "@shared/repository";

@Injectable()
export class TronMonitorService implements OnModuleInit {
  // Вкладка с кошельками TRON
  private readonly walletsSheet = 'tron-wallets';
  // Вкладка для сохранения транзакций TRON
  private readonly transactionsSheet = 'trans-tron';
  // Интервал мониторинга в часах
  public intervalHours: number = parseInt(process.env.DEFAULT_TIME_INTERVAL || '100');
  // Список кошельков
  private wallets: string[] = [];
  // Имя сервиса для логов
  private readonly serviceName = 'TronMonitor';

  constructor(
    private repository: Repository,
    private blockChainTransaction: BlockchainTransaction
  ) {
    console.log(`TronMonitorService: Using intervalHours=${this.intervalHours} (from env: ${process.env.DEFAULT_TIME_INTERVAL || 'not set'})`);
  }

  onModuleInit() {
    this.start();
  }

  /**
   * Запускает мониторинг TRON транзакций
   */
  public start(): void {
    console.log(
      `Starting TRON monitor service (wallets from ${this.walletsSheet}, saving to ${this.transactionsSheet})`
    );
    
    this.fetchWalletsFromSheets().subscribe({
      next: wallets => {
        console.log(`TronMonitorService: Fetched ${wallets.length} wallets from ${this.walletsSheet}`);
        this.wallets = wallets;
        this.runMonitor();
        const intervalMs = this.intervalHours * 60 * 60 * 1000;
        setInterval(() => this.runMonitor(), intervalMs);
      },
      error: error => {
        console.error(`TronMonitorService: Error fetching wallets: ${error.message}`);
      }
    });
  }

  /**
   * Выполняет один цикл мониторинга
   */
  private runMonitor(): void {
    if (this.wallets.length === 0) {
      console.warn('TronMonitorService: No wallets to monitor');
      return;
    }
    
    console.log(`TronMonitorService: Running monitor for ${this.wallets.length} TRON wallets`);
    
    this.blockChainTransaction
      .getTransactions(this.wallets, this.intervalHours, BlockchainType.TRON)
      .subscribe({
        next: transactions => {
          console.log(`TronMonitorService: Fetched ${transactions.length} TRON transactions`);
          this.saveTransactions(transactions);
        },
        error: error => {
          console.error(`TronMonitorService: Error fetching TRON transactions: ${error.message}`);
        }
      });
  }

  /**
   * Получает кошельки TRON из Google Sheets
   */
  private fetchWalletsFromSheets(): Observable<string[]> {
    return this.repository.getWallets(this.walletsSheet);
  }

  /**
   * Сохраняет транзакции TRON в Google Sheets
   */
  private saveTransactions(transactions: CompleteTransaction[]): void {
    console.log(`TronMonitorService: Saving ${transactions.length} TRON transactions to ${this.transactionsSheet}`);
    this.repository.saveTransactions(transactions, this.transactionsSheet);
  }
}