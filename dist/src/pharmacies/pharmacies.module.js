"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmaciesModule = void 0;
const common_1 = require("@nestjs/common");
const pharmacies_service_1 = require("./pharmacies.service");
const pharmacies_controller_1 = require("./pharmacies.controller");
const prisma_service_1 = require("../utils/prisma.service");
const pharmacy_inventory_controller_1 = require("./pharmacy-inventory.controller");
const pharmacy_inventory_service_1 = require("./pharmacy-inventory.service");
const pharmacy_earnings_controller_1 = require("./pharmacy-earnings.controller");
const geo_surge_module_1 = require("../geosurge/geo-surge.module");
const surge_module_1 = require("../surge/surge.module");
let PharmaciesModule = class PharmaciesModule {
};
exports.PharmaciesModule = PharmaciesModule;
exports.PharmaciesModule = PharmaciesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            geo_surge_module_1.GeoSurgeModule,
            surge_module_1.SurgeModule,
        ],
        controllers: [
            pharmacies_controller_1.PharmaciesController,
            pharmacy_inventory_controller_1.PharmaciesInventoryController,
            pharmacy_inventory_controller_1.PharmacyInventoryController,
            pharmacy_earnings_controller_1.PharmacyEarningsController,
        ],
        providers: [
            pharmacies_service_1.PharmaciesService,
            pharmacy_inventory_service_1.PharmacyInventoryService,
            prisma_service_1.PrismaService,
        ],
        exports: [pharmacies_service_1.PharmaciesService],
    })
], PharmaciesModule);
