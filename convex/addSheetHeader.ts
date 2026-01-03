"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { google } from "googleapis";

// One-time action to add header row to Google Sheet
export const addHeaderRow = action({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async () => {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS!);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = "1Wj5nqFcd6isnTA_FTgyA7aTRU6tHfTJG3fGGEN15B6Y";

    // Insert header row at the top
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "List1!A1:E1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["name", "price", "sale_price", "store", "date"]],
      },
    });

    console.log("✅ Header row added successfully!");
    return { success: true };
  },
});
