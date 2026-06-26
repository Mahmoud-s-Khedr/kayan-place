import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import {
  AdminCreateProductDto,
  AdminUpdateFaultStatusDto,
  AdminUpdateOrderStatusDto,
  AdminUpdateProductDto,
  AdminUpdateServiceStatusDto,
  CreateFollowupStepBodyDto,
  CreateGalleryItemDto,
  FaultIdParamDto,
  FollowupScopeParamDto,
  FollowupStepParamDto,
  GalleryIdParamDto,
  ListAdminFaultsQueryDto,
  ListOrdersQueryDto,
  ListServicesQueryDto,
  OrderIdParamDto,
  ProductIdParamDto,
  ServiceIdParamDto,
  UpdateFollowupStepDto,
  UpdateGalleryItemDto,
} from '../kayan/kayan.dto';
import {
  GalleryItemResponseDto,
  GalleryItemsResponseDto,
  KayanFaultResponseDto,
  KayanFaultsResponseDto,
  KayanMessageResponseDto,
  KayanOrderResponseDto,
  KayanOrdersResponseDto,
  KayanProductResponseDto,
  KayanServiceResponseDto,
  KayanServicesResponseDto,
  FollowupStepResponseDto,
} from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class KayanAdminController {
  constructor(private readonly kayanService: KayanService) {}

  @Post('products')
  @ApiResponse({ status: 201, type: KayanProductResponseDto })
  createProduct(@CurrentUser() admin: AuthUser, @Body() dto: AdminCreateProductDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateProduct(admin, dto);
  }

  @Patch('products/:id')
  @ApiResponse({ status: 200, type: KayanProductResponseDto })
  updateProduct(@CurrentUser() admin: AuthUser, @Param() params: ProductIdParamDto, @Body() dto: AdminUpdateProductDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateProduct(admin, params.id, dto);
  }

  @Delete('products/:id')
  @ApiResponse({ status: 200, type: KayanMessageResponseDto })
  deleteProduct(@CurrentUser() admin: AuthUser, @Param() params: ProductIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteProduct(admin, params.id);
  }

  @Get('orders')
  @ApiResponse({ status: 200, type: KayanOrdersResponseDto })
  listOrders(@Query() query: ListOrdersQueryDto): Promise<Record<string, unknown>> { return this.kayanService.adminListOrders(query); }

  @Patch('orders/:id/status')
  @ApiResponse({ status: 200, type: KayanOrderResponseDto })
  updateOrderStatus(@CurrentUser() admin: AuthUser, @Param() params: OrderIdParamDto, @Body() dto: AdminUpdateOrderStatusDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateOrderStatus(admin, params.id, dto);
  }

  @Get('faults')
  @ApiResponse({ status: 200, type: KayanFaultsResponseDto })
  listFaults(@Query() query: ListAdminFaultsQueryDto): Promise<Record<string, unknown>> { return this.kayanService.adminListFaults(query); }

  @Patch('faults/:id/status')
  @ApiResponse({ status: 200, type: KayanFaultResponseDto })
  updateFaultStatus(@CurrentUser() admin: AuthUser, @Param() params: FaultIdParamDto, @Body() dto: AdminUpdateFaultStatusDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateFaultStatus(admin, params.id, dto);
  }

  @Get('services')
  @ApiResponse({ status: 200, type: KayanServicesResponseDto })
  listServices(@Query() query: ListServicesQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminListServices(query);
  }

  @Patch('services/:id/status')
  @ApiResponse({ status: 200, type: KayanServiceResponseDto })
  updateServiceStatus(@CurrentUser() admin: AuthUser, @Param() params: ServiceIdParamDto, @Body() dto: AdminUpdateServiceStatusDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateServiceStatus(admin, params.id, dto);
  }

  @Post('followups/:itemType/:itemId/steps')
  @ApiResponse({ status: 201, type: FollowupStepResponseDto })
  createStep(@CurrentUser() admin: AuthUser, @Param() params: FollowupScopeParamDto, @Body() dto: CreateFollowupStepBodyDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateFollowupStep(admin, { ...dto, itemType: params.itemType, itemId: params.itemId });
  }

  @Patch('followups/:itemType/:itemId/steps/:id')
  @ApiResponse({ status: 200, type: FollowupStepResponseDto })
  updateStep(@Param() params: FollowupStepParamDto, @Body() dto: UpdateFollowupStepDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateFollowupStep(params.id, dto);
  }

  @Delete('followups/:itemType/:itemId/steps/:id')
  @ApiResponse({ status: 200, type: KayanMessageResponseDto })
  deleteStep(@Param() params: FollowupStepParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteFollowupStep(params.id);
  }

  @Get('gallery')
  @ApiResponse({ status: 200, type: GalleryItemsResponseDto })
  listGallery(): Promise<Record<string, unknown>> { return this.kayanService.adminListGallery(); }

  @Post('gallery')
  @ApiResponse({ status: 201, type: GalleryItemResponseDto })
  createGalleryItem(@CurrentUser() admin: AuthUser, @Body() dto: CreateGalleryItemDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateGalleryItem(admin, dto);
  }

  @Patch('gallery/:id')
  @ApiResponse({ status: 200, type: GalleryItemResponseDto })
  updateGalleryItem(@CurrentUser() admin: AuthUser, @Param() params: GalleryIdParamDto, @Body() dto: UpdateGalleryItemDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateGalleryItem(admin, params.id, dto);
  }

  @Delete('gallery/:id')
  @ApiResponse({ status: 200, type: KayanMessageResponseDto })
  deleteGalleryItem(@CurrentUser() admin: AuthUser, @Param() params: GalleryIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteGalleryItem(admin, params.id);
  }
}
