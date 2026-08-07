import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodType, ZodTypeDef } from 'zod';

/**
 * Applique un schéma Zod de @visiora/shared à un body/query/param.
 * Le même schéma valide le formulaire côté React : une seule règle, deux usages.
 *
 * Usage : `@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput`
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  /**
   * L'entrée est typée `unknown` et non `T` : un schéma portant des `.default()`
   * (pagination) produit un type de sortie plus riche que son entrée, et
   * `ZodSchema<T>` exigerait à tort que les deux coïncident.
   */
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

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
