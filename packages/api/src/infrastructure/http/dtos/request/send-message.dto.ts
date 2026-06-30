import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Request DTO for sending a message to the barista AI.
 *
 * This DTO handles HTTP-level validation before the message
 * is passed to the ProcessMessageUseCase. The validation ensures
 * that malformed requests are rejected early with clear error messages.
 */
export class SendMessageRequestDto {
  @ApiProperty({
    description: 'The message to send to the barista AI',
    example: 'Quiero un latte grande con leche de avena',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString({ message: 'Message must be a string' })
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MinLength(1, { message: 'Message must be at least 1 character' })
  @MaxLength(1000, { message: 'Message cannot exceed 1000 characters' })
  message!: string;

  @ApiPropertyOptional({
    description:
      'Conversation ID to continue an existing conversation. If omitted, a new conversation is created.',
    example: 'conv_abc123-def456-ghi789',
  })
  @IsOptional()
  @IsString({ message: 'Conversation ID must be a string' })
  @Matches(/^conv_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/, {
    message: 'Invalid conversation ID format',
  })
  conversationId?: string;
}
