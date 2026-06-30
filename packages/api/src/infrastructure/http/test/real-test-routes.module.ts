import { Module } from '@nestjs/common';
import { RealTestController } from './real-test.controller';

@Module({
  controllers: [RealTestController],
})
export class RealTestRoutesModule {}
