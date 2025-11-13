import { PrismaService } from '../utils/prisma.service';
import { CreateRiderDto, UpdateRiderDto, UpdateStatusDto } from './dto/rider.dto';
import { GeoSurgeService } from '../geosurge/geo-surge.service';
import { RiderLiveGateway } from '../ws/rider-live.gateway';
export declare class RidersService {
    private prisma;
    private geoSurge;
    private riderGateway;
    private readonly logger;
    constructor(prisma: PrismaService, geoSurge: GeoSurgeService, riderGateway: RiderLiveGateway);
    findAll(): Promise<{
        name: string;
        email: string;
        status: string;
        createdAt: Date;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }[]>;
    findOne(id: number): Promise<{
        name: string;
        email: string;
        status: string;
        createdAt: Date;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }>;
    create(dto: CreateRiderDto): Promise<{
        name: string;
        email: string;
        status: string;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }>;
    update(id: number, dto: UpdateRiderDto): Promise<{
        name: string;
        email: string;
        status: string;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }>;
    updateStatus(id: number, dto: UpdateStatusDto): Promise<{
        name: string;
        email: string;
        status: string;
        id: number;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
    updateLocation(id: number, lat: number, lon: number): Promise<{
        ok: boolean;
        id: number;
        lat: number;
        lon: number;
    }>;
}
