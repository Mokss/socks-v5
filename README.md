## Socks5 protocol

### Implementation of socks 5 version on node js

#### Does't support ipv6 address and udp/bind methods

## Installation

  ```
    npm install socks-v5
  ```

## TODO

  + ### IPV6 support
  + ### Add support UDP and BIND method

## Example 

### Create simple server
```javascript
const { createServer } = require("../index");

const server = createServer();

server.listen(1080); // any port
```

### Create server with authentication

``` javascript
const { createServer } = require("../index");

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
const { createServer }  = require("../index");

const setAddr = new Set(["tools.ietf.org", "github.com", "2ip.ru"]);

const server = createServer({
  filter(addr) {
    const result = !setAddr.has(addr); 
    if(!result) console.log(`host ${addr} unreachable`);
    return result;
  }
});
```

### __createServer(options)__

#### ```options``` - is an object that describes how to use a proxy server

 + #### ```timeout``` - type number, Sets the socket to timeout after timeout milliseconds of inactivity on the socket. By default net.Socket do not have a timeout.

 
