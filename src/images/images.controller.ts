import { Controller, Get, Query } from '@nestjs/common';
import { WikimediaService } from './wikimedia.service';

@Controller('images')
export class ImagesController {
  constructor(private readonly wikimedia: WikimediaService) {}

  /**
   * GET /images/wikimedia?query=...&size=512
   *
   * Returns a best-effort thumbnail URL from Wikipedia/Wikimedia.
   * Intended for fallback images (no DB persistence required).
   */
  @Get('wikimedia')
  wikimediaImage(
    @Query('query') query: string,
    @Query('size') size?: string,
  ) {
    const n = size != null ? Number(size) : 512;
    return this.wikimedia.searchImage(query, Number.isFinite(n) ? n : 512);
  }
}

