# Инструкция по настройке мониторинга ETH и TRON транзакций

Данный проект позволяет мониторить транзакции в двух блокчейн-сетях:
- TRON (TRX и TRC20 токены)
- Ethereum (ETH и ERC20 токены)

## 1. Настройка Google Sheets

### Структура таблицы

Для корректной работы сервиса, таблица Google Sheets должна содержать следующие листы:

1. **wallets** - лист с адресами кошельков для мониторинга:
   - Колонка A: адреса TRON-кошельков (начинаются с 'T')
   - Колонка B: адреса ETH-кошельков (начинаются с '0x')

2. **trans** - лист для записи TRON-транзакций:
   - Колонка A: Дата
   - Колонка B: Гаманець, звідки прийшло
   - Колонка C: Гаманець, куди прийшло
   - Колонка D: Хеш транзакції
   - Колонка E: Сума (USDT/TRX)
   - Колонка F: Валюта (USDT/TRX)
   - Колонка G: Сума в дол
   - Колонка H: Статус

3. **trans-erc** - лист для записи ETH-транзакций:
   - Колонка A: Дата
   - Колонка B: Гаманець, звідки прийшло
   - Колонка C: Гаманець, куди прийшло
   - Колонка D: Хеш транзакції
   - Колонка E: Сума (USDT/USDC/ETH)
   - Колонка F: Валюта (USDT/USDC/ETH)
   - Колонка G: Сума в дол
   - Колонка H: Статус
   - Колонка I: Сеть
   - Колонка J: Комиссия (Transaction Fee)
   - Колонка K: Валюта комиссии (ETH)

4. **logs** - лист для логирования работы сервиса:
   - Колонка A: Время (UTC)
   - Колонка B: Уровень логирования (INFO, ERROR, WARN, DEBUG)
   - Колонка C: Сообщение

## 2. Настройка конфигурации

Перед запуском убедитесь, что ваш файл `.env` содержит все необходимые настройки:

```
# API URLs и ключи
TRON_API_URL=https://api.trongrid.io
ETH_API_URL=https://api.etherscan.io/api
ETH_API_KEY=ваш-api-ключ-etherscan

# Настройки по умолчанию
DEFAULT_NETWORK=ALL
REQUEST_DELAY=300
MAX_RETRIES=3
DEFAULT_TIME_INTERVAL=1

# Google Sheets интеграция
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_WALLETS_SPREADSHEET_ID=id-вашей-таблицы
GOOGLE_SHEETS_WALLETS_RANGE=wallets!A:A
GOOGLE_SHEETS_ETH_WALLETS_RANGE=wallets!B:B
GOOGLE_SHEETS_TRANSACTIONS_SPREADSHEET_ID=id-вашей-таблицы
GOOGLE_SHEETS_TRANSACTIONS_RANGE=trans!A:H
GOOGLE_SHEETS_ETH_TRANSACTIONS_RANGE=trans-erc!A:K
GOOGLE_SHEETS_LOGS_SPREADSHEET_ID=id-вашей-таблицы
GOOGLE_SHEETS_LOGS_RANGE=logs!A:C
```

## 3. Добавление кошельков для мониторинга

Для добавления кошельков, которые нужно мониторить:
- В колонку А листа `wallets` добавьте TRON-кошельки (начинаются с 'T')
- В колонку B листа `wallets` добавьте ETH-кошельки (начинаются с '0x')

Система будет автоматически определять тип адреса и выполнять запросы к соответствующей сети.

## 4. Запуск мониторинга

### Мониторинг обеих сетей одновременно (TRON и ETH)

```bash
npm run dev:all
```

или для production:

```bash
npm run start:all
```

### Мониторинг только ETH-транзакций

```bash
npm run dev:eth
```

или для production:

```bash
npm run start:eth
```

### Мониторинг только TRON-транзакций

```bash
npm run dev:monitor
```

или для production:

```bash
npm run start:monitor
```

## 5. Особенности

- Скрипт выполняется по расписанию каждый час
- Для ETH отслеживаются только официальные токены USDT и USDC (по адресам их контрактов)
- Все суммы записываются в числовом формате, что упрощает дальнейшие расчеты в Google Sheets
- TRON и ETH транзакции записываются в разные листы Google таблицы
- Система автоматически распознает тип кошельков по их префиксу (T для TRON, 0x для ETH)

## 6. Проверка работы

После запуска мониторинга, проверьте:
- Лист `trans` - для транзакций TRON
- Лист `trans-erc` - для транзакций ETH

## 7. Разъяснение кодов ошибок

- **Invalid Ethereum address** - указан неверный формат ETH адреса
- **Invalid TRON address** - указан неверный формат TRON адреса
- **API request failed** - проблемы с подключением к API блокчейна
- **Google Sheets error** - проблемы с доступом к Google таблице

При возникновении ошибок проверьте:
- Правильность API ключей
- Доступность API сервисов
- Права доступа к Google таблице
- Правильность форматов адресов кошельков
