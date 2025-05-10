import { Injectable} from "@nestjs/common";
import { IBlockChainTransactionProcessor, CompleteTransaction} from "@shared/models";
import { Observable} from "rxjs";
import { MockBlockchainDataProvider } from "@core/providers/blockchain-data.provider";

@Injectable()
export class BlockchainTransaction implements IBlockChainTransactionProcessor {
    network = 'MOCK';

    constructor(private blockChainDataProvider: MockBlockchainDataProvider) {}

    getTransactions(wallets: string[]): Observable<CompleteTransaction[]> {
        console.log(`Getting transactions for wallets: ${wallets}`);
        return this.blockChainDataProvider.fetch(wallets);
    }
}