import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InMemoryStoreService } from './in-memory-store.service';

@SkipThrottle()
@Controller('api/v1/test')
export class TestController {
  constructor(private readonly store: InMemoryStoreService) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  reset(): void {
    this.store.reset();
  }
}
