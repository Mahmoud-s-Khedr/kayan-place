import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SuccessEnvelopeDto } from '../common/dto/api-response-envelope.dto';
import { FaultSeverity, FaultStatus, ItemType, OrderStatus, ServiceStatus, ServiceType } from './kayan.dto';

class KayanAssetDto {
  @ApiProperty() file_id!: number;
  @ApiProperty() sort_order!: number;
  @ApiPropertyOptional({ nullable: true }) object_key!: string | null;
  @ApiPropertyOptional({ nullable: true }) original_filename!: string | null;
  @ApiPropertyOptional({ nullable: true }) mime_type!: string | null;
  @ApiPropertyOptional({ nullable: true }) status!: string | null;
}

class KayanProductDto {
  @ApiProperty() id!: number;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() price!: number;
  @ApiPropertyOptional({ nullable: true, type: Object }) details!: Record<string, unknown> | null;
  @ApiProperty() is_active!: boolean;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
  @ApiProperty({ type: [KayanAssetDto] }) images!: KayanAssetDto[];
  @ApiProperty({ type: [KayanAssetDto] }) files!: KayanAssetDto[];
}

class KayanCartItemDto {
  @ApiProperty() id!: number;
  @ApiProperty() product_id!: number;
  @ApiProperty() quantity!: number;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
  @ApiProperty({ type: KayanProductDto }) product!: KayanProductDto;
}

class KayanOrderItemProductDto {
  @ApiProperty() id!: number;
  @ApiPropertyOptional({ nullable: true }) title!: string | null;
  @ApiPropertyOptional({ nullable: true }) is_active!: boolean | null;
}

class KayanOrderItemDto {
  @ApiProperty() id!: number;
  @ApiProperty() product_id!: number;
  @ApiProperty() quantity!: number;
  @ApiProperty() unit_price!: string;
  @ApiProperty({ type: KayanOrderItemProductDto }) product!: KayanOrderItemProductDto;
}

class KayanOrderUserDto {
  @ApiProperty() id!: number;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
}

class KayanOrderDto {
  @ApiProperty() id!: number;
  @ApiProperty() user_id!: number;
  @ApiProperty() delivery_address!: string;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
  @ApiProperty() item_count!: number;
  @ApiProperty({ type: [KayanOrderItemDto] }) items!: KayanOrderItemDto[];
  @ApiPropertyOptional({ type: KayanOrderUserDto }) user?: KayanOrderUserDto;
}

class KayanFaultUserDto {
  @ApiProperty() id!: number;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
}

class KayanFaultDto {
  @ApiProperty() id!: number;
  @ApiProperty() user_id!: number;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: FaultSeverity }) severity!: FaultSeverity;
  @ApiProperty() address!: string;
  @ApiProperty({ enum: FaultStatus }) status!: FaultStatus;
  @ApiPropertyOptional({ nullable: true }) cancelled_at!: string | null;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
  @ApiProperty({ type: [KayanAssetDto] }) images!: KayanAssetDto[];
  @ApiPropertyOptional({ type: KayanFaultUserDto }) user?: KayanFaultUserDto;
}

class KayanServiceUserDto {
  @ApiProperty() id!: number;
  @ApiPropertyOptional({ nullable: true }) name!: string | null;
  @ApiPropertyOptional({ nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
}

class KayanServiceDto {
  @ApiProperty() id!: number;
  @ApiProperty() user_id!: number;
  @ApiProperty({ enum: ServiceType }) service_type!: ServiceType;
  @ApiProperty() description!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ enum: ServiceStatus }) status!: ServiceStatus;
  @ApiPropertyOptional({ nullable: true }) cancelled_at!: string | null;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
  @ApiPropertyOptional({ type: KayanServiceUserDto }) user?: KayanServiceUserDto;
}

class FollowupStepDto {
  @ApiProperty() id!: number;
  @ApiProperty({ enum: ItemType }) item_type!: ItemType;
  @ApiProperty() item_id!: number;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) step_image_file_id!: number | null;
  @ApiProperty() sort_order!: number;
  @ApiProperty() created_at!: string;
}

class GalleryItemDto {
  @ApiProperty() id!: number;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() is_active!: boolean;
  @ApiProperty() created_at!: string;
  @ApiProperty({ type: [KayanAssetDto] }) images!: KayanAssetDto[];
}

class FollowupConversationDto {
  @ApiProperty() id!: number;
  @ApiProperty({ enum: ItemType }) item_type!: ItemType;
  @ApiProperty() item_id!: number;
  @ApiProperty() user_id!: number;
  @ApiProperty() admin_id!: number;
}

class FollowupMessageDto {
  @ApiProperty() id!: number;
  @ApiProperty() conversation_id!: number;
  @ApiProperty() sender_id!: number;
  @ApiProperty() message_text!: string;
  @ApiProperty() sent_at!: string;
}

class ItemRatingDto {
  @ApiProperty() id!: number;
  @ApiProperty() user_id!: number;
  @ApiPropertyOptional({ nullable: true }) item_type?: ItemType;
  @ApiPropertyOptional({ nullable: true }) item_id?: number;
  @ApiPropertyOptional({ nullable: true }) order_id?: number;
  @ApiPropertyOptional({ nullable: true }) product_id?: number;
  @ApiProperty() rating_value!: number;
  @ApiPropertyOptional({ nullable: true }) created_at?: string;
}

class MessageOnlyDto {
  @ApiProperty() message!: string;
}

class KayanProductsDataDto { @ApiProperty({ type: [KayanProductDto] }) items!: KayanProductDto[]; }
export class KayanProductsResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanProductsDataDto }) data!: KayanProductsDataDto; }

class KayanProductDataDto { @ApiProperty({ type: KayanProductDto }) product!: KayanProductDto; }
export class KayanProductResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanProductDataDto }) data!: KayanProductDataDto; }

class KayanCartDataDto { @ApiProperty({ type: [KayanCartItemDto] }) items!: KayanCartItemDto[]; }
export class KayanCartResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanCartDataDto }) data!: KayanCartDataDto; }

class KayanOrderDataDto { @ApiProperty({ type: KayanOrderDto }) order!: KayanOrderDto; }
export class KayanOrderResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanOrderDataDto }) data!: KayanOrderDataDto; }

class KayanOrdersDataDto { @ApiProperty({ type: [KayanOrderDto] }) items!: KayanOrderDto[]; }
export class KayanOrdersResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanOrdersDataDto }) data!: KayanOrdersDataDto; }

class KayanFaultDataDto { @ApiProperty({ type: KayanFaultDto }) fault!: KayanFaultDto; }
export class KayanFaultResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanFaultDataDto }) data!: KayanFaultDataDto; }

class KayanFaultsDataDto { @ApiProperty({ type: [KayanFaultDto] }) items!: KayanFaultDto[]; }
export class KayanFaultsResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanFaultsDataDto }) data!: KayanFaultsDataDto; }

class KayanServiceDataDto { @ApiProperty({ type: KayanServiceDto }) service!: KayanServiceDto; }
export class KayanServiceResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanServiceDataDto }) data!: KayanServiceDataDto; }

class KayanServicesDataDto { @ApiProperty({ type: [KayanServiceDto] }) items!: KayanServiceDto[]; }
export class KayanServicesResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanServicesDataDto }) data!: KayanServicesDataDto; }

class FollowupStepsDataDto { @ApiProperty({ type: [FollowupStepDto] }) items!: FollowupStepDto[]; }
export class FollowupStepsResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: FollowupStepsDataDto }) data!: FollowupStepsDataDto; }

class FollowupStepDataDto { @ApiProperty({ type: FollowupStepDto }) step!: FollowupStepDto; }
export class FollowupStepResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: FollowupStepDataDto }) data!: FollowupStepDataDto; }

class GalleryItemsDataDto { @ApiProperty({ type: [GalleryItemDto] }) items!: GalleryItemDto[]; }
export class GalleryItemsResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: GalleryItemsDataDto }) data!: GalleryItemsDataDto; }

class GalleryItemDataDto { @ApiProperty({ type: GalleryItemDto }) item!: GalleryItemDto; }
export class GalleryItemResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: GalleryItemDataDto }) data!: GalleryItemDataDto; }

class FollowupConversationDataDto { @ApiProperty({ type: FollowupConversationDto }) conversation!: FollowupConversationDto; }
export class FollowupConversationResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: FollowupConversationDataDto }) data!: FollowupConversationDataDto; }

class FollowupMessagesDataDto { @ApiProperty({ type: [FollowupMessageDto] }) items!: FollowupMessageDto[]; }
export class FollowupMessagesResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: FollowupMessagesDataDto }) data!: FollowupMessagesDataDto; }

class FollowupMessageDataDto { @ApiProperty({ type: FollowupMessageDto }) message!: FollowupMessageDto; }
export class FollowupMessageResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: FollowupMessageDataDto }) data!: FollowupMessageDataDto; }

class KayanRatingDataDto { @ApiProperty({ type: ItemRatingDto }) rating!: ItemRatingDto; }
export class KayanRatingResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: KayanRatingDataDto }) data!: KayanRatingDataDto; }

class MessageOnlyDataDto { @ApiProperty({ type: MessageOnlyDto }) message!: string; }
export class KayanMessageResponseDto extends SuccessEnvelopeDto { @ApiProperty({ type: MessageOnlyDataDto }) data!: MessageOnlyDataDto; }
