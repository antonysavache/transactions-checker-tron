import { Injectable, OnModuleInit } from '@nestjs/common';
import { Repository } from "@shared/repository";
import { Observable } from "rxjs";
import { Monitor, CompleteTransaction } from "@shared/models";
import { BlockchainTransaction } from "@core/services/blockchain-transaction.service";

@Injectable()
export class MonitorService implements Monitor, OnModuleInit {
  // Устанавливаем значение из .env или используем 480, если не задано
  intervalHours: number = parseInt(process.env.DEFAULT_TIME_INTERVAL || '1');
  wallets: string[] = [];
  private readonly serviceName = 'Monitor';

  constructor(
    private repository: Repository,
    private blockChainTransaction: BlockchainTransaction
  ) {
    console.log(`MonitorService: Using intervalHours=${this.intervalHours} (from env: ${process.env.DEFAULT_TIME_INTERVAL || 'not set'})`);
  }

  onModuleInit() {
    this.start();
  }

  public start(): void {
    console.log('Starting main monitor service');
    
    this.fetchWalletsFromSheets().subscribe({
      next: wallets => {
        console.log(`MonitorService: Fetched ${wallets.length} wallets from test-wallets`);
        this.wallets = wallets;
        this.runMonitor();
        const intervalMs = this.intervalHours * 60 * 60 * 1000;
        setInterval(() => this.runMonitor(), intervalMs);
      },
      error: error => {
        console.error(`MonitorService: Error fetching wallets: ${error.message}`);
      }
    });
  }

  private runMonitor(): void {
    if (this.wallets.length === 0) {
      console.warn('MonitorService: No wallets to monitor');
      return;
    }
    
    console.log(`MonitorService: Running monitor for ${this.wallets.length} wallets`);
    
    this.blockChainTransaction
      .getTransactions(this.wallets, this.intervalHours)
      .subscribe({
        next: transactions => {
          console.log(`MonitorService: Fetched ${transactions.length} transactions`);
          this.saveTransactions(transactions);
        },
        error: error => {
          console.error(`MonitorService: Error fetching transactions: ${error.message}`);
        }
      });
  }

  private fetchWalletsFromSheets(): Observable<string[]> {
    return this.repository.getWallets();
  }

  private saveTransactions(transactions: CompleteTransaction[]): void {
    console.log(`MonitorService: Saving ${transactions.length} transactions to test-trans`);
    this.repository.saveTransactions(transactions);
  }
}