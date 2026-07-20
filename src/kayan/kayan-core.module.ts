import { Global, Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { KayanService } from './kayan.service';

@Global()
@Module({
  imports: [FilesModule],
  providers: [KayanService],
  exports: [KayanService],
})
export class KayanCoreModule {}
