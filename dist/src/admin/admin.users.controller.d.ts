import { PrismaService } from '../utils/prisma.service';
import { WsGateway } from '../ws/ws.gateway';
import { NotificationService } from '../utils/notification.service';
import { AuditService } from '../utils/audit.service';
export declare class AdminUsersController {
    private prisma;
    private ws;
    private notify;
    private audit;
    constructor(prisma: PrismaService, ws: WsGateway, notify: NotificationService, audit: AuditService);
    private profileSummary;
    private docCounts;
    list(q?: string, role?: string, status?: string): Promise<{
        users: {
            partnerProfile: {
                pharmacyName: any;
                ownerName: any;
                city: any;
                pin: any;
                drugLicenseNumber: any;
                gstNumber: any;
                openingHours: any;
            } | null;
            docCounts: {
                total: number;
                verified: number;
                pending: number;
            };
            verificationDocs: undefined;
            name: string;
            email: string | null;
            phone: string | null;
            password: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            createdAt: Date;
            id: number;
            googleId: string | null;
            emailVerified: boolean;
            phoneVerified: boolean;
            otpCode: string | null;
            otpExpiresAt: Date | null;
            status: string;
            approvedBy: number | null;
            latitude: number | null;
            longitude: number | null;
            updatedAt: Date;
            deletedAt: Date | null;
        }[];
    }>;
    pending(role: string): Promise<{
        users: {
            partnerProfile: {
                pharmacyName: any;
                ownerName: any;
                city: any;
                pin: any;
                drugLicenseNumber: any;
                gstNumber: any;
                openingHours: any;
            } | null;
            docCounts: {
                total: number;
                verified: number;
                pending: number;
            };
            verificationDocs: undefined;
            name: string;
            email: string | null;
            phone: string | null;
            password: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            createdAt: Date;
            id: number;
            googleId: string | null;
            emailVerified: boolean;
            phoneVerified: boolean;
            otpCode: string | null;
            otpExpiresAt: Date | null;
            status: string;
            approvedBy: number | null;
            latitude: number | null;
            longitude: number | null;
            updatedAt: Date;
            deletedAt: Date | null;
        }[];
    }>;
    approve(id: string, req: any): Promise<{
        success: boolean;
    }>;
    documents(id: string): Promise<{
        userId: number;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        type: string;
        url: string;
        verified: boolean;
    }[]>;
    verifyDoc(id: string, docId: string, req: any): Promise<{
        success: boolean;
    }>;
    rejectDoc(id: string, docId: string, req: any): Promise<{
        success: boolean;
    }>;
    reject(id: string, req: any): Promise<{
        success: boolean;
    }>;
    overrideStatus(id: string, req: any, value?: string): Promise<{
        success: boolean;
    }>;
    messageUser(id: string, body: {
        message: string;
    }, req: any): Promise<{
        success: boolean;
    }>;
    suspendRider(id: string, body: {
        code: 'FRAUD' | 'INACTIVITY' | 'COMPLIANCE';
        note?: string;
    }, req: any): Promise<{
        success: boolean;
    }>;
    resumeRider(id: string, body: {
        note?: string;
    }, req: any): Promise<{
        success: boolean;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
