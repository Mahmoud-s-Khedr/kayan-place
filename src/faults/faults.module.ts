import { Module } from '@nestjs/common';
import { FaultsController } from './faults.controller';

@Module({ controllers: [FaultsController] })
export class FaultsModule {}
