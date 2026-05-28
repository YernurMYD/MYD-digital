import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { Screen } from './entities/screen.entity';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { QueryScreenDto } from './dto/query-screen.dto';

@Injectable()
export class ScreensService {
  constructor(
    @InjectRepository(Screen)
    private readonly screenRepo: Repository<Screen>,
  ) {}

  async create(
    dto: CreateScreenDto,
    organizationId: string,
  ): Promise<Screen> {
    const existing = await this.screenRepo.findOne({
      where: { name: dto.name, organizationId },
    });

    if (existing) {
      throw new ConflictException('Экран с таким названием уже существует');
    }

    const screen = this.screenRepo.create({
      ...dto,
      organizationId,
    });

    return this.screenRepo.save(screen);
  }

  async findAll(query: QueryScreenDto): Promise<Screen[]> {
    const where: FindOptionsWhere<Screen> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.location) {
      where.location = ILike(`%${query.location}%`);
    }

    return this.screenRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Screen> {
    const screen = await this.screenRepo.findOne({ where: { id } });
    if (!screen) {
      throw new NotFoundException('Экран не найден');
    }
    return screen;
  }

  async update(id: string, dto: UpdateScreenDto): Promise<Screen> {
    const screen = await this.findById(id);

    if (dto.name && dto.name !== screen.name) {
      const duplicate = await this.screenRepo.findOne({
        where: { name: dto.name, organizationId: screen.organizationId },
      });
      if (duplicate) {
        throw new ConflictException('Экран с таким названием уже существует');
      }
    }

    Object.assign(screen, dto);
    return this.screenRepo.save(screen);
  }
}
