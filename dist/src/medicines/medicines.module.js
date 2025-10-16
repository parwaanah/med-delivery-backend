"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicinesModule = void 0;
const common_1 = require("@nestjs/common");
const medicines_controller_1 = require("./medicines.controller");
const medicines_service_1 = require("./medicines.service");
let MedicinesModule = class MedicinesModule {
};
exports.MedicinesModule = MedicinesModule;
exports.MedicinesModule = MedicinesModule = __decorate([
    (0, common_1.Module)({
        controllers: [medicines_controller_1.MedicinesController],
        providers: [medicines_service_1.MedicinesService],
    })
], MedicinesModule);
//# sourceMappingURL=medicines.module.js.map