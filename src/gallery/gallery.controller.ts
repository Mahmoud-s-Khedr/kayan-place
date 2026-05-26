import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { GalleryItemsResponseDto } from '../kayan/kayan-response.dto';
import { KayanService } from '../kayan/kayan.service';

@ApiTags('Kayan Gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private readonly kayanService: KayanService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiResponse({ status: 200, type: GalleryItemsResponseDto })
  listGallery(): Promise<Record<string, unknown>> {
    return this.kayanService.listGallery();
  }
}
