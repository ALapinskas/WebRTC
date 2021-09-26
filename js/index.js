'use strict';

let isChannelReady = false,
    isInitiator = false,
    isStarted = false,
    pc,
    startTime = null,
    localStream, 
    remoteStream, 
    localPeerConnection, 
    remotePeerConnection;

let startButton, 
    callButton, 
    hangupButton, 
    localVideo,
    remoteVideo,
    roomName;

const mediaConstraints = { video: true },
        offerOptions     = { offerToReceiveVideo: 1 };

// Sets the MediaStream as the video element src.
function gotLocalMediaStream(mediaStream) {
    localVideo.srcObject = mediaStream;
    localStream = mediaStream;
    console.log('Received local stream.');
    callButton.disabled = false;  // Enable call button.
}

// Handles error by logging a message to the console.
function handleLocalMediaStreamError(error) {
    console.log(`navigator.getUserMedia error: ${error.toString()}.`);
}

// Handles remote MediaStream success by adding it as the remoteVideo src.
function gotRemoteMediaStream(event) {
    const mediaStream = event.stream;
    remoteVideo.srcObject = mediaStream;
    remoteStream = mediaStream;
    console.log('Remote peer connection received remote stream.');
}

// Connects with new peer candidate.
function handleConnection(event) {
    const peerConnection = event.target;
    const iceCandidate = event.candidate;

    if (iceCandidate) {
        const newIceCandidate = new RTCIceCandidate(iceCandidate);
        const otherPeer = getOtherPeer(peerConnection);

        otherPeer.addIceCandidate(newIceCandidate)
            .then(() => {
                handleConnectionSuccess(peerConnection);
            }).catch((error) => {
                handleConnectionFailure(peerConnection, error);
            });

        console.log(`${getPeerName(peerConnection)} ICE candidate:\n` +
                `${event.candidate.candidate}.`);
    }
}

// Logs that the connection succeeded.
function handleConnectionSuccess(peerConnection) {
    console.log(`${getPeerName(peerConnection)} addIceCandidate success.`);
}

// Logs that the connection failed.
function handleConnectionFailure(peerConnection, error) {
    console.log(`${getPeerName(peerConnection)} failed to add ICE Candidate:\n`+
        `${error.toString()}.`);
}

// Logs changes to the connection state.
function handleConnectionChange(event) {
    const peerConnection = event.target;
    console.log('ICE state change event: ', event);
    console.log(`${getPeerName(peerConnection)} ICE state: ` +
        `${peerConnection.iceConnectionState}.`);
}

// Logs error when setting session description fails.
function setSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}.`);
}

// Logs success when setting session description.
function setDescriptionSuccess(peerConnection, functionName) {
    const peerName = getPeerName(peerConnection);
    console.log(`${peerName} ${functionName} complete.`);
}

// Logs success when localDescription is set.
function setLocalDescriptionSuccess(peerConnection) {
    setDescriptionSuccess(peerConnection, 'setLocalDescription');
}

// Logs success when remoteDescription is set.
function setRemoteDescriptionSuccess(peerConnection) {
    setDescriptionSuccess(peerConnection, 'setRemoteDescription');
}

// Logs offer creation and sets peer connection session descriptions.
function createdOffer(description) {
    console.log(`Offer from localPeerConnection:\n${description.sdp}`);

    console.log('localPeerConnection setLocalDescription start.');
    localPeerConnection.setLocalDescription(description)
    .then(() => {
        setLocalDescriptionSuccess(localPeerConnection);
    }).catch(setSessionDescriptionError);

    console.log('remotePeerConnection setRemoteDescription start.');
    remotePeerConnection.setRemoteDescription(description)
    .then(() => {
        setRemoteDescriptionSuccess(remotePeerConnection);
    }).catch(setSessionDescriptionError);

    console.log('remotePeerConnection createAnswer start.');
    remotePeerConnection.createAnswer()
    .then(createdAnswer)
    .catch(setSessionDescriptionError);
}

// Logs answer to offer creation and sets peer connection session descriptions.
function createdAnswer(description) {
    console.log(`Answer from remotePeerConnection:\n${description.sdp}.`);

    console.log('remotePeerConnection setLocalDescription start.');
    remotePeerConnection.setLocalDescription(description)
    .then(() => {
        setLocalDescriptionSuccess(remotePeerConnection);
    }).catch(setSessionDescriptionError);

    console.log('localPeerConnection setRemoteDescription start.');
    localPeerConnection.setRemoteDescription(description)
    .then(() => {
        setRemoteDescriptionSuccess(localPeerConnection);
    }).catch(setSessionDescriptionError);
}

// Handles start button action: creates local MediaStream.
function startAction() {
    startButton.disabled = true;
    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(gotLocalMediaStream).catch(handleLocalMediaStreamError);
    console.log('Requesting local stream.');
}

// Handles call button action: creates peer connection.
function callAction() {
    callButton.disabled = true;
    hangupButton.disabled = false;

    console.log('Starting call.');
    startTime = window.performance.now();

    // Get local media stream tracks.
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();
    if (videoTracks.length > 0) {
        console.log(`Using video device: ${videoTracks[0].label}.`);
    }
    if (audioTracks.length > 0) {
        console.log(`Using audio device: ${audioTracks[0].label}.`);
    }

    const servers = null;  // Allows for RTC server configuration.

    // Create peer connections and add behavior.
    localPeerConnection = new RTCPeerConnection(servers);
    console.log('Created local peer connection object localPeerConnection.');

    localPeerConnection.addEventListener('icecandidate', handleConnection);
    localPeerConnection.addEventListener(
        'iceconnectionstatechange', handleConnectionChange);

    remotePeerConnection = new RTCPeerConnection(servers);
    console.log('Created remote peer connection object remotePeerConnection.');

    remotePeerConnection.addEventListener('icecandidate', handleConnection);
    remotePeerConnection.addEventListener(
        'iceconnectionstatechange', handleConnectionChange);
    remotePeerConnection.addEventListener('addstream', gotRemoteMediaStream);

    // Add local stream to connection and create offer to connect.
    localPeerConnection.addStream(localStream);
    console.log('Added local stream to localPeerConnection.');

    console.log('localPeerConnection createOffer start.');
    localPeerConnection.createOffer(offerOptions)
        .then(createdOffer).catch(setSessionDescriptionError);
}

// Handles hangup action: ends up call, closes connections and resets peers.
function hangupAction() {
    localPeerConnection.close();
    remotePeerConnection.close();
    localPeerConnection = null;
    remotePeerConnection = null;
    hangupButton.disabled = true;
    callButton.disabled = false;
    console.log('Ending call.');
}

function sendMessage(message) {
    console.log('Client sending message: ', message);
    socket.emit('message', message);
}

function gotStream(stream) {
    console.log('Adding local stream.');
    localStream = stream;
    localVideo.srcObject = stream;
    sendMessage('got user media');
    if (isInitiator) {
        startCall();
    }
}

function startCall() {
    console.log('>>>>>>> startCall() ', isStarted, localStream, isChannelReady);
    if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
        console.log('>>>>>> creating peer connection');
        createPeerConnection();
        pc.addStream(localStream);
        isStarted = true;
        console.log('isInitiator', isInitiator);
        if (isInitiator) {
            doCall();
        }
    }
}
function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(null);
        pc.onicecandidate = handleIceCandidate;
        pc.onaddstream = handleRemoteStreamAdded;
        pc.onremovestream = handleRemoteStreamRemoved;
        console.log('Created RTCPeerConnnection');
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}

function handleIceCandidate(event) {
    console.log('icecandidate event: ', event);
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

function doCall() {
    console.log('Sending offer to peer');
    pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer().then(
        setLocalAndSendMessage,
        onCreateSessionDescriptionError
    );
}

function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
    console.log('Failed to create session description: ' + error.toString());
}

function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}

function hangup() {
    console.log('Hanging up.');
    stop();
    sendMessage('bye');
}

function handleRemoteHangup() {
    console.log('Session terminated.');
    stop();
    isInitiator = false;
}

function stop() {
    isStarted = false;
    pc.close();
    pc = null;
}

// helper functions.

function getOtherPeer(peerConnection) {
    return (peerConnection === localPeerConnection) ?
        remotePeerConnection : localPeerConnection;
}

function getPeerName(peerConnection) {
    return (peerConnection === localPeerConnection) ?
        'localPeerConnection' : 'remotePeerConnection';
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

        // Set up initial action buttons status: disable call and hangup.
        callButton.disabled = true;
        hangupButton.disabled = true;

        // Add click event handlers for buttons.
        startButton.addEventListener('click', startAction);
        callButton.addEventListener('click', callAction);
        hangupButton.addEventListener('click', hangupAction);

        /////////////////////////////////////////////

        var room = 'foo';
        // Could prompt for room name:
        room = prompt('Enter room name:');

        roomName.innerText = room;

        var socket = io('https://alfa-webrtc-signaling.herokuapp.com'/*'http://localhost:9000'*/, {withCredentials: true});

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

        ////////////////////////////////////////////////

        // This client receives a message
        socket.on('message', function(message) {
            console.log('SERVER SIGNALING: Client received message:', message);
            if (message === 'got user media') {
                startCall();
            } else if (message.type === 'offer') {
                if (!isInitiator && !isStarted) {
                    startCall();
                }
                pc.setRemoteDescription(new RTCSessionDescription(message));
                doAnswer();
            } else if (message.type === 'answer' && isStarted) {
                pc.setRemoteDescription(new RTCSessionDescription(message));
            } else if (message.type === 'candidate' && isStarted) {
                var candidate = new RTCIceCandidate({
                    sdpMLineIndex: message.label,
                    candidate: message.candidate
                });
                pc.addIceCandidate(candidate);
            } else if (message === 'bye' && isStarted) {
                handleRemoteHangup();
            }
        });

        ////////////////////////////////////////////////////

        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
        })
        .then(gotStream)
        .catch(function(e) {
            alert('getUserMedia() error: ' + e.name);
        });

        window.onbeforeunload = function() {
            sendMessage('bye');
        };
    }
};
