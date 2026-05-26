import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateItemRatingDto } from '../kayan/kayan.dto';
import { KayanRatingResponseDto } from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Ratings')
@Controller('ratings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KayanRatingsController {
  constructor(private readonly kayanService: KayanService) {}

  @Post()
  @ApiResponse({ status: 201, type: KayanRatingResponseDto })
  createItemRating(@CurrentUser() user: AuthUser, @Body() dto: CreateItemRatingDto): Promise<Record<string, unknown>> {
    return this.kayanService.createItemRating(user, dto);
  }
}
