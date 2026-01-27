import { PrismaService } from '../utils/prisma.service';
export declare class ServiceAreaService {
    private prisma;
    constructor(prisma: PrismaService);
    listZones(): Promise<any>;
    createZone(data: {
        name: string;
        geojson: any;
        active?: boolean;
    }): Promise<any>;
    updateZone(id: number, data: {
        name?: string;
        geojson?: any;
        active?: boolean;
    }): Promise<any>;
    deleteZone(id: number): Promise<{
        ok: boolean;
    }>;
    isPointServiced(lat: number, lng: number): Promise<boolean>;
    assertPointServiced(lat: number | null | undefined, lng: number | null | undefined): Promise<boolean>;
}
