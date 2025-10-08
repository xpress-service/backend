const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Set up SendGrid as backup
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const createTransporter = () => {
  // Log environment variables for debugging (hide sensitive parts)
  console.log('Email configuration check:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Missing');
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Set' : 'Missing');
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'Missing');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email configuration missing: EMAIL_USER and EMAIL_PASSWORD are required');
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    secure: true,
    connectionTimeout: 10000, // 10 seconds timeout
    greetingTimeout: 5000,    // 5 seconds greeting timeout
    socketTimeout: 10000,     // 10 seconds socket timeout
    tls: {
      rejectUnauthorized: false
    }
  });
};

// SendGrid fallback function
const sendVerificationEmailSendGrid = async (email, verificationToken, firstName, role = 'customer') => {
  try {
    console.log(`� Attempting SendGrid fallback for: ${email}`);
    
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://servicexpress-tau.vercel.app'}/verify-email?token=${verificationToken}`;
    
    const msg = {
      to: email,
      from: {
        email: process.env.EMAIL_USER || 'servixpress247@gmail.com',
        name: 'ServiceXpress'
      },
      subject: 'Verify Your Email - ServiceXpress',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background-color: #667eea; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">ServiceXpress</h1>
          </div>
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>Welcome ${firstName}!</h2>
            <p>Please verify your email by clicking the link below:</p>
            <p><a href="${verificationUrl}" style="background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
            <p>Or copy and paste this link: <br><small>${verificationUrl}</small></p>
            <p><small>If you didn't create this account, please ignore this email.</small></p>
          </div>
        </div>
      `
    };
    
    await sgMail.send(msg);
    console.log('✅ Verification email sent via SendGrid');
    return true;
    
  } catch (error) {
    console.error('❌ SendGrid error:', error.message);
    console.error('SendGrid error details:', error.response ? error.response.body : 'No response details');
    
    if (error.code === 403 || error.message.includes('Forbidden')) {
      console.error('🔐 SendGrid Forbidden - Check:');
      console.error('1. Sender email verification (Settings → Sender Authentication)');
      console.error('2. API key permissions (Settings → API Keys)');
      console.error('3. Account verification status');
    }
    
    return false;
  }
};

const sendVerificationEmail = async (email, verificationToken, firstName, role = 'customer') => {
  console.log(`�🔄 Attempting to send verification email to: ${email}`);
  console.log(`🔄 Using frontend URL: ${process.env.FRONTEND_URL}`);
  
  // Try Gmail first
  try {
    const transporter = createTransporter();
    
    // Test the connection first with shorter timeout
    console.log('🔄 Testing Gmail SMTP connection...');
    await transporter.verify();
    console.log('✅ Gmail SMTP connection verified successfully');
    
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://servicexpress-tau.vercel.app'}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: {
        name: 'ServiceXpress',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Verify Your Email - ServiceXpress',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background-color: #667eea; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">ServiceXpress</h1>
          </div>
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>Welcome ${firstName}!</h2>
            <p>Please verify your email by clicking the link below:</p>
            <p><a href="${verificationUrl}" style="background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
            <p>Or copy and paste this link: <br><small>${verificationUrl}</small></p>
            <p><small>If you didn't create this account, please ignore this email.</small></p>
          </div>
        </div>
      `
    };
    
    console.log('📧 Sending email via Gmail SMTP...');
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent successfully via Gmail:', result.messageId);
    return true;
    
  } catch (gmailError) {
    console.error('❌ Gmail failed, trying SendGrid fallback...');
    console.error('Gmail error:', gmailError.code, gmailError.message);
    
    // Fallback to SendGrid if Gmail fails
    if (process.env.SENDGRID_API_KEY) {
      console.log('� Switching to SendGrid...');
      return await sendVerificationEmailSendGrid(email, verificationToken, firstName, role);
    } else {
      console.error('❌ No SendGrid API key configured, email sending failed');
      return false;
    }
  }
};

const sendVendorApprovalEmail = async (email, firstName, isApproved, rejectionReason = null) => {
  try {
    const transporter = createTransporter();
    const subject = isApproved ? 'Vendor Application Approved!' : 'Vendor Application Status';
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background-color: ${isApproved ? '#28a745' : '#dc3545'}; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">ServiceXpress</h1>
          </div>
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2>${isApproved ? 'Congratulations!' : 'Application Update'}</h2>
            <p>Dear ${firstName},</p>
            <p>Your vendor application has been ${isApproved ? 'approved' : 'reviewed'}.</p>
            ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
            <p>Best regards,<br>ServiceXpress Team</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Vendor email sent to: ${email}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error sending vendor email:', error.message);
    return false;
  }
};

// Test email function for debugging
const testEmailConnection = async () => {
  try {
    console.log('🧪 Testing email configuration...');
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email connection test successful');
    return { success: true, message: 'Email connection verified' };
  } catch (error) {
    console.error('❌ Email connection test failed:', error.message);
    return { success: false, error: error.message, code: error.code };
  }
};

module.exports = {
  sendVerificationEmail,
  sendVerificationEmailSendGrid,
  sendVendorApprovalEmail,
  testEmailConnection
};