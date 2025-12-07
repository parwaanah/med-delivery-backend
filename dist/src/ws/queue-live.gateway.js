"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueLiveGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
let QueueLiveGateway = class QueueLiveGateway {
    constructor() {
        this.queues = {};
        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        this.redis = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times) => Math.min(times * 200, 2000),
        });
    }
    async afterInit() {
        this.queues = {
            notifications: new bullmq_1.Queue('notifications', { connection: this.redis }),
            orders: new bullmq_1.Queue('orders', { connection: this.redis }),
        };
        for (const [name, queue] of Object.entries(this.queues)) {
            const events = new bullmq_1.QueueEvents(name, { connection: this.redis });
            const send = async (event, jobId, extra) => {
                try {
                    const job = await queue.getJob(jobId);
                    if (!job)
                        return;
                    this.server.emit('job_event', {
                        queue: name,
                        event,
                        job: {
                            id: job.id,
                            name: job.name,
                            data: job.data,
                            progress: job.progress,
                            attemptsMade: job.attemptsMade,
                        },
                        extra,
                        at: new Date().toISOString(),
                    });
                    await this.emitQueueSummary();
                }
                catch (err) {
                    console.warn('QueueLive send error', err);
                }
            };
            events.on('active', ({ jobId }) => send('active', jobId));
            events.on('waiting', ({ jobId }) => send('waiting', jobId));
            events.on('progress', ({ jobId, data }) => send('progress', jobId, data));
            events.on('completed', ({ jobId }) => send('completed', jobId));
            events.on('failed', ({ jobId, failedReason }) => send('failed', jobId, failedReason));
        }
        console.log('✅ QueueLiveGateway initialized (anonymous safe)');
    }
    async emitQueueSummary() {
        const summary = {};
        for (const [name, queue] of Object.entries(this.queues)) {
            try {
                summary[name] = await queue.getJobCounts();
            }
            catch {
                summary[name] = { error: 'unavailable' };
            }
        }
        this.server.emit('queue_summary', {
            timestamp: new Date().toISOString(),
            queues: summary,
        });
    }
};
exports.QueueLiveGateway = QueueLiveGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], QueueLiveGateway.prototype, "server", void 0);
exports.QueueLiveGateway = QueueLiveGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/queue-live', cors: { origin: '*' } }),
    __metadata("design:paramtypes", [])
], QueueLiveGateway);
