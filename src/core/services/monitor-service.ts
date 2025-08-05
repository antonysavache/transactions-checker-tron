import { Injectable, OnModuleInit } from '@nestjs/common';
import { Repository } from "@shared/repository";
import { Observable } from "rxjs";
import { Monitor, CompleteTransaction } from "@shared/models";
import { BlockchainTransaction } from "@core/services/blockchain-transaction.service";

@Injectable()
export class MonitorService implements Monitor, OnModuleInit {
  intervalHours: number = parseInt(process.env.DEFAULT_TIME_INTERVAL || '1');
  wallets: string[] = [];
  private readonly serviceName = 'Monitor';

  constructor(
    private repository: Repository,
    private blockChainTransaction: BlockchainTransaction
  ) {
  }

  onModuleInit() {
    this.start();
  }

  public start(): void {
    // При первом запуске получаем список кошельков и настраиваем интервал проверки
    this.fetchWalletsFromSheets().subscribe({
      next: wallets => {
        console.log(`MonitorService: Initial wallet list loaded with ${wallets.length} wallets`);

        // Запускаем первую проверку
        this.runMonitor();

        // Настраиваем периодические проверки по расписанию
        const intervalMs = this.intervalHours * 60 * 60 * 1000;
        console.log(`MonitorService: Scheduling periodic checks every ${this.intervalHours} hours (${intervalMs}ms)`);
        setInterval(() => this.runMonitor(), intervalMs);
      },
      error: error => {
        console.error(`MonitorService: Failed to load initial wallet list: ${error.message}`);
      }
    });
  }

  private runMonitor(): void {
    // Получаем свежий список кошельков перед каждой проверкой
    this.fetchWalletsFromSheets().subscribe({
      next: freshWallets => {
        console.log(`MonitorService: Fetched fresh wallet list with ${freshWallets.length} wallets`);
        if (!freshWallets.length) {
          console.log('MonitorService: No wallets to monitor, skipping check');
          return;
        }

        // Вычисляем интервал для проверки транзакций (в 2 раза больше интервала между проверками)
        const lookbackHours = this.intervalHours * 2;
        console.log(`MonitorService: Check interval: ${this.intervalHours}h, lookback period: ${lookbackHours}h`);

        // Используем свежеполученный список кошельков
        this.blockChainTransaction
            .getTransactions(freshWallets, lookbackHours)
            .subscribe({
              next: transactions => {
                this.saveTransactions(transactions);
              },
              error: error => {
                console.error(`MonitorService: Error fetching transactions: ${error.message}`);
              }
            });
      },
      error: error => {
        console.error(`MonitorService: Error fetching fresh wallets: ${error.message}`);
      }
    });
  }

  private fetchWalletsFromSheets(): Observable<string[]> {
    return this.repository.getWallets('tron-wallets');
  }

  private saveTransactions(transactions: CompleteTransaction[]): void {
    this.repository.saveTransactions(transactions, 'trans-tron');
  }
}