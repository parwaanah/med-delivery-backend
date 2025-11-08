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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurgeProcessor = void 0;
const common_1 = require("@nestjs/common");
const surge_service_1 = require("./surge.service");
let SurgeProcessor = class SurgeProcessor {
    constructor(surge) {
        this.surge = surge;
        this.logger = new common_1.Logger('SurgeProcessor');
    }
    onModuleInit() {
        this.logger.log('🚀 SurgeProcessor running every 15s');
        this.interval = setInterval(() => this.tick(), 15000);
    }
    async tick() {
        try {
            await this.surge['recalculate']();
        }
        catch (err) {
            this.logger.error('Surge recalc error', err);
        }
    }
    onModuleDestroy() {
        if (this.interval)
            clearInterval(this.interval);
    }
};
exports.SurgeProcessor = SurgeProcessor;
exports.SurgeProcessor = SurgeProcessor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [surge_service_1.SurgeService])
], SurgeProcessor);
