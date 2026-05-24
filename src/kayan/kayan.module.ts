import { Module } from '@nestjs/common';
import { KayanAdminController, KayanController } from './kayan.controller';
import { KayanService } from './kayan.service';

@Module({
  controllers: [KayanController, KayanAdminController],
  providers: [KayanService],
})
export class KayanModule {}
