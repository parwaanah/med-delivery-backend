import { PrismaService } from '../utils/prisma.service';
import { CreateRiderDto, UpdateRiderDto, UpdateStatusDto } from './dto/rider.dto';
export declare class RidersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        name: string;
        email: string;
        createdAt: Date;
        id: number;
    }[]>;
    findOne(id: number): Promise<{
        name: string;
        email: string;
        createdAt: Date;
        id: number;
    }>;
    create(dto: CreateRiderDto): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    update(id: number, dto: UpdateRiderDto): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
    updateStatus(id: number, dto: UpdateStatusDto): Promise<{
        name: string;
        email: string;
        status: string;
        id: number;
    }>;
}
