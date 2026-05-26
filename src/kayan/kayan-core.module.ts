import { Global, Module } from '@nestjs/common';
import { KayanService } from './kayan.service';

@Global()
@Module({
  providers: [KayanService],
  exports: [KayanService],
})
export class KayanCoreModule {}
