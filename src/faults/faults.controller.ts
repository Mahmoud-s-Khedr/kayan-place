import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateFaultDto, FaultIdParamDto, ListMyFaultsQueryDto, UpdateFaultDto } from '../kayan/kayan.dto';
import { KayanFaultResponseDto, KayanFaultsResponseDto } from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Faults')
@Controller('faults')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FaultsController {
  constructor(private readonly kayanService: KayanService) {}

  @Post()
  @ApiResponse({ status: 201, type: KayanFaultResponseDto })
  createFault(@CurrentUser() user: AuthUser, @Body() dto: CreateFaultDto): Promise<Record<string, unknown>> {
    return this.kayanService.createFault(user, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: KayanFaultResponseDto })
  updateFault(@CurrentUser() user: AuthUser, @Param() params: FaultIdParamDto, @Body() dto: UpdateFaultDto): Promise<Record<string, unknown>> {
    return this.kayanService.updateFault(user, params.id, dto);
  }

  @Get('me')
  @ApiResponse({ status: 200, type: KayanFaultsResponseDto })
  listMyFaults(@CurrentUser() user: AuthUser, @Query() query: ListMyFaultsQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyFaults(user, query);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: KayanFaultResponseDto })
  getFault(@CurrentUser() user: AuthUser, @Param() params: FaultIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.getFaultForUser(user.sub, params.id);
  }

  @Post(':id/cancel')
  @ApiResponse({ status: 200, type: KayanFaultResponseDto })
  cancelFault(@CurrentUser() user: AuthUser, @Param() params: FaultIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.cancelFault(user, params.id);
  }
}
