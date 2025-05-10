/**
 * Логгеры для работы приложения
 */

// Настройка логгеров для разных типов сообщений
export const apiLogger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${formatMessage(message, args)}`),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${formatMessage(message, args)}`),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${formatMessage(message, args)}`),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${formatMessage(message, args)}`)
};

export const transactionLogger = {
  info: (message: string, ...args: any[]) => console.log(`[TX-INFO] ${formatMessage(message, args)}`),
  debug: (message: string, ...args: any[]) => console.debug(`[TX-DEBUG] ${formatMessage(message, args)}`),
  warn: (message: string, ...args: any[]) => console.warn(`[TX-WARN] ${formatMessage(message, args)}`),
  error: (message: string, ...args: any[]) => console.error(`[TX-ERROR] ${formatMessage(message, args)}`)
};

// Вспомогательная функция для форматирования сообщений
function formatMessage(message: string, args: any[]): string {
  if (args.length === 0) return message;
  
  let formattedMessage = message;
  for (const arg of args) {
    formattedMessage = formattedMessage.replace(/%[sdj%]/, toString(arg));
  }
  return formattedMessage;
}

function toString(obj: any): string {
  if (typeof obj === 'object') {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      return String(obj);
    }
  }
  return String(obj);
}
