import { match } from "assert/strict";
import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from "aws-lambda";

export async function main(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  console.log("Event:", JSON.stringify(event));

  try {
    const { authorizationToken, methodArn } = event;

    if (!authorizationToken) {
      console.warn("No authorization token in ", event);
      throw new Error("Unauthorized");
    }

    const credentialsEnv = process.env.TEST_CREDENTIALS || "";

    // Пример: [johndoe="TEST_PASSWORD"]
    console.log("Credentials from env:", credentialsEnv);
    const credentials = JSON.parse(credentialsEnv);

    const token = authorizationToken.split(" ")[1]; // remove "Basic" prefix
    const decoded = Buffer.from(token, "base64").toString("utf-8"); // "username:password"
    const [username, password] = decoded.split(":"); // split into username and password

    console.log(`Decoded credentials: ${username}:${password}`);

    const expectedPassword = credentials[username];
    if (expectedPassword && password === expectedPassword) {
      return <APIGatewayAuthorizerResult>{
        principalId: username,
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "execute-api:Invoke",
              Effect: "Allow",
              Resource: methodArn,
            },
          ],
        },
        context: {
          username,
        },
      };
    }

    throw new Error("Forbidden");
  } catch (err: any) {
    console.error("Error decoding token:", err);

    if (err.message === "Forbidden") {
      // Return 403 for invalid credentials
      throw new Error("Forbidden");
    }

    throw new Error("Unauthorized");
  }
}
