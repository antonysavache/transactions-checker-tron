/**
 * Адаптер для обработки входных данных TRON
 */
import { IInputConfig, IMonitoringData, ISourceData } from '../../core/types';

export class TronInputAdapter {
  private defaultTimeIntervalHours: number;
  private defaultNetwork: 'TRON';

  constructor(options: IInputConfig = {}) {
    this.defaultTimeIntervalHours = options.defaultTimeIntervalHours || 1;
    this.defaultNetwork = 'TRON';
  }

  public getMonitoringData(inputData: ISourceData): IMonitoringData {
    // Преобразуем входные данные в стандартный формат
    const wallets = Array.isArray(inputData.wallets) 
      ? inputData.wallets 
      : [inputData.wallets];
    
    // Фильтруем только TRON-адреса (начинаются с T)
    const filteredWallets = wallets.filter(wallet => 
      typeof wallet === 'string' && wallet.startsWith('T')
    );
    
    if (filteredWallets.length === 0) {
      throw new Error('No valid TRON wallet addresses provided');
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
