// Alternative email service using SendGrid (more reliable for production)
const sgMail = require('@sendgrid/mail');

// Set up SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendVerificationEmailSendGrid = async (email, verificationToken, firstName, role = 'customer') => {
  try {
    console.log(`🔄 Sending verification email via SendGrid to: ${email}`);
    
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://servicexpress-tau.vercel.app'}/verify-email?token=${verificationToken}`;
    
    const msg = {
      to: email,
      from: {
        email: 'noreply@servicexpress.com', // Use your domain
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
    return false;
  }
};

module.exports = {
  sendVerificationEmailSendGrid
};