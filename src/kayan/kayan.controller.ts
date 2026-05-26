import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import {
  AdminCreateProductDto,
  AdminUpdateFaultStatusDto,
  AdminUpdateOrderStatusDto,
  AdminUpdateProductDto,
  AdminUpdateServiceStatusDto,
  CheckoutCartDto,
  CartItemIdParamDto,
  CreateCartItemDto,
  CreateFaultDto,
  CreateFollowupConversationBodyDto,
  CreateFollowupStepBodyDto,
  CreateGalleryItemDto,
  CreateItemRatingDto,
  CreateOrderDto,
  CreateServiceOrderDto,
  FaultIdParamDto,
  FollowupConversationMessagesParamDto,
  FollowupScopeParamDto,
  FollowupStepParamDto,
  GalleryIdParamDto,
  ListOrdersQueryDto,
  ListMyFaultsQueryDto,
  ListProductsQueryDto,
  ListServicesQueryDto,
  OrderIdParamDto,
  ProductIdParamDto,
  SendFollowupMessageDto,
  ServiceIdParamDto,
  UpdateFaultDto,
  UpdateFollowupStepDto,
  UpdateGalleryItemDto,
  UpdateCartItemDto,
  UpdateOrderAddressDto,
  UpdateServiceOrderDto,
} from './kayan.dto';
import { KayanService } from './kayan.service';
import {
  GalleryItemResponseDto,
  GalleryItemsResponseDto,
  KayanCartResponseDto,
  KayanFaultResponseDto,
  KayanFaultsResponseDto,
  KayanMessageResponseDto,
  KayanOrderResponseDto,
  KayanOrdersResponseDto,
  KayanProductResponseDto,
  KayanProductsResponseDto,
  KayanRatingResponseDto,
  KayanServiceResponseDto,
  KayanServicesResponseDto,
} from './kayan-response.dto';

@ApiTags('Kayan API')
@Controller('api')
export class KayanController {
  constructor(private readonly kayanService: KayanService) {}

  @Get('products')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List public Kayan products' })
  @ApiResponse({ status: 200, type: KayanProductsResponseDto })
  listProducts(@Query() query: ListProductsQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listProducts(query);
  }

  @Get('products/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get Kayan product by id' })
  @ApiResponse({ status: 200, type: KayanProductResponseDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto })
  getProduct(@Param() params: ProductIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.getProduct(params.id);
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create order' })
  @ApiResponse({ status: 201, type: KayanOrderResponseDto })
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto): Promise<Record<string, unknown>> {
    return this.kayanService.createOrder(user, dto);
  }

  @Get('cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List cart items' })
  @ApiResponse({ status: 200, type: KayanCartResponseDto })
  listCart(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.kayanService.listCart(user);
  }

  @Post('cart/items')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add cart item' })
  @ApiResponse({ status: 201, type: KayanCartResponseDto })
  addCartItem(@CurrentUser() user: AuthUser, @Body() dto: CreateCartItemDto): Promise<Record<string, unknown>> {
    return this.kayanService.addCartItem(user, dto);
  }

  @Patch('cart/items/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateCartItem(
    @CurrentUser() user: AuthUser,
    @Param() params: CartItemIdParamDto,
    @Body() dto: UpdateCartItemDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.updateCartItem(user, params.id, dto);
  }

  @Delete('cart/items/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: KayanMessageResponseDto })
  deleteCartItem(@CurrentUser() user: AuthUser, @Param() params: CartItemIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.deleteCartItem(user, params.id);
  }

  @Post('cart/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 201, type: KayanOrderResponseDto })
  checkoutCart(@CurrentUser() user: AuthUser, @Body() dto: CheckoutCartDto): Promise<Record<string, unknown>> {
    return this.kayanService.checkoutCart(user, dto);
  }

  @Get('orders/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: KayanOrdersResponseDto })
  listMyOrders(@CurrentUser() user: AuthUser, @Query() query: ListOrdersQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyOrders(user, query);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: KayanOrderResponseDto })
  getOrder(@CurrentUser() user: AuthUser, @Param() params: OrderIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.getOrderForUser(user.sub, params.id);
  }

  @Patch('orders/:id/address')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateOrderAddress(
    @CurrentUser() user: AuthUser,
    @Param() params: OrderIdParamDto,
    @Body() dto: UpdateOrderAddressDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.updateOrderAddress(user, params.id, dto);
  }

  @Post('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: KayanOrderResponseDto })
  cancelOrder(@CurrentUser() user: AuthUser, @Param() params: OrderIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.cancelOrder(user, params.id);
  }

  @Post('faults')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 201, type: KayanFaultResponseDto })
  createFault(@CurrentUser() user: AuthUser, @Body() dto: CreateFaultDto): Promise<Record<string, unknown>> {
    return this.kayanService.createFault(user, dto);
  }

  @Patch('faults/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateFault(
    @CurrentUser() user: AuthUser,
    @Param() params: FaultIdParamDto,
    @Body() dto: UpdateFaultDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.updateFault(user, params.id, dto);
  }

  @Get('faults/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: KayanFaultsResponseDto })
  listMyFaults(@CurrentUser() user: AuthUser, @Query() query: ListMyFaultsQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyFaults(user, query);
  }

  @Post('faults/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: KayanFaultResponseDto })
  cancelFault(@CurrentUser() user: AuthUser, @Param() params: FaultIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.cancelFault(user, params.id);
  }

  @Post('services')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 201, type: KayanServiceResponseDto })
  createService(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceOrderDto): Promise<Record<string, unknown>> {
    return this.kayanService.createService(user, dto);
  }

  @Patch('services/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateService(
    @CurrentUser() user: AuthUser,
    @Param() params: ServiceIdParamDto,
    @Body() dto: UpdateServiceOrderDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.updateService(user, params.id, dto);
  }

  @Get('services/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: KayanServicesResponseDto })
  listMyServices(@CurrentUser() user: AuthUser, @Query() query: ListServicesQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyServices(user, query);
  }

  @Post('services/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: KayanServiceResponseDto })
  cancelService(@CurrentUser() user: AuthUser, @Param() params: ServiceIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.cancelService(user, params.id);
  }

  @Get('followups/:itemType/:itemId/steps')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listFollowupSteps(
    @CurrentUser() user: AuthUser,
    @Param() params: FollowupScopeParamDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.listFollowupSteps(user, params.itemType, params.itemId);
  }

  @Get('gallery')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiResponse({ status: 200, type: GalleryItemsResponseDto })
  listGallery(): Promise<Record<string, unknown>> {
    return this.kayanService.listGallery();
  }

  @Post('ratings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 201, type: KayanRatingResponseDto })
  createItemRating(@CurrentUser() user: AuthUser, @Body() dto: CreateItemRatingDto): Promise<Record<string, unknown>> {
    return this.kayanService.createItemRating(user, dto);
  }

  @Post('followups/:itemType/:itemId/chat/conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createConversation(
    @CurrentUser() user: AuthUser,
    @Param() params: FollowupScopeParamDto,
    @Body() dto: CreateFollowupConversationBodyDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.createFollowupConversation(user, { ...dto, itemType: params.itemType, itemId: params.itemId });
  }

  @Get('followups/:itemType/:itemId/chat/conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param() params: FollowupConversationMessagesParamDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.listFollowupMessages(user, params.id, params.itemType, params.itemId);
  }

  @Post('followups/:itemType/:itemId/chat/conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param() params: FollowupConversationMessagesParamDto,
    @Body() dto: SendFollowupMessageDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.sendFollowupMessage(user, params.id, dto, params.itemType, params.itemId);
  }
}

@ApiTags('Kayan API Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('api/admin')
export class KayanAdminController {
  constructor(private readonly kayanService: KayanService) {}

  @Post('products')
  @ApiResponse({ status: 201, type: KayanProductResponseDto })
  createProduct(@CurrentUser() admin: AuthUser, @Body() dto: AdminCreateProductDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateProduct(admin, dto);
  }

  @Patch('products/:id')
  updateProduct(
    @CurrentUser() admin: AuthUser,
    @Param() params: ProductIdParamDto,
    @Body() dto: AdminUpdateProductDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateProduct(admin, params.id, dto);
  }

  @Delete('products/:id')
  @ApiResponse({ status: 200, type: KayanMessageResponseDto })
  deleteProduct(@CurrentUser() admin: AuthUser, @Param() params: ProductIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteProduct(admin, params.id);
  }

  @Get('orders')
  @ApiResponse({ status: 200, type: KayanOrdersResponseDto })
  listOrders(): Promise<Record<string, unknown>> {
    return this.kayanService.adminListOrders();
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @CurrentUser() admin: AuthUser,
    @Param() params: OrderIdParamDto,
    @Body() dto: AdminUpdateOrderStatusDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateOrderStatus(admin, params.id, dto);
  }

  @Get('faults')
  @ApiResponse({ status: 200, type: KayanFaultsResponseDto })
  listFaults(): Promise<Record<string, unknown>> {
    return this.kayanService.adminListFaults();
  }

  @Patch('faults/:id/status')
  updateFaultStatus(
    @CurrentUser() admin: AuthUser,
    @Param() params: FaultIdParamDto,
    @Body() dto: AdminUpdateFaultStatusDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateFaultStatus(admin, params.id, dto);
  }

  @Get('services')
  @ApiResponse({ status: 200, type: KayanServicesResponseDto })
  listServices(@Query() query: ListServicesQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminListServices(query);
  }

  @Patch('services/:id/status')
  updateServiceStatus(
    @CurrentUser() admin: AuthUser,
    @Param() params: ServiceIdParamDto,
    @Body() dto: AdminUpdateServiceStatusDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateServiceStatus(admin, params.id, dto);
  }

  @Post('followups/:itemType/:itemId/steps')
  createStep(
    @CurrentUser() admin: AuthUser,
    @Param() params: FollowupScopeParamDto,
    @Body() dto: CreateFollowupStepBodyDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateFollowupStep(admin, { ...dto, itemType: params.itemType, itemId: params.itemId });
  }

  @Patch('followups/:itemType/:itemId/steps/:id')
  updateStep(
    @Param() params: FollowupStepParamDto,
    @Body() dto: UpdateFollowupStepDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateFollowupStep(params.id, dto);
  }

  @Delete('followups/:itemType/:itemId/steps/:id')
  deleteStep(
    @Param() params: FollowupStepParamDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteFollowupStep(params.id);
  }

  @Get('gallery')
  @ApiResponse({ status: 200, type: GalleryItemsResponseDto })
  listGallery(): Promise<Record<string, unknown>> {
    return this.kayanService.adminListGallery();
  }

  @Post('gallery')
  @ApiResponse({ status: 201, type: GalleryItemResponseDto })
  createGalleryItem(@CurrentUser() admin: AuthUser, @Body() dto: CreateGalleryItemDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateGalleryItem(admin, dto);
  }

  @Patch('gallery/:id')
  updateGalleryItem(
    @CurrentUser() admin: AuthUser,
    @Param() params: GalleryIdParamDto,
    @Body() dto: UpdateGalleryItemDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateGalleryItem(admin, params.id, dto);
  }

  @Delete('gallery/:id')
  @ApiResponse({ status: 200, type: KayanMessageResponseDto })
  deleteGalleryItem(@CurrentUser() admin: AuthUser, @Param() params: GalleryIdParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteGalleryItem(admin, params.id);
  }
}
