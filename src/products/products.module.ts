import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { KayanProductsController } from './kayan-products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController, KayanProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
