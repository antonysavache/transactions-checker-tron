import { Controller, Get, Param } from '@nestjs/common';
import { EthereumBlockchainDataProvider } from '@core/providers/ethereum/ethereum-blockchain-data.provider';

@Controller('api/ethereum')
export class EthereumController {
  constructor(private readonly ethereumProvider: EthereumBlockchainDataProvider) {}

  @Get('transaction/:hash')
  async getTransactionByHash(@Param('hash') hash: string) {
    return await this.ethereumProvider.getFullTransactionInfo(hash).toPromise();
  }
}
