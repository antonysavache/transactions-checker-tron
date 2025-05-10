import { Module } from '@nestjs/common';
import {GoogleSheetsService} from "./services";

@Module({
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class SharedModule {}