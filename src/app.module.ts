import { Module } from '@nestjs/common';
import {GoogleSheetsModule} from "@core/services/google-sheets-service/google-sheets.module";
import {MonitorModule} from "@core/monitor.module";
import {LoggingModule} from "@core/services/logging/logging.module";

@Module({
  imports: [
    GoogleSheetsModule, 
    MonitorModule,
    LoggingModule
  ],
})
export class AppModule {}
