import { Observable } from "rxjs";
import { CompleteTransaction } from "@shared/models";
import { Injectable } from "@nestjs/common";
import { GoogleSheetsService } from '@shared/services/google-sheets.service';

@Injectable()
export class Repository {
    constructor(private readonly googleSheetsService: GoogleSheetsService) {
        console.log('Repository created');
    }
    
    getWallets(): Observable<string[]> {
        console.log('Repository: Getting wallets from Google Sheets');
        // Получаем кошельки с вкладки test-wallets
        return this.googleSheetsService.getWallets('test-wallets');
    }

    saveTransactions(transactions: CompleteTransaction[]): void {
        console.log('Repository: Saving transactions to Google Sheets, count:', transactions.length);
        
        if (transactions.length === 0) {
            console.log('Repository: No transactions to save');
            return;
        }
        
        console.log('Repository: First transaction:', JSON.stringify(transactions[0]));
        
        // Сохраняем транзакции на вкладку test-trans
        this.googleSheetsService.saveTransactions(transactions, 'test-trans')
            .subscribe({
                next: () => console.log('Repository: Transactions saved successfully'),
                error: error => console.error('Repository: Error saving transactions:', error)
            });
    }
}