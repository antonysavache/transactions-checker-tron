/**
 * Утилита для настройки Google Sheets
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { GoogleSheetsService } from '../services/google-sheets-service/google-sheets-service';
import { IProcessedTransaction } from '../types';

// Загружаем конфигурацию из .env файла
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Функция для интерактивного ввода
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Основная функция настройки
async function setup() {
  console.log('Google Sheets Setup Utility');
  console.log('===========================');
  
  try {
    // Проверяем наличие переменных окружения
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
      console.error('Error: GOOGLE_SHEETS_CREDENTIALS environment variable is not set.');
      process.exit(1);
    }
    
    console.log('Credentials found in environment variables.');
    
    // Создаем сервис
    const sheetsService = new GoogleSheetsService();
    
    // Инициализируем сервис
    await sheetsService.initialize();
    console.log('Google Sheets service initialized successfully.');
    
    // Проверяем доступ к таблицам
    if (!process.env.GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID) {
      const spreadsheetId = await prompt('Enter the Wallets Spreadsheet ID: ');
      process.env.GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID = spreadsheetId;
    }
    
    if (!process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID) {
      const spreadsheetId = await prompt('Enter the Transactions Spreadsheet ID: ');
      process.env.GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID = spreadsheetId;
    }
    
    console.log('\nTesting connection...');
    
    // Тестовая транзакция
    const testTransaction: IProcessedTransaction = {
      id: 'test-transaction-id',
      fromAddress: 'TEST_FROM_ADDRESS',
      toAddress: 'TEST_TO_ADDRESS',
      amount: 1.234,
      ticker: 'TEST',
      date: new Date().toISOString(),
      network: 'ETH',
      status: 'confirmed',
      fee: 0.01,
      feeCurrency: 'ETH'
    };
    
    // Сохраняем тестовую транзакцию
    console.log('Saving test transaction...');
    // Передаем второй параметр network
    await sheetsService.saveTransactions([testTransaction], 'ETH');
    console.log('Test transaction saved successfully.');
    
    console.log('\nSetup completed successfully.');
    console.log('You can now run the application with Google Sheets integration enabled.');
  } catch (error) {
    console.error('Error during setup:', (error as Error).message);
    console.error('Please check your credentials and spreadsheet IDs.');
  } finally {
    rl.close();
  }
}

// Запускаем настройку, если этот файл запущен напрямую
if (require.main === module) {
  setup().catch(error => {
    console.error('Fatal error during setup:', error);
    process.exit(1);
  });
}

export { setup };
