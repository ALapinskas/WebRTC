# WebRTC. WebRTC demonstration client + Signaling server

1. Generate keys
openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 -keyout key.pem -out cert.pem
2. Choose path for your signaling server in js/index.js setting signalingServer variable. 
To use local server set http://localhost:9000, and run: npm start, in separate window
3. Run client: npm start client