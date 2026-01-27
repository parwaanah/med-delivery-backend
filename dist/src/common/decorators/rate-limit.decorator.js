"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimit = exports.RATE_LIMIT_META_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.RATE_LIMIT_META_KEY = 'rate_limit';
const RateLimit = (opts) => (0, common_1.SetMetadata)(exports.RATE_LIMIT_META_KEY, opts);
exports.RateLimit = RateLimit;
