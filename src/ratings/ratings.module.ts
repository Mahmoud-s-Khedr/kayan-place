import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller';
import { KayanRatingsController } from './kayan-ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  controllers: [RatingsController, KayanRatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
