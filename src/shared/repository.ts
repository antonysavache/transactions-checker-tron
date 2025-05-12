import { Observable, tap } from "rxjs";
import { CompleteTransaction } from "@shared/models";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { GoogleSheetsService } from '@shared/services/google-sheets.service';

@Injectable()
export class Repository implements OnModuleInit {
    private readonly serviceName = 'Repository';

    constructor(
        private readonly googleSheetsService: GoogleSheetsService
    ) {
        console.log('Repository created');
    }
    
    async onModuleInit() {
        console.log('Repository.onModuleInit: Testing Google Sheets connection...');
        
        try {
            // Проверяем подключение при инициализации
            await this.testGoogleSheetsConnection();
            console.log('Repository.onModuleInit: Google Sheets connection test successful');
            
            // Добавим тестовую запись
            this.testGoogleSheetsWriting();
        } catch (error) {
            console.error('Repository.onModuleInit: Error testing Google Sheets connection:', error);
        }
    }
    
    /**
     * Тестирует запись в Google Sheets
     */
    private testGoogleSheetsWriting(): void {
        // Если Google Sheets не включен, не выполняем тест
        if (process.env.GOOGLE_SHEETS_ENABLED !== 'true') {
            console.log('Repository: Google Sheets is disabled, skipping write test');
            return;
        }
        
        console.log('Repository: Testing writing to Google Sheets...');
        
        // Создаем тестовую транзакцию
        const testTransaction: CompleteTransaction = {
            data: `'${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
            walletSender: 'TEST_SENDER',
            walletReceiver: 'TEST_RECEIVER',
            hash: `TEST_${Date.now()}`,
            amount: 0.001,
            currency: 'TEST'
        };
        
        console.log('Repository: Test transaction:', JSON.stringify(testTransaction));
        
        // Сохраняем тестовую транзакцию в таблицу логов
        const logsSheet = 'logs';
        
        this.googleSheetsService.saveTransactions([testTransaction], logsSheet)
            .subscribe({
                next: () => console.log(`Repository: Test transaction saved successfully to ${logsSheet}`),
                error: error => console.error(`Repository: Error saving test transaction to ${logsSheet}:`, error)
            });
    }
    
    /**
     * Проверяет подключение к Google Sheets
     */
    private async testGoogleSheetsConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.googleSheetsService.initialize().subscribe({
                next: () => {
                    console.log('Repository: Google Sheets service initialized successfully');
                    resolve();
                },
                error: error => {
                    console.error('Repository: Error initializing Google Sheets service:', error);
                    reject(error);
                }
            });
        });
    }
    
    /**
     * Получает кошельки с указанной вкладки
     * @param sheetName Имя вкладки с кошельками
     * @returns Observable со списком кошельков
     */
    getWallets(sheetName: string = 'test-wallets'): Observable<string[]> {
        console.log(`Repository: Getting wallets from Google Sheets, sheet: ${sheetName}`);
        return this.googleSheetsService.getWallets(sheetName);
    }

    /**
     * Сохраняет транзакции на указанную вкладку
     * @param transactions Транзакции для сохранения
     * @param sheetName Имя вкладки для сохранения
     */
    saveTransactions(transactions: CompleteTransaction[], sheetName: string = 'test-trans'): void {
        console.log(`Repository: Saving ${transactions.length} transactions to Google Sheets, sheet: ${sheetName}`);
        
        if (transactions.length === 0) {
            console.log('Repository: No transactions to save');
            return;
        }
        
        // Логируем первую транзакцию для диагностики
        if (transactions.length > 0) {
            console.log('Repository: First transaction:', JSON.stringify(transactions[0]));
        }
        
        // Проверим переменные окружения для определения правильного spreadsheetId
        const spreadsheetId = process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID;
        if (!spreadsheetId) {
            console.error('Repository: GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID is not set!');
        }
        
        // Проверяем, включена ли интеграция с Google Sheets
        const sheetsEnabled = process.env.GOOGLE_SHEETS_ENABLED;
        if (sheetsEnabled !== 'true') {
            console.warn(`Repository: Google Sheets integration is disabled (GOOGLE_SHEETS_ENABLED=${sheetsEnabled})`);
            return;
        }
        
        this.googleSheetsService.saveTransactions(transactions, sheetName)
            .subscribe({
                next: () => console.log(`Repository: Transactions saved successfully to ${sheetName}`),
                error: error => {
                    console.error(`Repository: Error saving transactions to ${sheetName}:`, error);
                    
                    // Пробуем упростить сохранение в случае ошибки - сохраняем только одну транзакцию для теста
                    if (transactions.length > 0) {
                        console.log('Repository: Attempting to save just the first transaction as a test...');
                        this.googleSheetsService.saveTransactions([transactions[0]], sheetName)
                            .subscribe({
                                next: () => console.log(`Repository: Test transaction saved successfully to ${sheetName}`),
                                error: err => console.error(`Repository: Error saving test transaction to ${sheetName}:`, err)
                            });
                    }
                }
            });
    }
}