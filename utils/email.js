const nodemailer = require('nodemailer');
const pug = require('pug');
const { convert } = require('html-to-text');

module.exports = class Email {
  //send the actual email
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Moustafa Aboulazm <${process.env.EMAIL_FROM}>`;
  }
  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      //sendgrid
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
        
        // Activate in gmail "less secure app" option
        // https://myaccount.google.com/lesssecureapps
        // https://support.google.com/accounts/answer/6010255
        // https://support.google.com/accounts/answer/185833?hl=en
      });
    }
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: 25,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  //send the actual email
  async send(template, subject) {
    //render html based on pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });
    //define mail option
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html),
    };
    // create a transport and send email
    const transporter = this.newTransport();
    await transporter.sendMail(mailOptions);
  }
  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family');
  }
  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)',
    );
  }
};

/* // function to send email
const sendEmail = async (options) => {
  //create transporter
  let transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 25,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  // define mail options
  const mailOptions = {
    from: 'Moustafa Aboulazm <aboulazm@10.io>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };
  // send mail
  await transporter.sendMail(mailOptions);
};
module.exports = sendEmail;
 */
