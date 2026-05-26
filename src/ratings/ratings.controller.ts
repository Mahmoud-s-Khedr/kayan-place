import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { RatingSummaryResponseDto } from './dto/rating-response.dto';
import { RatingsService } from './ratings.service';
import { UserIdParamDto } from './dto/user-id-param.dto';

@ApiTags('Ratings (Legacy)')
@Controller('ratings/summary')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get(':userId')
  @ApiParam({ name: 'userId', type: Number, description: 'Target user ID' })
  @ApiOperation({ summary: 'Get legacy user rating summary' })
  @ApiResponse({ status: 200, description: 'Average rating and review count', type: RatingSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  getUserRatingSummary(@Param() params: UserIdParamDto): Promise<Record<string, unknown>> {
    return this.ratingsService.getUserRatingSummary(params.userId);
  }
}
