import { Observable, tap } from "rxjs";
import { CompleteTransaction } from "@shared/models";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { GoogleSheetsService } from '@shared/services/google-sheets.service';

@Injectable()
export class Repository implements OnModuleInit {
    constructor(
        private readonly googleSheetsService: GoogleSheetsService
    ) {
    }
    
    async onModuleInit() {
        try {
            await this.testGoogleSheetsConnection();
        } catch (error) {
            console.error('Repository.onModuleInit: Error testing Google Sheets connection:', error);
        }
    }
    
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
    
    getWallets(sheetName: string): Observable<string[]> {
        return this.googleSheetsService.getWallets(sheetName);
    }

    saveTransactions(transactions: CompleteTransaction[], sheetName: string): void {
        if (!transactions.length) {
            console.log('Repository: No transactions to save');
            return;
        }

        const spreadsheetId = process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID;
        if (!spreadsheetId) {
            console.error('Repository: GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID is not set!');
        }

        this.googleSheetsService.saveTransactions(transactions, sheetName)
            .subscribe({
                next: () => console.log(`Repository: Transactions saved successfully to ${sheetName}`),
                error: error => {
                    console.error(`Repository: Error saving transactions to ${sheetName}:`, error);
                }
            });
    }
}