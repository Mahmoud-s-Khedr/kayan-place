import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ListMyProductsDto } from './dto/list-my-products.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { ProductListResponseDto } from './dto/product-response.dto';
import { ProductsService } from './products.service';

@ApiTags('Products (Legacy)')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('my/products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the current user\'s products (legacy, no Kayan equivalent)' })
  @ApiResponse({ status: 200, description: 'Paginated list of own products', type: ProductListResponseDto })
  listMyProducts(@CurrentUser() user: AuthUser, @Query() query: ListMyProductsDto): Promise<Record<string, unknown>> {
    return this.productsService.listMyProducts(user, query);
  }

  @Get('search/products')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Search/filter product listings (legacy, kept for compatibility)' })
  @ApiResponse({ status: 200, description: 'Paginated search results', type: ProductListResponseDto })
  searchProducts(@Query() query: SearchProductsDto, @CurrentUser() user?: AuthUser | null): Promise<Record<string, unknown>> {
    void user;
    return this.productsService.searchProducts(query);
  }
}
