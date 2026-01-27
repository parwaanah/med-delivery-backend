import { Module } from '@nestjs/common';
import { UtilsModule } from '../utils/utils.module';
import { ServiceAreaService } from './service-area.service';
import { ServiceAreaAdminController } from './service-area.controller';

@Module({
  imports: [UtilsModule],
  providers: [ServiceAreaService],
  controllers: [ServiceAreaAdminController],
  exports: [ServiceAreaService],
})
export class ServiceAreaModule {}

