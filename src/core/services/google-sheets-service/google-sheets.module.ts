import { Module } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets-service';

@Module({
  providers: [
    {
      provide: 'GoogleSheetsService',
      useClass: GoogleSheetsService,
    }
  ],
  exports: ['GoogleSheetsService'],
})
export class GoogleSheetsModule {}
