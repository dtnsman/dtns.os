const app = require('express')();

app.use(function (req, res, next) {
   res.header("Access-Control-Allow-Origin", "*");
   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
   next();
});

const server = require('http').createServer(app);
const port = 10010
server.listen(port, () => {
   console.log('http-server running on port ' + port);
});

const svgCaptcha = require('svg-captcha');
app.all('/q', function (req, res) {
    var data = svgCaptcha.create({size: 6, // size of random string
                ignoreChars: '0oO1li', // filter out some characters like 0o1i
                noise: 5, // number of noise lines
                // width:600, //150px default
                // height:200, //50px default
                color: true, // characters will have distinct colors instead of grey, true if background option is set
                background: '#f0f0f0', });
    console.log('captcha-data:',data);
    res.json(data)
});