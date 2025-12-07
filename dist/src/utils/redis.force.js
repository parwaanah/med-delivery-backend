"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceRedisUrl = forceRedisUrl;
function forceRedisUrl(config) {
    const dockerUrl = 'redis://redis:6379';
    return dockerUrl;
}
