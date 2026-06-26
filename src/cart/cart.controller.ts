import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CartItemIdParamDto, CheckoutCartDto, CreateCartItemDto, UpdateCartItemDto } from '../kayan/kayan.dto';
import { KayanCartResponseDto, KayanMessageResponseDto, KayanOrderResponseDto } from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly kayanService: KayanService) {}

  @Get()
  @ApiResponse({ status: 200, type: KayanCartResponseDto })
  listCart(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.kayanService.listCart(user);
  }

  @Post('items')
  @ApiResponse({ status: 201, type: KayanCartResponseDto })
  addCartItem(@CurrentUser() user: AuthUser, @Body() dto: CreateCartItemDto): Promise<Record<string, unknown>> {
    return this.kayanService.addCartItem(user, dto);
  }

  @Patch('items/:id')
  @ApiResponse({ status: 200, type: KayanCartResponseDto })
  updateCartItem(@CurrentUser() user: AuthUser, @Param() params: CartItemIdParamDto, @Body() dto: UpdateCartItemDto): Promise<Record<string, unknown>> {
    return this.kayanService.updateCartItem(user, params.id, dto);
  }

  @Delete('items/:id')
  @ApiResponse({ status: 200, type: KayanMessageResponseDto })
  deleteCartItem(@CurrentUser() user: AuthUser, @Param() params: CartItemIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.deleteCartItem(user, params.id);
  }

  @Post('checkout')
  @ApiResponse({ status: 201, type: KayanOrderResponseDto })
  checkoutCart(@CurrentUser() user: AuthUser, @Body() dto: CheckoutCartDto): Promise<Record<string, unknown>> {
    return this.kayanService.checkoutCart(user, dto);
  }
}
