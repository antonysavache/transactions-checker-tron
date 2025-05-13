import {Module, OnModuleInit} from "@nestjs/common";
import {Repository} from "@shared/repository";
import {BlockchainTransaction} from "@core/services/blockchain-transaction.service";
import {MonitorService} from "@core/services/monitor-service";
import { SharedModule } from "@shared/shared.module";
import { TronModule } from "@core/providers/tron/tron.module";
import {MockBlockchainDataProvider} from "@core/providers/mock/blockchain-data.provider";

@Module({
  imports: [SharedModule, TronModule],
  providers: [
    Repository, 
    BlockchainTransaction,
    MonitorService,
    MockBlockchainDataProvider,
  ],
  exports: [MonitorService]
})
export class MonitorModule implements OnModuleInit {
  onModuleInit() {
    console.log('MonitorModule initialized');
  }
}