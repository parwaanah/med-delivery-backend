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
exports.PharmacyProfileDto = exports.PharmacyBankDetailsDto = exports.PharmacyAddressDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class PharmacyAddressDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { line1: { required: true, type: () => String }, city: { required: true, type: () => String }, pin: { required: true, type: () => String } };
    }
}
exports.PharmacyAddressDto = PharmacyAddressDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyAddressDto.prototype, "line1", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyAddressDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyAddressDto.prototype, "pin", void 0);
class PharmacyBankDetailsDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { accountName: { required: true, type: () => String }, accountNumber: { required: true, type: () => String }, ifsc: { required: true, type: () => String }, bankName: { required: true, type: () => String } };
    }
}
exports.PharmacyBankDetailsDto = PharmacyBankDetailsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyBankDetailsDto.prototype, "accountName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyBankDetailsDto.prototype, "accountNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyBankDetailsDto.prototype, "ifsc", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyBankDetailsDto.prototype, "bankName", void 0);
class PharmacyProfileDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { pharmacyName: { required: true, type: () => String }, ownerName: { required: true, type: () => String }, address: { required: true, type: () => require("./profile.dto").PharmacyAddressDto }, gstNumber: { required: true, type: () => String }, drugLicenseNumber: { required: true, type: () => String }, openingHours: { required: true, type: () => String }, bankDetails: { required: false, type: () => require("./profile.dto").PharmacyBankDetailsDto } };
    }
}
exports.PharmacyProfileDto = PharmacyProfileDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyProfileDto.prototype, "pharmacyName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyProfileDto.prototype, "ownerName", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PharmacyAddressDto),
    __metadata("design:type", PharmacyAddressDto)
], PharmacyProfileDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyProfileDto.prototype, "gstNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyProfileDto.prototype, "drugLicenseNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PharmacyProfileDto.prototype, "openingHours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PharmacyBankDetailsDto),
    __metadata("design:type", PharmacyBankDetailsDto)
], PharmacyProfileDto.prototype, "bankDetails", void 0);
