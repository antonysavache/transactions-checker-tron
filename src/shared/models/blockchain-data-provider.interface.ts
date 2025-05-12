import { CompleteTransaction } from './transaction.interface';
import { Observable } from 'rxjs';

export interface IBlockchainDataProvider {
    fetch(wallets: string[], intervalHours?: number): Observable<CompleteTransaction[]>;
}