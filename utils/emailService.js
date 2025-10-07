const nodemailer = require('nodemailer');
require('dotenv').config();

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};


const sendVerificationEmail = async (email, verificationToken, firstName, role = 'customer') => {
  try {
    const transporter = createTransporter();
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
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
            <p><small>If you didn't create this account, please ignore this email.</small></p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent to:', email);
    return true;
    
  } catch (error) {
    console.error('❌ Error sending verification email:', error.message);
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

module.exports = {
  sendVerificationEmail,
  sendVendorApprovalEmail
};