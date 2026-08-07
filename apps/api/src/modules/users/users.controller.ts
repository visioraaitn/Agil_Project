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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  ResetPasswordInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserSummary,
  createUserSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  updateProfileSchema,
  updateUserSchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Déclaré avant `:userId` : sinon « me » serait capturé comme un identifiant. */
  @Patch('me')
  @ApiOperation({ summary: 'Mise à jour de son propre profil' })
  updateOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileInput,
  ): Promise<UserSummary> {
    return this.users.updateOwnProfile(user.id, dto);
  }

  @Get()
  @RequirePermission('user:manage')
  @ApiOperation({ summary: 'Liste paginée des comptes' })
  list(
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQuery,
  ): Promise<Paginated<UserSummary>> {
    return this.users.list(query);
  }

  @Get(':userId')
  @RequirePermission('user:manage')
  @ApiOperation({ summary: "Détail d'un compte" })
  getById(@Param('userId', ParseUUIDPipe) userId: string): Promise<UserSummary> {
    return this.users.getById(userId);
  }

  @Post()
  @RequirePermission('user:manage')
  @ApiOperation({ summary: 'Création de compte' })
  create(
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserInput,
  ): Promise<UserSummary> {
    return this.users.create(dto);
  }

  @Patch(':userId')
  @RequirePermission('user:manage')
  @ApiOperation({ summary: "Modification d'un compte (profil, rôle global, activation)" })
  update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserInput,
  ): Promise<UserSummary> {
    return this.users.update(userId, dto);
  }

  @Post(':userId/reset-password')
  @RequirePermission('user:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Réinitialisation du mot de passe par un administrateur" })
  async resetPassword(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordInput,
  ): Promise<void> {
    await this.users.resetPassword(userId, dto.newPassword);
  }

  @Delete(':userId')
  @RequirePermission('user:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression logique du compte' })
  async remove(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.users.softDelete(userId, actor.id);
  }
}
