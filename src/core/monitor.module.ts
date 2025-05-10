import { Module, OnModuleInit } from '@nestjs/common';
import { TransactionMonitor } from './monitor-service';
import { GoogleSheetsModule } from './services/google-sheets-service/google-sheets.module';
import { LoggingModule } from './services/logging/logging.module';
import { AsyncLoggerService } from './services/logging/async-logger.service';
import { initializeLogger } from './decorators/logging.decorators';
import { monitorMockTransactions } from '../mock/mock-monitor';
import { MONITORED_MOCK_WALLETS } from '../mock/config/wallets';
import { monitorEthTransactions } from '../eth/eth-monitor';
import { MONITORED_ETH_WALLETS } from '../eth/config/wallets';
import { monitorTronTransactions } from '../tron/tron-monitor';
import { MONITORED_TRON_WALLETS } from '../tron/config/wallets';

// Константы для токенов инъекции
export const MOCK_MONITOR = 'MOCK_MONITOR';
export const ETH_MONITOR = 'ETH_MONITOR';
export const TRON_MONITOR = 'TRON_MONITOR';

@Module({
  imports: [GoogleSheetsModule, LoggingModule],
  providers: [
    // Провайдер для MOCK монитора
    {
      provide: MOCK_MONITOR,
      useFactory: (googleSheetsService) => {
        const intervalHours = parseInt(process.env.DEFAULT_TIME_INTERVAL || '1');
        return new TransactionMonitor(
          googleSheetsService,
          {
            intervalHours,
            wallets: MONITORED_MOCK_WALLETS,
          },
          monitorMockTransactions,
          'MOCK'
        );
      },
      inject: ['GoogleSheetsService']
    },
    // Провайдер для ETH монитора
    {
      provide: ETH_MONITOR,
      useFactory: (googleSheetsService) => {
        const intervalHours = parseInt(process.env.DEFAULT_TIME_INTERVAL || '1');
        return new TransactionMonitor(
          googleSheetsService,
          {
            intervalHours,
            wallets: MONITORED_ETH_WALLETS,
          },
          monitorEthTransactions,
          'ETH'
        );
      },
      inject: ['GoogleSheetsService']
    },
    // Провайдер для TRON монитора
    {
      provide: TRON_MONITOR,
      useFactory: (googleSheetsService) => {
        const intervalHours = parseInt(process.env.DEFAULT_TIME_INTERVAL || '1');
        return new TransactionMonitor(
          googleSheetsService,
          {
            intervalHours,
            wallets: MONITORED_TRON_WALLETS,
          },
          monitorTronTransactions,
          'TRON'
        );
      },
      inject: ['GoogleSheetsService']
    }
  ],
  exports: [MOCK_MONITOR, ETH_MONITOR, TRON_MONITOR, LoggingModule],
})
export class MonitorModule implements OnModuleInit {
  constructor(private readonly loggerService: AsyncLoggerService) {}
  
  onModuleInit() {
    // Инициализация логгера
    initializeLogger(this.loggerService);
  }
}