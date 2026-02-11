import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { ImagesController } from './images.controller';
import { WikimediaService } from './wikimedia.service';

@Module({
  imports: [CacheModule],
  controllers: [ImagesController],
  providers: [WikimediaService],
})
export class ImagesModule {}

