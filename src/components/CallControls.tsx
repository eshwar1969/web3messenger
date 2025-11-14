'use client';

import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { WebRTCService } from '../services/webrtc.service';

const CallControls: React.FC = () => {
  const { callState, currentConversation } = useAppStore();

  const handleEndCall = () => {
    WebRTCService.getInstance().endCall();
    window.dispatchEvent(new CustomEvent('app-log', {
      detail: { message: '📞 Call ended', type: 'info' }
    }));
  };

  if (callState.state === 'idle') {
    return null;
  }

  const getCallStatusText = () => {
    switch (callState.state) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Ringing...';
      case 'connected':
        return callState.type === 'video' ? 'Video call active' : 'Voice call active';
      default:
        return 'In call';
    }
  };

  return (
    <div id="callControls" className="call-controls">
      <div className="call-active">
        <span>
          {callState.type === 'video' ? '📹' : '📞'} {getCallStatusText()}
        </span>
        <button 
          id="endCallBtn" 
          className="end-call-btn"
          onClick={handleEndCall}
        >
          End Call
        </button>
      </div>
      {callState.type === 'video' && (
        <div className="video-container">
          <video id="localVideo" autoPlay muted style={{ width: '200px', height: '150px' }} />
          <video id="remoteVideo" autoPlay style={{ width: '100%', height: '400px' }} />
        </div>
      )}
    </div>
  );
};

export default CallControls;

