import { S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import csv from 'csv-parser';
import { Readable } from 'stream';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const main: S3Handler = async (event) => {
  console.log('Received S3 event with data:', JSON.stringify(event, null, 2));

  for (const record of (event.Records || [])) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file from bucket: ${bucketName}, key: ${objectKey}`);

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      });

      const response = await s3Client.send(command);
      const s3Stream = response.Body as Readable;

      await new Promise<void>((resolve, reject) => {
        s3Stream
          .pipe(csv())
          .on('data', (data) => {
            console.log('Parsed record:', data);
          })
          .on('end', () => {
            console.log(`Finished parsing ${objectKey}`);
            resolve();
          })
          .on('error', (err) => {
            console.error('Error parsing CSV:', err);
            reject(err);
          });
      });
    } catch (err) {
      console.error(`Error processing file ${objectKey}:`, err);
    }
  }
};