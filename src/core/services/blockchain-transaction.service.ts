import { Injectable} from "@nestjs/common";
import { CompleteTransaction } from "@shared/models";
import { Observable, tap } from "rxjs";
import { MockBlockchainDataProvider } from "@core/providers/mock/blockchain-data.provider";
import { TronBlockchainDataProvider } from "@core/providers/tron/tron-blockchain-data.provider";
import { Repository } from "@shared/repository";

export enum BlockchainType {
    MOCK = 'MOCK',
    TRON = 'TRON',
    ETH = 'ETH'
}

@Injectable()
export class BlockchainTransaction {
    constructor(
        private mockDataProvider: MockBlockchainDataProvider,
        private tronDataProvider: TronBlockchainDataProvider,
        private repository: Repository
    ) {}

    getTransactions(wallets: string[], intervalHours: number = 24): Observable<CompleteTransaction[]> {
        return this.tronDataProvider.fetch(wallets, intervalHours).pipe(
            tap(transactions => {
                // Группируем транзакции по кошелькам
                const walletTransactions = new Map<string, number>();
                
                // Считаем транзакции для каждого кошелька
                transactions.forEach(tx => {
                    // Учитываем как входящие, так и исходящие транзакции
                    if (wallets.includes(tx.walletSender)) {
                        walletTransactions.set(
                            tx.walletSender, 
                            (walletTransactions.get(tx.walletSender) || 0) + 1
                        );
                    }
                    
                    if (wallets.includes(tx.walletReceiver)) {
                        walletTransactions.set(
                            tx.walletReceiver, 
                            (walletTransactions.get(tx.walletReceiver) || 0) + 1
                        );
                    }
                });
                
                // Логируем количество транзакций для каждого кошелька
                wallets.forEach(wallet => {
                    const count = walletTransactions.get(wallet) || 0;
                    const logMessage = `Successfully fetched ${count} total transactions for wallet ${wallet}`;
                    console.log(logMessage);
                    this.repository.saveLog(logMessage);
                });
            })
        );
    }
}