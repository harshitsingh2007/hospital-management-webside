/**
 * smsService.js
 * -------------
 * Unified SMS Dispatch Service for Hex Visionaries AI Queue System.
 * Supports:
 *  1. Fast2SMS (Indian Mobile Numbers - Quick OTP Route)
 *  2. Twilio (International & Indian SMS)
 *  3. MSG91 (Indian DLT/OTP Route)
 *  4. Development Simulation Fallback (prints formatted OTP to terminal & returns dev_otp)
 */

const env = require("../config/env");

/**
 * Sends a 6-digit OTP SMS to the given phone number.
 *
 * @param {string} phone - Target phone number
 * @param {string} otp - 6-digit numeric OTP code
 * @param {string} [hospitalName] - Optional hospital branding name
 * @returns {Promise<{ success: boolean, simulated: boolean, provider: string, message: string }>}
 */
async function sendOtpSms(phone, otp, hospitalName = "City General Hospital") {
  const cleanDigits = String(phone || "").replace(/\D/g, "");
  const target10 = cleanDigits.slice(-10);

  if (!target10 || target10.length !== 10) {
    console.warn(`[SMS Service] Warning: Phone number ${phone} does not appear to be a standard 10-digit number.`);
  }

  const messageText = `Your OTP for ${hospitalName} patient portal is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;

  // 1. Check for Fast2SMS (India)
  const fast2SmsKey = process.env.FAST2SMS_API_KEY || env.FAST2SMS_API_KEY;
  if (fast2SmsKey && fast2SmsKey.trim()) {
    try {
      console.log(`[SMS Service] Dispatching real SMS via Fast2SMS to +91 ${target10}...`);
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: fast2SmsKey.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variables_values: String(otp),
          route: "otp",
          numbers: target10,
        }),
      });

      let data = await response.json();
      if (!response.ok || data.return !== true) {
        // Fallback to GET query route
        const getUrl = `https://www.fast2sms.com/dev/bulkV2?variables_values=${encodeURIComponent(otp)}&route=otp&numbers=${encodeURIComponent(target10)}`;
        const getResp = await fetch(getUrl, {
          headers: { authorization: fast2SmsKey.trim() },
        });
        if (getResp.ok) {
          const getData = await getResp.json();
          if (getData.return === true || getData.status_code === 200) {
            data = getData;
          }
        }
      }

      if (data.return === true || data.status_code === 200) {
        console.log(`[SMS Service] ✓ SMS successfully sent via Fast2SMS to ${target10}`);
        return {
          success: true,
          simulated: false,
          provider: "fast2sms",
          message: `SMS delivered to +91 ${target10}`,
        };
      } else {
        console.error("[SMS Service] Fast2SMS dispatch failed:", data);
      }
    } catch (err) {
      console.error("[SMS Service] Error calling Fast2SMS API:", err.message);
    }
  }

  // 2. Check for Twilio
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN || env.TWILIO_AUTH_TOKEN;
  const twilioVerifySid = process.env.TWILIO_VERIFY_SERVICE_SID || env.TWILIO_VERIFY_SERVICE_SID;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER || env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioToken) {
    const formattedTo = cleanDigits.startsWith("91") && cleanDigits.length === 12
      ? `+${cleanDigits}`
      : `+91${target10}`;

    // 2a. Priority: Twilio Verify Service (Bypasses Indian trial template restrictions)
    if (twilioVerifySid) {
      try {
        console.log(`[SMS Service] Dispatching real SMS via Twilio Verify (${twilioVerifySid}) to ${formattedTo}...`);
        const verifyUrl = `https://verify.twilio.com/v2/Services/${twilioVerifySid}/Verifications`;
        const params = new URLSearchParams();
        params.append("To", formattedTo);
        params.append("Channel", "sms");

        const response = await fetch(verifyUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const data = await response.json();
        if (response.ok && (data.status === "pending" || data.sid)) {
          console.log(`[SMS Service] ✓ SMS successfully dispatched via Twilio Verify (SID: ${data.sid}) to ${formattedTo}`);
          return {
            success: true,
            simulated: false,
            provider: "twilio_verify",
            message: `SMS delivered via Twilio Verify to ${formattedTo}`,
          };
        } else {
          console.error("[SMS Service] Twilio Verify dispatch error:", data);
        }
      } catch (err) {
        console.error("[SMS Service] Error calling Twilio Verify API:", err.message);
      }
    }

    // 2b. Standard Twilio Messages API fallback
    if (twilioFrom) {
      try {
        console.log(`[SMS Service] Dispatching real SMS via Twilio Messages to ${formattedTo}...`);
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

        const params = new URLSearchParams();
        params.append("To", formattedTo);
        params.append("From", twilioFrom);
        params.append("Body", messageText);

        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const data = await response.json();
        if (response.ok && data.sid) {
          console.log(`[SMS Service] ✓ SMS successfully sent via Twilio (SID: ${data.sid}) to ${formattedTo}`);
          return {
            success: true,
            simulated: false,
            provider: "twilio",
            message: `SMS delivered via Twilio to ${formattedTo}`,
          };
        } else {
          console.error("[SMS Service] Twilio dispatch failed:", data);
        }
      } catch (err) {
        console.error("[SMS Service] Error calling Twilio API:", err.message);
      }
    }
  }

  // 3. Check for MSG91
  const msg91AuthKey = process.env.MSG91_AUTH_KEY || env.MSG91_AUTH_KEY;
  const msg91TemplateId = process.env.MSG91_TEMPLATE_ID || env.MSG91_TEMPLATE_ID;

  if (msg91AuthKey && msg91TemplateId) {
    try {
      console.log(`[SMS Service] Dispatching real SMS via MSG91 to +91${target10}...`);
      const msg91Url = `https://control.msg91.com/api/v5/otp?template_id=${msg91TemplateId}&mobile=91${target10}&authkey=${msg91AuthKey}&otp=${otp}`;
      const response = await fetch(msg91Url, { method: "POST" });
      const data = await response.json();
      if (response.ok && data.type === "success") {
        console.log(`[SMS Service] ✓ SMS successfully sent via MSG91 to 91${target10}`);
        return {
          success: true,
          simulated: false,
          provider: "msg91",
          message: `SMS delivered via MSG91 to +91 ${target10}`,
        };
      } else {
        console.error("[SMS Service] MSG91 dispatch failed:", data);
      }
    } catch (err) {
      console.error("[SMS Service] Error calling MSG91 API:", err.message);
    }
  }

  // 4. Development Simulation Fallback
  // When no commercial telecom gateway is configured, print the OTP clearly to terminal
  console.log("\n================================================================================");
  console.log("📲 [TELECOM SMS DISPATCH SIMULATION]");
  console.log(`   Recipient Mobile: +91 ${target10}`);
  console.log(`   One-Time Password (OTP): [ ${otp} ]`);
  console.log(`   Message Text: "${messageText}"`);
  console.log("   Status: SIMULATED (Displayed on Staff Desk & Ticket Pass Slip)");
  console.log("   TIP: To deliver real SMS to physical mobile phones, add FAST2SMS_API_KEY");
  console.log("        or TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN in backend/.env");
  console.log("================================================================================\n");

  return {
    success: true,
    simulated: true,
    provider: "simulation",
    otp,
    message: `Verification code [${otp}] generated for +91 ${target10}. (Simulated mode: shown on desk screen & ticket pass)`,
  };
}

/**
 * Validates OTP against Twilio Verify service if active.
 */
async function verifyTwilioOtp(phone, code) {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN || env.TWILIO_AUTH_TOKEN;
  const twilioVerifySid = process.env.TWILIO_VERIFY_SERVICE_SID || env.TWILIO_VERIFY_SERVICE_SID;

  if (!twilioSid || !twilioToken || !twilioVerifySid) return false;

  const cleanDigits = String(phone || "").replace(/\D/g, "");
  const target10 = cleanDigits.slice(-10);
  const formattedTo = cleanDigits.startsWith("91") && cleanDigits.length === 12
    ? `+${cleanDigits}`
    : `+91${target10}`;

  try {
    const checkUrl = `https://verify.twilio.com/v2/Services/${twilioVerifySid}/VerificationCheck`;
    const params = new URLSearchParams();
    params.append("To", formattedTo);
    params.append("Code", String(code).trim());

    const response = await fetch(checkUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();
    return Boolean(data.valid === true || data.status === "approved");
  } catch (e) {
    console.error("[SMS Service] Error verifying Twilio OTP:", e.message);
    return false;
  }
}

module.exports = {
  sendOtpSms,
  verifyTwilioOtp,
};

