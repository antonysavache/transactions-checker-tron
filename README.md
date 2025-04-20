# True Transaction Spy

Сервис для мониторинга транзакций в сети TRON для определенных кошельков с интеграцией Google Sheets.

## Особенности

- Отслеживание транзакций TRX и TRC20 токенов
- Интеграция с Google Sheets для получения списка кошельков
- Автоматическая запись транзакций в Google Sheets
- Периодическое сканирование с настраиваемым интервалом
- Логирование всех операций в Google Sheets

## Требования

- Node.js 16+
- Учетные данные Google API (сервисный аккаунт)
- Доступ к таблице Google Sheets

## Установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd true-transaction-spy

# Установить зависимости
npm install

# Создать .env файл
cp .env.example .env
# Отредактировать .env файл, добавив учетные данные Google Sheets и другие настройки
```

## Запуск

### Локально

```bash
# Запуск с мониторингом каждый час
npm run dev:monitor

# Запуск разового сканирования
npm run dev
```

### В производственной среде (Railway)

Для запуска в Railway, необходимо:

1. Создать новый проект на Railway
2. Подключить ваш Git-репозиторий
3. Добавить необходимые переменные окружения в настройках проекта
4. Railway автоматически запустит мониторинг с помощью указанного в `Procfile` скрипта

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

# ID Google таблицы с логами и диапазон ячеек (используется та же таблица)
GOOGLE_SHEETS_LOGS_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SHEETS_LOGS_RANGE=logs!A:C
```

## Структура таблицы Google Sheets

Для работы сервиса, таблица Google Sheets должна содержать следующие листы:

1. **wallets** - лист с адресами кошельков для мониторинга
   - Столбец A: адреса кошельков TRON

2. **trans** - лист для записи найденных транзакций
   - Столбец A: Дата
   - Столбец B: Гаманець, звідки прийшло
   - Столбец C: Гаманець, куди прийшло
   - Столбец D: Хеш транзакції
   - Столбец E: Сума (USDT/TRX)
   - Столбец F: Валюта (USDT/TRX)
   - Столбец G: Сума в дол
   - Столбец H: Статус

3. **logs** - лист для логирования работы сервиса
   - Столбец A: Время (UTC)
   - Столбец B: Уровень логирования (INFO, ERROR, WARN, DEBUG)
   - Столбец C: Сообщение

## Настройка для Railway

1. Создайте проект на Railway.app
2. Подключите ваш Git-репозиторий
3. Добавьте все необходимые переменные окружения (см. раздел выше)
4. Включите опцию "Always On" для непрерывной работы
5. Сервис будет автоматически запущен и будет мониторить транзакции каждый час