/**
 * Адаптер для обработки входных данных Mock
 */
import { IInputConfig, IMonitoringData, ISourceData } from '../../core/types';

export class MockInputAdapter {
  private defaultTimeIntervalHours: number;
  private defaultNetwork: 'MOCK';

  constructor(options: IInputConfig = {}) {
    this.defaultTimeIntervalHours = options.defaultTimeIntervalHours || 1;
    this.defaultNetwork = 'MOCK' as any; // Приведение типа, поскольку MOCK не входит в стандартные типы
  }

  public getMonitoringData(inputData: ISourceData): IMonitoringData {
    // Преобразуем входные данные в стандартный формат
    const wallets = Array.isArray(inputData.wallets) 
      ? inputData.wallets 
      : [inputData.wallets];
    
    // Фильтруем только MOCK-адреса (для демонстрации принимаем любые)
    const filteredWallets = wallets.filter(wallet => 
      typeof wallet === 'string'
    );
    
    if (filteredWallets.length === 0) {
      throw new Error('No valid MOCK wallet addresses provided');
    }
    
    // Рассчитываем временной интервал
    const timeIntervalHours = inputData.timeIntervalHours || this.defaultTimeIntervalHours;
    
    // Определяем временные рамки
    const endTime = Date.now();
    const startTime = inputData.timeFrame?.startTime || (endTime - timeIntervalHours * 60 * 60 * 1000);
    
    return {
      wallets: filteredWallets,
      timeFrame: {
        startTime: inputData.timeFrame?.startTime || startTime,
        endTime: inputData.timeFrame?.endTime || endTime
      },
      network: this.defaultNetwork
    };
  }
}
