import {Module, OnModuleInit} from "@nestjs/common";
import {Repository} from "@shared/repository";
import {BlockchainTransaction} from "@core/services/blockchain-transaction.service";
import {MonitorService} from "@core/services/monitor-service";
import { MockBlockchainDataProvider } from "@core/providers/blockchain-data.provider";
import { SharedModule } from "@shared/shared.module";

@Module({
  imports: [SharedModule],
  providers: [
    Repository, 
    BlockchainTransaction,
    MonitorService,
    MockBlockchainDataProvider,
  ]
})
export class MonitorModule implements OnModuleInit {
  onModuleInit() {
    console.log('MonitorModule initialized');
  }
}