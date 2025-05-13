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
      console.log('GoogleSheetsService: Already initialized');
      return of(undefined);
    }
    
    return from(this.initializeSheets()).pipe(
      tap(() => {
        this.initialized = true;
        console.log('GoogleSheetsService: Initialized successfully');
        
        if (!this.spreadsheetId) {
          console.warn('GoogleSheetsService: GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID is not set!');
        }
      }),
      catchError(error => {
        this.initialized = true;
        return throwError(() => error);
      })
    );
  }

  getWallets(sheetName: string, range?: string): Observable<string[]> {
    return this.ensureInitialized().pipe(
      switchMap(() => {
        const fullRange = `${sheetName}!${range || 'A:A'}`;
        
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
    if (!transactions.length) {
      console.log('GoogleSheetsService: No transactions to save, returning early');
      return of(undefined);
    }
    
    return this.ensureInitialized().pipe(
      tap(() => console.log(`GoogleSheetsService: Successfully initialized, proceeding to save data`)),
      switchMap(() => {
        // Получаем ID таблицы для транзакций (может отличаться от ID таблицы для кошельков)
        const transactionsSpreadsheetId = process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID || this.spreadsheetId;
        console.log(`GoogleSheetsService: Using transactions spreadsheet ID: ${transactionsSpreadsheetId}`);
        
        if (!transactionsSpreadsheetId) {
          return throwError(() => new Error('GoogleSheetsService: GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID is not set!'));
        }
        
        // Сортируем транзакции по дате (от старых к новым)
        const sortedTransactions = [...transactions].sort((a, b) => {
          // Удаляем апостроф из начала даты, если он есть
          const dateA = a.data.startsWith("'") ? a.data.substring(1) : a.data;
          const dateB = b.data.startsWith("'") ? b.data.substring(1) : b.data;
          
          // Сравниваем даты в порядке возрастания (от старых к новым)
          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
        
        console.log(`GoogleSheetsService: Transactions sorted by date. First date: ${sortedTransactions[0]?.data}, Last date: ${sortedTransactions[sortedTransactions.length-1]?.data}`);
        
        // Преобразуем транзакции в формат для записи в таблицу
        // Текстовые поля предваряем апострофом, числа оставляем как есть
        const rows = sortedTransactions.map(tx => [
          // Добавляем апостроф к дате, чтобы Google Sheets интерпретировал её как текст
          tx.data.startsWith("'") ? tx.data : `'${tx.data}`,
          `'${tx.walletSender}`,    // Отправитель - как текст
          `'${tx.walletReceiver}`,  // Получатель - как текст
          `'${tx.hash}`,            // Хеш транзакции - как текст
          parseFloat(String(tx.amount)) || 0, // Сумма - как число (гарантируем числовой тип)
          `'${tx.currency}`         // Валюта - как текст
        ]);

        // Получаем диапазон из переменных окружения, если он определен
        let range = `${sheetName}!A:F`;
        
        // Проверяем есть ли специальные диапазоны для разных типов листов
        const ethTransactionsRange = process.env.GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE;
        const defaultTransactionsRange = process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE;
        
        if (sheetName === 'trans-erc' && ethTransactionsRange) {
          range = ethTransactionsRange;
          console.log(`GoogleSheetsService: Using ETH transactions range: ${range}`);
        } else if (sheetName === 'trans' && defaultTransactionsRange) {
          range = defaultTransactionsRange;
          console.log(`GoogleSheetsService: Using default transactions range: ${range}`);
        } else if (sheetName === 'test-trans' && defaultTransactionsRange) {
          range = defaultTransactionsRange;
          console.log(`GoogleSheetsService: Using test transactions range: ${range}`);
        } else if (sheetName) {
          console.log(`GoogleSheetsService: Using dynamic range for sheet ${sheetName}: ${range}`);
        }

        console.log(`GoogleSheetsService: Appending ${rows.length} rows to spreadsheet ID: ${transactionsSpreadsheetId}, range: ${range}`);
        
        // Добавляем timeout для отладки
        return new Observable<void>(observer => {
          setTimeout(() => {
            console.log(`GoogleSheetsService: Now executing Google Sheets API call`);
            
            from(this.sheets!.spreadsheets.values.append({
              spreadsheetId: transactionsSpreadsheetId,
              range: range,
              valueInputOption: 'USER_ENTERED', // Позволяет использовать спец. форматирование
              insertDataOption: 'INSERT_ROWS',
              requestBody: {
                values: rows
              }
            })).subscribe({
              next: response => {
                console.log(`GoogleSheetsService: Successfully saved transactions to ${sheetName}. Response:`, 
                  response.status, 
                  response.statusText, 
                  response.data?.updates?.updatedRange || 'unknown range'
                );
                observer.next(undefined);
                observer.complete();
              },
              error: error => {
                console.error(`GoogleSheetsService: Error in Google Sheets API call:`, error);
                observer.error(error);
              }
            });
          }, 500); // Небольшая задержка для отладки
        });
      }),
      catchError(error => {
        console.error(`GoogleSheetsService: Error saving transactions to sheet ${sheetName}:`, error);
        // Пробуем вывести более подробную информацию об ошибке
        if (error.response) {
          console.error(`Status: ${error.response.status}, Data:`, error.response.data);
        }
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Добавляет одну строку данных в указанную вкладку
   * @param sheetName Имя вкладки
   * @param row Строка данных
   * @returns Observable с результатами операции
   */
  appendRow(sheetName: string, row: any[]): Observable<void> {
    return this.ensureInitialized().pipe(
      switchMap(() => {
        const range = `${sheetName}!A:Z`;
        
        return from(this.sheets!.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: range,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [row]
          }
        })).pipe(
          map(() => undefined as void)
        );
      }),
      catchError(error => {
        console.error(`Error appending row to sheet ${sheetName}:`, error);
        return throwError(() => error);
      })
    );
  }
  
  private ensureInitialized(): Observable<void> {
    if (this.initialized) {
      if (!this.sheets) {
        console.error('GoogleSheetsService: sheets is null despite initialized=true!');
        return throwError(() => new Error('sheets is null'));
      }
      return of(undefined);
    }
    
    console.log('GoogleSheetsService: Not initialized yet, calling initialize()');
    return this.initialize().pipe(
      tap(() => {
        if (!this.sheets) {
          console.error('GoogleSheetsService: sheets is still null after initialize()!');
        }
      })
    );
  }
  
  private async initializeSheets(): Promise<void> {
    const credentialsStr = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (!credentialsStr) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS environment variable is not set');
    }
    
    try {
      const credentials = JSON.parse(credentialsStr);
      
      console.log(`GoogleSheetsService: Initializing with client_email: ${credentials.client_email}`);
      console.log(`GoogleSheetsService: Using spreadsheet ID: ${this.spreadsheetId}`);
      
      // Проверяем настройки
      if (!this.spreadsheetId) {
        console.warn('GoogleSheetsService: GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID is not set!');
      }
      
      // Проверяем наличие других важных настроек
      const sheetsEnabled = process.env.GOOGLE_SHEETS_ENABLED;
      console.log(`GoogleSheetsService: Google Sheets integration is ${sheetsEnabled === 'true' ? 'enabled' : 'disabled'}`);
      
      this.auth = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      // Проверяем наличие переменных для различных диапазонов
      console.log('GoogleSheetsService: Configured ranges:');
      console.log(`- GOOGLE_SHEETS_WALLETS_RANGE: ${process.env.GOOGLE_SHEETS_WALLETS_RANGE || 'not set'}`);
      console.log(`- GOOGLE_SHEETS_ETH_WALLETS_RANGE: ${process.env.GOOGLE_SHEETS_ETH_WALLETS_RANGE || 'not set'}`);
      console.log(`- GOOGLE_SHEETS_TRANSACTIONS_RANGE: ${process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE || 'not set'}`);
      console.log(`- GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE: ${process.env.GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE || 'not set'}`);
      
    } catch (error) {
      console.error('GoogleSheetsService: Error parsing credentials or initializing:', error);
      throw error;
    }
  }
}