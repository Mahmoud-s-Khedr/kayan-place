import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { GetPublicUserQueryDto } from './dto/get-public-user-query.dto';
import { PublicUserProfileResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';
import { IdParamDto } from '../common/dto/id-param.dto';

@ApiTags('Users')
@Controller('users')
export class PublicUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiParam({ name: 'id', type: Number, description: 'Target user ID' })
  @ApiOperation({ summary: 'Get public profile and active listings for a user' })
  @ApiResponse({ status: 200, description: 'Public profile and products', type: PublicUserProfileResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  getPublicProfile(
    @Param() params: IdParamDto,
    @Query() query: GetPublicUserQueryDto,
    @CurrentUser() user?: AuthUser | null,
  ): Promise<Record<string, unknown>> {
    void user;
    return this.usersService.getPublicProfile(params.id, query);
  }
}
