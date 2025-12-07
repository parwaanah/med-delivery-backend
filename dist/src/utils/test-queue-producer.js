"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const redis = new ioredis_1.default('redis://redis:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});
const orders = new bullmq_1.Queue('orders', { connection: redis });
(async () => {
    console.log('🚀 Adding sample jobs...');
    await orders.add('order_process', { orderId: 1001, customer: 'Alice' });
    await orders.add('order_process', { orderId: 1002, customer: 'Bob' });
    console.log('✅ Jobs added.');
    process.exit(0);
})();
