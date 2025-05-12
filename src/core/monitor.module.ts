import {Module, OnModuleInit} from "@nestjs/common";
import {Repository} from "@shared/repository";
import {BlockchainTransaction} from "@core/services/blockchain-transaction.service";
import {MonitorService} from "@core/services/monitor-service";
import { SharedModule } from "@shared/shared.module";
import {MockBlockchainDataProvider} from "@core/providers/mock/blockchain-data.provider";
import { TronModule } from "@core/providers/tron/tron.module";
import { EthereumModule } from "@core/providers/ethereum/ethereum.module";
import { TronMonitorService } from "@core/services/tron-monitor.service";
import { EthereumMonitorService } from "@core/services/ethereum-monitor.service";

@Module({
  imports: [SharedModule, TronModule, EthereumModule],
  providers: [
    Repository, 
    BlockchainTransaction,
    MonitorService,
    TronMonitorService,
    EthereumMonitorService,
    MockBlockchainDataProvider
  ],
  exports: [MonitorService, TronMonitorService, EthereumMonitorService]
})
export class MonitorModule implements OnModuleInit {
  onModuleInit() {
    console.log('MonitorModule initialized');
  }
}