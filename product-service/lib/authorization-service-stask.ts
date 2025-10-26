// Filename: authorizer-stack/authorizer-stack.ts
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";
import dotenv from 'dotenv';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";

dotenv.config();

const { TEST_CREDENTIALS } = process.env;

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basicAuthorizer = new lambda.Function(
      this,
      "basic-authorizer",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(5),
        handler: "basicAuthorizer.main",
        code: lambda.Code.fromAsset(path.join(__dirname, "./lambda/basicAuthorizer")),
        environment: {
          TEST_CREDENTIALS: TEST_CREDENTIALS ?? ""
        },
      }
    );

    basicAuthorizer.addPermission("ApiGatewayInvokePermission", {
      principal: new ServicePrincipal("apigateway.amazonaws.com"),
    });

    new cdk.CfnOutput(this, "BasicAuthorizerArn", {
      value: basicAuthorizer.functionArn,
      exportName: "BasicAuthorizerArn",
    });
  }
}
