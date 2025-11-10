// src/common/guards/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * PermissionsGuard reads metadata 'roles' (set by your existing @Roles() decorator)
 * and ensures request.user.role (string) matches. It allows the route if:
 * - no roles metadata is set (open)
 * - or user.role matches one of the roles
 *
 * Works well with Passport JWT strategy that sets request.user.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler()) 
      ?? this.reflector.get<string[]>('roles', context.getClass());

    // if no roles specified, allow
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const user = req.user;

    if (!user || !user.role) {
      throw new ForbiddenException('User role missing');
    }

    // Accept either enum-like or string roles (case-insensitive)
    const userRole = String(user.role).toUpperCase();
    const allowed = requiredRoles.map((r) => String(r).toUpperCase());
    if (allowed.includes(userRole)) return true;

    throw new ForbiddenException('Insufficient permissions');
  }
}
