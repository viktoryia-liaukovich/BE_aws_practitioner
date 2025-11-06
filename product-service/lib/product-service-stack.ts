import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import path from "path";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { PRODUCTS_TABLE, STOCK_TABLE } from "../constants";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

export class ProductServiceStack extends cdk.Stack {
  public readonly catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, "product-service-api", {
      restApiName: "Product Service",
      description: "This API serves products.",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
    });

    const productTable = dynamodb.Table.fromTableName(
      this,
      PRODUCTS_TABLE,
      PRODUCTS_TABLE
    );

    const stockTable = dynamodb.Table.fromTableName(
      this,
      STOCK_TABLE,
      STOCK_TABLE
    );

    const getProductsListLambda = new lambda.Function(this, "get-products", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "getProductsList.main",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./lambda/getProductsList")
      ),
      environment: {
        PRODUCTS_TABLE: PRODUCTS_TABLE,
        STOCK_TABLE: STOCK_TABLE,
      },
    });

    const createProductLambda = new lambda.Function(this, "create-product", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "createProduct.main",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "./lambda/createProduct")
      ),
      environment: {
        PRODUCTS_TABLE: PRODUCTS_TABLE,
        STOCK_TABLE: STOCK_TABLE,
      },
    });

    const createProductTopic = new sns.Topic(this, "create-product-topic", {
      displayName: "Product Created Topic",
    });

    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription("Viktoryia_Liaukovich@epam.com")
    );

    const catalogBatchProcessLambda = new lambda.Function(
      this,
      "catalogBatchProcess",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "catalogBatchProcess.main",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "lambda/catalogBatchProcess")
        ),
        environment: {
          PRODUCTS_TABLE: PRODUCTS_TABLE,
          STOCKS_TABLE: STOCK_TABLE,
          CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
        },
      }
    );

    const createProduct = new apigateway.LambdaIntegration(
      createProductLambda,
      {
        proxy: true,
      }
    );

    const getProductsList = new apigateway.LambdaIntegration(
      getProductsListLambda,
      {
        proxy: true,
      }
    );

    const productsResource = api.root.addResource("products");

    productsResource.addMethod("GET", getProductsList);

    productsResource.addMethod("POST", createProduct);

    const getProductByIdLambda = new lambda.Function(
      this,
      "get-product-by-id",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(5),
        handler: "getProductById.main",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "./lambda/getProductById")
        ),
        environment: {
          PRODUCTS_TABLE: PRODUCTS_TABLE,
          STOCK_TABLE: STOCK_TABLE,
        },
      }
    );
    const getProductById = new apigateway.LambdaIntegration(
      getProductByIdLambda,
      {
        proxy: true,
      }
    );

    const productByIdResource = productsResource.addResource("{id}");
    // On this resource attach a GET method which pass reuest to our Lambda function
    productByIdResource.addMethod("GET", getProductById);

    this.catalogItemsQueue = new sqs.Queue(this, "catalog-items-queue", {
      queueName: "catalog-items-queue",
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    catalogBatchProcessLambda.addEventSource(
      new eventSources.SqsEventSource(this.catalogItemsQueue, {
        batchSize: 5,
      })
    );

    productTable.grantReadData(getProductsListLambda);
    productTable.grantReadData(getProductByIdLambda);
    productTable.grantWriteData(createProductLambda);
    productTable.grantWriteData(catalogBatchProcessLambda);
    stockTable.grantReadData(getProductsListLambda);
    stockTable.grantReadData(getProductByIdLambda);
    stockTable.grantWriteData(createProductLambda);
    stockTable.grantWriteData(catalogBatchProcessLambda);

    createProductTopic.grantPublish(catalogBatchProcessLambda);
  }
}
