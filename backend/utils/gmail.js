const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: `"MediFind Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🏥 MediFind Admin Security OTP',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 550px; margin: 0 auto; padding: 30px; border: 1px solid rgba(0,0,0,0.05); border-radius: 16px; background-color: #0b1512; color: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #00FF7F; font-size: 1.8rem; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 1px;">MediFind Portal</h2>
          <p style="color: rgba(255,255,255,0.6); font-size: 0.9rem; margin-top: 5px;">Secure Verification Authority</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 25px; margin-bottom: 25px;">
          <p style="font-size: 1rem; line-height: 1.5; margin: 0 0 15px; color: rgba(255,255,255,0.85);">Hello Admin,</p>
          <p style="font-size: 0.95rem; line-height: 1.5; margin: 0 0 20px; color: rgba(255,255,255,0.7);">A login attempt has been initiated for your administrative console. Please use the following temporary 2FA verification code to authorize access:</p>
          
          <div style="font-size: 2.8rem; font-weight: 700; text-align: center; color: #00FF7F; padding: 15px; background: rgba(0, 255, 127, 0.08); border: 1px solid rgba(0, 255, 127, 0.2); border-radius: 8px; letter-spacing: 8px; font-family: monospace;">
            ${otp}
          </div>
          
          <p style="font-size: 0.8rem; color: rgba(255,255,255,0.4); text-align: center; margin-top: 15px; margin-bottom: 0;">This security code is active for 5 minutes. If you did not initiate this authorization, please secure your admin credentials immediately.</p>
        </div>
        
        <div style="text-align: center; font-size: 0.8rem; color: rgba(255,255,255,0.3); border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;">
          <p style="margin: 0;">This email is an automated system security notice. Do not reply to this address.</p>
          <p style="margin: 5px 0 0;">&copy; MediFind Healthcare SaaS Inc.</p>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};
