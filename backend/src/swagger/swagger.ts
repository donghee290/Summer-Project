import swaggerJSDoc from 'swagger-jsdoc';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface SwaggerYaml {
  paths?: Record<string, any>;
  components?: Record<string, any>;
}

// Load YAML specs from sibling files
const searchYamlPath = path.resolve(__dirname, 'search.yaml');
const articleYamlPath = path.resolve(__dirname, 'article.yaml');

const searchDoc = (yaml.load(fs.readFileSync(searchYamlPath, 'utf8')) as SwaggerYaml) || {};
const articleDoc = (yaml.load(fs.readFileSync(articleYamlPath, 'utf8')) as SwaggerYaml) || {};

// Base spec from JSDoc
const baseSpec: any = swaggerJSDoc({
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

export const swaggerSpec = {
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

export default swaggerSpec;