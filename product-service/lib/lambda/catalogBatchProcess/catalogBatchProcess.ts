import { DynamoDBClient,  } from "@aws-sdk/client-dynamodb";
import { SQSEvent } from "aws-lambda";
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const documentClient = DynamoDBDocumentClient.from(dynamoDB)
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

export const main = async (event: SQSEvent) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const results = await Promise.all(
      event.Records.map(async (record) => {
        const product = JSON.parse(record.body);
        console.log("Processing product:", product);

        await documentClient.send(
          new PutCommand({
            TableName: process.env.PRODUCTS_TABLE,
            Item: {
              id: product.id,
              title: product.title,
              price: product.price,
              description: product.description || "",
            },
          })
        );

        await documentClient.send(
          new PutCommand({
            TableName: process.env.STOCKS_TABLE,
            Item: {
              product_id: product.id,
              count: product.count || 0,
            },
          })
        );

        await snsClient.send(
          new PublishCommand({
            TopicArn: process.env.CREATE_PRODUCT_TOPIC_ARN,
            Subject: "New Product Created",
            Message: JSON.stringify(product, null, 2),
          })
        );
      })
    );

    console.log(`Successfully processed ${results.length} products.`);
    return { statusCode: 200 };
  } catch (err) {
    console.error("Error while processing batch:", err);
    throw err;
  }
};