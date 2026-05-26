import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { ProductIdParamDto, ListProductsQueryDto } from '../kayan/kayan.dto';
import { KayanProductResponseDto, KayanProductsResponseDto } from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Products')
@Controller('products')
export class KayanProductsController {
  constructor(private readonly kayanService: KayanService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List public Kayan products' })
  @ApiResponse({ status: 200, type: KayanProductsResponseDto })
  listProducts(@Query() query: ListProductsQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listProducts(query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get Kayan product by id' })
  @ApiResponse({ status: 200, type: KayanProductResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  getProduct(@Param() params: ProductIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.getProduct(params.id);
  }
}
