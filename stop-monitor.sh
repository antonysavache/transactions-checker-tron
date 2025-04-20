#!/bin/bash
# stop-monitor.sh

# Проверяем, существует ли файл с PID
if [ ! -f ".monitor.pid" ]; then
    echo "Сервис мониторинга не запущен или файл .monitor.pid не найден"
    exit 1
fi

# Получаем PID процесса
PID=$(cat .monitor.pid)

# Проверяем, запущен ли процесс
if ! ps -p $PID > /dev/null; then
    echo "Процесс с PID $PID не найден. Возможно, сервис уже остановлен"
    rm .monitor.pid
    exit 0
fi

# Останавливаем процесс
echo "Останавливаем сервис мониторинга (PID: $PID)..."
kill $PID

# Ждем завершения процесса
sleep 2

# Проверяем, завершился ли процесс
if ps -p $PID > /dev/null; then
    echo "Процесс не завершился добровольно. Принудительно останавливаем..."
    kill -9 $PID
    sleep 1
fi

# Удаляем файл с PID
rm .monitor.pid
echo "Сервис мониторинга остановлен"