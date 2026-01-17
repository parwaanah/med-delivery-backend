"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const date_fns_1 = require("date-fns");
const prisma_service_1 = require("../utils/prisma.service");
const audit_service_1 = require("../utils/audit.service");
const client_1 = require("@prisma/client");
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwtService, audit) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.audit = audit;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async register(data) {
        if (!data.name || !data.email || !data.password) {
            throw new common_1.BadRequestException("Name, email and password required");
        }
        const exists = await this.prisma.user.findUnique({
            where: { email: data.email },
        });
        if (exists)
            throw new common_1.BadRequestException("Email already in use");
        const hashed = await bcrypt.hash(data.password, 10);
        const role = data.role || client_1.UserRole.CUSTOMER;
        const user = await this.prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashed,
                role,
                status: role === client_1.UserRole.CUSTOMER ? "APPROVED" : "PENDING",
                emailVerified: role !== client_1.UserRole.CUSTOMER,
            },
        });
        return this.issueTokens(user);
    }
    async login(data, ip, ua) {
        const user = await this.prisma.user.findUnique({
            where: { email: data.email },
        });
        if (!user || !user.password) {
            throw new common_1.UnauthorizedException("Invalid credentials");
        }
        if (user.role === client_1.UserRole.CUSTOMER && !user.emailVerified) {
            throw new common_1.UnauthorizedException("Please verify your email");
        }
        const match = await bcrypt.compare(data.password, user.password);
        if (!match)
            throw new common_1.UnauthorizedException("Invalid credentials");
        const session = await this.prisma.session.create({
            data: {
                userId: user.id,
                ip: ip || null,
                userAgent: ua || null,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 12),
            },
        });
        return this.issueTokens(user, session.id, ip, ua);
    }
    async verifyEmail(token) {
        if (!token)
            throw new common_1.BadRequestException("Missing token");
        const user = await this.prisma.user.findFirst({
            where: { otpCode: token },
        });
        if (!user)
            throw new common_1.BadRequestException("Invalid verification token");
        if (user.otpExpiresAt && (0, date_fns_1.isBefore)(user.otpExpiresAt, new Date())) {
            throw new common_1.BadRequestException("Verification token expired");
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: true,
                otpCode: null,
                otpExpiresAt: null,
            },
        });
        return { message: "Email verified successfully" };
    }
    async verifyOtp(data) {
        const user = await this.prisma.user.findUnique({
            where: { phone: data.phone },
        });
        if (!user || user.otpCode !== data.otp) {
            throw new common_1.UnauthorizedException("Invalid OTP");
        }
        if (user.otpExpiresAt && (0, date_fns_1.isBefore)(user.otpExpiresAt, new Date())) {
            throw new common_1.UnauthorizedException("OTP expired");
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                otpCode: null,
                otpExpiresAt: null,
                phoneVerified: true,
            },
        });
        return this.issueTokens(user);
    }
    async refresh(refreshToken) {
        if (!refreshToken) {
            throw new common_1.UnauthorizedException("Missing refresh token");
        }
        const hash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");
        const stored = await this.prisma.refreshToken.findFirst({
            where: { tokenHash: hash, revoked: false },
            include: { user: true },
        });
        if (!stored || stored.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException("Invalid refresh token");
        }
        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revoked: true },
        });
        return this.issueTokens(stored.user, stored.sessionId ?? undefined);
    }
    async logout(userId) {
        await this.prisma.$transaction([
            this.prisma.refreshToken.updateMany({
                where: { userId, revoked: false },
                data: { revoked: true },
            }),
            this.prisma.session.updateMany({
                where: { userId, revoked: false },
                data: { revoked: true },
            }),
        ]);
        return { message: "Logged out successfully" };
    }
    async issueTokens(user, sessionId, ip, ua) {
        const accessToken = this.jwtService.sign({
            sub: user.id,
            role: user.role,
        });
        const rawRefresh = crypto.randomBytes(32).toString("hex");
        const hashed = crypto
            .createHash("sha256")
            .update(rawRefresh)
            .digest("hex");
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                sessionId,
                tokenHash: hashed,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 48),
            },
        });
        await this.audit.log({
            userId: user.id,
            email: user.email,
            role: user.role,
            eventType: "SESSION_ISSUED",
            success: true,
            ip,
            userAgent: ua,
        });
        return {
            accessToken,
            refreshToken: rawRefresh,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
            },
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        audit_service_1.AuditService])
], AuthService);
