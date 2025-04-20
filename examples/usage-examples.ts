/**
 * Примеры использования библиотеки True Transaction Spy
 */

import { monitorTransactions } from '../src';

/**
 * Пример 1: Базовый мониторинг за последний час
 */
async function basicMonitoring() {
  try {
    const results = await monitorTransactions({
      wallets: [
        'TXmVpin5vq5gdZsciyyjdZgKRUju4st1wM', // Пример адреса (Binance Hot Wallet)
        'TNaRAoLUyYEV2uF7GUrzSjRQTU8v5ZJ5VR'  // Другой пример
      ],
      timeIntervalHours: 1 // за последний час
    });

    console.log('Базовый мониторинг:');
    console.log(`Найдено транзакций: ${results.length}`);
    console.log('Первые 3 транзакции:');
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
  } catch (error) {
    console.error('Ошибка в базовом мониторинге:', (error as Error).message);
  }
}

/**
 * Пример 2: Мониторинг за определенный период времени
 */
async function specificPeriodMonitoring() {
  try {
    // Период: 1 января 2023, 00:00:00 - 2 января 2023, 00:00:00
    const startTime = new Date('2023-01-01T00:00:00Z').getTime();
    const endTime = new Date('2023-01-02T00:00:00Z').getTime();

    const results = await monitorTransactions({
      wallets: ['TXmVpin5vq5gdZsciyyjdZgKRUju4st1wM'],
      timeFrame: {
        startTime,
        endTime
      }
    });

    console.log('Мониторинг за конкретный период:');
    console.log(`Найдено транзакций: ${results.length}`);
    console.log('Первые 3 транзакции:');
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
  } catch (error) {
    console.error('Ошибка в мониторинге за период:', (error as Error).message);
  }
}

/**
 * Пример 3: Мониторинг одного кошелька
 */
async function singleWalletMonitoring() {
  try {
    const results = await monitorTransactions({
      wallets: 'TXmVpin5vq5gdZsciyyjdZgKRUju4st1wM', // один кошелек как строка
      timeIntervalHours: 24 // за последние 24 часа
    });

    console.log('Мониторинг одного кошелька:');
    console.log(`Найдено транзакций: ${results.length}`);
    console.log('Первые 3 транзакции:');
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
  } catch (error) {
    console.error('Ошибка в мониторинге одного кошелька:', (error as Error).message);
  }
}

/**
 * Запуск всех примеров последовательно
 */
async function runAllExamples() {
  console.log('========= НАЧАЛО ПРИМЕРОВ =========');
  
  await basicMonitoring();
  console.log('\n');
  
  await specificPeriodMonitoring();
  console.log('\n');
  
  await singleWalletMonitoring();
  
  console.log('========= КОНЕЦ ПРИМЕРОВ =========');
}

// Запуск всех примеров
runAllExamples().catch(error => {
  console.error('Ошибка при выполнении примеров:', (error as Error).message);
});