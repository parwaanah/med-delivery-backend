import { GeoSurgeService } from './geo-surge.service';
export declare class GeoSurgeController {
    private readonly geoSurgeService;
    constructor(geoSurgeService: GeoSurgeService);
    getZones(): Promise<{
        count: number;
        zones: any[];
        timestamp: string;
    }>;
}
