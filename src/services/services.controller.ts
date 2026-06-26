import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateServiceOrderDto, ListServicesQueryDto, ServiceIdParamDto, UpdateServiceOrderDto } from '../kayan/kayan.dto';
import { KayanServiceResponseDto, KayanServicesResponseDto } from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Services')
@Controller('services')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly kayanService: KayanService) {}

  @Post()
  @ApiResponse({ status: 201, type: KayanServiceResponseDto })
  createService(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceOrderDto): Promise<Record<string, unknown>> {
    return this.kayanService.createService(user, dto);
  }

  @Get()
  @ApiResponse({ status: 200, type: KayanServicesResponseDto })
  listServices(@Query() query: ListServicesQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.publicListServices(query);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: KayanServiceResponseDto })
  updateService(@CurrentUser() user: AuthUser, @Param() params: ServiceIdParamDto, @Body() dto: UpdateServiceOrderDto): Promise<Record<string, unknown>> {
    return this.kayanService.updateService(user, params.id, dto);
  }

  @Get('me')
  @ApiResponse({ status: 200, type: KayanServicesResponseDto })
  listMyServices(@CurrentUser() user: AuthUser, @Query() query: ListServicesQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyServices(user, query);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: KayanServiceResponseDto })
  getService(@CurrentUser() user: AuthUser, @Param() params: ServiceIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.getServiceForUser(user.sub, params.id);
  }

  @Post(':id/cancel')
  @ApiResponse({ status: 200, type: KayanServiceResponseDto })
  cancelService(@CurrentUser() user: AuthUser, @Param() params: ServiceIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.cancelService(user, params.id);
  }
}
