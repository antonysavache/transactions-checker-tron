import { Module } from '@nestjs/common';
import { MonitorModule } from "@core/monitor.module";
import { SharedModule } from "@shared/shared.module";

@Module({
  imports: [
    SharedModule,
    MonitorModule,
  ],
})
export class AppModule {}