import { Injectable } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Observable, from, of, throwError } from 'rxjs';
import { tap, switchMap, catchError, map } from 'rxjs/operators';
import { IGoogleSheetsService } from '@shared/models/google-sheets.interface';
import { CompleteTransaction } from '@shared/models';

@Injectable()
export class GoogleSheetsService implements IGoogleSheetsService {
  private auth: JWT | null = null;
  private sheets: sheets_v4.Sheets | null = null;
  private initialized = false;
  private readonly spreadsheetId: string;
  
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID || '';
  }
  
  initialize(): Observable<void> {
    if (this.initialized) {
      return of(undefined);
    }
    
    return from(this.initializeSheets()).pipe(
      tap(() => {
        this.initialized = true;
        console.log('GoogleSheetsService initialized successfully');
      }),
      catchError(error => {
        console.error('Failed to initialize GoogleSheetsService:', error);
        return throwError(() => error);
      })
    );
  }

  getWallets(sheetName: string, range?: string): Observable<string[]> {
    return this.ensureInitialized().pipe(
      switchMap(() => {
        const fullRange = `${sheetName}!${range || 'A:A'}`;
        
        console.log(`Fetching wallets from ${this.spreadsheetId}, range: ${fullRange}`);
        
        return from(this.sheets!.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: fullRange,
        }));
      }),
      map(response => {
        const values = response.data.values || [];
        
        const wallets = values
          .map(row => row[0]?.toString().trim())
          .filter(wallet => wallet && wallet.length > 0 && !wallet.startsWith('#'));
        
        console.log(`Successfully fetched ${wallets.length} wallets from sheet ${sheetName}`);
        
        return wallets;
      }),
      catchError(error => {
        console.error(`Error fetching wallets from sheet ${sheetName}:`, error);
        return throwError(() => error);
      })
    );
  }

  saveTransactions(transactions: CompleteTransaction[], sheetName: string): Observable<void> {
    return this.ensureInitialized().pipe(
      switchMap(() => {
        // Преобразуем транзакции в формат для записи в таблицу
        const rows = transactions.map(tx => [
          tx.data,                // Дата
          tx.walletSender,        // Отправитель
          tx.walletReceiver,      // Получатель
          tx.hash,                // Хеш транзакции
          tx.amount,              // Сумма
          tx.currency             // Валюта
        ]);

        const range = `${sheetName}!A:F`;

        return from(this.sheets!.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: range,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: rows
          }
        })).pipe(
          map(() => undefined as void)
        );
      }),
      catchError(error => {
        console.error(`Error saving transactions to sheet ${sheetName}:`, error);
        return throwError(() => error);
      })
    );
  }
  
  private ensureInitialized(): Observable<void> {
    if (this.initialized) {
      return of(undefined);
    }
    return this.initialize();
  }
  
  private async initializeSheets(): Promise<void> {
    const credentialsStr = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentialsStr) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS environment variable is not set');
    }
    
    const credentials = JSON.parse(credentialsStr);
    
    this.auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }
}