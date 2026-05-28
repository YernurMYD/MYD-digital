import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: { organizationId: string },
  ) {
    return this.usersService.create(dto, currentUser.organizationId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(UserRole.ADMIN)
  toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.toggleStatus(id);
  }

  @Get('me/profile')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.AGENT, UserRole.CLIENT, UserRole.ACCOUNTANT)
  getProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.findById(user.id);
  }
}
