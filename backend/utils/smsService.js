const twilio = require('twilio');

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

let twilioClient = null;

const initializeTwilio = () => {
  // Use development mode if in dev environment OR if Twilio not configured
  if (isDevelopment) {
    console.log('📱 SMS Service: Development mode (Twilio disabled)');
    return null;
  }
  
  // Check if Twilio credentials exist
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('⚠️ Twilio credentials not found, using development mode');
    return null;
  }

  // Initialize Twilio client
  if (!twilioClient) {
    try {
      twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID, 
        process.env.TWILIO_AUTH_TOKEN
      );
      console.log('✅ Twilio SMS service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Twilio:', error.message);
      return null;
    }
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

    // Development Mode
    if (isDevelopment || !initializeTwilio()) {
      console.log('📱 SMS Service (Development Mode)');
      console.log(`📞 To: ${formattedNumber}`);
      console.log(`💬 Message: ${message}`);
      console.log('✅ SMS sent successfully (simulated)');
      
      return {
        success: true,
        messageId: `dev_${Date.now()}`,
        status: 'sent',
        to: formattedNumber,
        message: 'SMS sent in development mode',
        mode: 'development'
      };
    }

    // Production Mode - Send via Twilio
    const client = twilioClient;
    
    if (!client) {
      throw new Error('Twilio client not initialized');
    }

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
      message: 'SMS sent successfully',
      mode: 'production'
    };

  } catch (error) {
    console.error('❌ SMS sending failed:', error.message);
    
    // Fallback to development mode on error (only in dev)
    if (isDevelopment) {
      console.log('📱 Falling back to development mode');
      return {
        success: true,
        messageId: `dev_fallback_${Date.now()}`,
        status: 'sent',
        to: `+91${phoneNumber}`,
        message: 'SMS sent in development mode (fallback)',
        mode: 'development_fallback'
      };
    }
    
    // In production, return actual error
    return {
      success: false,
      error: error.message,
      message: 'Failed to send SMS',
      mode: 'production_error'
    };
  }
};

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
    case 'manual-review':
      message = `Your crop insurance claim ${documentId} is under manual review. We will update you within 2-3 business days.`;
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
  const hasCredentials = !!(
    process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_PHONE_NUMBER
  );

  return {
    isConfigured: hasCredentials,
    mode: isDevelopment ? 'development' : 'production',
    provider: 'Twilio',
    status: hasCredentials ? 'active' : 'development_mode',
    environment: process.env.NODE_ENV || 'development'
  };
};

// Initialize on module load
initializeTwilio();

module.exports = {
  sendSMS,
  sendOTP,
  sendClaimNotification,
  sendNotification,
  isValidPhoneNumber,
  getServiceStatus,
  initializeTwilio
};
