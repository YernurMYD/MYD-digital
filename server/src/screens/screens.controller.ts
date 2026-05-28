import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ScreensService } from './screens.service';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { QueryScreenDto } from './dto/query-screen.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums/role.enum';

@Controller('screens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScreensController {
  constructor(private readonly screensService: ScreensService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  create(
    @Body() dto: CreateScreenDto,
    @CurrentUser() user: { organizationId: string },
  ) {
    return this.screensService.create(dto, user.organizationId);
  }

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.AGENT,
    UserRole.CLIENT,
  )
  findAll(@Query() query: QueryScreenDto) {
    return this.screensService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.screensService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScreenDto,
  ) {
    return this.screensService.update(id, dto);
  }
}
