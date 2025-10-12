import { APIGatewayProxyHandler } from 'aws-lambda';
import AWS from 'aws-sdk';

const s3 = new AWS.S3({ region: process.env.AWS_REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const fileName = event.queryStringParameters?.fileName;
    if (!fileName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing query parameter: fileName' }),
      };
    }

    const key = `uploaded/${fileName}`;

    const signedUrl = s3.getSignedUrl('putObject', {
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      Expires: 60 * 5, // 5 minutes
      ContentType: 'text/csv',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ signedUrl }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
