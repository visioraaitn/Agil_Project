import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  ChangePasswordInput,
  LoginInput,
  SessionResponse,
  changePasswordSchema,
  loginSchema,
} from '@visiora/shared';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { SessionContext } from './token.service';
import type { Env } from '../../config/env';

export const REFRESH_COOKIE = 'visiora_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authentification par email et mot de passe' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const result = await this.auth.login({ ...dto }, sessionContext(request));
    this.setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    return result.session;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Renouvellement du token d'accès (rotation du refresh token)" })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const raw = request.cookies?.[REFRESH_COOKIE] as string | undefined;
    const result = await this.auth.refresh(raw, sessionContext(request));
    this.setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    return result.session;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Déconnexion — révoque la session courante' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request.cookies?.[REFRESH_COOKIE] as string | undefined);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @ApiOperation({ summary: 'Utilisateur authentifié courant' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Changement de mot de passe — révoque les autres sessions' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(user.id, dto);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  /**
   * Le refresh token voyage en cookie httpOnly : inaccessible au JavaScript, il
   * survit à une injection de script, contrairement au localStorage. Le `path`
   * restreint son envoi aux seules routes d'authentification.
   */
  private setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  private cookieOptions(): CookieOptions {
    const prefix = this.config.get('API_PREFIX', { infer: true });
    return {
      httpOnly: true,
      sameSite: this.config.get('AUTH_COOKIE_SAME_SITE', { infer: true }),
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: `${prefix}/auth`,
    };
  }
}

function sessionContext(request: Request): SessionContext {
  return {
    userAgent: request.headers['user-agent'],
    ipAddress: request.ip,
  };
}
