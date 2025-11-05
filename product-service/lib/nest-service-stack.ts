import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { aws_apigateway as apigateway, Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface NestServiceStackProps extends StackProps {
  database: rds.DatabaseInstance;
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class NestServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: NestServiceStackProps) {
    super(scope, id, props);

    const { database, vpc, dbSecurityGroup } = props;

    // Create security group for Lambda
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'NestLambdaSecurityGroup', {
      vpc,
      description: 'Security group for Nest Lambda function',
      allowAllOutbound: true,
    });

    // Note: RDS security group already allows access from VPC CIDR block

    // 👇 Point to your built NestJS Lambda entry file
    const lambdaFunction = new lambda.Function(this, 'NestServiceLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../nodejs-aws-cart-api/dist/lambda_bundle.js')),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: Duration.seconds(30),
      environment: {
        DB_HOST: database.dbInstanceEndpointAddress,
        DB_PORT: database.dbInstanceEndpointPort,
        DB_USERNAME: database.secret?.secretValueFromJson('username').unsafeUnwrap() || 'postgres',
        DB_PASSWORD: database.secret?.secretValueFromJson('password').unsafeUnwrap() || '',
        DB_DATABASE: 'cartdb',
        NODE_ENV: 'production',
      },
    });

    // Grant Lambda access to the database secret
    if (database.secret) {
      database.secret.grantRead(lambdaFunction);
    }

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