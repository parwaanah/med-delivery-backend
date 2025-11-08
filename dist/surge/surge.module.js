"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurgeModule = void 0;
const common_1 = require("@nestjs/common");
const surge_service_1 = require("./surge.service");
const surge_processor_1 = require("./surge.processor");
const surge_controller_1 = require("./surge.controller");
const ws_module_1 = require("../ws/ws.module");
const utils_module_1 = require("../utils/utils.module");
let SurgeModule = class SurgeModule {
};
exports.SurgeModule = SurgeModule;
exports.SurgeModule = SurgeModule = __decorate([
    (0, common_1.Module)({
        imports: [ws_module_1.WsModule, utils_module_1.UtilsModule],
        providers: [surge_service_1.SurgeService, surge_processor_1.SurgeProcessor],
        controllers: [surge_controller_1.SurgeController],
        exports: [surge_service_1.SurgeService],
    })
], SurgeModule);
