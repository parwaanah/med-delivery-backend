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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcryptjs"));
const prisma_service_1 = require("../utils/prisma.service");
const client_1 = require("@prisma/client");
const crypto = __importStar(require("crypto"));
const date_fns_1 = require("date-fns");
const audit_service_1 = require("../utils/audit.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, audit) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.audit = audit;
    }
    async register(data) {
        const existing = await this.prisma.user.findUnique({
            where: { email: data.email },
        });
        if (existing)
            throw new common_1.BadRequestException('Email already in use');
        const hashed = await bcrypt.hash(data.password, 10);
        const user = await this.prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashed,
                role: data.role || client_1.UserRole.CUSTOMER,
            },
        });
        return this.generateToken(user);
    }
    async login(data, ip, userAgent) {
        const user = await this.prisma.user.findUnique({
            where: { email: data.email },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const match = await bcrypt.compare(data.password, user.password);
        if (!match)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const session = await this.prisma.session.create({
            data: {
                userId: user.id,
                ip: ip || null,
                userAgent: userAgent || null,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 12),
            },
        });
        const refreshTokenRaw = crypto.randomBytes(32).toString('hex');
        const refreshTokenHash = crypto
            .createHash('sha256')
            .update(refreshTokenRaw)
            .digest('hex');
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                sessionId: session.id,
                tokenHash: refreshTokenHash,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 48),
            },
        });
        const accessToken = this.jwtService.sign({ sub: user.id, role: user.role }, { expiresIn: '1h' });
        return {
            accessToken,
            refreshToken: refreshTokenRaw,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        };
    }
    async refreshToken(oldToken) {
        const oldHash = crypto.createHash('sha256').update(oldToken).digest('hex');
        const existing = await this.prisma.refreshToken.findFirst({
            where: { tokenHash: oldHash, revoked: false },
            include: { session: true },
        });
        if (!existing || !existing.session)
            throw new common_1.UnauthorizedException('Invalid refresh token');
        await this.prisma.refreshToken.update({
            where: { id: existing.id },
            data: { revoked: true },
        });
        const newTokenRaw = crypto.randomBytes(32).toString('hex');
        const newTokenHash = crypto
            .createHash('sha256')
            .update(newTokenRaw)
            .digest('hex');
        await this.prisma.refreshToken.create({
            data: {
                userId: existing.session.userId,
                sessionId: existing.session.id,
                tokenHash: newTokenHash,
                expiresAt: (0, date_fns_1.addHours)(new Date(), 48),
            },
        });
        const user = await this.prisma.user.findUnique({
            where: { id: existing.session.userId },
        });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        const accessToken = this.jwtService.sign({ sub: user.id, role: user.role }, { expiresIn: '1h' });
        return {
            accessToken,
            refreshToken: newTokenRaw,
        };
    }
    async revokeSession(sessionId) {
        await this.prisma.session.update({
            where: { id: sessionId },
            data: { revoked: true },
        });
        await this.prisma.refreshToken.updateMany({
            where: { sessionId },
            data: { revoked: true },
        });
    }
    async validateUser(userId) {
        return this.prisma.user.findUnique({ where: { id: Number(userId) } });
    }
    generateToken(user) {
        const payload = { sub: user.id, role: user.role, email: user.email };
        const accessToken = this.jwtService.sign(payload);
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        audit_service_1.AuditService])
], AuthService);
