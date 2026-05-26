import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateFollowupConversationBodyDto, FollowupConversationMessagesParamDto, FollowupScopeParamDto, SendFollowupMessageDto } from '../kayan/kayan.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Followups')
@Controller('followups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FollowupsController {
  constructor(private readonly kayanService: KayanService) {}

  @Get(':itemType/:itemId/steps')
  listFollowupSteps(@CurrentUser() user: AuthUser, @Param() params: FollowupScopeParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.listFollowupSteps(user, params.itemType, params.itemId);
  }

  @Post(':itemType/:itemId/chat/conversations')
  createConversation(@CurrentUser() user: AuthUser, @Param() params: FollowupScopeParamDto, @Body() dto: CreateFollowupConversationBodyDto): Promise<Record<string, unknown>> {
    return this.kayanService.createFollowupConversation(user, { ...dto, itemType: params.itemType, itemId: params.itemId });
  }

  @Get(':itemType/:itemId/chat/conversations/:id/messages')
  listMessages(@CurrentUser() user: AuthUser, @Param() params: FollowupConversationMessagesParamDto): Promise<Record<string, unknown>> {
    return this.kayanService.listFollowupMessages(user, params.id, params.itemType, params.itemId);
  }

  @Post(':itemType/:itemId/chat/conversations/:id/messages')
  sendMessage(@CurrentUser() user: AuthUser, @Param() params: FollowupConversationMessagesParamDto, @Body() dto: SendFollowupMessageDto): Promise<Record<string, unknown>> {
    return this.kayanService.sendFollowupMessage(user, params.id, dto, params.itemType, params.itemId);
  }
}
