import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSocket, disconnectSocket } from '../../api/socketService';

interface RemoteStream {
  socketId: string;
  userName: string;
  stream: MediaStream;
}

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export const VideoCallPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);

  useEffect(() => {
    if (!user || !roomId) return;

    const socket = getSocket();

    // Get local media stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Join the room
        socket.emit('join-room', {
          roomId,
          userId: user.id,
          userName: user.name,
        });
        setIsConnected(true);
      })
      .catch((err) => {
        console.error('Failed to get media devices:', err);
        alert('Could not access camera/microphone. Please allow permissions.');
      });

    // ── Socket event handlers ──────────────────────────────────────────────

    // Existing users already in room — initiate offer to each
    socket.on('existing-users', async (users: { socketId: string; userName: string }[]) => {
      setParticipantCount((p) => p + users.length);
      for (const remoteUser of users) {
        await createOffer(remoteUser.socketId, remoteUser.userName);
      }
    });

    // New user joined — they will send us an offer
    socket.on('user-joined', ({ socketId, userName }: { socketId: string; userName: string }) => {
      setParticipantCount((p) => p + 1);
      console.log(`${userName} joined`);
    });

    // Received offer from another peer
    socket.on('offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(from, 'Remote User');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { to: from, answer });
    });

    // Received answer to our offer
    socket.on('answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Received ICE candidate
    socket.on('ice-candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // User left
    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      setRemoteStreams((prev) => prev.filter((s) => s.socketId !== socketId));
      setParticipantCount((p) => Math.max(1, p - 1));
    });

    return () => {
      cleanup();
    };
  }, [user, roomId]);

  // ── WebRTC helpers ─────────────────────────────────────────────────────

  const createPeerConnection = (socketId: string, userName: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[socketId] = pc;

    // Add local tracks to peer connection
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    // When we receive remote track
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStreams((prev) => {
        const exists = prev.find((s) => s.socketId === socketId);
        if (exists) return prev;
        return [...prev, { socketId, userName, stream: remoteStream }];
      });
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit('ice-candidate', { to: socketId, candidate: event.candidate });
      }
    };

    return pc;
  };

  const createOffer = async (socketId: string, userName: string) => {
    const pc = createPeerConnection(socketId, userName);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    getSocket().emit('offer', { to: socketId, offer });
  };

  // ── Controls ────────────────────────────────────────────────────────────

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        getSocket().emit('toggle-audio', { roomId, muted: !audioTrack.enabled });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        getSocket().emit('toggle-video', { roomId, videoOff: !videoTrack.enabled });
      }
    }
  };

  const endCall = () => {
    cleanup();
    navigate(-1);
  };

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    getSocket().emit('leave-room', { roomId });
    disconnectSocket();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-white font-semibold text-lg">Video Call</h1>
          <p className="text-gray-400 text-sm">Room: {roomId}</p>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <Users size={16} />
          <span className="text-sm">{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
          {isConnected && (
            <span className="ml-3 flex items-center gap-1 text-green-400 text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
              Connected
            </span>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4">
        <div className={`grid gap-4 h-full ${remoteStreams.length === 0 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {/* Local Video */}
          <div className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-sm">Camera Off</p>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
              {user?.name} (You)
              {isMuted && <span className="ml-2 text-red-400">🔇</span>}
            </div>
          </div>

          {/* Remote Videos */}
          {remoteStreams.map((remote) => (
            <div key={remote.socketId} className="relative bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center">
              <video
                autoPlay
                playsInline
                className="w-full h-full object-cover"
                ref={(el) => { if (el) el.srcObject = remote.stream; }}
              />
              <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white text-sm px-2 py-1 rounded">
                {remote.userName}
              </div>
            </div>
          ))}

          {/* Waiting for others */}
          {remoteStreams.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-500">
                <Users size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-lg">Waiting for others to join...</p>
                <p className="text-sm mt-1 opacity-70">Share Room ID: <span className="font-mono text-gray-300">{roomId}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-4 flex justify-center gap-4">
        <button
          onClick={toggleAudio}
          className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'}`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={22} className="text-white" /> : <Mic size={22} className="text-white" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-colors ${isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'}`}
          title={isVideoOff ? 'Turn On Camera' : 'Turn Off Camera'}
        >
          {isVideoOff ? <VideoOff size={22} className="text-white" /> : <Video size={22} className="text-white" />}
        </button>

        <button
          onClick={endCall}
          className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
          title="End Call"
        >
          <PhoneOff size={22} className="text-white" />
        </button>
      </div>
    </div>
  );
};