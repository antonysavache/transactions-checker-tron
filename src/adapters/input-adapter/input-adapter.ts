import { IInputConfig, IMonitoringData, ISourceData } from '../../types';

export class InputAdapter {
  private readonly defaultTimeIntervalHours: number;
  private readonly defaultNetwork: 'TRON' | 'ETH' | 'ALL';

  constructor(options: IInputConfig = {}) {
    this.defaultTimeIntervalHours = options.defaultTimeIntervalHours || 1;
    this.defaultNetwork = options.defaultNetwork || 'TRON';
  }

  public getMonitoringData(source: ISourceData): IMonitoringData {
    if (!source) {
      throw new Error('Source is required for monitoring data');
    }

    const wallets = this._extractWallets(source);  
    const timeFrame = this._extractTimeFrame(source);
    const network = source.network || this.defaultNetwork;

    return {
      wallets,
      timeFrame: {
        startTime: timeFrame.startTime,
        endTime: timeFrame.endTime
      },
      network
    };
  }

  private _extractWallets(source: ISourceData): string[] {
    if (Array.isArray(source.wallets)) {
      return source.wallets;
    }
    
    if (typeof source.wallets === 'string') {
      return [source.wallets];
    }

    return [];
  }

  private _extractTimeFrame(source: ISourceData): { startTime: number, endTime: number } {
    const now = Date.now();
    
    if (source.timeFrame) {
      return {
        startTime: source.timeFrame.startTime || now - this.defaultTimeIntervalHours * 60 * 60 * 1000,
        endTime: source.timeFrame.endTime || now
      };
    }
    
    if (source.timeIntervalHours) {
      const intervalMs = source.timeIntervalHours * 60 * 60 * 1000;
      return {
        startTime: now - intervalMs,
        endTime: now
      };
    }
    
    return {
      startTime: now - this.defaultTimeIntervalHours * 60 * 60 * 1000,
      endTime: now
    };
  }
}