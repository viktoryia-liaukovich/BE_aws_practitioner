#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductServiceStack } from '../lib/product-service-stack';
import { ImportServiceStack } from '../lib/import-service-stack';
import { AuthorizationServiceStack } from '../lib/authorization-service-stask';
import { NestServiceStack } from '../lib/nest-service-stack';
import { CartRdsStack } from '../lib/cart-rds-stack';

const app = new cdk.App();
const productServiceStack = new ProductServiceStack(app, 'ProductServiceStack', {});

new AuthorizationServiceStack(app, 'AuthorizationServiceStack', {});

new ImportServiceStack(app, 'ImportServiceStack', {
  catalogItemsQueue: productServiceStack.catalogItemsQueue,
});

// Create RDS stack first
const cartRdsStack = new CartRdsStack(app, 'CartRdsStack', {});

// Create Nest Service stack with RDS dependencies
new NestServiceStack(app, 'NestServiceStack', {
  database: cartRdsStack.database,
  vpc: cartRdsStack.vpc,
  dbSecurityGroup: cartRdsStack.dbSecurityGroup,
});