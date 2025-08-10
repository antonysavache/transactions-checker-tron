import { Module } from '@nestjs/common';
import { GoogleSheetsService } from "@shared/services";
import { DuplicateCleanerService } from "@shared/services/duplicate-cleaner.service";
import { Repository } from "./repository";

@Module({
  providers: [GoogleSheetsService, DuplicateCleanerService, Repository],
  exports: [GoogleSheetsService, DuplicateCleanerService, Repository],
})
export class SharedModule {}