import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { products } from "./mocks/products";

export async function main(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id;

  const product = products.find((p) => p.id === id);

  if (!product) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Product not found" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(product),
  };
}