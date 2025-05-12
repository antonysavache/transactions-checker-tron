import { Module } from '@nestjs/common';
import { TronBlockchainDataProvider } from './tron-blockchain-data.provider';

@Module({
  providers: [
    {
      provide: TronBlockchainDataProvider,
      useFactory: () => {
        return new TronBlockchainDataProvider({
          apiUrl: process.env.TRON_API_URL || 'https://api.trongrid.io',
          requestDelay: parseInt(process.env.REQUEST_DELAY || '300'),
          maxRetries: parseInt(process.env.MAX_RETRIES || '3')
        });
      }
    }
  ],
  exports: [TronBlockchainDataProvider]
})
export class TronModule {}