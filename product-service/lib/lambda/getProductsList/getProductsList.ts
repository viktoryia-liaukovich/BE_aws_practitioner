import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBClient
} from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const documentClient = DynamoDBDocumentClient.from(dynamoDB)
const productsTable = process.env.PRODUCTS_TABLE as string;
const stockTable = process.env.STOCK_TABLE as string;

export async function main(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {

    console.log('Get products list request.');

    const products = await documentClient.send(
    new ScanCommand({
      TableName: productsTable,
    })
  )

  const stocks = await documentClient.send(
    new ScanCommand({
      TableName: stockTable,
    })
  )

  if (
    !products.Items?.length ||
    !stocks.Items?.length
  ) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
      body: JSON.stringify({ message: 'No items found' }),
    }
  }


  const productsList = products.Items?.map(product => {
    const stock = stocks.Items?.find(stock => stock.product_id.S === product.id.S);
    return {
      ...product,
      count: stock ? stock.count : 0,
    }
  })

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    },
    body: JSON.stringify(productsList),
  };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      },
      body: JSON.stringify({ message: 'Server error occured' }),
    }
  }
}