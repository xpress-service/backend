const nodemailer = require('nodemailer');
require('dotenv').config();

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
    tls: {
      rejectUnauthorized: false
    }
  });
};

const sendVerificationEmail = async (email, verificationToken, firstName, role = 'customer') => {
  try {
    console.log(`🔄 Attempting to send verification email to: ${email}`);
    console.log(`🔄 Using frontend URL: ${process.env.FRONTEND_URL}`);
    
    const transporter = createTransporter();
    
    // Test the connection first
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');
    
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
    
    console.log('📧 Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent successfully:', result.messageId);
    return true;
    
  } catch (error) {
    console.error('❌ Detailed error sending verification email:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    // More specific error messages
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed - check EMAIL_USER and EMAIL_PASSWORD');
    } else if (error.code === 'ENOTFOUND') {
      console.error('🌐 Network error - check internet connection');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏰ Timeout error - Gmail servers might be slow');
    }
    
    return false;
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
  sendVendorApprovalEmail,
  testEmailConnection
};