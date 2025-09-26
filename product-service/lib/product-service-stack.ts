import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import path from 'path';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, "product-service-api", {
      restApiName: "Product Service",
      description: "This API serves products."
    });

    const getProductsListLambda = new lambda.Function(this, 'get-products', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'getProductsList.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
    });
    const getProductsList = new apigateway.LambdaIntegration(getProductsListLambda, {
      integrationResponses: [ // Add mapping for successful response
        {
          statusCode: '200',
        }
      ],
      proxy: false,
    });

    // Create a resource /hello and GET request under it
    const productsResource = api.root.addResource("products");
    // On this resource attach a GET method which pass reuest to our Lambda function
    productsResource.addMethod('GET', getProductsList, {
      methodResponses: [{ statusCode: '200' }]
    });

    const getProductByIdLambda = new lambda.Function(this, 'get-product-by-id', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'getProductById.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
    });
    const getProductById = new apigateway.LambdaIntegration(getProductByIdLambda, {
      integrationResponses: [ // Add mapping for successful response
        { statusCode: '200' },
        { statusCode: '404' },
      ],
    });

    // Create a resource /hello and GET request under it
    const productByIdResource = productsResource.addResource("{id}");
    // On this resource attach a GET method which pass reuest to our Lambda function
    productByIdResource.addMethod('GET', getProductById, {
      methodResponses: [{ statusCode: '200' }, { statusCode: '404' }]
    });
  }
}
