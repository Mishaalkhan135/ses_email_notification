// Importing AWS SDK Services
import * as AWS from "aws-sdk";
const rdsdataservice = new AWS.RDSDataService();
const ses = new AWS.SES();

// Import Other Util Packages
const randomize = require("randomatic");

// Importing Types
import {
	PlatformApiResponse,
	EnvironmentVariablesObject,
} from "../../utils/types";
import { SendEmailRequest } from "aws-sdk/clients/ses";

export default async (
	email: string,
	{
		secretArn,
		resourceArn,
		database,
		source_email,
	}: EnvironmentVariablesObject
): Promise<PlatformApiResponse> => {
	source_email = source_email.trim();
	email = email.trim();
	//===================================================================
	// Check if Email is provided properly
	//===================================================================
	if (!email || email === "")
		return {
			error: {
				status_code: 400,
				message: "Bad Request: Email is missing.",
			},
		};

	//===================================================================
	// Validate email
	//===================================================================
	const isValidEmail = new RegExp(
		/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/
	);
	if (!email.match(isValidEmail)) {
		return {
			error: {
				status_code: 400,
				message: "Bad Request: Invalid email.",
			},
		};
	}

	//===================================================================
	// Generate Code Randomly
	//===================================================================
	const randomCode = randomize("Aa0", 6);
	//add 15 minutes to date
	var minutesToAdd = 15;
	var currentDates = new Date();
	var expiryDate = new Date(
		currentDates.getTime() + minutesToAdd * 60000
	).getTime();
	const currentDate = new Date().getTime();

	//===================================================================
	// Create Send Code Params
	//===================================================================
	const sqlParams = {
		secretArn,
		resourceArn,
		sql: `UPDATE user SET verification_code='${randomCode}',code_created_date=${currentDate},code_expiry_date=${expiryDate}, updated_date=${currentDate}, update_source='sendCode' WHERE email='${email}'`,
		database,
		includeResultMetadata: true,
	};

	try {
		// ============================================================================
		// Execute Update Query on RDS
		// ============================================================================
		const data = await rdsdataservice.executeStatement(sqlParams).promise();

		if (data.numberOfRecordsUpdated !== 1) {
			return {
				error: {
					status_code: 404,
					message: "Not Found: User with this email does not exist.",
				},
			};
		}

		// Email send from Address
		const sendEmailfrom: string = source_email;

		const sesParams: SendEmailRequest = {
			Destination: {
				ToAddresses: [email],
			},
			Message: {
				Body: {
					Html: {
						Data: `
            <!DOCTYPE html>
            <html lang="en">
			<head>
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<style>
			.card {
			  box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);
			  transition: 0.3s;
			  width: 80%;
			}
			
			.card:hover {
			  box-shadow: 0 8px 16px 0 rgba(0,0,0,0.2);
			}
			
			.container {
			  padding: 2px 16px;
			}
			</style>
			</head>
			<body>
			<div class="card">
			  <div class="container">
			  <h1>Verification code by Axiom</h1>
				<h3><b>Please verify</b></h3> 
				<p>Verification code is :<b>${randomCode}<b></p> 
			  </div>
			</div>
			</body>
            </html>
            `,
					},
				},
				Subject: {
					Data: "You email verification code",
				},
			},
			Source: sendEmailfrom,
		};

		await ses.sendEmail(sesParams).promise();

		return {
			success: {
				status_code: 200,
				message: "A verification code has been sent to your email.",
			},
		};
	} catch (err) {
		return {
			error: {
				status_code: 500,
				message: `Internal Service Error: Something went wrong in sending OTP.`,
			},
		};
	}
};
