import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CreateTagInput,
  TagSummary,
  UpdateTagInput,
  createTagSchema,
  updateTagSchema,
} from '@visiora/shared';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TagsService } from './tags.service';

@ApiTags('tags')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou clé courte (ex. VIS)' })
@Controller('projects/:projectId/tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'Tags du projet' })
  list(@ProjectId() projectId: string): Promise<TagSummary[]> {
    return this.tags.list(projectId);
  }

  @Post()
  @RequirePermission('tag:manage')
  @ApiOperation({ summary: 'Création d’un tag' })
  create(
    @ProjectId() projectId: string,
    @Body(new ZodValidationPipe(createTagSchema)) dto: CreateTagInput,
  ): Promise<TagSummary> {
    return this.tags.create(projectId, dto);
  }

  @Patch(':tagId')
  @RequirePermission('tag:manage')
  @ApiOperation({ summary: 'Modification d’un tag' })
  update(
    @ProjectId() projectId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Body(new ZodValidationPipe(updateTagSchema)) dto: UpdateTagInput,
  ): Promise<TagSummary> {
    return this.tags.update(projectId, tagId, dto);
  }

  @Delete(':tagId')
  @RequirePermission('tag:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression d’un tag' })
  async remove(
    @ProjectId() projectId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ): Promise<void> {
    await this.tags.remove(projectId, tagId);
  }
}
