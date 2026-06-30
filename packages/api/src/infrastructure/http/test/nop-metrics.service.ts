import { Injectable } from '@nestjs/common';

@Injectable()
export class NopMetricsService {
  recordHttpRequest(_method: string, _path: string, _status: number, _duration: number): void {}
  recordAICall(_provider: string, _model: string, _operation: string, _duration: number, _tokens?: number): void {}
  recordAIError(_provider: string, _model: string, _operation: string): void {}
  recordOrder(_status: string): void {}
  recordDBQuery(_operation: string, _collection: string, _duration: number): void {}
  recordVectorSearch(_operation: string, _duration: number, _results?: number): void {}
  incrementActiveConversations(): void {}
  decrementActiveConversations(): void {}
  recordTokensUsed(_provider: string, _tokens: number): void {}
}
