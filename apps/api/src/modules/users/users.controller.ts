import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AuthenticatedUser,
  CreateUserInput,
  ListUsersQuery,
  Paginated,
  ResetPasswordInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserDirectoryEntry,
  UserDirectoryQuery,
  UserSummary,
  createUserSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  updateProfileSchema,
  updateUserSchema,
  userDirectoryQuerySchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { UploadedFileLike } from '../storage/object-storage.service';
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

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Envoi de son avatar dans le stockage objet' })
  uploadOwnAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<UserSummary> {
    return this.users.uploadOwnAvatar(user.id, file);
  }

  /**
   * Annuaire ouvert à tout utilisateur authentifié : sans lui, un Product Owner
   * — qui détient `project:member:manage` mais pas `user:manage` — ne pourrait
   * désigner personne à affecter à son projet.
   */
  @Get('directory')
  @ApiOperation({ summary: 'Annuaire des comptes actifs (nom, email, avatar)' })
  directory(
    @Query(new ZodValidationPipe(userDirectoryQuerySchema)) query: UserDirectoryQuery,
  ): Promise<UserDirectoryEntry[]> {
    return this.users.directory(query);
  }

  @Get()
  @RequirePermission('user:manage')
  @ApiOperation({ summary: 'Liste paginée des comptes' })
  list(
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQuery,
  ): Promise<Paginated<UserSummary>> {
    return this.users.list(query);
  }

  @Get(':userId/avatar/:fileName')
  @Public()
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @ApiOperation({ summary: "Affichage public de l'avatar courant d'un utilisateur" })
  async avatar(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const avatar = await this.users.getAvatar(userId, fileName);
    response.setHeader('Content-Type', avatar.mimeType);
    response.setHeader('Content-Disposition', 'inline');
    return new StreamableFile(avatar.stream);
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
  @ApiOperation({ summary: 'Réinitialisation du mot de passe par un administrateur' })
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
