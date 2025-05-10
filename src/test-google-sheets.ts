import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MonitorService } from '@core/services/monitor-service';
import { Repository } from '@shared/repository';
import { GoogleSheetsService } from '@shared/services/google-sheets.service';
import { Observable, of } from 'rxjs';
import { CompleteTransaction } from '@shared/models';

/**
 * Тестовый скрипт для проверки сохранения транзакций в Google Sheets
 */
async function testGoogleSheets() {
  // Создаем тестовые транзакции
  const testTransactions: CompleteTransaction[] = [
    {
      data: '2025-04-24 15:27:45',
      walletSender: 'TMrzxVJKZEvKknmHxpE3weErahEdXtX4C6',
      walletReceiver: 'TDFjBhr63PxjRYaxR8N3z4Lwubq7z23GnB',
      hash: 'c51046117b53d38f797173642e0c8bcaa706ad5ff248bc83f517a3b7b9792392',
      amount: 1100.00,
      currency: 'USDT',
    },
    {
      data: '2025-04-25 12:30:15',
      walletSender: 'TMrzxVJKZEvKknmHxpE3weErahEdXtX4C6',
      walletReceiver: 'TS1ptj4r95TLBHWvpozBhYzqykxAjy3izX',
      hash: 'a71046117b53d38f797173642e0c8bcaa706ad5ff248bc83f517a3b7b9792123',
      amount: 500.50,
      currency: 'TRX',
    }
  ];

  // Создаем приложение
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // Получаем сервис Google Sheets
    const googleSheetsService = app.get(GoogleSheetsService);
    
    console.log('Initializing Google Sheets service...');
    // Инициализируем сервис
    googleSheetsService.initialize().subscribe({
      next: () => {
        console.log('Google Sheets service initialized successfully');
        
        console.log('Saving test transactions...');
        // Сохраняем тестовые транзакции
        googleSheetsService.saveTransactions(testTransactions, 'test-trans').subscribe({
          next: () => console.log('Test transactions saved successfully'),
          error: error => console.error('Error saving test transactions:', error)
        });
      },
      error: error => console.error('Error initializing Google Sheets service:', error)
    });
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Запускаем тестовый скрипт если запущен напрямую
if (require.main === module) {
  console.log('Running test script...');
  testGoogleSheets();
}