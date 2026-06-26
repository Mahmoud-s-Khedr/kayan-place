import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateItemRatingDto, GetItemReviewsQueryDto, ItemIdParamDto } from '../kayan/kayan.dto';
import { KayanRatingResponseDto, KayanRatingsResponseDto } from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Ratings')
@Controller('ratings')
export class KayanRatingsController {
  constructor(private readonly kayanService: KayanService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 201, type: KayanRatingResponseDto })
  createItemRating(@CurrentUser() user: AuthUser, @Body() dto: CreateItemRatingDto): Promise<Record<string, unknown>> {
    return this.kayanService.createItemRating(user, dto);
  }

  @Get('items/:itemId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get reviews for a specific item (fault, service, or order)' })
  @ApiResponse({ status: 200, type: KayanRatingsResponseDto })
  getItemReviews(@Param() params: ItemIdParamDto, @Query() query: GetItemReviewsQueryDto): Promise<Record<string, unknown>> {
    return this.kayanService.getItemReviews(params.itemId, query);
  }
}
