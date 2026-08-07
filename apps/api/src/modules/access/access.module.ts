import { Global, Module } from '@nestjs/common';
import { ProjectAccessService } from './project-access.service';

/** Résolution des droits — utilisée par le guard et par les services métier. */
@Global()
@Module({
  providers: [ProjectAccessService],
  exports: [ProjectAccessService],
})
export class AccessModule {}
