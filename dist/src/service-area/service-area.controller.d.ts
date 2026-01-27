import { ServiceAreaService } from './service-area.service';
import { UpsertZoneDto } from './dto/upsert-zone.dto';
export declare class ServiceAreaAdminController {
    private readonly serviceArea;
    constructor(serviceArea: ServiceAreaService);
    list(): Promise<any>;
    create(dto: UpsertZoneDto): Promise<any>;
    update(id: string, dto: Partial<UpsertZoneDto>): Promise<any>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
}
