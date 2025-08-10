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

  /**
   * Получает существующие комбинации хеш+сумма из таблицы для фильтрации дублей
   * @param sheetName Имя листа с транзакциями
   * @returns Observable с Set комбинаций "хеш-сумма"
   */
  getExistingTransactionHashes(sheetName: string): Observable<Set<string>> {
    return this.ensureInitialized().pipe(
      switchMap(() => {
        const transactionsSpreadsheetId = process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID || this.spreadsheetId;
        
        // Получаем диапазон для хешей (колонка D) и сумм (колонка E)
        let hashAmountRange = `${sheetName}!D:E`;
        
        console.log(`GoogleSheetsService: Fetching existing transaction hashes and amounts from ${hashAmountRange}`);
        
        return from(this.sheets!.spreadsheets.values.get({
          spreadsheetId: transactionsSpreadsheetId,
          range: hashAmountRange,
        }));
      }),
      map(response => {
        const values = response.data.values || [];
        
        // Извлекаем комбинации хеш+сумма, пропуская заголовок и пустые строки
        const hashAmountCombinations = new Set<string>();
        
        values.forEach((row, index) => {
          if (index === 0) return; // Пропускаем заголовок
          
          const hash = row[0]?.toString().trim(); // Колонка D (хеш)
          const amount = row[1]?.toString().trim(); // Колонка E (сумма)
          
          if (hash && amount && hash.length > 0 && !hash.startsWith('#') && hash !== 'hash') {
            // Убираем апостроф из начала хеша, если есть
            const cleanHash = hash.startsWith("'") ? hash.substring(1) : hash;
            
            // Нормализуем сумму - приводим к числу и обратно для единообразия
            const numAmount = parseFloat(amount);
            const normalizedAmount = isNaN(numAmount) ? amount : numAmount.toFixed(2);
            
            // Создаем уникальный ключ: "хеш-сумма"
            const uniqueKey = `${cleanHash}-${normalizedAmount}`;
            hashAmountCombinations.add(uniqueKey);
          }
        });
        
        console.log(`GoogleSheetsService: Found ${hashAmountCombinations.size} existing hash-amount combinations`);
        return hashAmountCombinations;
      }),
      catchError(error => {
        console.error(`GoogleSheetsService: Error fetching existing hash-amount combinations from ${sheetName}:`, error);
        // Возвращаем пустой Set в случае ошибки, чтобы не блокировать сохранение
        return of(new Set<string>());
      })
    );
  }

  saveTransactions(transactions: CompleteTransaction[], sheetName: string): Observable<void> {
    if (!transactions.length) {
      console.log('GoogleSheetsService: No transactions to save, returning early');
      return of(undefined);
    }
    
    return this.ensureInitialized().pipe(
      tap(() => console.log(`GoogleSheetsService: Successfully initialized, proceeding to check for duplicates`)),
      switchMap(() => {
        // Сначала получаем существующие комбинации хеш+сумма для фильтрации дублей
        return this.getExistingTransactionHashes(sheetName);
      }),
      switchMap((existingHashAmountCombinations) => {
        // Фильтруем транзакции, исключая дубли по комбинации хеш+сумма
        const uniqueTransactions = transactions.filter(tx => {
          // Нормализуем сумму для сравнения
          const numAmount = parseFloat(String(tx.amount));
          const normalizedAmount = isNaN(numAmount) ? String(tx.amount) : numAmount.toFixed(2);
          const uniqueKey = `${tx.hash}-${normalizedAmount}`;
          const isDuplicate = existingHashAmountCombinations.has(uniqueKey);
          
          if (isDuplicate) {
            console.log(`GoogleSheetsService: Skipping duplicate transaction with hash: ${tx.hash} and amount: ${normalizedAmount}`);
          }
          return !isDuplicate;
        });
        
        console.log(`GoogleSheetsService: Filtered ${transactions.length - uniqueTransactions.length} duplicate transactions. ${uniqueTransactions.length} unique transactions remain.`);
        
        if (!uniqueTransactions.length) {
          console.log('GoogleSheetsService: No unique transactions to save after filtering duplicates');
          return of(undefined);
        }
        
        // Получаем ID таблицы для транзакций
        const transactionsSpreadsheetId = process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID || this.spreadsheetId;
        console.log(`GoogleSheetsService: Using transactions spreadsheet ID: ${transactionsSpreadsheetId}`);
        
        if (!transactionsSpreadsheetId) {
          return throwError(() => new Error('GoogleSheetsService: GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID is not set!'));
        }
        
        // Сортируем уникальные транзакции по дате (от старых к новым)
        const sortedTransactions = [...uniqueTransactions].sort((a, b) => {
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
          parseFloat(String(tx.amount)) || 0, // Сумма - как число
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
  
  /**
   * Сохраняет лог-запись на страницу "logs" в Google Таблице
   * @param logEntry Текст лог-записи
   * @returns Observable, завершающийся после сохранения или с ошибкой
   */
  saveLog(logEntry: string): Observable<void> {
    console.log(`GoogleSheetsService: Saving log entry: ${logEntry}`);
    
    return this.ensureInitialized().pipe(
      switchMap(() => {
        // Используем тот же ID таблицы, что и для основных данных
        const spreadsheetId = this.spreadsheetId;
        
        if (!spreadsheetId) {
          return throwError(() => new Error('GoogleSheetsService: No spreadsheet ID configured'));
        }
        
        // Создаем запись лога с текущей датой и временем
        const now = new Date();
        const timestamp = now.toISOString().replace('T', ' ').substring(0, 19); // Формат: YYYY-MM-DD HH:MM:SS
        
        // Форматируем строку для записи
        const row = [
          `'${timestamp}`, // Дата и время как текст
          `'${logEntry}`   // Текст лога как текст
        ];
        
        // Фиксированная страница "logs"
        const range = `logs!A:B`;
        
        return from(this.sheets!.spreadsheets.values.append({
          spreadsheetId: spreadsheetId,
          range: range,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [row]
          }
        })).pipe(
          map(() => {
            console.log(`GoogleSheetsService: Log entry saved successfully`);
            return undefined as void;
          })
        );
      }),
      catchError(error => {
        console.error(`GoogleSheetsService: Error saving log:`, error);
        return throwError(() => error);
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