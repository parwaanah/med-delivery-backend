"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalLogger = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let GlobalLogger = class GlobalLogger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, 'app.log');
        this.errorFile = path.join(this.logDir, 'errors.log');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir);
        }
    }
    writeToFile(filePath, message) {
        fs.appendFileSync(filePath, message + '\n', { encoding: 'utf8' });
    }
    format(level, message, context) {
        const ts = new Date().toISOString();
        const ctx = context ? `[${context}]` : '';
        return `[${ts}] [${level}] ${ctx} ${typeof message === 'string' ? message : JSON.stringify(message)}`;
    }
    log(message, context) {
        const formatted = this.format('INFO', message, context);
        console.log(formatted);
        this.writeToFile(this.logFile, formatted);
    }
    error(message, trace, context) {
        const formatted = this.format('ERROR', message, context);
        console.error(formatted, trace || '');
        this.writeToFile(this.errorFile, formatted + (trace ? `\n${trace}` : ''));
    }
    warn(message, context) {
        const formatted = this.format('WARN', message, context);
        console.warn(formatted);
        this.writeToFile(this.logFile, formatted);
    }
};
exports.GlobalLogger = GlobalLogger;
exports.GlobalLogger = GlobalLogger = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], GlobalLogger);
