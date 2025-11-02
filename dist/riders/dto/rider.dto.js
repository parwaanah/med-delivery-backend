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
exports.UpdateStatusDto = exports.UpdateRiderDto = exports.CreateRiderDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateRiderDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String }, email: { required: true, type: () => String }, password: { required: true, type: () => String, minLength: 6 } };
    }
}
exports.CreateRiderDto = CreateRiderDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateRiderDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateRiderDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.MinLength)(6),
    __metadata("design:type", String)
], CreateRiderDto.prototype, "password", void 0);
class UpdateRiderDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: false, type: () => String }, email: { required: false, type: () => String } };
    }
}
exports.UpdateRiderDto = UpdateRiderDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateRiderDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpdateRiderDto.prototype, "email", void 0);
class UpdateStatusDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { status: { required: true, type: () => Object, enum: ['AVAILABLE', 'BUSY', 'OFFLINE'] } };
    }
}
exports.UpdateStatusDto = UpdateStatusDto;
__decorate([
    (0, class_validator_1.IsIn)(['AVAILABLE', 'BUSY', 'OFFLINE']),
    __metadata("design:type", String)
], UpdateStatusDto.prototype, "status", void 0);
