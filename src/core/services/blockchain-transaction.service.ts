import { Injectable} from "@nestjs/common";
import { CompleteTransaction } from "@shared/models";
import { Observable } from "rxjs";
import { MockBlockchainDataProvider } from "@core/providers/mock/blockchain-data.provider";
import { TronBlockchainDataProvider } from "@core/providers/tron/tron-blockchain-data.provider";

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
    ) {}

    getTransactions(wallets: string[], intervalHours: number = 24,): Observable<CompleteTransaction[]> {
        return this.tronDataProvider.fetch(wallets, intervalHours)
    }
}