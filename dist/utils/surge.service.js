"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurgeService = void 0;
const common_1 = require("@nestjs/common");
const date_fns_1 = require("date-fns");
let SurgeService = class SurgeService {
    constructor() {
        this.surgeMultiplier = 1.0;
        this.surgeUntil = null;
    }
    setSurge(multiplier, durationMinutes) {
        this.surgeMultiplier = multiplier;
        this.surgeUntil = (0, date_fns_1.addMinutes)(new Date(), durationMinutes);
    }
    getCurrentMultiplier() {
        if (this.surgeUntil && (0, date_fns_1.isAfter)(new Date(), this.surgeUntil)) {
            this.surgeMultiplier = 1.0;
            this.surgeUntil = null;
        }
        return this.surgeMultiplier;
    }
    isSurgeActive() {
        return this.surgeMultiplier > 1.0 && this.surgeUntil && (0, date_fns_1.isAfter)(this.surgeUntil, new Date());
    }
};
exports.SurgeService = SurgeService;
exports.SurgeService = SurgeService = __decorate([
    (0, common_1.Injectable)()
], SurgeService);
