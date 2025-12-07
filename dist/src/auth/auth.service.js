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
        this.LOADTEST = process.env.LOADTEST_MODE === 'true';
    }
    async register(data) {
        if (!data.name || !data.email || !data.password)
            throw new common_1.BadRequestException('Name, email and password required');
        const exists = await this.prisma.user.findUnique({
            where: { email: data.email },
        });
        if (exists)
            throw new common_1.BadRequestException('Email already in use');
        const hashed = await bcrypt.hash(data.password, 10);
        const role = data.role || client_1.UserRole.CUSTOMER;
        const status = role === client_1.UserRole.CUSTOMER ? 'APPROVED' : 'PENDING';
        const user = await this.prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashed,
                role,
                status,
            },
        });
        await this.audit.log({
            userId: user.id,
            email: user.email || undefined,
            role: user.role,
            eventType: 'REGISTER_SUCCESS',
            success: true,
        });
        return this.generateToken(user);
    }
    async login(data, ip, ua) {
        const user = await this.prisma.user.findUnique({
            where: { email: data.email },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (!this.LOADTEST) {
            if (user.status !== 'APPROVED' && user.role !== client_1.UserRole.CUSTOMER) {
                throw new common_1.UnauthorizedException('Account pending admin approval');
            }
        }
        if (!user.password) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const match = await bcrypt.compare(data.password, user.password);
        if (!match)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const session = await this.prisma.session.create({
            data: {
                userId: user.id,
                ip: ip || null,
                userAgent: ua ? String(ua) : null,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 12),
            },
        });
        const rawRefresh = crypto.randomBytes(32).toString('hex');
        const hashedRefresh = crypto
            .createHash('sha256')
            .update(rawRefresh)
            .digest('hex');
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                sessionId: session.id,
                tokenHash: hashedRefresh,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 48),
            },
        });
        await this.audit.log({
            userId: user.id,
            email: user.email || undefined,
            eventType: 'LOGIN_SUCCESS',
            role: user.role,
            success: true,
        });
        const accessToken = this.jwtService.sign({
            sub: user.id,
            role: user.role,
        });
        return {
            accessToken,
            refreshToken: rawRefresh,
            sessionId: session.id,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
        };
    }
    async refreshToken(oldToken) {
        if (!oldToken)
            throw new common_1.UnauthorizedException('Missing token');
        const oldHash = crypto.createHash('sha256').update(oldToken).digest('hex');
        const existing = await this.prisma.refreshToken.findFirst({
            where: { tokenHash: oldHash, revoked: false },
            include: { session: true },
        });
        if (!existing || !existing.session) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        if (existing.expiresAt && (0, date_fns_1.isBefore)(existing.expiresAt, new Date())) {
            await this.prisma.refreshToken.update({
                where: { id: existing.id },
                data: { revoked: true },
            });
            throw new common_1.UnauthorizedException('Refresh token expired');
        }
        if (existing.session.revoked) {
            throw new common_1.UnauthorizedException('Session revoked');
        }
        await this.prisma.refreshToken.update({
            where: { id: existing.id },
            data: { revoked: true },
        });
        const user = await this.prisma.user.findUnique({
            where: { id: existing.session.userId },
        });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        const newRaw = crypto.randomBytes(32).toString('hex');
        const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                sessionId: existing.session.id,
                tokenHash: newHash,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 48),
            },
        });
        const accessToken = this.jwtService.sign({
            sub: user.id,
            role: user.role,
        });
        return {
            accessToken,
            refreshToken: newRaw,
            sessionId: existing.session.id,
        };
    }
    async requestPasswordReset(email) {
        if (!email)
            throw new common_1.BadRequestException('Email required');
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user)
            throw new common_1.BadRequestException('No such user');
        const token = crypto.randomBytes(20).toString('hex');
        const link = `https://app/reset-password?token=${token}`;
        this.logger.log(`Password reset for ${email}: ${link}`);
        return {
            message: `Password reset email sent to ${email}`,
            resetLink: link,
        };
    }
    async logout(sessionId) {
        if (!sessionId) {
            throw new common_1.BadRequestException('sessionId required');
        }
        await this.prisma.session.update({
            where: { id: sessionId },
            data: { revoked: true },
        });
        await this.prisma.refreshToken.updateMany({
            where: { sessionId },
            data: { revoked: true },
        });
        return { message: 'Logout successful' };
    }
    generateToken(user) {
        const accessToken = this.jwtService.sign({
            sub: user.id,
            role: user.role,
        });
        return {
            accessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    }
    async sendOtp(data) {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        await this.prisma.user.upsert({
            where: { phone: data.phone },
            create: {
                phone: data.phone,
                name: 'New User',
                role: data.role || client_1.UserRole.CUSTOMER,
                status: 'APPROVED',
                otpCode: otp,
                otpExpiresAt: (0, date_fns_1.addHours)(new Date(), 1),
            },
            update: {
                otpCode: otp,
                otpExpiresAt: (0, date_fns_1.addHours)(new Date(), 1),
            },
        });
        this.logger.log(`DUMMY SMS OTP for ${data.phone}: ${otp}`);
        return { message: 'OTP sent successfully (dummy mode)' };
    }
    async verifyOtp(data, ip, ua) {
        const user = await this.prisma.user.findUnique({
            where: { phone: data.phone },
        });
        if (!user || user.otpCode !== data.otp) {
            throw new common_1.UnauthorizedException('Invalid OTP');
        }
        await this.prisma.user.update({
            where: { id: user.id },
            data: { otpCode: null },
        });
        const session = await this.prisma.session.create({
            data: {
                userId: user.id,
                ip,
                userAgent: ua,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 12),
            },
        });
        const rawRefresh = crypto.randomBytes(32).toString('hex');
        const hashedRefresh = crypto
            .createHash('sha256')
            .update(rawRefresh)
            .digest('hex');
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                sessionId: session.id,
                tokenHash: hashedRefresh,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 48),
            },
        });
        const accessToken = this.jwtService.sign({
            sub: user.id,
            role: user.role,
        });
        return {
            accessToken,
            refreshToken: rawRefresh,
            sessionId: session.id,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role,
            },
        };
    }
    async googleLogin(googleUser) {
        let user = await this.prisma.user.findUnique({
            where: { email: googleUser.email },
        });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    googleId: googleUser.googleId,
                    email: googleUser.email,
                    name: googleUser.name,
                    role: client_1.UserRole.CUSTOMER,
                    status: 'APPROVED',
                },
            });
        }
        const session = await this.prisma.session.create({
            data: {
                userId: user.id,
                ip: null,
                userAgent: 'google-oauth',
                expiresAt: (0, date_fns_1.addHours)(new Date(), 12),
            },
        });
        const rawRefresh = crypto.randomBytes(32).toString('hex');
        const hashedRefresh = crypto
            .createHash('sha256')
            .update(rawRefresh)
            .digest('hex');
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                sessionId: session.id,
                tokenHash: hashedRefresh,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 48),
            },
        });
        const accessToken = this.jwtService.sign({
            sub: user.id,
            role: user.role,
        });
        return {
            accessToken,
            refreshToken: rawRefresh,
            sessionId: session.id,
            user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
