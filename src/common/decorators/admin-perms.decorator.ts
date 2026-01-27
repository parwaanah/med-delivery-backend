import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMS_KEY = 'adminPerms';

/**
 * Require one of the provided admin permission codes.
 * Notes:
 * - Permission enforcement is gated by env `ADMIN_PERMS_ENFORCE=1`.
 * - `SUPERADMIN` always grants access.
 */
export const AdminPerms = (...perms: string[]) => SetMetadata(ADMIN_PERMS_KEY, perms);

