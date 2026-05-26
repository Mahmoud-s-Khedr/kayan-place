import {
  Delete,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { AdminService } from './admin.service';
import { CreateWarningDto } from './dto/create-warning.dto';
import { ListAdminPaginationQueryDto } from './dto/list-admin-pagination-query.dto';
import { ListUserListingsQueryDto } from './dto/list-user-listings-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import {
  AdminAdminsListResponseDto,
  AdminUserDetailsResponseDto,
  AdminUserListingsResponseDto,
  AdminUserResponseDto,
  AdminUsersListResponseDto,
  WarningResponseDto,
} from './dto/admin-response.dto';
import { SuccessResponseDto } from '../users/dto/user-response.dto';
import { IdParamDto } from '../common/dto/id-param.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users with optional filters (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated user list', type: AdminUsersListResponseDto })
  @ApiResponse({ status: 403, description: 'Admin access required', type: ErrorResponseDto })
  listUsers(@Query() query: ListUsersQueryDto): Promise<Record<string, unknown>> {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiOperation({ summary: 'Get user details for moderation page (admin only)' })
  @ApiResponse({ status: 200, description: 'Detailed user profile', type: AdminUserDetailsResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  getUserDetails(@Param() params: IdParamDto): Promise<Record<string, unknown>> {
    return this.adminService.getUserDetails(params.id);
  }

  @Get('users/:id/listings')
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiOperation({ summary: 'List user listings for admin view (read-only)' })
  @ApiResponse({ status: 200, description: 'Paginated user listings', type: AdminUserListingsResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  listUserListings(
    @Param() params: IdParamDto,
    @Query() query: ListUserListingsQueryDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.listUserListings(params.id, query);
  }

  @Get('admins')
  @ApiOperation({ summary: 'List all admins (admin only)' })
  @ApiResponse({ status: 200, description: 'Array of admin users', type: AdminAdminsListResponseDto })
  listAdmins(@Query() query: ListAdminPaginationQueryDto): Promise<Record<string, unknown>> {
    return this.adminService.listAdmins(query);
  }

  @Post('admins/:id')
  @ApiParam({ name: 'id', type: Number, description: 'User ID to promote to admin' })
  @ApiOperation({ summary: 'Promote a user to admin (admin only)' })
  @ApiResponse({ status: 200, description: 'User promoted to admin', type: AdminUserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  promoteAdmin(
    @CurrentUser() admin: AuthUser,
    @Param() params: IdParamDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.promoteAdmin(admin, params.id);
  }

  @Delete('admins/:id')
  @ApiParam({ name: 'id', type: Number, description: 'Admin user ID to demote' })
  @ApiOperation({ summary: 'Demote an admin to regular user (admin only)' })
  @ApiResponse({ status: 200, description: 'Admin demoted', type: AdminUserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  demoteAdmin(
    @CurrentUser() admin: AuthUser,
    @Param() params: IdParamDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.demoteAdmin(admin, params.id);
  }

  @Patch('users/:id/status')
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiOperation({ summary: 'Update a user\'s status (admin only)' })
  @ApiResponse({ status: 200, description: 'User status updated', type: AdminUserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  updateUserStatus(
    @CurrentUser() admin: AuthUser,
    @Param() params: IdParamDto,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.updateUserStatus(admin, params.id, dto);
  }

  @Delete('users/:id')
  @ApiParam({ name: 'id', type: Number, description: 'User ID' })
  @ApiOperation({ summary: 'Delete a user (soft-delete, admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted', type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ErrorResponseDto })
  deleteUser(
    @CurrentUser() admin: AuthUser,
    @Param() params: IdParamDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.deleteUser(admin, params.id);
  }

  @Post('warnings')
  @ApiOperation({ summary: 'Issue a warning to a user (admin only)' })
  @ApiResponse({ status: 201, description: 'Warning created', type: WarningResponseDto })
  @ApiResponse({ status: 404, description: 'Target user not found', type: ErrorResponseDto })
  createWarning(
    @CurrentUser() admin: AuthUser,
    @Body() dto: CreateWarningDto,
  ): Promise<Record<string, unknown>> {
    return this.adminService.createWarning(admin, dto);
  }

}
