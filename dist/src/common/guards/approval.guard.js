"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalGuard = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let ApprovalGuard = class ApprovalGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        if (!user)
            return false;
        if (user.role === client_1.UserRole.CUSTOMER)
            return true;
        if (user.role === client_1.UserRole.ADMIN)
            return true;
        const rawPath = req.originalUrl || req.url || "";
        const path = rawPath.split("?")[0];
        if (path === "/users/me")
            return true;
        if (user.role === client_1.UserRole.PHARMACY && user.status === "SUSPENDED") {
            if (path.startsWith("/auth/") || path === "/users/me")
                return true;
            throw new common_1.ForbiddenException("Account suspended. Contact support.");
        }
        if (user.role === client_1.UserRole.PHARMACY && user.status !== "APPROVED") {
            const allowed = path.startsWith("/auth/") ||
                path === "/users/me" ||
                path === "/profile/me" ||
                path === "/profile/documents";
            if (!allowed) {
                throw new common_1.ForbiddenException("Account pending admin approval");
            }
            return true;
        }
        if (user.role === client_1.UserRole.RIDER) {
            const allowed = path.startsWith("/auth/") ||
                path === "/users/me" ||
                path.startsWith("/notifications") ||
                path.startsWith("/rider/profile/documents") ||
                path === "/rider/lifecycle";
            if (user.status === "SUSPENDED") {
                if (allowed)
                    return true;
                throw new common_1.ForbiddenException("Account suspended. Contact support.");
            }
            if (user.status !== "ACTIVE") {
                if (allowed)
                    return true;
                throw new common_1.ForbiddenException("Access denied: rider must be ACTIVE");
            }
            return true;
        }
        return true;
    }
};
exports.ApprovalGuard = ApprovalGuard;
exports.ApprovalGuard = ApprovalGuard = __decorate([
    (0, common_1.Injectable)()
], ApprovalGuard);
