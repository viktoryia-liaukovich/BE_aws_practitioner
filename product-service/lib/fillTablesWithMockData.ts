import {
  DynamoDBClient,
  PutItemCommandOutput,
} from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { products } from './mocks/products'
import { PRODUCTS_TABLE, STOCK_TABLE } from '../constants'

async function fillTablesWithMockData() {
  const dynamoDB = new DynamoDBClient({ region: 'us-east-1' });
  const documentClient = DynamoDBDocumentClient.from(dynamoDB)
  const commands: Array<Promise<PutItemCommandOutput>> = []
  console.log('products', products);

  products.forEach((product) => {
    const putProduct = new PutCommand({
      TableName: PRODUCTS_TABLE,
      Item: {
        id: product.id ,
        title: product.title,
        description: product.description,
        price: product.price,
      },
    })

    const putStock = new PutCommand({
      TableName: STOCK_TABLE,
      Item: {
        product_id: product.id ,
        count: product.count,
      },
    })
    console.log("Inserting product:", JSON.stringify(product, null, 2));

    commands.push(documentClient.send(putProduct), documentClient.send(putStock))
  })

  return Promise.all(commands)
}

fillTablesWithMockData()