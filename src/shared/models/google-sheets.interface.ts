import { Observable } from 'rxjs';
import { CompleteTransaction } from './transaction.interface';

export interface IGoogleSheetsService {
  initialize(): Observable<void>;
  getWallets(sheetName: string, range?: string): Observable<string[]>;
  saveTransactions(transactions: CompleteTransaction[], sheetName: string): Observable<void>;
}