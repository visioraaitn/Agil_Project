import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CalendarEvent,
  GlobalSearchQuery,
  ProjectDashboard,
  SearchResult,
  globalSearchQuerySchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('projects/:projectId/dashboard')
  @ApiParam({ name: 'projectId', description: 'UUID du projet ou cle courte (ex. VIS)' })
  @ApiOperation({ summary: 'Dashboard projet : KPI, burndown, velocite, bloques' })
  dashboard(@ProjectId() projectId: string): Promise<ProjectDashboard> {
    return this.reports.dashboard(projectId);
  }

  @Get('projects/:projectId/calendar')
  @ApiParam({ name: 'projectId', description: 'UUID du projet ou cle courte (ex. VIS)' })
  @ApiOperation({ summary: 'Evenements calendrier du projet' })
  calendar(@ProjectId() projectId: string): Promise<CalendarEvent[]> {
    return this.reports.calendar(projectId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Recherche globale simple' })
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(globalSearchQuerySchema)) query: GlobalSearchQuery,
  ): Promise<SearchResult[]> {
    return this.reports.search(user.id, query.q);
  }
}
