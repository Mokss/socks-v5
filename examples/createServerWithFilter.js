import * as socks5 from '../index.js';

const setAddr = new Set(['tools.ietf.org', 'github.com', '2ip.ru']);

const server = socks5.createServer({
  filter(addr) {
    const result = !setAddr.has(addr);
    if (!result) console.log(`Host ${addr} unreachable`);
    return result;
  },
});

server.listen(1080);

server.on('connect', (info) => console.log(`Connected to remote server at ${info.addr}:${info.port}`));

server.on('listening', () => {
  console.log(
    `Server listening ${server.address().address}:${server.address().port}`,
  );
});

server.on('connection', (socket) => {
  console.log('New socks connection', socket.remoteAddress, socket.remotePort);
});

// server.on('data', (data) => console.log(data));

server.on('error', (error) => {
  console.error(error);
});
