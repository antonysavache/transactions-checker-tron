import { Injectable, OnModuleInit } from '@nestjs/common';
import { Repository } from "@shared/repository";
import { Observable } from "rxjs";
import { Monitor, CompleteTransaction } from "@shared/models";
import { BlockchainTransaction } from "@core/services/blockchain-transaction.service";

@Injectable()
export class MonitorService implements Monitor, OnModuleInit {
  intervalHours = 1;
  wallets: string[] = [];

  constructor(
    private repository: Repository,
    private blockChainTransaction: BlockchainTransaction,
  ) {}

  onModuleInit() {
    this.start();
  }

  public start(): void {
    this.fetchWalletsFromSheets().subscribe(wallets => {
      console.log(wallets)
      this.wallets = wallets;
      this.runMonitor();
      const intervalMs = this.intervalHours * 60 * 60 * 1000;
      setInterval(() => this.runMonitor(), intervalMs);
    });
  }

  private runMonitor(): void {
    this.blockChainTransaction.getTransactions(this.wallets).subscribe(transactions => this.saveTransactions(transactions));
  }

  private fetchWalletsFromSheets(): Observable<string[]> {
    return this.repository.getWallets();
  }

  private saveTransactions(transactions: CompleteTransaction[]): void {
    return this.repository.saveTransactions(transactions);
  }
}