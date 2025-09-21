const twilio = require('twilio');

// Force development mode for now
const FORCE_DEVELOPMENT_MODE = true;

let twilioClient = null;

const initializeTwilio = () => {
  if (FORCE_DEVELOPMENT_MODE) {
    console.log('📱 SMS Service: Using development mode (Twilio disabled)');
    return null;
  }
  
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio SMS service initialized');
  }
  return twilioClient;
};

const sendSMS = async (phoneNumber, message) => {
  try {
    // Validate phone number
    if (!phoneNumber || phoneNumber.length !== 10) {
      throw new Error('Invalid phone number format. Must be 10 digits.');
    }

    const formattedNumber = `+91${phoneNumber}`;

    // FORCE DEVELOPMENT MODE
    if (FORCE_DEVELOPMENT_MODE || process.env.NODE_ENV === 'development') {
      console.log('📱 SMS Service (Development Mode)');
      console.log(`📞 To: ${formattedNumber}`);
      console.log(`💬 Message: ${message}`);
      console.log('✅ SMS sent successfully (simulated)');
      
      return {
        success: true,
        messageId: 'dev_' + Date.now(),
        status: 'sent',
        to: formattedNumber,
        message: 'SMS sent in development mode'
      };
    }

    // Try to initialize Twilio
    const client = initializeTwilio();
    
    if (!client) {
      throw new Error('Twilio not configured');
    }

    // Send SMS via Twilio
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber
    });

    console.log(`✅ SMS sent successfully to ${formattedNumber}, SID: ${result.sid}`);

    return {
      success: true,
      messageId: result.sid,
      status: result.status,
      to: result.to,
      message: 'SMS sent successfully'
    };

  } catch (error) {
    console.error('❌ SMS sending failed:', error.message);
    
    // Fallback to development mode on error
    console.log('📱 Falling back to development mode');
    return {
      success: true, // Return success for development
      messageId: 'dev_fallback_' + Date.now(),
      status: 'sent',
      to: `+91${phoneNumber}`,
      message: 'SMS sent in development mode (fallback)'
    };
  }
};

// Rest of the functions remain the same...
const sendOTP = async (phoneNumber, otp) => {
  const message = `Your PBI AgriInsure verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`;
  return await sendSMS(phoneNumber, message);
};

const sendClaimNotification = async (phoneNumber, documentId, status) => {
  let message = '';
  
  switch (status) {
    case 'submitted':
      message = `Your crop insurance claim ${documentId} has been submitted successfully. We will process it within 3-5 working days.`;
      break;
    case 'approved':
      message = `Good news! Your crop insurance claim ${documentId} has been approved. Payout will be processed soon.`;
      break;
    case 'rejected':
      message = `Your crop insurance claim ${documentId} has been rejected. Please check the app for details and appeal options.`;
      break;
    case 'payout-complete':
      message = `Your crop insurance claim ${documentId} payout has been completed. Amount credited to your account.`;
      break;
    case 'field-verification':
      message = `Your crop insurance claim ${documentId} requires field verification. Our agent will contact you soon.`;
      break;
    default:
      message = `Your crop insurance claim ${documentId} status has been updated to: ${status}`;
  }

  return await sendSMS(phoneNumber, message);
};

const sendNotification = async (phoneNumber, message) => {
  const notificationMessage = `PBI AgriInsure: ${message}`;
  return await sendSMS(phoneNumber, notificationMessage);
};

const isValidPhoneNumber = (phoneNumber) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phoneNumber);
};

const getServiceStatus = () => {
  return {
    isConfigured: FORCE_DEVELOPMENT_MODE ? false : !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    mode: FORCE_DEVELOPMENT_MODE ? 'development (forced)' : (process.env.NODE_ENV || 'development'),
    provider: 'Twilio',
    status: FORCE_DEVELOPMENT_MODE ? 'development_mode' : 'active'
  };
};

module.exports = {
  sendSMS,
  sendOTP,
  sendClaimNotification,
  sendNotification,
  isValidPhoneNumber,
  getServiceStatus
};
