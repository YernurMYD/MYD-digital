import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { AccountStatus } from '../common/enums/role.enum';
import { JwtPayload, TokenPair } from './interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'passwordHash', 'role', 'status', 'organizationId'],
    });

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    if (user.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Аккаунт заблокирован. Обратитесь к администратору');
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('Аккаунт не активен');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    await this.saveRefreshToken(user.id, tokens.refreshToken);
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    return tokens;
  }

  async refresh(userId: string, refreshToken: string): Promise<TokenPair> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'role', 'status', 'organizationId', 'refreshTokenHash'],
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Доступ запрещён');
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('Аккаунт не активен');
    }

    const tokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!tokenValid) {
      throw new UnauthorizedException('Недействительный refresh-токен');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    await this.saveRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.userRepo.update(userId, { refreshTokenHash: null as any });
  }

  private async generateTokens(payload: JwtPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.cfg.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.cfg.get('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.cfg.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.cfg.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const hash = await bcrypt.hash(token, 10);
    await this.userRepo.update(userId, { refreshTokenHash: hash });
  }
}
