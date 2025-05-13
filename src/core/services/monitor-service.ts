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
    this.fetchWalletsFromSheets().subscribe({
      next: wallets => {
        this.wallets = wallets;
        this.runMonitor();
        const intervalMs = this.intervalHours * 60 * 60 * 1000;
        setInterval(() => this.runMonitor(), intervalMs);
      }
    });
  }

  private runMonitor(): void {
    if (!this.wallets.length) {
      return;
    }
    
    this.blockChainTransaction
      .getTransactions(this.wallets, this.intervalHours)
      .subscribe({
        next: transactions => {
          this.saveTransactions(transactions);
        },
        error: error => {
          console.error(`MonitorService: Error fetching transactions: ${error.message}`);
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