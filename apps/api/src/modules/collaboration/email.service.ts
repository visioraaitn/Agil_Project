import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import net from 'node:net';
import type { Env } from '../../config/env';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendNotification(to: string, subject: string, body: string): Promise<boolean> {
    const host = this.config.get('SMTP_HOST', { infer: true });
    const port = this.config.get('SMTP_PORT', { infer: true });
    if (!host || !port) return false;

    const from = this.config.get('MAIL_FROM', { infer: true });
    try {
      await sendSmtp({
        host,
        port,
        from: extractEmail(from),
        to,
        message: [
          `From: ${from}`,
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=utf-8',
          '',
          body,
        ].join('\r\n'),
      });
      return true;
    } catch (error) {
      this.logger.warn(`Email non envoye a ${to}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

function extractEmail(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return match?.[1] ?? value;
}

function sendSmtp({
  host,
  port,
  from,
  to,
  message,
}: {
  host: string;
  port: number;
  from: string;
  to: string;
  message: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const commands = [
      'HELO visiora.local',
      `MAIL FROM:<${from}>`,
      `RCPT TO:<${to}>`,
      'DATA',
      `${message}\r\n.`,
      'QUIT',
    ];
    let index = 0;
    let done = false;

    const fail = (error: Error) => {
      if (done) return;
      done = true;
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(5_000, () => fail(new Error('timeout SMTP')));
    socket.on('error', fail);
    socket.on('data', (chunk) => {
      const response = chunk.toString('utf8');
      if (/^[45]\d\d/m.test(response)) {
        fail(new Error(response.trim()));
        return;
      }
      if (index < commands.length) {
        socket.write(`${commands[index++]}\r\n`);
      } else if (!done) {
        done = true;
        socket.end();
        resolve();
      }
    });
  });
}
