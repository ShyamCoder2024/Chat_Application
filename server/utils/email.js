const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1) Create a transporter
    // For Development (No real email), we can just log unless credentials are provided
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log("⚠️ EMAIL_USER or EMAIL_PASS not set. Logging email instead.");
        console.log(`📧 EMAIL TO: ${options.email}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Message: ${options.message}`);
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'Gmail', // Or custom host/port
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // 2) Define the email options
    const mailOptions = {
        from: 'MeetPune Support <support@meetpune.com>',
        to: options.email,
        subject: options.subject,
        text: options.message,
        // html: options.html
    };

    // 3) Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
