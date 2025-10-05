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

export async function main(product: any) {
  const id = randomUUID();

  console.log("Create product request for: ", JSON.stringify(product, null, 2));

  try {
    const validationError = validateInput(product);

    if (validationError) {
      return {
        statusCode: 400,
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

    return JSON.stringify({...createdProduct, ...createdStock});
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error }),
    }
  }
}