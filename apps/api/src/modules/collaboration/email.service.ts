import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import * as net from 'net';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { Env } from '../../config/env';

interface AccountCreatedEmail {
  email: string;
  name: string;
  initialPassword: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Obtient ou initialise l'instance réutilisable du transporteur SMTP.
   * Résout explicitement l'hôte en IPv4 pour éviter tout ENETUNREACH IPv6 sur Windows.
   * Retourne `null` si la configuration minimale (hôte/port) est absente.
   */
  private async getTransporter(): Promise<Transporter<SMTPTransport.SentMessageInfo> | null> {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get('SMTP_HOST', { infer: true });
    const port = this.config.get('SMTP_PORT', { infer: true });
    const secure = this.config.get('SMTP_SECURE', { infer: true });
    const username = this.config.get('SMTP_USER', { infer: true })?.trim();
    const password = this.config.get('SMTP_PASSWORD', { infer: true })?.replace(/\s+/g, '');

    if (!host || !port) {
      this.logger.warn('Configuration SMTP incomplète : SMTP_HOST ou SMTP_PORT manquant.');
      return null;
    }

    const isSecure = secure ?? port === 465;

    // Résolution explicite IPv4 (Windows Node.js IPv6 fallback issue)
    let resolvedHost = host;
    if (host !== 'localhost' && !net.isIP(host)) {
      try {
        const lookup = await dns.promises.lookup(host, { family: 4 });
        resolvedHost = lookup.address;
      } catch {
        resolvedHost = host;
      }
    }

    const transportOptions: SMTPTransport.Options = {
      host: resolvedHost,
      port,
      secure: isSecure,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: {
        servername: host,
      },
    };

    // Authentification conditionnelle (compatible serveurs locaux type Mailhog/Mailpit et relais sans auth)
    if (username && password) {
      transportOptions.auth = {
        user: username,
        pass: password,
      };
    }

    this.transporter = nodemailer.createTransport(transportOptions);
    return this.transporter;
  }

  /**
   * Vérifie la validité de la connexion SMTP auprès du serveur distant.
   */
  async verifyConnection(): Promise<boolean> {
    const transporter = await this.getTransporter();
    if (!transporter) {
      return false;
    }

    try {
      await transporter.verify();
      this.logger.log('Connexion SMTP vérifiée avec succès.');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Vérification SMTP échouée : ${message}`);
      return false;
    }
  }

  /**
   * Envoie un email de notification.
   * Capture toute exception réseau/SMTP pour éviter de bloquer le flux appelant.
   */
  async sendNotification(to: string, subject: string, body: string): Promise<boolean> {
    const transporter = await this.getTransporter();
    if (!transporter) {
      return false;
    }

    const from =
      this.config.get('MAIL_FROM', { infer: true }) || 'VisioraAI Agile <no-reply@visiora.ai>';

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text: body,
      });

      this.logger.log(`Email envoyé avec succès à ${to}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échec d'envoi de l'email à ${to} : ${message}`);
      return false;
    }
  }

  async sendAccountCreated(account: AccountCreatedEmail): Promise<boolean> {
    const appUrl = this.config.get('APP_URL', { infer: true }).replace(/\/$/, '');
    const body = [
      `Bonjour ${account.name},`,
      '',
      'Votre compte VisioraAI Agile a été créé.',
      `Email : ${account.email}`,
      `Mot de passe initial : ${account.initialPassword}`,
      '',
      `Accéder à l'application : ${appUrl}/login`,
      '',
      'Connectez-vous puis changez immédiatement ce mot de passe depuis Paramètres > Sécurité.',
      "Si vous n'attendiez pas la création de ce compte, contactez votre administrateur.",
    ].join('\n');

    return this.sendNotification(account.email, 'Votre compte VisioraAI Agile', body);
  }
}
