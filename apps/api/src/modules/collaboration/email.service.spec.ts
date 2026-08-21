import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let mockConfigService: { get: jest.Mock };
  let mockTransporter: {
    sendMail: jest.Mock;
    verify: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-123', response: '250 OK' }),
      verify: jest.fn().mockResolvedValue(true),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe('sendNotification', () => {
    it('devrait envoyer un email avec succès lorsque les identifiants sont fournis', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: 'user@example.com',
          SMTP_PASSWORD: 'secure password',
          MAIL_FROM: 'VisioraAI <no-reply@visiora.ai>',
        };
        return config[key];
      });

      const result = await service.sendNotification(
        'recipient@example.com',
        'Bienvenue',
        'Bienvenue sur le projet',
      );

      expect(result).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: 'user@example.com',
            pass: 'securepassword', // espaces retirés
          },
        }),
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'VisioraAI <no-reply@visiora.ai>',
        to: 'recipient@example.com',
        subject: 'Bienvenue',
        text: 'Bienvenue sur le projet',
      });
    });

    it('devrait envoyer un email sans objet auth si aucun identifiant n’est configuré (ex: Mailhog)', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: 'localhost',
          SMTP_PORT: 1025,
          SMTP_SECURE: false,
          SMTP_USER: '',
          SMTP_PASSWORD: '',
          MAIL_FROM: 'VisioraAI <no-reply@visiora.ai>',
        };
        return config[key];
      });

      const result = await service.sendNotification(
        'recipient@example.com',
        'Test Mailhog',
        'Corps du message',
      );

      expect(result).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 1025,
          secure: false,
        }),
      );
      // Ne doit pas contenir d'objet auth
      const passedOptions = (nodemailer.createTransport as jest.Mock).mock.calls[0][0];
      expect(passedOptions.auth).toBeUndefined();
    });

    it('devrait retourner false sans exception si SMTP_HOST ou SMTP_PORT est manquant', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.sendNotification('recipient@example.com', 'Sujet', 'Message');

      expect(result).toBe(false);
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('devrait capturer les erreurs de sendMail et retourner false', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: 'user',
          SMTP_PASSWORD: 'pass',
          MAIL_FROM: 'no-reply@visiora.ai',
        };
        return config[key];
      });

      mockTransporter.sendMail.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await service.sendNotification('recipient@example.com', 'Sujet', 'Message');

      expect(result).toBe(false);
    });
  });

  describe('verifyConnection', () => {
    it('devrait retourner true si le transporteur est valide', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: 465,
          SMTP_SECURE: true,
          SMTP_USER: 'user',
          SMTP_PASSWORD: 'pass',
        };
        return config[key];
      });

      const result = await service.verifyConnection();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
    });

    it('devrait retourner false si la vérification échoue', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: 587,
        };
        return config[key];
      });

      mockTransporter.verify.mockRejectedValueOnce(new Error('Invalid credentials'));

      const result = await service.verifyConnection();

      expect(result).toBe(false);
    });
  });

  describe('sendAccountCreated', () => {
    it("envoie l'adresse et le mot de passe initial au nouveau compte", async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: 'user',
          SMTP_PASSWORD: 'pass',
          MAIL_FROM: 'no-reply@visiora.ai',
          APP_URL: 'https://visiora-planner.netlify.app',
        };
        return config[key];
      });

      const result = await service.sendAccountCreated({
        email: 'new.user@example.com',
        name: 'New User',
        initialPassword: 'Initial1234',
      });

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new.user@example.com',
          subject: 'Votre compte VisioraAI Agile',
          text: expect.stringContaining('Mot de passe initial : Initial1234'),
        }),
      );
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            "Accéder à l'application : https://visiora-planner.netlify.app/login",
          ),
        }),
      );
    });
  });
});
