const nodemailer = require("nodemailer");

// 使用async..await 创建执行函数
async function main() {
  // 如果你没有一个真实邮箱的话可以使用该方法创建一个测试邮箱
  let testAccount = await nodemailer.createTestAccount();

  // 创建Nodemailer传输器 SMTP 或者 其他 运输机制
  let transporter = nodemailer.createTransport(require('../../setting/rtmailer_setting.json'));

  // 定义transport对象并发送邮件
  let info = await transporter.sendMail({
    from: '"仰望者" <lauolee@qq.com>', // 发送方邮箱的账号
    to: "lauolee@qq.com, lauolee@qq.com", // 邮箱接受者的账号
    cc:"lauolee@qq.com",
    subject: "今天天气不错，又是美好的一天，欢迎使用新式邮箱通知", // Subject line
    text: "H5-Dooring?", // 文本内容
    html: "欢迎注册xxx.xxx.xxxxxx.xx, 您的邮箱验证码是:<b>1jtner</b>", // html 内容, 如果设置了html内容, 将忽略text内容
    attachments: [
      {   // utf-8 string as an attachment
          filename: 'text1.txt',
          content: 'hello world!'
      },
      {   // binary buffer as an attachment
          filename: 'text2.txt',
          content: new Buffer('hello world!','utf-8')
      },
      {   // file on disk as an attachment
          filename: 'text3.txt',
          path: '../../setting/rtmailer_setting.json' // stream this file
      },
      {   // filename and content type is derived from path
          path: '../../setting/rtmailer_setting.json'
      },
      {   // stream as an attachment
          filename: 'text4.txt',
          content: require('fs').createReadStream('../../setting/rtmailer_setting.json')
      },
      {   // define custom content type for the attachment
          filename: 'text.bin',
          content: 'hello world!',
          contentType: 'text/plain'
      },
      // {   // use URL as an attachment
      //     filename: 'license.txt',
      //     path: 'https://raw.github.com/nodemailer/nodemailer/master/LICENSE'
      // },
      {   // encoded string as an attachment
          filename: 'text1.txt',
          content: 'aGVsbG8gd29ybGQh',
          encoding: 'base64'
      },
      {   // data uri as an attachment
          path: 'data:text/plain;base64,aGVsbG8gd29ybGQ='
      },
      {
          // use pregenerated MIME node
          raw: 'Content-Type: text/plain\r\n' +
               'Content-Disposition: attachment;\r\n' +
               '\r\n' +
               'Hello world!'
      }
  ]
  });
  console.log('send-result-info:',info)
}

main().catch(console.error);