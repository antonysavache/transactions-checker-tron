import { AsyncLoggerService } from '../services/logging/async-logger.service';

let loggerInstance: AsyncLoggerService;

export function initializeLogger(logger: AsyncLoggerService) {
  loggerInstance = logger;
}

export function LogMethod(options: {
  enterMessage?: string; 
  exitMessage?: string;
  logArgs?: boolean;
  logResult?: boolean;
  network?: string;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      if (!loggerInstance) {
        console.warn('Logger not initialized for decorators. Using original method.');
        return await originalMethod.apply(this, args);
      }
      
      const className = this.constructor.name;
      const methodName = propertyKey;
      
      const network = options.network || (this as any).network;
      
      if (options.enterMessage) {
        loggerInstance.bothInfo(options.enterMessage, ...getLogArgs(options, args, network));
      } else {
        loggerInstance.bothInfo(`Entering ${className}.${methodName}`, network);
        
        if (options.logArgs && args.length > 0) {
          loggerInstance.info(`${className}.${methodName} arguments:`, 
            ...args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg), network);
        }
      }
      
      try {
        // Выполняем оригинальный метод
        const result = await originalMethod.apply(this, args);
        
        // Логируем выход из метода
        if (options.exitMessage) {
          loggerInstance.bothInfo(options.exitMessage, ...getLogArgs(options, args, network));
        } else {
          loggerInstance.bothInfo(`Exiting ${className}.${methodName}`, network);
        }
        
        // Логируем результат если указано
        if (options.logResult && result !== undefined) {
          loggerInstance.info(`${className}.${methodName} result:`, 
            typeof result === 'object' ? JSON.stringify(result) : result, network);
        }
        
        return result;
      } catch (error: any) {
        // Логируем ошибку
        loggerInstance.bothError(`Error in ${className}.${methodName}: ${error.message}`, network);
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Вспомогательные декораторы для частых операций
export function LogMonitorStart() {
  return LogMethod({
    enterMessage: 'Starting %s transaction monitor, checking every %d hours',
    exitMessage: '%s monitor scheduled to run every %d hours',
  });
}

export function LogMonitorExecution() {
  return LogMethod({
    enterMessage: 'Running %s transaction monitoring for %d wallets with interval %d hours',
    exitMessage: 'Monitoring complete, found %d %s transactions',
  });
}

// Декоратор для логирования ошибок в catch блоках
export function LogError(message: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      if (!loggerInstance) {
        console.warn('Logger not initialized for decorators. Using original method.');
        return await originalMethod.apply(this, args);
      }
      
      try {
        return await originalMethod.apply(this, args);
      } catch (error: any) {
        // Если есть network в this, добавляем его
        const network = (this as any).network;
        loggerInstance.bothError(message, error.message, network);
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Декоратор для логирования инициализации мониторов
 */
export function LogModuleInitialization() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      if (!loggerInstance) {
        console.warn('Logger not initialized for decorators. Using original method.');
        return await originalMethod.apply(this, args);
      }
      
      const className = this.constructor.name;
      
      // Логируем начало инициализации
      loggerInstance.bothInfo(`${className}: Initializing transaction monitors...`);
      
      try {
        // Выполняем оригинальный метод
        const result = await originalMethod.apply(this, args);
        
        // Логируем успешное завершение
        loggerInstance.bothInfo(`${className}: All monitors initialized successfully`);
        
        return result;
      } catch (error: any) {
        // Логируем ошибку
        loggerInstance.bothError(
          `${className}: Failed to initialize monitors: ${error.message}`,
          error.stack
        );
        
        // Пробрасываем ошибку дальше
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Декоратор для логирования запуска конкретного монитора
 */
export function LogMonitorInitialization(monitorName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      if (!loggerInstance) {
        console.warn('Logger not initialized for decorators. Using original method.');
        return await originalMethod.apply(this, args);
      }
      
      const className = this.constructor.name;
      
      // Логируем начало запуска конкретного монитора
      loggerInstance.bothInfo(`${className}: Starting ${monitorName} monitor...`);
      
      try {
        // Выполняем оригинальный метод
        const result = await originalMethod.apply(this, args);
        
        // Логируем успешный запуск
        loggerInstance.bothInfo(`${className}: ${monitorName} monitor started successfully`);
        
        return result;
      } catch (error: any) {
        // Логируем ошибку
        loggerInstance.bothError(
          `${className}: Failed to start ${monitorName} monitor: ${error.message}`,
          error.stack
        );
        
        // Пробрасываем ошибку дальше
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Декоратор для измерения времени выполнения метода
 */
export function LogExecutionTime(description: string = '') {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      if (!loggerInstance) {
        console.warn('Logger not initialized for decorators. Using original method.');
        return await originalMethod.apply(this, args);
      }
      
      const className = this.constructor.name;
      const methodName = propertyKey;
      const actionName = description || `${className}.${methodName}`;
      
      const startTime = Date.now();
      
      try {
        // Выполняем оригинальный метод
        const result = await originalMethod.apply(this, args);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Логируем время выполнения
        loggerInstance.bothInfo(`${actionName} completed in ${duration}ms`);
        
        return result;
      } catch (error: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Логируем ошибку с временем выполнения
        loggerInstance.bothError(
          `${actionName} failed after ${duration}ms: ${error.message}`,
          error.stack
        );
        
        throw error;
      }
    };
    
    return descriptor;
  };
}

export function InitializeMonitors() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    LogExecutionTime('Monitor initialization')(target, propertyKey, descriptor);
    LogModuleInitialization()(target, propertyKey, descriptor);
    
    return descriptor;
  };
}

function getLogArgs(options: any, args: any[], network?: string): any[] {
  const logArgs = [...args];
  if (network) {
    logArgs.push(network);
  }
  return logArgs;
}
