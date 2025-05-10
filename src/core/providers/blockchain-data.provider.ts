import {Injectable} from "@nestjs/common";
import { CompleteTransaction } from "@shared/models";
import { Observable, of } from "rxjs";
import { delay } from "rxjs/operators";
import {IBlockchainDataProvider} from "@shared/models/blockchain-data-provider.interface";

@Injectable()
export class MockBlockchainDataProvider implements IBlockchainDataProvider {
    fetch(wallets: string[]): Observable<CompleteTransaction[]> {
        console.log('MockBlockchainDataProvider: Generating mock transactions for wallets:', wallets);
        
        if (!wallets || wallets.length === 0) {
            console.log('MockBlockchainDataProvider: No wallets provided, using default wallets');
            wallets = ['TMrzxVJKZEvKknmHxpE3weErahEdXtX4C6', 'TDFjBhr63PxjRYaxR8N3z4Lwubq7z23GnB'];
        }
        
        const mockTransactions = this.generateMockTransactions(wallets, 10);
        console.log(`MockBlockchainDataProvider: Generated ${mockTransactions.length} mock transactions`);
        
        return of(mockTransactions).pipe(
            delay(1000)
        );
    }
    

    private generateMockTransactions(wallets: string[], count: number): CompleteTransaction[] {
        const mockTransactions: CompleteTransaction[] = [];
        mockTransactions.push({
            data: '1',
            walletSender: '2',
            walletReceiver: '3',
            hash: '4',
            amount: 0,
            currency: '5'
        })

        return mockTransactions;
    }
    
    /**
     * Форматирует дату в формат YYYY-MM-DD HH:MM:SS
     */
    private formatDate(date: Date): string {
        const pad = (num: number) => num.toString().padStart(2, '0');
        
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * Генерирует случайный хеш транзакции
     */
    private generateRandomHash(): string {
        const characters = '0123456789abcdef';
        let hash = '';
        
        for (let i = 0; i < 64; i++) {
            hash += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        return hash;
    }
}