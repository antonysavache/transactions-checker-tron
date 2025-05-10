import { CompleteTransaction } from './transaction.interface';
import { Observable } from 'rxjs';

export interface IBlockchainDataProvider {
    fetch(wallets: string[]): Observable<CompleteTransaction[]>;
}