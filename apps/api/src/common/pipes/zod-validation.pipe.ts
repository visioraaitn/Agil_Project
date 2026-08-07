import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Applique un schéma Zod de @visiora/shared à un body/query/param.
 * Le même schéma valide le formulaire côté React : une seule règle, deux usages.
 *
 * Usage : `@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput`
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.') || '_';
          (details[path] ??= []).push(issue.message);
        }
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Les données envoyées sont invalides',
          details,
        });
      }
      throw error;
    }
  }
}
