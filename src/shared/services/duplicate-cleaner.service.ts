import { Injectable } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';

interface TransactionRow {
  index: number;
  data: any[];
  hash: string;
  amount: string;
  uniqueKey: string;
}

@Injectable()
export class DuplicateCleanerService {
  
  /**
   * Удаляет дубликаты из указанного листа Google Таблицы
   * @param sheets Инстанс Google Sheets API
   * @param spreadsheetId ID таблицы
   * @param sheetName Имя листа
   * @returns Observable, завершающийся после очистки
   */
  cleanDuplicates(
    sheets: sheets_v4.Sheets, 
    spreadsheetId: string, 
    sheetName: string
  ): Observable<number> {
    console.log(`DuplicateCleanerService: Starting cleanup for sheet ${sheetName}`);
    
    return this.getAllSheetData(sheets, spreadsheetId, sheetName).pipe(
      switchMap((allData) => {
        if (allData.length <= 1) {
          console.log('DuplicateCleanerService: No data to clean (only headers or empty sheet)');
          return of(0);
        }
        
        const { uniqueRows, duplicateCount } = this.findAndFilterDuplicates(allData);
        
        if (duplicateCount === 0) {
          console.log('DuplicateCleanerService: No duplicates found');
          return of(0);
        }
        
        console.log(`DuplicateCleanerService: Found ${duplicateCount} duplicates, removing them...`);
        
        return this.replaceSheetData(sheets, spreadsheetId, sheetName, uniqueRows).pipe(
          map(() => duplicateCount)
        );
      }),
      catchError(error => {
        console.error('DuplicateCleanerService: Error during cleanup:', error);
        return throwError(() => error);
      })
    );
  }
  
  /**
   * Получает все данные из листа
   */
  private getAllSheetData(
    sheets: sheets_v4.Sheets, 
    spreadsheetId: string, 
    sheetName: string
  ): Observable<any[][]> {
    const range = `${sheetName}!A:F`;
    
    return from(sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range,
    })).pipe(
      map(response => response.data.values || [])
    );
  }
  
  /**
   * Находит и фильтрует дубликаты
   */
  private findAndFilterDuplicates(allData: any[][]): { uniqueRows: any[][], duplicateCount: number } {
    const headers = allData[0];
    const dataRows = allData.slice(1);
    
    console.log(`DuplicateCleanerService: Processing ${dataRows.length} data rows`);
    
    const seenCombinations = new Set<string>();
    const uniqueRows: any[][] = [headers]; // Начинаем с заголовков
    let duplicateCount = 0;
    
    dataRows.forEach((row, index) => {
      // Хеш в колонке D (индекс 3), сумма в колонке E (индекс 4)
      const hash = row[3]?.toString().trim();
      const amount = row[4]?.toString().trim();
      
      if (hash && amount && hash.length > 0) {
        // Убираем апостроф из начала хеша, если есть
        const cleanHash = hash.startsWith("'") ? hash.substring(1) : hash;
        
        // Нормализуем сумму
        const numAmount = parseFloat(amount);
        const normalizedAmount = isNaN(numAmount) ? amount : numAmount.toFixed(2);
        
        const uniqueKey = `${cleanHash}-${normalizedAmount}`;
        
        if (seenCombinations.has(uniqueKey)) {
          duplicateCount++;
          console.log(`DuplicateCleanerService: Removing duplicate row ${index + 2}: ${uniqueKey}`);
        } else {
          seenCombinations.add(uniqueKey);
          uniqueRows.push(row);
        }
      } else {
        // Строки без хеша или суммы тоже сохраняем
        uniqueRows.push(row);
      }
    });
    
    return { uniqueRows, duplicateCount };
  }
  
  /**
   * Заменяет данные в листе
   */
  private replaceSheetData(
    sheets: sheets_v4.Sheets, 
    spreadsheetId: string, 
    sheetName: string, 
    newData: any[][]
  ): Observable<void> {
    const range = `${sheetName}!A:F`;
    
    // Сначала очищаем лист
    return from(sheets.spreadsheets.values.clear({
      spreadsheetId: spreadsheetId,
      range: range,
    })).pipe(
      switchMap(() => {
        // Затем записываем новые данные
        return from(sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: newData
          }
        }));
      }),
      map(() => {
        console.log(`DuplicateCleanerService: Successfully updated sheet with ${newData.length} rows`);
        return undefined as void;
      })
    );
  }
}
