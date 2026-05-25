import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min, ValidateIf, ValidateNested } from 'class-validator';

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
}

export enum FaultSortBy {
  CREATED_AT = 'createdAt',
  SEVERITY = 'severity',
}

export enum ServiceSortBy {
  CREATED_AT = 'createdAt',
}

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

export class ListProductsQueryDto {
  @IsOptional() @IsString() @IsNotEmpty() query?: string;
  @IsOptional() @Type(() => Number) @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @Min(0) maxPrice?: number;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsEnum(ProductAvailabilityFilter) availability?: ProductAvailabilityFilter;
  @IsOptional() @IsEnum(ProductSortBy) sortBy?: ProductSortBy;
  @IsOptional() @IsEnum(SortDirection) sortDirection?: SortDirection;
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

export class ListOrdersQueryDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
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

export class ListMyFaultsQueryDto {
  @IsOptional() @IsEnum(FaultStatus) status?: FaultStatus;
  @IsOptional() @IsEnum(FaultSeverity) severity?: FaultSeverity;
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
}

export class AdminUpdateServiceStatusDto {
  @IsEnum(ServiceStatus) status!: ServiceStatus;
}

export class ListServicesQueryDto {
  @IsOptional() @IsEnum(ServiceType) serviceType?: ServiceType;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsEnum(ServiceSortBy) sortBy?: ServiceSortBy;
  @IsOptional() @IsEnum(SortDirection) sortDirection?: SortDirection;
}

export class CreateFollowupStepDto {
  @IsEnum(ItemType) itemType!: ItemType;
  @IsInt() @Min(1) itemId!: number;
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsInt() @Min(1) stepImageFileId?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateFollowupStepDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsInt() @Min(1) stepImageFileId?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
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
  @IsEnum(ItemType) itemType!: ItemType;
  @ValidateIf((dto: CreateItemRatingDto) => dto.itemType !== ItemType.ORDER)
  @IsInt() @Min(1) itemId?: number;
  @ValidateIf((dto: CreateItemRatingDto) => dto.itemType === ItemType.ORDER)
  @IsInt() @Min(1) orderId?: number;
  @ValidateIf((dto: CreateItemRatingDto) => dto.itemType === ItemType.ORDER)
  @IsInt() @Min(1) productId?: number;
  @IsInt() @Min(1) @Max(5) ratingValue!: number;
}

export class CreateFollowupConversationDto {
  @IsEnum(ItemType) itemType!: ItemType;
  @IsInt() @Min(1) itemId!: number;
  @IsOptional() @IsInt() @Min(1) adminId?: number;
}

export class SendFollowupMessageDto {
  @IsString() @IsNotEmpty() messageText!: string;
}
