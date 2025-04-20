# True Transaction Spy

Сервис для мониторинга транзакций в сети TRON для определенных кошельков.

## Особенности

- Отслеживание транзакций TRX и TRC20 токенов
- Интеграция с Google Sheets для получения списка кошельков
- Автоматическая запись транзакций в Google Sheets
- Периодическое сканирование с настраиваемым интервалом

## Требования для развертывания

- Node.js 16+
- Учетные данные Google API
- Доступ к таблице Google Sheets

## Переменные окружения

```
# API URL для сети TRON
TRON_API_URL=https://api.trongrid.io

# Задержка между запросами в миллисекундах
REQUEST_DELAY=300

# Максимальное количество повторных попыток при ошибке
MAX_RETRIES=3

# Интервал времени по умолчанию в часах
DEFAULT_TIME_INTERVAL=1

# Google Sheets интеграция
GOOGLE_SHEETS_ENABLED=true

# Учетные данные Google сервисного аккаунта (JSON)
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}

# ID Google таблицы с кошельками и диапазон ячеек
GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SHEETS_WALLETS_RANGE=wallets!A:A

# ID Google таблицы с транзакциями и диапазон ячеек
GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SHEETS_TRANSACTIONS_RANGE=trans!A:H
```

## Команды

- `npm run build` - Сборка проекта
- `npm run start:monitor` - Запуск мониторинга
- `npm run setup:sheets` - Проверка и настройка интеграции с Google Sheets# transactions-checker
