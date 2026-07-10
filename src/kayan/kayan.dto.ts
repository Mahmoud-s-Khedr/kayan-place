import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Length, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
import { createOffsetPaginationQueryDto } from '../common/dto/offset-pagination-query.dto';

export enum OrderStatus {
  RECEIVED = 'received',
  READY_TO_SHIP = 'ready_to_ship',
  ON_THE_WAY = 'on_the_way',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
}

export enum FaultStatus {
  RECEIVED = 'received',
  ASSIGNED = 'assigned',
  ON_THE_WAY = 'on_the_way',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
}

export enum ServiceStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  CANCELLED = 'cancelled',
  FINISHED = 'finished',
}

export enum FaultSeverity {
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  EMERGENT = 'emergent',
}

export enum ServiceType {
  DESIGNING = 'designing',
  MAINTENANCE = 'maintenance',
  RENEWAL = 'renewal',
}

export enum ItemType {
  ORDER = 'order',
  FAULT = 'fault',
  SERVICE = 'service',
}

export enum RatingItemType {
  PRODUCT = 'product',
  FAULT = 'fault',
  SERVICE = 'service',
}

export enum ProductAvailabilityFilter {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export enum ProductSortBy {
  CREATED_AT = 'createdAt',
  PRICE = 'price',
}

export enum OrderSortBy {
  CREATED_AT = 'createdAt',
  PRICE = 'price',
}

export enum FaultSortBy {
  CREATED_AT = 'createdAt',
  SEVERITY = 'severity',
}

export enum ServiceSortBy {
  CREATED_AT = 'createdAt',
}

const KayanListPaginationQueryDto = createOffsetPaginationQueryDto({
  defaultLimit: 20,
  maxLimit: 100,
});

const KayanFollowupPaginationQueryDto = createOffsetPaginationQueryDto({
  defaultLimit: 50,
  maxLimit: 100,
});

export class ProductItemDto {
  @IsInt() @Min(1) productId!: number;
  @IsInt() @Min(1) quantity!: number;
}

export class AdminCreateProductDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsInt() @Min(0) amount!: number;
  @Type(() => Number) @Min(0) price!: number;
  @IsOptional() @IsObject() details?: Record<string, unknown>;
  @IsOptional() @IsArray() @IsInt({ each: true }) imageFileIds?: number[];
  @IsOptional() @IsArray() @IsInt({ each: true }) fileIds?: number[];
}

export class AdminUpdateProductDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @IsOptional() @IsInt() @Min(0) amount?: number;
  @IsOptional() @Type(() => Number) @Min(0) price?: number;
  @IsOptional() @IsObject() details?: Record<string, unknown>;
  @IsOptional() @IsArray() @IsInt({ each: true }) imageFileIds?: number[];
  @IsOptional() @IsArray() @IsInt({ each: true }) fileIds?: number[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListProductsQueryDto extends KayanListPaginationQueryDto {
  @IsOptional() @IsString() @IsNotEmpty() query?: string;
  @IsOptional() @Type(() => Number) @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @Min(0) maxPrice?: number;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsEnum(ProductAvailabilityFilter) availability?: ProductAvailabilityFilter;
  @IsOptional() @IsEnum(ProductSortBy) sortBy?: ProductSortBy;
  @IsOptional() @IsEnum(SortDirection) sortDirection?: SortDirection;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) minRate?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) maxRate?: number;
}

export class CreateOrderDto {
  @IsString() @IsNotEmpty() deliveryAddress!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProductItemDto) items!: ProductItemDto[];
}

export class UpdateOrderAddressDto {
  @IsString() @IsNotEmpty() deliveryAddress!: string;
}

export class AdminUpdateOrderStatusDto {
  @IsEnum(OrderStatus) status!: OrderStatus;
}

export class ListOrdersQueryDto extends KayanListPaginationQueryDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsString() @IsNotEmpty() search?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @Type(() => Number) @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @Min(0) maxPrice?: number;
  @IsOptional() @IsEnum(OrderSortBy) sortBy?: OrderSortBy;
  @IsOptional() @IsEnum(SortDirection) sortDirection?: SortDirection;
}

export class CreateCartItemDto {
  @IsInt() @Min(1) productId!: number;
  @IsInt() @Min(1) quantity!: number;
}

export class UpdateCartItemDto {
  @IsInt() @Min(1) quantity!: number;
}

export class CheckoutCartDto {
  @IsString() @IsNotEmpty() deliveryAddress!: string;
}

export class CreateFaultDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsEnum(FaultSeverity) severity!: FaultSeverity;
  @IsString() @IsNotEmpty() address!: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) imageFileIds?: number[];
}

export class UpdateFaultDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @IsOptional() @IsEnum(FaultSeverity) severity?: FaultSeverity;
  @IsOptional() @IsString() @IsNotEmpty() address?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) imageFileIds?: number[];
}

export class AdminUpdateFaultStatusDto {
  @IsEnum(FaultStatus) status!: FaultStatus;
}

export class ListMyFaultsQueryDto extends KayanListPaginationQueryDto {
  @IsOptional() @IsEnum(FaultStatus) status?: FaultStatus;
  @IsOptional() @IsEnum(FaultSeverity) severity?: FaultSeverity;
  @IsOptional() @IsString() @IsNotEmpty() search?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsEnum(FaultSortBy) sortBy?: FaultSortBy;
  @IsOptional() @IsEnum(SortDirection) sortDirection?: SortDirection;
}

export class CreateServiceOrderDto {
  @IsEnum(ServiceType) serviceType!: ServiceType;
  @IsString() @IsNotEmpty() description!: string;
  @IsString() @IsNotEmpty() address!: string;
}

export class UpdateServiceOrderDto {
  @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @IsOptional() @IsString() @IsNotEmpty() address?: string;
}

export class AdminUpdateServiceStatusDto {
  @IsEnum(ServiceStatus) status!: ServiceStatus;
}

export class ListServicesQueryDto extends KayanListPaginationQueryDto {
  @IsOptional() @IsEnum(ServiceType) serviceType?: ServiceType;
  @IsOptional() @IsEnum(ServiceStatus) status?: ServiceStatus;
  @IsOptional() @IsString() @IsNotEmpty() search?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsEnum(ServiceSortBy) sortBy?: ServiceSortBy;
  @IsOptional() @IsEnum(SortDirection) sortDirection?: SortDirection;
}

export class CreateFollowupStepDto {
  @IsEnum(ItemType) itemType!: ItemType;
  @IsInt() @Min(1) itemId!: number;
  @ApiProperty() @IsString() @IsNotEmpty() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) stepImageFileId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() state?: boolean;
}

export class CreateFollowupStepBodyDto {
  @ApiProperty() @IsString() @IsNotEmpty() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) stepImageFileId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() state?: boolean;
}

export class UpdateFollowupStepDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) stepImageFileId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() state?: boolean;
}

export class CreateGalleryItemDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) imageFileIds?: number[];
}

export class UpdateGalleryItemDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsInt({ each: true }) imageFileIds?: number[];
}

export class CreateItemRatingDto {
  @IsEnum(RatingItemType) itemType!: RatingItemType;
  @ValidateIf((dto: CreateItemRatingDto) => dto.itemType !== RatingItemType.PRODUCT)
  @IsInt() @Min(1) itemId?: number;
  @ValidateIf((dto: CreateItemRatingDto) => dto.itemType === RatingItemType.PRODUCT)
  @IsInt() @Min(1) orderId?: number;
  @ValidateIf((dto: CreateItemRatingDto) => dto.itemType === RatingItemType.PRODUCT && dto.itemId === undefined)
  @IsInt() @Min(1) productId?: number;
  @IsInt() @Min(1) @Max(5) ratingValue!: number;
  @IsOptional() @IsString() @Length(1, 2000) comment?: string;
}

export class CreateFollowupConversationDto {
  @IsEnum(ItemType) itemType!: ItemType;
  @IsInt() @Min(1) itemId!: number;
  @IsOptional() @IsInt() @Min(1) adminId?: number;
}

export class CreateFollowupConversationBodyDto {
  @IsOptional() @IsInt() @Min(1) adminId?: number;
}

export class SendFollowupMessageDto {
  @IsString() @IsNotEmpty() messageText!: string;
}

export class ProductIdParamDto {
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class CartItemIdParamDto {
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class OrderIdParamDto {
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class FaultIdParamDto {
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class ServiceIdParamDto {
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class GalleryIdParamDto {
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class FollowupScopeParamDto {
  @IsEnum(ItemType) itemType!: ItemType;
  @Type(() => Number) @IsInt() @Min(1) itemId!: number;
}

export class FollowupConversationMessagesParamDto extends FollowupScopeParamDto {
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class FollowupStepParamDto extends FollowupScopeParamDto {
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class ListGalleryQueryDto extends KayanListPaginationQueryDto {
  @IsOptional() @IsString() @IsNotEmpty() query?: string;
}

export class ListFollowupStepsQueryDto extends KayanFollowupPaginationQueryDto {}

export class GetItemReviewsQueryDto extends KayanListPaginationQueryDto {
  @IsEnum(RatingItemType) itemType!: RatingItemType;
}

export enum AdminUserRatingItemType {
  FAULT = 'fault',
  SERVICE = 'service',
}

export class ListAdminRatingsQueryDto extends KayanListPaginationQueryDto {
  @IsOptional() @IsEnum(RatingItemType) itemType?: RatingItemType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) userId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) ratingValue?: number;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsString() @IsNotEmpty() search?: string;
}

export class ListAdminUserRatingsQueryDto extends KayanListPaginationQueryDto {
  @IsOptional() @IsEnum(AdminUserRatingItemType) itemType?: AdminUserRatingItemType;
}

export class ItemIdParamDto {
  @Type(() => Number) @IsInt() @Min(1) itemId!: number;
}

export class ListAdminFaultsQueryDto extends KayanListPaginationQueryDto {
  @IsOptional() @IsEnum(FaultStatus) status?: FaultStatus;
  @IsOptional() @IsEnum(FaultSeverity) severity?: FaultSeverity;
  @IsOptional() @IsString() @IsNotEmpty() search?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsEnum(FaultSortBy) sortBy?: FaultSortBy;
  @IsOptional() @IsEnum(SortDirection) sortDirection?: SortDirection;
}
