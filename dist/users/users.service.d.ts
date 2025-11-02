import { PrismaService } from '../utils/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }[]>;
    findOne(id: number): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    update(id: number, dto: UpdateUserDto): Promise<{
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
        status: string | null;
        latitude: number | null;
        longitude: number | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
