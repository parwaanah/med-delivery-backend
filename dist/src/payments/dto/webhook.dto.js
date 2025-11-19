"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookDto = void 0;
const openapi = require("@nestjs/swagger");
class WebhookDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { event: { required: true, type: () => String }, payload: { required: false, type: () => Object } };
    }
}
exports.WebhookDto = WebhookDto;
