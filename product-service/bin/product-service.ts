#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductServiceStack } from '../lib/product-service-stack';
import { ImportServiceStack } from '../lib/import-service-stack';
import { AuthorizationServiceStack } from '../lib/authorization-service-stask';
import { NestServiceStack } from '../lib/nest-service-stack';

const app = new cdk.App();
const productServiceStack = new ProductServiceStack(app, 'ProductServiceStack', {});

new AuthorizationServiceStack(app, 'AuthorizationServiceStack', {});

new ImportServiceStack(app, 'ImportServiceStack', {
  catalogItemsQueue: productServiceStack.catalogItemsQueue,
});

new NestServiceStack(app, 'NestServiceStack', {});