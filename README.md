# Transactions Checker для TRON и Ethereum

Сервис для мониторинга транзакций в блокчейнах TRON и Ethereum с записью результатов в Google Sheets.

## Основные возможности

- Мониторинг TRON-транзакций (TRX и TRC20 токены)
- Мониторинг Ethereum-транзакций (ETH и ERC20 токены: USDT, USDC)
- Интеграция с Google Sheets для сохранения результатов
- Автоматическое выполнение по расписанию
- Легко настраиваемый через конфигурационные файлы

## Требования

- Node.js 16+
- Доступ к Google Sheets API (сервисный аккаунт)
- Etherscan API ключ для Ethereum
- Доступ к TRON API

## Установка и запуск локально

1. Клонировать репозиторий
```bash
git clone https://github.com/yourusername/transactions-checker.git
cd transactions-checker
```

2. Установить зависимости
```bash
npm install
```

3. Скопировать `.env.example` в `.env` и заполнить все необходимые переменные
```bash
cp .env.example .env
```

4. Сборка проекта
```bash
npm run build
```

5. Запуск
```bash
# Мониторинг обеих сетей
npm run start:all

# Мониторинг только TRON
npm run start:monitor

# Мониторинг только Ethereum
npm run start:eth
```

## Настройка

Основная настройка производится через файл `.env`:

```
# API URLs
TRON_API_URL=https://api.trongrid.io
ETH_API_URL=https://api.etherscan.io/api
ETH_API_KEY=your_api_key_here

# Параметры по умолчанию
DEFAULT_NETWORK=ALL
REQUEST_DELAY=300
MAX_RETRIES=3
DEFAULT_TIME_INTERVAL=1

# Google Sheets
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_WALLETS_RANGE=wallets!A:A
GOOGLE_SHEETS_ETH_WALLETS_RANGE=wallets!B:B
GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_TRANSACTIONS_RANGE=trans!A:H
GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE=trans-erc!A:I
GOOGLE_SHEETS_LOGS_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_LOGS_RANGE=logs!A:C
```

## Мониторинг адресов

Адреса для мониторинга можно указать двумя способами:
1. В файле `src/config/wallets.ts`
2. В Google Sheets в указанном диапазоне (если включена интеграция с Google Sheets)

## Запуск по расписанию

Для автоматического запуска по расписанию, вы можете использовать:
- cron на Linux/Unix
- Windows Task Scheduler на Windows
- Railway Cron Jobs для деплоя на Railway

## Деплой на Railway

Для деплоя на Railway, обратитесь к файлу [RAILWAY.md](RAILWAY.md).

## Структура проекта

```
src/
  ├── adapters/            # Адаптеры ввода/вывода
  ├── config/              # Конфигурация
  ├── services/            # Сервисы для работы с блокчейнами и Google Sheets
  ├── types/               # TypeScript типы
  ├── utils/               # Утилиты
  ├── index.ts             # Главная точка входа
  ├── scheduler.ts         # Запуск по расписанию
  ├── run-all-monitors.ts  # Запуск мониторинга всех сетей
  └── run-eth-monitor.ts   # Запуск мониторинга только Ethereum
```

## Тестирование

```bash
# Тест ETH интеграции
npm run test:eth

# Тест за 48 часов (вместо стандартного 1 часа)
npx ts-node src/test-48h-monitor.ts

# Тест ETH за 48 часов
npx ts-node src/test-eth-48h-monitor.ts
```

## Логирование

Логирование выполняется в:
1. Консоль (при локальном запуске)
2. Google Sheets (если включена интеграция)
3. Логи Railway (при деплое на Railway)

## Лицензия

[ISC](LICENSE)
