import { Module } from '@nestjs/common';
import { EthereumBlockchainDataProvider } from './ethereum-blockchain-data.provider';

@Module({
  providers: [
    {
      provide: EthereumBlockchainDataProvider,
      useFactory: () => {
        return new EthereumBlockchainDataProvider({
          apiUrl: process.env.ETH_API_URL || 'https://api.etherscan.io/api',
          apiKey: process.env.ETH_API_KEY || '',
          requestDelay: parseInt(process.env.REQUEST_DELAY || '300'),
          maxRetries: parseInt(process.env.MAX_RETRIES || '3')
        });
      }
    }
  ],
  exports: [EthereumBlockchainDataProvider]
})
export class EthereumModule {}