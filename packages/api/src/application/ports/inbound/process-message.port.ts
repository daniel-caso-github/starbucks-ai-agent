import { ProcessMessageInputDto, ProcessMessageOutputDto } from '@application/dtos';
import { Either } from '@application/common';
import { ApplicationError } from '@application/errors';

export interface IProcessMessagePort {
  execute(
    input: ProcessMessageInputDto,
  ): Promise<Either<ApplicationError, ProcessMessageOutputDto>>;
}
