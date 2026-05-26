import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateOrderDto, ListOrdersQueryDto, OrderIdParamDto, UpdateOrderAddressDto } from '../kayan/kayan.dto';
import { KayanOrderResponseDto, KayanOrdersResponseDto } from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly kayanService: KayanService) {}

  @Post()
  @ApiResponse({ status: 201, type: KayanOrderResponseDto })
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto): Promise<Record<string, unknown>> {
    return this.kayanService.createOrder(user, dto);
  }

  @Get('me')
  @ApiResponse({ status: 200, type: KayanOrdersResponseDto })
  listMyOrders(@CurrentUser() user: AuthUser, @Query() query: ListOrdersQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyOrders(user, query);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: KayanOrderResponseDto })
  getOrder(@CurrentUser() user: AuthUser, @Param() params: OrderIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.getOrderForUser(user.sub, params.id);
  }

  @Patch(':id/address')
  updateOrderAddress(@CurrentUser() user: AuthUser, @Param() params: OrderIdParamDto, @Body() dto: UpdateOrderAddressDto): Promise<Record<string, unknown>> {
    return this.kayanService.updateOrderAddress(user, params.id, dto);
  }

  @Post(':id/cancel')
  @ApiResponse({ status: 200, type: KayanOrderResponseDto })
  cancelOrder(@CurrentUser() user: AuthUser, @Param() params: OrderIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.cancelOrder(user, params.id);
  }
}
