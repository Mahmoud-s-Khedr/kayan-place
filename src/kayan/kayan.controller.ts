import { Body, Controller, Delete, Get, Header, Param, ParseEnumPipe, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  CreateCartItemDto,
  CreateFaultDto,
  CreateFollowupConversationDto,
  CreateFollowupConversationBodyDto,
  CreateFollowupStepDto,
  CreateFollowupStepBodyDto,
  CreateGalleryItemDto,
  CreateItemRatingDto,
  CreateOrderDto,
  CreateServiceOrderDto,
  ItemType,
  ListOrdersQueryDto,
  ListMyFaultsQueryDto,
  ListProductsQueryDto,
  ListServicesQueryDto,
  SendFollowupMessageDto,
  UpdateFaultDto,
  UpdateFollowupStepDto,
  UpdateGalleryItemDto,
  UpdateCartItemDto,
  UpdateOrderAddressDto,
  UpdateServiceOrderDto,
} from './kayan.dto';
import { KayanService } from './kayan.service';

@ApiTags('Kayan V2')
@Controller('v2')
export class KayanController {
  constructor(private readonly kayanService: KayanService) {}

  @Get('products')
  @UseGuards(OptionalJwtAuthGuard)
  listProducts(@Query() query: ListProductsQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listProducts(query);
  }

  @Get('products/:id')
  @UseGuards(OptionalJwtAuthGuard)
  getProduct(@Param('id', ParseIntPipe) productId: number): Promise<Record<string, unknown>> {
    return this.kayanService.getProduct(productId);
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto): Promise<Record<string, unknown>> {
    return this.kayanService.createOrder(user, dto);
  }

  @Get('cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listCart(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.kayanService.listCart(user);
  }

  @Post('cart/items')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  addCartItem(@CurrentUser() user: AuthUser, @Body() dto: CreateCartItemDto): Promise<Record<string, unknown>> {
    return this.kayanService.addCartItem(user, dto);
  }

  @Patch('cart/items/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateCartItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) cartItemId: number,
    @Body() dto: UpdateCartItemDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.updateCartItem(user, cartItemId, dto);
  }

  @Delete('cart/items/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  deleteCartItem(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) cartItemId: number): Promise<Record<string, unknown>> {
    return this.kayanService.deleteCartItem(user, cartItemId);
  }

  @Post('cart/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  checkoutCart(@CurrentUser() user: AuthUser, @Body() dto: CheckoutCartDto): Promise<Record<string, unknown>> {
    return this.kayanService.checkoutCart(user, dto);
  }

  @Get('orders/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMyOrders(@CurrentUser() user: AuthUser, @Query() query: ListOrdersQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyOrders(user, query);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getOrder(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) orderId: number): Promise<Record<string, unknown>> {
    return this.kayanService.getOrderForUser(user.sub, orderId);
  }

  @Patch('orders/:id/address')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateOrderAddress(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) orderId: number,
    @Body() dto: UpdateOrderAddressDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.updateOrderAddress(user, orderId, dto);
  }

  @Post('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  cancelOrder(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) orderId: number): Promise<Record<string, unknown>> {
    return this.kayanService.cancelOrder(user, orderId);
  }

  @Post('faults')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createFault(@CurrentUser() user: AuthUser, @Body() dto: CreateFaultDto): Promise<Record<string, unknown>> {
    return this.kayanService.createFault(user, dto);
  }

  @Patch('faults/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateFault(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) faultId: number,
    @Body() dto: UpdateFaultDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.updateFault(user, faultId, dto);
  }

  @Get('faults/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMyFaults(@CurrentUser() user: AuthUser, @Query() query: ListMyFaultsQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyFaults(user, query);
  }

  @Post('faults/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  cancelFault(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) faultId: number): Promise<Record<string, unknown>> {
    return this.kayanService.cancelFault(user, faultId);
  }

  @Post('services')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createService(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceOrderDto): Promise<Record<string, unknown>> {
    return this.kayanService.createService(user, dto);
  }

  @Patch('services/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateService(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) serviceId: number,
    @Body() dto: UpdateServiceOrderDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.updateService(user, serviceId, dto);
  }

  @Get('services/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMyServices(@CurrentUser() user: AuthUser, @Query() query: ListServicesQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.listMyServices(user, query);
  }

  @Post('services/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  cancelService(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) serviceId: number): Promise<Record<string, unknown>> {
    return this.kayanService.cancelService(user, serviceId);
  }

  @Get('followups/:itemType/:itemId/steps')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listFollowupSteps(
    @CurrentUser() user: AuthUser,
    @Param('itemType', new ParseEnumPipe(ItemType)) itemType: ItemType,
    @Param('itemId', ParseIntPipe) itemId: number,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.listFollowupSteps(user, itemType, itemId);
  }

  @Get('followup/steps')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
  @Header('X-Deprecated-Route', 'Use /v2/followups/:itemType/:itemId/steps')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listFollowupStepsDeprecated(
    @CurrentUser() user: AuthUser,
    @Query('itemType', new ParseEnumPipe(ItemType)) itemType: ItemType,
    @Query('itemId', ParseIntPipe) itemId: number,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.listFollowupSteps(user, itemType, itemId);
  }

  @Get('gallery')
  @UseGuards(OptionalJwtAuthGuard)
  listGallery(): Promise<Record<string, unknown>> {
    return this.kayanService.listGallery();
  }

  @Post('ratings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createItemRating(@CurrentUser() user: AuthUser, @Body() dto: CreateItemRatingDto): Promise<Record<string, unknown>> {
    return this.kayanService.createItemRating(user, dto);
  }

  @Post('followups/:itemType/:itemId/chat/conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createConversation(
    @CurrentUser() user: AuthUser,
    @Param('itemType', new ParseEnumPipe(ItemType)) itemType: ItemType,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CreateFollowupConversationBodyDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.createFollowupConversation(user, { ...dto, itemType, itemId });
  }

  @Post('followup/chat/conversations')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
  @Header('X-Deprecated-Route', 'Use /v2/followups/:itemType/:itemId/chat/conversations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createConversationDeprecated(@CurrentUser() user: AuthUser, @Body() dto: CreateFollowupConversationDto): Promise<Record<string, unknown>> {
    return this.kayanService.createFollowupConversation(user, dto);
  }

  @Get('followups/:itemType/:itemId/chat/conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param('itemType', new ParseEnumPipe(ItemType)) itemType: ItemType,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('id', ParseIntPipe) conversationId: number,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.listFollowupMessages(user, conversationId, itemType, itemId);
  }

  @Get('followup/chat/conversations/:id/messages')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
  @Header('X-Deprecated-Route', 'Use /v2/followups/:itemType/:itemId/chat/conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMessagesDeprecated(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) conversationId: number): Promise<Record<string, unknown>> {
    return this.kayanService.listFollowupMessages(user, conversationId);
  }

  @Post('followups/:itemType/:itemId/chat/conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param('itemType', new ParseEnumPipe(ItemType)) itemType: ItemType,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() dto: SendFollowupMessageDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.sendFollowupMessage(user, conversationId, dto, itemType, itemId);
  }

  @Post('followup/chat/conversations/:id/messages')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
  @Header('X-Deprecated-Route', 'Use /v2/followups/:itemType/:itemId/chat/conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  sendMessageDeprecated(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() dto: SendFollowupMessageDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.sendFollowupMessage(user, conversationId, dto);
  }
}

@ApiTags('Kayan V2 Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('v2/admin')
export class KayanAdminController {
  constructor(private readonly kayanService: KayanService) {}

  @Post('products')
  createProduct(@CurrentUser() admin: AuthUser, @Body() dto: AdminCreateProductDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateProduct(admin, dto);
  }

  @Patch('products/:id')
  updateProduct(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseIntPipe) productId: number,
    @Body() dto: AdminUpdateProductDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateProduct(admin, productId, dto);
  }

  @Delete('products/:id')
  deleteProduct(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) productId: number): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteProduct(admin, productId);
  }

  @Get('orders')
  listOrders(): Promise<Record<string, unknown>> {
    return this.kayanService.adminListOrders();
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseIntPipe) orderId: number,
    @Body() dto: AdminUpdateOrderStatusDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateOrderStatus(admin, orderId, dto);
  }

  @Get('faults')
  listFaults(): Promise<Record<string, unknown>> {
    return this.kayanService.adminListFaults();
  }

  @Patch('faults/:id/status')
  updateFaultStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseIntPipe) faultId: number,
    @Body() dto: AdminUpdateFaultStatusDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateFaultStatus(admin, faultId, dto);
  }

  @Get('services')
  listServices(@Query() query: ListServicesQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminListServices(query);
  }

  @Patch('services/:id/status')
  updateServiceStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseIntPipe) serviceId: number,
    @Body() dto: AdminUpdateServiceStatusDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateServiceStatus(admin, serviceId, dto);
  }

  @Post('followups/:itemType/:itemId/steps')
  createStep(
    @CurrentUser() admin: AuthUser,
    @Param('itemType', new ParseEnumPipe(ItemType)) itemType: ItemType,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CreateFollowupStepBodyDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateFollowupStep(admin, { ...dto, itemType, itemId });
  }

  @Post('followup-steps')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
  @Header('X-Deprecated-Route', 'Use /v2/admin/followups/:itemType/:itemId/steps')
  createStepDeprecated(@CurrentUser() admin: AuthUser, @Body() dto: CreateFollowupStepDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateFollowupStep(admin, dto);
  }

  @Patch('followups/:itemType/:itemId/steps/:id')
  updateStep(
    @Param('itemType', new ParseEnumPipe(ItemType)) _itemType: ItemType,
    @Param('itemId', ParseIntPipe) _itemId: number,
    @Param('id', ParseIntPipe) stepId: number,
    @Body() dto: UpdateFollowupStepDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateFollowupStep(stepId, dto);
  }

  @Patch('followup-steps/:id')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
  @Header('X-Deprecated-Route', 'Use /v2/admin/followups/:itemType/:itemId/steps/:id')
  updateStepDeprecated(@Param('id', ParseIntPipe) stepId: number, @Body() dto: UpdateFollowupStepDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateFollowupStep(stepId, dto);
  }

  @Delete('followups/:itemType/:itemId/steps/:id')
  deleteStep(
    @Param('itemType', new ParseEnumPipe(ItemType)) _itemType: ItemType,
    @Param('itemId', ParseIntPipe) _itemId: number,
    @Param('id', ParseIntPipe) stepId: number,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteFollowupStep(stepId);
  }

  @Delete('followup-steps/:id')
  @Header('Deprecation', 'true')
  @Header('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT')
  @Header('X-Deprecated-Route', 'Use /v2/admin/followups/:itemType/:itemId/steps/:id')
  deleteStepDeprecated(@Param('id', ParseIntPipe) stepId: number): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteFollowupStep(stepId);
  }

  @Get('gallery')
  listGallery(): Promise<Record<string, unknown>> {
    return this.kayanService.adminListGallery();
  }

  @Post('gallery')
  createGalleryItem(@CurrentUser() admin: AuthUser, @Body() dto: CreateGalleryItemDto): Promise<Record<string, unknown>> {
    return this.kayanService.adminCreateGalleryItem(admin, dto);
  }

  @Patch('gallery/:id')
  updateGalleryItem(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseIntPipe) galleryId: number,
    @Body() dto: UpdateGalleryItemDto,
  ): Promise<Record<string, unknown>> {
    return this.kayanService.adminUpdateGalleryItem(admin, galleryId, dto);
  }

  @Delete('gallery/:id')
  deleteGalleryItem(@CurrentUser() admin: AuthUser, @Param('id', ParseIntPipe) galleryId: number): Promise<Record<string, unknown>> {
    return this.kayanService.adminDeleteGalleryItem(admin, galleryId);
  }
}
