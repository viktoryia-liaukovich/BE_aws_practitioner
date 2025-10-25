import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBClient
} from '@aws-sdk/client-dynamodb'
import { randomUUID } from "crypto";
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const documentClient = DynamoDBDocumentClient.from(dynamoDB)
const productsTable = process.env.PRODUCTS_TABLE as string;
const stockTable = process.env.STOCK_TABLE as string;

function validateInput(product: unknown) {
  if (!product) return "Product is required";

  if (typeof product !== "object") return "Product data is invalid";

  const { title, description, price } = product as {
    title: string;
    description: string;
    price: number;
  };

  if (!title || typeof title !== "string") return "Title should be a valid string";

  if (!description || typeof description !== "string") return "Description should be a valid string";

  if (!price || typeof price !== "number") return "Price should be a valid number";

  return null;
}

export async function main(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = randomUUID();

  let product;
  try {
    product = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({ message: 'Invalid JSON in request body' }),
    };
  }

  console.log("Create product request for: ", JSON.stringify(product, null, 2));

  try {
    const validationError = validateInput(product);

    if (validationError) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({ message: validationError }),
      }
    }

    const createdProduct = await documentClient.send(
      new PutCommand({
        TableName: productsTable,
        Item: {
          id,
          title: product.title,
          description: product.description,
          price: product.price
        }
      })
    )

    const createdStock = await documentClient.send(
      new PutCommand({
        TableName: stockTable,
        Item: {
          product_id: id,
          count: product.count
        }
      })
    )

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({...createdProduct, ...createdStock}),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({ message: 'Server error occured' }),
    }
  }
}