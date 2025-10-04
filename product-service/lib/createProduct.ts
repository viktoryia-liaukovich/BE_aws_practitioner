import {
  DynamoDBClient
} from '@aws-sdk/client-dynamodb'
import { randomUUID } from "crypto";
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const documentClient = DynamoDBDocumentClient.from(dynamoDB)
const productsTable = process.env.PRODUCTS_TABLE as string;
const stockTable = process.env.STOCK_TABLE as string;

export async function main(product: any) {
  const id = randomUUID();

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
}