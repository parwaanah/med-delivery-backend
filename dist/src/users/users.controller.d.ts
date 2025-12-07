import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<{
        name: string;
        email: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }[]>;
    findOne(id: string): Promise<{
        name: string;
        email: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        name: string;
        email: string | null;
        password: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        phone: string | null;
        status: string;
        createdAt: Date;
        id: number;
        googleId: string | null;
        otpCode: string | null;
        otpExpiresAt: Date | null;
        approvedBy: number | null;
        latitude: number | null;
        longitude: number | null;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
