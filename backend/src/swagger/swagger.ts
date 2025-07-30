import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// 1. 정확한 타입 정의
interface SwaggerYaml {
  paths?: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
}

// 2. YAML 로드
const searchYamlPath = path.resolve(__dirname, './search.yaml');
const searchDoc = yaml.load(
  fs.readFileSync(searchYamlPath, 'utf8')
) as SwaggerYaml;

// 3. swagger-jsdoc 기본 정의
const baseSpec: any = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: '늬웃',
      version: '1.0.0',
      description: '뉴스 기반 정보형 콘텐츠 서비스',
    },
    servers: [
      {
        url: 'http://localhost:8080',
      },
    ],
  },
  apis: ['./routes/**/*.ts'],
});

// 4. 병합
export const swaggerSpec = {
  ...baseSpec,
  paths: {
    ...(baseSpec.paths || {}),
    ...(searchDoc.paths || {}),
  },
  components: {
    ...(baseSpec.components || {}),
    ...(searchDoc.components || {}),
  },
};