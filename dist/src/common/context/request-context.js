"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContext = void 0;
const async_hooks_1 = require("async_hooks");
const crypto_1 = require("crypto");
const asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
class RequestContext {
    static run(fn, store = {}) {
        const context = {
            requestId: store.requestId ?? (0, crypto_1.randomUUID)(),
            userId: store.userId ?? '-',
            userRole: store.userRole ?? '-',
        };
        asyncLocalStorage.run(context, fn);
    }
    static get(key) {
        const store = asyncLocalStorage.getStore();
        return store ? store[key] : undefined;
    }
    static getRequestId() {
        return this.get('requestId') || 'no-req-id';
    }
    static getUser() {
        const userId = this.get('userId') || '-';
        const userRole = this.get('userRole') || '-';
        return { id: userId, role: userRole };
    }
}
exports.RequestContext = RequestContext;
//# sourceMappingURL=request-context.js.map