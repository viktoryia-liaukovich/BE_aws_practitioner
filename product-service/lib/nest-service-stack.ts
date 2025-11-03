import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { aws_apigateway as apigateway, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class NestServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 👇 Point to your built NestJS Lambda entry file
    const lambdaFunction = new lambda.Function(this, 'NestServiceLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../nodejs-aws-cart-api/dist/lambda_bundle.js')),
    });

    // 👇 Define API Gateway that routes traffic to Lambda
    const api = new apigateway.RestApi(this, 'NestApi', {
      restApiName: 'Nest Service API',
      description: 'This service serves a Nest.js application.',
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);

    const proxyResource = api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', lambdaIntegration);
  }
}