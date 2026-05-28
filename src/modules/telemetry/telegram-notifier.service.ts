import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * Сервис отправки критических алертов администраторам через Telegram Bot API.
 *
 * Env-переменные:
 *   TELEGRAM_BOT_TOKEN  — токен бота (@BotFather)
 *   TELEGRAM_CHAT_IDS   — ID чатов через запятую (группа или личные)
 *
 * Вызывается автоматически при событии alert.triggered,
 * если в channels присутствует 'telegram'.
 */

interface AlertEvent {
  alertId: string;
  deviceId: string;
  severity: string;
  alertType: string;
  message: string;
  channels: string[];
}

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
};

@Injectable()
export class TelegramNotifierService implements OnModuleInit {
  private readonly logger = new Logger(TelegramNotifierService.name);
  private botToken = '';
  private chatIds: string[] = [];
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    const rawChatIds = this.config.get<string>('TELEGRAM_CHAT_IDS', '');
    this.chatIds = rawChatIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    this.enabled = Boolean(this.botToken && this.chatIds.length);

    if (this.enabled) {
      this.logger.log(`Telegram notifications enabled for ${this.chatIds.length} chat(s)`);
    } else {
      this.logger.warn(
        'Telegram notifications disabled: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS',
      );
    }
  }

  @OnEvent('alert.triggered')
  async onAlertTriggered(event: AlertEvent): Promise<void> {
    if (!this.enabled) return;
    if (!event.channels?.includes('telegram')) return;

    const text = this.formatMessage(event);

    await Promise.allSettled(
      this.chatIds.map((chatId) => this.sendMessage(chatId, text)),
    );
  }

  @OnEvent('device.offline')
  async onDeviceOffline(event: { deviceId: string; offlineMinutes: number }): Promise<void> {
    if (!this.enabled) return;

    const text =
      `🔴 *УСТРОЙСТВО OFFLINE*\n\n` +
      `Устройство: \`${event.deviceId}\`\n` +
      `Не отвечает: *${event.offlineMinutes} мин*\n` +
      `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`;

    await Promise.allSettled(
      this.chatIds.map((chatId) => this.sendMessage(chatId, text)),
    );
  }

  private formatMessage(event: AlertEvent): string {
    const icon = SEVERITY_ICON[event.severity] ?? '⚪';
    const severity = event.severity.toUpperCase();

    return (
      `${icon} *VECTOR Alert — ${severity}*\n\n` +
      `Устройство: \`${event.deviceId}\`\n` +
      `Тип: \`${event.alertType}\`\n` +
      `Сообщение: ${event.message}\n` +
      `ID: \`${event.alertId}\`\n` +
      `Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`
    );
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Telegram API error (chat ${chatId}): ${res.status} ${body}`);
      }
    } catch (err) {
      this.logger.error(`Telegram send failed (chat ${chatId}): ${err.message}`);
    }
  }
}
