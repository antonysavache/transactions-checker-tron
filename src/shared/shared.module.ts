import { Module } from '@nestjs/common';
import { GoogleSheetsService } from "@shared/services";
import { Repository } from "./repository";

@Module({
  providers: [GoogleSheetsService, Repository],
  exports: [GoogleSheetsService, Repository],
})
export class SharedModule {}