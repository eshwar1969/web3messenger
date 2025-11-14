'use client';

import React, { useState, useEffect } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { FormatUtils } from '../utils/format';
import { ConversationService } from '../services/conversation.service';

const ConversationList: React.FC = () => {
  const { conversations, currentConversation, selectConversation, isLoading } = useConversations();
  const [conversationNames, setConversationNames] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    // Load conversation names
    const names = ConversationService.getInstance().getAllNames();
    setConversationNames(names);
  }, [conversations]);

  const handleConversationClick = (index: number) => {
    selectConversation(index);
  };

  const handleNameEdit = (convId: string, currentName: string | null) => {
    setEditingId(convId);
    setEditValue(currentName || '');
  };

  const handleNameSave = (convId: string) => {
    if (editValue.trim()) {
      ConversationService.getInstance().setConversationName(convId, editValue.trim());
      setConversationNames(prev => ({ ...prev, [convId]: editValue.trim() }));
    } else {
      ConversationService.getInstance().removeConversationName(convId);
      const updated = { ...conversationNames };
      delete updated[convId];
      setConversationNames(updated);
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleNameCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  if (isLoading) {
    return (
      <div className="conversations-list">
        <div className="loading">Loading conversations...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="conversations-list">
        <div className="empty-state">
          <p>No conversations yet.</p>
          <p>Start one above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversations-list">
      {conversations.map((conv: any, index: number) => {
        const isDm = conv.version === 'DM';
        const isActive = currentConversation === conv;
        const customName = conversationNames[conv.id];
        const isEditing = editingId === conv.id;

        let title = 'Conversation';
        let subtitle = '';
        let memberCount = 0;

        if (customName) {
          title = customName;
        } else if (isDm && conv.peerInboxId) {
          title = FormatUtils.getInstance().formatInboxId(conv.peerInboxId);
          subtitle = conv.peerInboxId;
        } else if (conv.memberInboxIds && conv.memberInboxIds.length > 0) {
          memberCount = conv.memberInboxIds.length;
          title = `🏠 Room`;
          subtitle = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
        } else {
          title = `🏠 Room`;
          subtitle = '0 members';
        }

        return (
          <div
            key={conv.id || index}
            className={`conversation-item ${isActive ? 'active' : ''}`}
            onClick={() => !isEditing && handleConversationClick(index)}
            style={{ 
              cursor: isEditing ? 'default' : 'pointer',
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              transition: 'background-color 0.2s',
              backgroundColor: isActive ? '#f0f9ff' : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (!isActive && !isEditing) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleNameSave(conv.id);
                        if (e.key === 'Escape') handleNameCancel();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: 1, padding: '6px 10px', fontSize: '14px', border: '1px solid #3b82f6', borderRadius: '6px', outline: 'none' }}
                      autoFocus
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNameSave(conv.id);
                      }}
                      className="primary-action"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNameCancel();
                      }}
                      className="ghost-action"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', fontWeight: '600', color: '#1a202c', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title}
                      </strong>
                      {!isDm && memberCount > 0 && (
                        <span style={{ fontSize: '11px', color: '#718096', background: '#e2e8f0', padding: '2px 6px', borderRadius: '10px' }}>
                          {memberCount}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {subtitle}
                    </div>
                  </>
                )}
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNameEdit(conv.id, customName || null);
                    }}
                    className="ghost-action tiny"
                    style={{ padding: '4px 8px', fontSize: '12px', opacity: 0.6 }}
                    title="Rename conversation"
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;
