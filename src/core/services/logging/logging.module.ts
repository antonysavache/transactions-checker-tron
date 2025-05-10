import { Module } from '@nestjs/common';
import { AsyncLoggerService } from './async-logger.service';

@Module({
  providers: [AsyncLoggerService],
  exports: [AsyncLoggerService],
})
export class LoggingModule {}
