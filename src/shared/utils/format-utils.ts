/**
 * Общие утилиты для работы с данными
 */

/**
 * Форматирование метки времени в строку даты
 * @param timestamp Метка времени в миллисекундах
 * @param format Формат даты
 * @returns Строка с датой и временем в указанном формате
 */
export function formatTimestamp(timestamp: number, format: string = 'DD.MM.YYYY HH:mm:ss'): string {
  const date = new Date(timestamp);
  
  const tokens: {[key: string]: string} = {
    YYYY: date.getFullYear().toString(),
    MM: (date.getMonth() + 1).toString().padStart(2, '0'),
    DD: date.getDate().toString().padStart(2, '0'),
    HH: date.getHours().toString().padStart(2, '0'),
    mm: date.getMinutes().toString().padStart(2, '0'),
    ss: date.getSeconds().toString().padStart(2, '0')
  };
  
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => tokens[match]);
}

/**
 * Форматирование числового значения с указанным количеством десятичных знаков
 * @param amount Числовое значение
 * @param decimals Количество десятичных знаков
 * @returns Отформатированная строка с числом
 */
export function formatAmount(amount: number, decimals: number = 6): string {
  return amount.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Сокращение адреса (показываются только начало и конец)
 * @param address Адрес кошелька или транзакции
 * @param prefixLength Длина отображаемого префикса
 * @param suffixLength Длина отображаемого суффикса
 * @returns Сокращенный адрес
 */
export function shortenAddress(address: string, prefixLength: number = 6, suffixLength: number = 4): string {
  if (!address || address.length <= prefixLength + suffixLength) {
    return address;
  }
  
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

/**
 * Простая хеш-функция для генерации идентификаторов
 * @param input Входная строка
 * @returns Хеш в виде шестнадцатеричной строки
 */
export function simpleHash(input: string): string {
  let hash = 0;
  if (input.length === 0) return hash.toString(16);
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(16);
}