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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const prisma = new client_1.PrismaClient();
const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
let firebaseCredentials = null;
if (fs.existsSync(serviceAccountPath)) {
    try {
        firebaseCredentials = require(serviceAccountPath);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseCredentials),
            });
            console.log('🔥 Firebase Admin initialized successfully');
        }
    }
    catch (err) {
        console.warn('⚠️ Firebase initialization failed to parse JSON:', err.message);
    }
}
else {
    console.warn('⚠️ Firebase service account JSON not found at:', serviceAccountPath);
}
let NotificationsService = class NotificationsService {
    async sendPush(targetType, targetId, title, message) {
        const notification = await prisma.notification.create({
            data: { targetType, targetId, title, message },
        });
        const tokenRecord = await prisma.deviceToken.findUnique({
            where: { userId: targetId },
        });
        if (!tokenRecord) {
            console.log(`📭 No FCM token found for ${targetType} #${targetId}`);
            return { stored: true, pushSent: false };
        }
        try {
            await admin.messaging().send({
                token: tokenRecord.token,
                notification: {
                    title,
                    body: message,
                },
            });
            console.log(`✅ Push sent to ${targetType} #${targetId}`);
            return { stored: true, pushSent: true };
        }
        catch (err) {
            console.error('❌ FCM send error:', err.message);
            return { stored: true, pushSent: false };
        }
    }
    async getNotificationsForUser(role, userId) {
        const notifications = await prisma.notification.findMany({
            where: {
                targetType: role,
                targetId: userId,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (notifications.length === 0)
            throw new common_1.NotFoundException('No notifications found');
        return notifications;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)()
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map