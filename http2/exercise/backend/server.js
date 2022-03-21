import http2 from "http2";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import handler from "serve-handler";
import nanobuffer from "nanobuffer";

let connections = [];

const msg = new nanobuffer(50);
const getMsgs = () => Array.from(msg).reverse();

msg.push({
  user: "brian",
  text: "hi",
  time: Date.now(),
});

// the two commands you'll have to run in the root directory of the project are
// (not inside the backend folder)
//
// openssl req -new -newkey rsa:2048 -new -nodes -keyout key.pem -out csr.pem
// openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out server.crt
//
// http2 only works over HTTPS
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = http2.createSecureServer({
  cert: fs.readFileSync(path.join(__dirname, "/../server.crt")),
  key: fs.readFileSync(path.join(__dirname, "/../key.pem")),
});

/*
 *
 * Code goes here
 *
 */

server.on("stream", (stream, headers) => {
  const path = headers[":path"];
  const method = headers[":method"];
  //stream is open for every request from web browser 
  if(path === "/msgs" && method === "GET") {
    try {
        //reply with 200 OK and encodings
         console.log("connected a stream "+ stream.id);
         stream.respond({
           ":status": 200,
           "content-type": "text/plain; charset=utf-8",
         })
    
         //write the first response
         stream.write(JSON.stringify({msg: getMsgs()}));

         connections.push(stream);
    } catch (e) {
      console.error(e);
      connections = connections.filter(s=> s !== stream);
    }
     stream.on("close", () => {
       console.log("disconnected "+stream.id);
     });
  }

});

server.on("request", async (req, res) => {
  const path = req.headers[":path"];
  const method = req.headers[":method"];

  if (path !== "/msgs") {
    // handle the static assets
    return handler(req, res, {
      public: "./frontend",
    });
  } else if (method === "POST") {
    // get data out of post
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const data = Buffer.concat(buffers).toString();
    const { user, text } = JSON.parse(data);

    msg.push({
      user,
      text,
      time: Date.now(),
    });
    res.end();

    connections.forEach( (stream) => {
      stream.write(JSON.stringify({ msg: getMsgs()}));
    })
  }
});

// start listening
const port = process.env.PORT || 8080;
server.listen(port, () =>
  console.log(
    `Server running at https://localhost:${port} - make sure you're on httpS, not http`
  )
);
