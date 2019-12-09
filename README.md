## Socks5 protocol

Implementation of socks 5 version on node js

Does't support ipv6 address and udp/bind methods

### Requirements

+ Node.js v10.0+

## Installation

  ```
    npm install socks-v5
  ```

## TODO

  + IPV6 support
  + Add support UDP and BIND method

## Server

### Create simple server
```javascript
const { createServer } = require("socks-proxy-v5");

const server = createServer();

server.listen(1080); // any port
```

### Create server with authentication

``` javascript
const { createServer } = require("socks-proxy-v5");

const server = createServer({
  authenticate(login, password) {
    // verify name/password
    if (login !== "foo" || password !== "bar") {
      console.log("authentication failed", login);
      return false; 
      // authentication failed
    }
    console.log(`user ${login} connect`);
    // return successful authentication
    return true;
  }
});

server.listen(1080);
```

### Create server with filter

```javascript
const { createServer }  = require("socks-proxy-v5");

const setAddr = new Set(["tools.ietf.org", "github.com", "2ip.ru"]);

const server = createServer({
  filter(addr) {
    const result = !setAddr.has(addr); 
    if(!result) console.log(`host ${addr} unreachable`);
    return result;
  }
});
```

### createServer(options)

```options``` - is an object that describes how to use a proxy server. (```optional```)

+ __timeout__ - type ```number```. Sets the socket to timeout after timeout milliseconds of inactivity on the socket. Default set 2 minute. If timeout is 0, then the existing idle timeout is disabled

  ```javascript 
  const { createServer }  = require("socks-proxy-v5");
  const server = createServer({
    timeout: 10000 // 10 second
  });
  ```
  After timeout the socket will be destroyed

+ __authenticate__(login, password) - type ```function```. Have two argument  type ```string```.Returns ```true``` if the user is authenticated, else ```false```  
You can make queries to the database, create arrays of data,  log users, you are limited only by your imagination.

+ __filter__(address) - type ```function```. Have one argument, type ```string```.  Returns ```true``` if the user has been filtered, else ```false```   
You can use regular expressions, iterating over an array, or using new data types as an example (new Set), queries to the data base

### Server Events  (```optional```)

+ __connect__   
Emitted when a socket connection is successfully established.
    ```javascript 
    server.on("connect", info =>
      console.log(`connected to remote server at ${info.addr}:${info.port}`)
    );
  ```

+ __connection__   
Emitted when a new connection is made. socket is an instance of net.Socket.
    ```javascript 
    server.on("connection", socket => {
      console.log("new socks connection", socket.remoteAddress, socket.remotePort);
    });
  ```

+ __error__   
  Emitted when an error occurs. 
    ```javascript   
    server.on("error", err => {
      console.error(`server ERROR ---> ${err}`);
    });
  ```

+ __data__   
Emitted when data is received. The argument data will be a Buffer or String.
    ```javascript 
    server.on("data", data => console.log(data));
    ```

+ __listening__  
Emitted when the server has been bound after calling server.listen().
  ```javascript 
  server.listen(1080);

  server.on("listening", () => {
    console.log(
      `server listening ${server.address().address}:${server.address().port}`
    );
  });
  ```

### server.listen(options) 

work like [server.listen()](https://nodejs.org/dist/latest-v12.x/docs/api/net.html#net_server_listen)

## Client

Most browsers, windows, linux, spotify, don`t  support socks5 protocol authentication.
I wrote a crutch as a local server that supports authentication. The client consumes no more than 30 MB, you can create a daemon for this process using node-windows for the Windows operating system or running pm2 startup for Linux. Then connect to your local server.

```javascript 
const { createClient } = require("socks-proxy-v5");

const setting = {
  host: "127.0.0.1", // your socks 5 server
  port: "1080", // port your server
  login: "foo",
  password: "bar"
};

const server = createClient(setting);
server.listen(1080);

server.on("listening", () => {
  console.log(
    `server listening ${server.address().address}:${server.address().port}`
  );
});

server.on("error", err => console.error(`Client Server Error ---> ${err}`));
```

See more [RFC1928](https://tools.ietf.org/html/rfc1928), [RFC1929](https://tools.ietf.org/html/rfc1929)  
[examples](https://github.com/MoksS/socks-v5/tree/master/examples)
