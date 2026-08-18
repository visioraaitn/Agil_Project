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
  CreateLabelInput,
  LabelSummary,
  UpdateLabelInput,
  createLabelSchema,
  updateLabelSchema,
} from '@visiora/shared';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LabelsService } from './labels.service';

@ApiTags('labels')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou clé courte (ex. VIS)' })
@Controller('projects/:projectId/labels')
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  @ApiOperation({ summary: 'Étiquettes du projet' })
  list(@ProjectId() projectId: string): Promise<LabelSummary[]> {
    return this.labels.list(projectId);
  }

  @Post()
  @RequirePermission('label:manage')
  @ApiOperation({ summary: 'Création d’une étiquette' })
  create(
    @ProjectId() projectId: string,
    @Body(new ZodValidationPipe(createLabelSchema)) dto: CreateLabelInput,
  ): Promise<LabelSummary> {
    return this.labels.create(projectId, dto);
  }

  @Patch(':labelId')
  @RequirePermission('label:manage')
  @ApiOperation({ summary: 'Modification d’une étiquette' })
  update(
    @ProjectId() projectId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @Body(new ZodValidationPipe(updateLabelSchema)) dto: UpdateLabelInput,
  ): Promise<LabelSummary> {
    return this.labels.update(projectId, labelId, dto);
  }

  @Delete(':labelId')
  @RequirePermission('label:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression d’une étiquette' })
  async remove(
    @ProjectId() projectId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ): Promise<void> {
    await this.labels.remove(projectId, labelId);
  }
}
