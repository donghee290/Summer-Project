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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
// Load YAML specs from sibling files
const searchYamlPath = path.resolve(__dirname, 'search.yaml');
const articleYamlPath = path.resolve(__dirname, 'article.yaml');
const searchDoc = yaml.load(fs.readFileSync(searchYamlPath, 'utf8')) || {};
const articleDoc = yaml.load(fs.readFileSync(articleYamlPath, 'utf8')) || {};
// Base spec from JSDoc
const baseSpec = (0, swagger_jsdoc_1.default)({
    definition: {
        openapi: '3.0.0',
        info: {
            title: '늬웃',
            version: '1.0.0',
            description: '뉴스 기반 정보형 콘텐츠 서비스',
        },
        servers: [
            { url: process.env.SWAGGER_SERVER_URL || 'http://localhost:8080' },
        ],
    },
    apis: ['./routes/**/*.ts'],
});
exports.swaggerSpec = {
    ...baseSpec,
    paths: {
        ...(baseSpec.paths || {}),
        ...(searchDoc.paths || {}),
        ...(articleDoc.paths || {}),
    },
    components: {
        ...(baseSpec.components || {}),
        ...(searchDoc.components || {}),
        ...(articleDoc.components || {}),
    },
};
exports.default = exports.swaggerSpec;
