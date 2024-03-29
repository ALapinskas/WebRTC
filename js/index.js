'use strict';

let isChannelReady = false,
    isInitiator = false,
    isStarted = false,
    socket,
    pc,
    startTime = null,
    localStream, 
    remoteStream,
    signalingServer = 'https://webrtc-server.1090103-cq86606.tmweb.ru:9009'/*'http://localhost:9000'*/;

let startButton, 
    callButton, 
    hangupButton, 
    localVideo,
    remoteVideo,
    roomName,
    serviceMessages;

const mediaConstraints = { video: true },
        offerOptions     = { offerToReceiveVideo: 1 };

function startAction() {
    startButton.disabled = true;
    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(function(mediaStream) {
            localVideo.srcObject = mediaStream;
            localStream = mediaStream;
            sendMessage('got user media');
            callButton.disabled = false;
            if (isInitiator) {
                initiateCall();
            }
        }).catch((err) => {
            if(err.name === "NotFoundError") {
                console.error("cannot find video device");
                alert("cannot find video device");
            } else if(err.name === "NotAllowedError" || err.name === "NotReadableError"){
                console.error("cannot access to video device");
                alert("cannot access to video device");
            } else {
                console.error("Error getting media devices: " + err.name + ", " + err.code);
                alert("unknown error");
            }
        });
}

function sendMessage(message) {
    socket.emit('message', message);
}

function initiateCall() {
    if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
        callButton.disabled = true;
        hangupButton.disabled = false;
        createPeerConnection();
        for (const track of localStream.getTracks()) {
            pc.addTrack(track, localStream);
        }
        isStarted = true;
        console.log('isInitiator', isInitiator);
        if (isInitiator) {
            startCall();
        }
    } else if (isChannelReady === false) {
        console.warn("Didn't received signaling server response, yet. Probably there is no other participants to start the call, or signaling server is down.");
    }
}
function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(null);
        pc.onicecandidate = handleIceCandidate;
        pc.ontrack = handleRemoteStreamAdded;
        pc.onremovetrack = handleRemoteStreamRemoved;
    } catch (e) {
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

function handleIceCandidate(event) {
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    } else {
        console.log('End of candidates.');
    }
}

function handleCreateOfferError(event) {
    console.log('createOffer() error: ', event);
}

function startCall() {
    pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function createAnswer() {
    pc.createAnswer().then(
        setLocalAndSendMessage,
        onCreateSessionDescriptionError
    );
}

function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
    console.log('Failed to create session description: ' + error.toString());
}

function handleRemoteStreamAdded(event) {
    console.log('handle remote stream added');
    console.log(event);
    if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = event.streams[0];
    } else {
        let inboundStream = new MediaStream(event.track);
        remoteVideo.srcObject = inboundStream;
        remoteStream = inboundStream;
    }
}

function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}

function hangup() {
    hangupButton.disabled = true;
    callButton.disabled = false;
    stop();
    sendMessage('disconnect');
}

function handleRemoteHangup() {
    stop();
    isInitiator = false;
}

function stop() {
    isStarted = false;
    if(pc) {
        pc.close();
        pc = null;
    }
}

document.onreadystatechange = function () {
    if (document.readyState == "interactive") {
        // Define action buttons.
        startButton = document.getElementById('startButton');
        callButton = document.getElementById('callButton');
        hangupButton = document.getElementById('hangupButton');
        roomName = document.getElementById('url');

        localVideo = document.querySelector('#localVideo');
        remoteVideo = document.querySelector('#remoteVideo');

        serviceMessages = document.getElementById('service_messages');
        callButton.disabled = true;
        hangupButton.disabled = true;

        startButton.addEventListener('click',  startAction);
        callButton.addEventListener('click', initiateCall);
        hangupButton.addEventListener('click', hangup);

        var room = 'default';
        
        room = prompt('Enter room name:');

        roomName.innerText = room;

        socket = io(signalingServer, {withCredentials: true});

        if (room !== '') {
            socket.emit('create or join', room);
            console.log('CLIENT SOCKET: Attempted to create or  join room', room);
        }

        socket.on('created', function(room) {
            console.log('CLIENT SOCKET: Created room ' + room);
            isInitiator = true;
        });

        socket.on('full', function(room) {
            console.log('CLIENT SOCKET: Room ' + room + ' is full');
        });

        socket.on('join', function (room){
            console.log('CLIENT SOCKET: Another peer made a request to join room ' + room);
            console.log('CLIENT SOCKET: This peer is the initiator of room ' + room + '!');
            isChannelReady = true;
        });

        socket.on('joined', function(room) {
            console.log('CLIENT SOCKET: joined: ' + room);
            isChannelReady = true;
        });

        socket.on('log', function(array) {
            console.log.apply(console, array);
        });

        socket.on('message', function(message) {
            console.log('SERVER SIGNALING: Client received message:', message);
            if (message === 'got user media') {
                initiateCall();
            } else if (message.type === 'offer') {
                if (localStream === undefined && !isStarted) {
                    createPeerConnection();
                }
                if (!isInitiator && !isStarted) {
                    initiateCall();
                }
                
                pc.setRemoteDescription(new RTCSessionDescription(message));
                createAnswer();
            } else if (message.type === 'answer' && isStarted) {
                pc.setRemoteDescription(new RTCSessionDescription(message));
            } else if (message.type === 'candidate' && isStarted) {
                var candidate = new RTCIceCandidate({
                    sdpMLineIndex: message.label,
                    candidate: message.candidate
                });
                pc.addIceCandidate(candidate);
            } else if (message === 'disconnect' && isStarted) {
                handleRemoteHangup();
            }
        });

        window.onbeforeunload = function() {
            sendMessage('disconnect');
        };
    }
};
