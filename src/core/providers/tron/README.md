# Инструкции по установке TronWeb

Для работы с TronBlockchainDataProvider необходимо установить следующие зависимости:

```bash
npm install tronweb axios rxjs
```

## Возможные проблемы

### Отсутствие типов для TronWeb

Библиотека TronWeb не имеет официальных TypeScript типов. Мы создали файл определения типов в `src/types/tronweb.d.ts`, который содержит базовые типы для основных функций, используемых в нашем коде.

### Дополнительные зависимости TronWeb

TronWeb имеет большое количество зависимостей, некоторые из которых могут вызывать проблемы при сборке. Если столкнетесь с ошибками, связанными с зависимостями TronWeb, может потребоваться установить дополнительные пакеты:

```bash
npm install crypto-browserify stream-browserify assert stream-http https-browserify os-browserify
```

## Настройка проекта для работы с TronWeb

Если вы используете webpack, вам может потребоваться добавить следующие настройки в ваш webpack.config.js:

```javascript
resolve: {
  fallback: {
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "assert": require.resolve("assert"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "os": require.resolve("os-browserify/browser")
  }
}
```

## Использование TronBlockchainDataProvider

```typescript
import { TronBlockchainDataProvider } from '@core/providers/tron/tron-blockchain-data.provider';

@Injectable()
export class YourService {
  constructor(private tronProvider: TronBlockchainDataProvider) {}
  
  async someMethod() {
    // Пример использования
    this.tronProvider.fetch(['TRX_ADDRESS_1', 'TRX_ADDRESS_2']).subscribe(
      transactions => {
        console.log('Полученные транзакции:', transactions);
        
        // Фильтрация входящих транзакций
        const incoming = transactions.filter(tx => 
          tx.walletReceiver === 'TRX_ADDRESS_1' || tx.walletReceiver === 'TRX_ADDRESS_2'
        );
        
        // Фильтрация исходящих транзакций
        const outgoing = transactions.filter(tx => 
          tx.walletSender === 'TRX_ADDRESS_1' || tx.walletSender === 'TRX_ADDRESS_2'
        );
        
        console.log('Входящие транзакции:', incoming);
        console.log('Исходящие транзакции:', outgoing);
      },
      error => console.error('Ошибка получения транзакций:', error)
    );
  }
}
```