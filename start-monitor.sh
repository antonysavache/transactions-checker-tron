#!/bin/bash
# start-monitor.sh

# Проверяем, что Node.js установлен
if ! command -v node &> /dev/null; then
    echo "Node.js не найден. Пожалуйста, установите Node.js"
    exit 1
fi

# Проверяем, что npm установлен
if ! command -v npm &> /dev/null; then
    echo "npm не найден. Пожалуйста, установите npm"
    exit 1
fi

# Устанавливаем зависимости, если папка node_modules не существует
if [ ! -d "node_modules" ]; then
    echo "Устанавливаем зависимости..."
    npm install
fi

# Компилируем TypeScript
echo "Компилируем TypeScript..."
npm run build

# Запускаем сервис мониторинга в фоновом режиме
echo "Запускаем сервис мониторинга..."
node dist/scheduler.js > /dev/null 2>&1 &

# Сохраняем PID процесса
echo $! > .monitor.pid
echo "Сервис мониторинга запущен с PID: $(cat .monitor.pid)"
echo "Логи можно найти в папке logs/"
echo "Результаты в файле transactions.txt"