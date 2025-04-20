import { IInputConfig, IMonitoringData, ISourceData } from '../../types';

export class InputAdapter {
  private readonly defaultTimeIntervalHours: number;

  constructor(options: IInputConfig = {}) {
    this.defaultTimeIntervalHours = options.defaultTimeIntervalHours || 1;
  }

  public getMonitoringData(source: ISourceData): IMonitoringData {
    if (!source) {
      throw new Error('Source is required for monitoring data');
    }

    const wallets = this._extractWallets(source);  
    const timeFrame = this._extractTimeFrame(source);

    return {
      wallets,
      timeFrame: {
        startTime: timeFrame.startTime,
        endTime: timeFrame.endTime
      }
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