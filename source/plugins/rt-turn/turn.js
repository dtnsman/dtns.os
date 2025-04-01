const Turn = require('node-turn');
const server = new Turn({
  // set options
  authMech: 'long-term',
  credentials: {
    username: "password"
  }
});
server.start();
console.info('turn-server is running')