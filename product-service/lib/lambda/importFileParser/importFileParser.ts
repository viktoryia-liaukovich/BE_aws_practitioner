import { S3Event } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import csv from "csv-parser";
import { Readable } from "stream";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const sqs = new SQSClient({ region: process.env.AWS_REGION });

export const main = async (event: S3Event) => {
  console.log("Received S3 event with data:", JSON.stringify(event, null, 2));

  for (const record of event.Records || []) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(
      record.s3.object.key.replace(/\+/g, " ")
    );

    console.log(
      `Processing file from bucket: ${bucketName}, key: ${objectKey}`
    );
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    const response = await s3Client.send(command);
    const s3Stream = response.Body as Readable;

    let sentCount = 0;

    await new Promise<void>((resolve, reject) => {
      const sendPromises: Promise<any>[] = [];

      s3Stream
        .pipe(
          csv({
            separator: ",",
            strict: false,
            mapHeaders: ({ header }) => header.trim(),
            mapValues: ({ value }) => value.trim(),
          })
        )
        .on("data", async (row) => {
          console.log("ROW:", row);
          sendPromises.push(
            sqs.send(
              new SendMessageCommand({
                QueueUrl: process.env.SQS_URL!,
                MessageBody: JSON.stringify(row),
              })
            )
          );
        })
        .on("end", async () => {
          await Promise.all(sendPromises);
          sentCount = sendPromises.length;
          console.log(
            `✅ Finished processing ${objectKey}. Sent ${sentCount} messages.`
          );
          resolve();
        })
        .on("error", (err) => {
          console.error("Error parsing CSV:", err);
          reject(err);
        });
    });
  }
  return { statusCode: 200 };
};
