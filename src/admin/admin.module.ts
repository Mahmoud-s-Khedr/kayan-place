import { Module } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminController } from './admin.controller';
import { KayanAdminController } from './kayan-admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, KayanAdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
