import { ApiProperty } from '@nestjs/swagger';

export class WsAckDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class ConversationJoinAckDto extends WsAckDto {
  @ApiProperty({ example: 'conversation:12' })
  room!: string;
}

export class MessageReadAckDto extends WsAckDto {
  @ApiProperty({ type: Object })
  message!: Record<string, unknown>;
}

export class MessageSentAckDto extends WsAckDto {
  @ApiProperty({ type: Object })
  message!: Record<string, unknown>;
}
