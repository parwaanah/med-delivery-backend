// src/notifications/notifications.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// -------------------------------
// 🔥 Initialize Firebase once globally
// -------------------------------
const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

let firebaseCredentials: any = null;
if (fs.existsSync(serviceAccountPath)) {
  try {
    firebaseCredentials = require(serviceAccountPath);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseCredentials),
      });
      console.log('🔥 Firebase Admin initialized successfully');
    }
  } catch (err) {
    console.warn('⚠️ Firebase initialization failed to parse JSON:', err.message);
  }
} else {
  console.warn('⚠️ Firebase service account JSON not found at:', serviceAccountPath);
}

@Injectable()
export class NotificationsService {
  // 🔔 Save + Send push notification
  async sendPush(
    targetType: 'pharmacy' | 'rider',
    targetId: number,
    title: string,
    message: string,
  ) {
    // 1️⃣ Store notification in DB
    const notification = await prisma.notification.create({
      data: { targetType, targetId, title, message },
    });

    // 2️⃣ Fetch FCM token if available
    const tokenRecord = await prisma.deviceToken.findUnique({
      where: { userId: targetId },
    });

    if (!tokenRecord) {
      console.log(`📭 No FCM token found for ${targetType} #${targetId}`);
      return { stored: true, pushSent: false };
    }

    // 3️⃣ Send push notification via Firebase
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
    } catch (err) {
      console.error('❌ FCM send error:', err.message);
      return { stored: true, pushSent: false };
    }
  }

  // 📬 Fetch notifications for a user
  async getNotificationsForUser(role: string, userId: number) {
    const notifications = await prisma.notification.findMany({
      where: {
        targetType: role,
        targetId: userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (notifications.length === 0)
      throw new NotFoundException('No notifications found');

    return notifications;
  }
}
