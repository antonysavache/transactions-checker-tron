/**
 * Адаптер для обработки входных данных ETH
 */
import { IInputConfig, IMonitoringData, ISourceData } from '../../core/types';

export class EthInputAdapter {
  private defaultTimeIntervalHours: number;
  private defaultNetwork: 'ETH';

  constructor(options: IInputConfig = {}) {
    this.defaultTimeIntervalHours = options.defaultTimeIntervalHours || 1;
    this.defaultNetwork = 'ETH';
  }

  public getMonitoringData(inputData: ISourceData): IMonitoringData {
    // Преобразуем входные данные в стандартный формат
    const wallets = Array.isArray(inputData.wallets) 
      ? inputData.wallets 
      : [inputData.wallets];
    
    // Фильтруем только ETH-адреса (начинаются с 0x)
    const filteredWallets = wallets.filter(wallet => 
      typeof wallet === 'string' && wallet.startsWith('0x')
    );
    
    if (filteredWallets.length === 0) {
      throw new Error('No valid ETH wallet addresses provided');
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
