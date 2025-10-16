export declare class UsersService {
    findAll(): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    }[]>;
    findOne(id: number): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    } | null>;
    create(name: string, email: string, password: string): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    }>;
    update(id: number, data: {
        name?: string;
        email?: string;
        password?: string;
    }): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    }>;
    remove(id: number): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    }>;
}
