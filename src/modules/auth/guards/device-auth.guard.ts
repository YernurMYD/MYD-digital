import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Guard для аутентификации устройств по API-ключу.
 * Устройства отправляют токен в заголовке X-Device-Token.
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-device-token'];

    if (!token) {
      throw new UnauthorizedException('Device token is required');
    }

    // В реальной реализации: валидация токена через Redis/БД
    // const device = await this.deviceRepo.findOne({ where: { apiToken: token } });
    // if (!device) throw new UnauthorizedException('Invalid device token');
    // request.device = device;

    return true;
  }
}
