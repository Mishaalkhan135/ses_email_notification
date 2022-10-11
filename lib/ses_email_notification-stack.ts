import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SesEmailNotificationStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		//================================================================================
		//	Appsync : Platfrom API
		//================================================================================
		const platformApi = new appsync.GraphqlApi(this, "platform-api", {
			name: "platform-api",
			schema: appsync.Schema.fromAsset("graphql/schema.gql"),
			authorizationConfig: {
				defaultAuthorization: {
					authorizationType: appsync.AuthorizationType.API_KEY,
					apiKeyConfig: {
						expires: Expiration.after(Duration.days(365)),
					},
				},
			},
		});

		//================================================================================
		// Lambda : Lambda Function for Platform API
		//================================================================================
		const platformApiLambda = new lambda.Function(
			this,
			"platform-api-lambda",
			{
				functionName: "platform-api-lambda",
				runtime: lambda.Runtime.NODEJS_16_X,
				code: lambda.Code.fromAsset("lambda"),
				handler: "PlatformApiLambda.handler",
				// This may need to be increased later
				timeout: Duration.minutes(15),
				environment: {
					SOURCE_EMAIL: "mishaalkhan135@gmail.com",
				},
			}
		);

		//================================================================================
		// Policy : Add Permission for 'platformApiLambda' Lambda to access SES
		//================================================================================
		platformApiLambda.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ["ses:SendEmail"],
				resources: ["*"],
			})
		);

		//================================================================================
		// Set 'platformApiLambda' Lambda as a Datasource for Platform API
		//================================================================================
		const platformApiDatasource = platformApi.addLambdaDataSource(
			"platform-api-datasource",
			platformApiLambda
		);

		//================================================================================
		// Defining Resolvers for 'platformApiDatasource'
		//================================================================================

		// user resolvers

		platformApiDatasource.createResolver({
			typeName: "Mutation",
			fieldName: "verify_email",
		});

		//================================================================================
		// Outputs
		//================================================================================
		new CfnOutput(this, "platform-api-url", {
			value: platformApi.graphqlUrl,
		});
		new cdk.CfnOutput(this, "GraphQLAPIKey", {
			value: platformApi.apiKey || "",
		});
	}
}
