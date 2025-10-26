import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from "aws-cdk-lib/aws-sqs";
import path from "path";

interface ImportServiceStackProps extends cdk.StackProps {
  catalogItemsQueue: sqs.Queue;
}

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, "import-service-api", {
          restApiName: "Import Service",
          defaultCorsPreflightOptions: {
            allowOrigins: apigateway.Cors.ALL_ORIGINS,
            allowMethods: apigateway.Cors.ALL_METHODS,
            allowHeaders: [
              'Content-Type',
              'X-Amz-Date',
              'Authorization',
              'X-Api-Key',
              'X-Amz-Security-Token',
            ],
          },
        });

    const bucket = new s3.Bucket(this, "ImportServiceBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
        },
      ]
    });

    new s3deploy.BucketDeployment(this, "CreateUploadedFolder", {
      destinationBucket: bucket,
      sources: [s3deploy.Source.asset("./assets")],
    });

    const importProductsFileLambda = new lambda.Function(this, "import-products-file", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "importProductsFile.main",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./lambda/importProductsFile")
      ),
       environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });

    bucket.grantPut(importProductsFileLambda);

    const importProductsFileIntegration = new apigateway.LambdaIntegration(importProductsFileLambda, {
      integrationResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
      ],
      proxy: true,
    });

    const basicAuthorizerArn = cdk.Fn.importValue('BasicAuthorizerArn');

    const authorizerLambda = lambda.Function.fromFunctionArn(
      this,
      'BasicAuthorizerLambda',
      basicAuthorizerArn
    );

    const authorizer = new apigateway.TokenAuthorizer(
      this,
      "BasicTokenAuthorizer",
      {
        handler: authorizerLambda,
        identitySource: "method.request.header.Authorization",
        authorizerName: "BasicAuthorizer",
        resultsCacheTtl: cdk.Duration.minutes(1),
      }
    );

     const importResource = api.root.addResource("import");

     importResource.addMethod('GET', importProductsFileIntegration, {
      requestParameters: {
        'method.request.querystring.fileName': true, // true = required
      },
      requestValidatorOptions: {
        validateRequestParameters: true,
      },
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
     });

     const importFileParser = new lambda.Function(this, 'ImportFileParserLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'importFileParser.main',
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./lambda/importFileParser")
      ),
      environment: {
        BUCKET_NAME: bucket.bucketName,
         SQS_URL: props.catalogItemsQueue.queueUrl,
      },
    });

    bucket.grantRead(importFileParser);
    props.catalogItemsQueue.grantSendMessages(importFileParser);

    // Configure the trigger for "uploaded/" folder
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: 'uploaded/' }
    );
  }
}
