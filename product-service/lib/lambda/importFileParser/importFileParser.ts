import { S3Handler } from 'aws-lambda';
import AWS from 'aws-sdk';
import csv from 'csv-parser';

const s3 = new AWS.S3({ region: process.env.AWS_REGION });

export const handler: S3Handler = async (event) => {
  console.log('Received S3 event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file from bucket: ${bucketName}, key: ${objectKey}`);

    try {
      const s3Stream = s3
        .getObject({
          Bucket: bucketName,
          Key: objectKey,
        })
        .createReadStream();

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