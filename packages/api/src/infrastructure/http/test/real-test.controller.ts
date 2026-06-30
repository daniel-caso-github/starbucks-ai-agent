import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@SkipThrottle()
@Controller('api/v1/test')
export class RealTestController {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(): Promise<void> {
    await Promise.all([
      this.conn.collection('conversations').deleteMany({}),
      this.conn.collection('orders').deleteMany({}),
    ]);
  }
}
