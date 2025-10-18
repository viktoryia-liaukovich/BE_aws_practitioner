import { SQSEvent, SQSRecord } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { main } from '../lib/lambda/catalogBatchProcess/catalogBatchProcess';

// Create mocks for AWS clients
const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);

// Mock environment variables
const originalEnv = process.env;

describe('catalogBatchProcess Lambda', () => {
  beforeEach(() => {
    // Reset mocks before each test
    ddbMock.reset();
    snsMock.reset();

    // Set up environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1',
      PRODUCTS_TABLE: 'test-products-table',
      STOCKS_TABLE: 'test-stocks-table',
      CREATE_PRODUCT_TOPIC_ARN: 'arn:aws:sns:us-east-1:123456789012:test-topic',
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  const createSQSRecord = (product: any): SQSRecord => ({
    messageId: 'test-message-id',
    receiptHandle: 'test-receipt-handle',
    body: JSON.stringify(product),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1234567890',
      SenderId: 'test-sender',
      ApproximateFirstReceiveTimestamp: '1234567890',
    },
    messageAttributes: {},
    md5OfBody: 'test-md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
    awsRegion: 'us-east-1',
  });

  const createSQSEvent = (products: any[]): SQSEvent => ({
    Records: products.map(createSQSRecord),
  });

  test('should successfully process a single product', async () => {
    // Arrange
    const product = {
      id: 'test-id-1',
      title: 'Test Product',
      price: 99.99,
      description: 'Test description',
      count: 10,
    };

    const event = createSQSEvent([product]);

    ddbMock.on(PutCommand).resolves({});
    snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

    // Act
    const result = await main(event);

    // Assert
    expect(result).toEqual({ statusCode: 200 });

    // Verify DynamoDB calls
    const ddbCalls = ddbMock.commandCalls(PutCommand);
    expect(ddbCalls).toHaveLength(2);

    // Check products table call
    expect(ddbCalls[0].args[0].input).toEqual({
      TableName: 'test-products-table',
      Item: {
        id: 'test-id-1',
        title: 'Test Product',
        price: 99.99,
        description: 'Test description',
      },
    });

    // Check stocks table call
    expect(ddbCalls[1].args[0].input).toEqual({
      TableName: 'test-stocks-table',
      Item: {
        product_id: 'test-id-1',
        count: 10,
      },
    });

    // Verify SNS call
    const snsCalls = snsMock.commandCalls(PublishCommand);
    expect(snsCalls).toHaveLength(1);
    expect(snsCalls[0].args[0].input).toEqual({
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
      Subject: 'New Product Created',
      Message: JSON.stringify(product, null, 2),
    });
  });

  test('should process multiple products in batch', async () => {
    // Arrange
    const products = [
      {
        id: 'test-id-1',
        title: 'Product 1',
        price: 10.0,
        description: 'Description 1',
        count: 5,
      },
      {
        id: 'test-id-2',
        title: 'Product 2',
        price: 20.0,
        description: 'Description 2',
        count: 15,
      },
      {
        id: 'test-id-3',
        title: 'Product 3',
        price: 30.0,
        description: 'Description 3',
        count: 25,
      },
    ];

    const event = createSQSEvent(products);

    ddbMock.on(PutCommand).resolves({});
    snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

    // Act
    const result = await main(event);

    // Assert
    expect(result).toEqual({ statusCode: 200 });

    // Verify all products were processed (2 DynamoDB calls per product + 1 SNS call per product)
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(6); // 3 products * 2 tables
    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(3); // 3 products
  });

  test('should handle product without description', async () => {
    // Arrange
    const product = {
      id: 'test-id-1',
      title: 'Product without description',
      price: 50.0,
      count: 7,
    };

    const event = createSQSEvent([product]);

    ddbMock.on(PutCommand).resolves({});
    snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

    // Act
    const result = await main(event);

    // Assert
    expect(result).toEqual({ statusCode: 200 });

    const ddbCalls = ddbMock.commandCalls(PutCommand);

    // Check that description defaults to empty string
    expect(ddbCalls[0].args[0].input.Item!.description).toBe('');
  });

  test('should handle product without count (defaults to 0)', async () => {
    // Arrange
    const product = {
      id: 'test-id-1',
      title: 'Product without count',
      price: 50.0,
      description: 'Test',
    };

    const event = createSQSEvent([product]);

    ddbMock.on(PutCommand).resolves({});
    snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

    // Act
    const result = await main(event);

    // Assert
    expect(result).toEqual({ statusCode: 200 });

    const ddbCalls = ddbMock.commandCalls(PutCommand);

    // Check that count defaults to 0
    expect(ddbCalls[1].args[0].input.Item!.count).toBe(0);
  });

  test('should throw error when DynamoDB put to products table fails', async () => {
    // Arrange
    const product = {
      id: 'test-id-1',
      title: 'Test Product',
      price: 99.99,
      count: 10,
    };

    const event = createSQSEvent([product]);

    ddbMock
      .on(PutCommand, { TableName: 'test-products-table' })
      .rejects(new Error('DynamoDB error'));

    // Act & Assert
    await expect(main(event)).rejects.toThrow('DynamoDB error');
  });

  test('should throw error when DynamoDB put to stocks table fails', async () => {
    // Arrange
    const product = {
      id: 'test-id-1',
      title: 'Test Product',
      price: 99.99,
      count: 10,
    };

    const event = createSQSEvent([product]);

    ddbMock
      .on(PutCommand, { TableName: 'test-products-table' })
      .resolves({});

    ddbMock
      .on(PutCommand, { TableName: 'test-stocks-table' })
      .rejects(new Error('Stocks table error'));

    // Act & Assert
    await expect(main(event)).rejects.toThrow('Stocks table error');
  });

  test('should throw error when SNS publish fails', async () => {
    // Arrange
    const product = {
      id: 'test-id-1',
      title: 'Test Product',
      price: 99.99,
      count: 10,
    };

    const event = createSQSEvent([product]);

    ddbMock.on(PutCommand).resolves({});
    snsMock.on(PublishCommand).rejects(new Error('SNS publish error'));

    // Act & Assert
    await expect(main(event)).rejects.toThrow('SNS publish error');
  });

  test('should handle invalid JSON in SQS message body', async () => {
    // Arrange
    const event: SQSEvent = {
      Records: [
        {
          messageId: 'test-message-id',
          receiptHandle: 'test-receipt-handle',
          body: 'invalid-json',
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: '1234567890',
            SenderId: 'test-sender',
            ApproximateFirstReceiveTimestamp: '1234567890',
          },
          messageAttributes: {},
          md5OfBody: 'test-md5',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
          awsRegion: 'us-east-1',
        },
      ],
    };

    // Act & Assert
    await expect(main(event)).rejects.toThrow();
  });

  test('should process empty records array', async () => {
    // Arrange
    const event: SQSEvent = {
      Records: [],
    };

    // Act
    const result = await main(event);

    // Assert
    expect(result).toEqual({ statusCode: 200 });
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
  });

  test('should handle products with additional fields', async () => {
    // Arrange
    const product = {
      id: 'test-id-1',
      title: 'Test Product',
      price: 99.99,
      description: 'Test description',
      count: 10,
      extraField1: 'value1',
      extraField2: 'value2',
    };

    const event = createSQSEvent([product]);

    ddbMock.on(PutCommand).resolves({});
    snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

    // Act
    const result = await main(event);

    // Assert
    expect(result).toEqual({ statusCode: 200 });

    // Verify only expected fields are saved to products table
    const ddbCalls = ddbMock.commandCalls(PutCommand);
    expect(ddbCalls[0].args[0].input.Item).toEqual({
      id: 'test-id-1',
      title: 'Test Product',
      price: 99.99,
      description: 'Test description',
    });

    // Verify SNS message includes all fields
    const snsCalls = snsMock.commandCalls(PublishCommand);
    expect(JSON.parse(snsCalls[0].args[0].input.Message!)).toEqual(product);
  });

  test('should handle products with zero price', async () => {
    // Arrange
    const product = {
      id: 'test-id-1',
      title: 'Free Product',
      price: 0,
      description: 'Free item',
      count: 100,
    };

    const event = createSQSEvent([product]);

    ddbMock.on(PutCommand).resolves({});
    snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });

    // Act
    const result = await main(event);

    // Assert
    expect(result).toEqual({ statusCode: 200 });

    const ddbCalls = ddbMock.commandCalls(PutCommand);
    expect(ddbCalls[0].args[0].input.Item!.price).toBe(0);
  });
});
