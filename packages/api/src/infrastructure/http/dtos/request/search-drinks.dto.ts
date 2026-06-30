import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for semantic drink search.
 *
 * The query is transformed into an embedding and compared against
 * drink descriptions stored in ChromaDB to find semantically
 * similar matches. For example, "something cold and chocolatey"
 * would match drinks like Mocha Frappuccino.
 */
export class SearchDrinksRequestDto {
  @ApiProperty({
    description: 'Natural language search query describing the desired drink',
    example: 'something cold and refreshing with chocolate',
  })
  @IsString({ message: 'Query must be a string' })
  @IsNotEmpty({ message: 'Search query cannot be empty' })
  query!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return (1-20)',
    example: 5,
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(20, { message: 'Limit cannot exceed 20' })
  @Transform(({ value }) => (value ? parseInt(value as string, 10) : 5))
  limit?: number = 5;
}
