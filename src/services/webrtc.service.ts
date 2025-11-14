import { useAppStore } from '../store/useAppStore';

export class WebRTCService {
  private static instance: WebRTCService;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  async initializePeerConnection(isCaller: boolean): Promise<RTCPeerConnection> {
    this.peerConnection = new RTCPeerConnection(this.configuration);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
      if (remoteVideo && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', this.peerConnection?.connectionState);
      if (this.peerConnection?.connectionState === 'connected') {
        useAppStore.getState().setCallState({ state: 'connected' });
      } else if (this.peerConnection?.connectionState === 'disconnected' ||
                 this.peerConnection?.connectionState === 'failed') {
        this.endCall();
      }
    };

    return this.peerConnection;
  }

  async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Set local video element
    const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
    if (localVideo) {
      localVideo.srcObject = this.localStream;
    }

    useAppStore.getState().setLocalStream(this.localStream);
    return this.localStream;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(description));
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async sendIceCandidate(candidate: RTCIceCandidate) {
    const currentConversation = useAppStore.getState().currentConversation;
    if (!currentConversation) return;

    const candidateData = {
      type: 'ice_candidate',
      candidate: candidate
    };

    try {
      await currentConversation.send(JSON.stringify(candidateData));
    } catch (error) {
      console.error('Failed to send ICE candidate:', error);
    }
  }

  async sendCallOffer(callType: 'voice' | 'video', offer: RTCSessionDescriptionInit) {
    const currentConversation = useAppStore.getState().currentConversation;
    if (!currentConversation) throw new Error('No active conversation');

    const callData = {
      type: 'call_offer',
      callType,
      offer,
      timestamp: Date.now()
    };

    await currentConversation.send(JSON.stringify(callData));
  }

  async sendCallAnswer(answer: RTCSessionDescriptionInit) {
    const currentConversation = useAppStore.getState().currentConversation;
    if (!currentConversation) throw new Error('No active conversation');

    const answerData = {
      type: 'call_answer',
      answer,
      timestamp: Date.now()
    };

    await currentConversation.send(JSON.stringify(answerData));
  }

  async sendCallResponse(status: 'busy' | 'declined') {
    const currentConversation = useAppStore.getState().currentConversation;
    if (!currentConversation) return;

    const responseData = {
      type: 'call_response',
      status,
      timestamp: Date.now()
    };

    await currentConversation.send(JSON.stringify(responseData));
  }

  async sendEndCall() {
    const currentConversation = useAppStore.getState().currentConversation;
    if (!currentConversation) return;

    const endData = {
      type: 'end_call',
      timestamp: Date.now()
    };

    try {
      await currentConversation.send(JSON.stringify(endData));
    } catch (error) {
      console.error('Failed to send end call message:', error);
    }
  }

  endCall() {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clear video elements
    const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
    const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;

    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    // Update store
    useAppStore.getState().setCallState({ state: 'idle', type: null });
    useAppStore.getState().setLocalStream(null);
    useAppStore.getState().setPeerConnection(null);

    // Send end call message
    this.sendEndCall();
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }
}
