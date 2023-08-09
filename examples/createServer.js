import { networkInterfaces } from 'os';
import { createServer } from '../index.js';

const server = createServer();

server.listen(1080);

server.on('connect', (info) => console.log(`Connected to remote server at ${info.addr}:${info.port}`));

server.on('listening', () => {
  console.log(networkInterfaces().en0);
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
