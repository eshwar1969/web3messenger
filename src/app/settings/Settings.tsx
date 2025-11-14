'use client';

import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ProfileService } from '../../services/profile.service';
import { FriendDirectoryService } from '../../services/friendDirectory.service';

const Settings: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const [friendInboxId, setFriendInboxId] = useState('');
  const [friendType, setFriendType] = useState<'inbox' | 'address'>('inbox');

  const { userProfile, friendDirectory } = useAppStore();

  const handleSaveDisplayName = () => {
    if (ProfileService.getInstance().setDisplayName(displayName)) {
      alert('Display name updated!');
      setDisplayName('');
    }
  };

  const handleAddFriend = () => {
    if (FriendDirectoryService.getInstance().addFriend(friendUsername, friendInboxId, friendType)) {
      alert('Friend added!');
      setFriendUsername('');
      setFriendInboxId('');
    }
  };

  return (
    <div className="settings">
      <h2>Settings</h2>

      <section className="settings-section">
        <h3>Profile</h3>
        <div className="profile-setup">
          <label htmlFor="displayNameInput">Display Name</label>
          <div className="profile-input">
            <input
              id="displayNameInput"
              type="text"
              placeholder="e.g. orbitlabs"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <button onClick={handleSaveDisplayName} className="ghost-action profile-save">
              Save
            </button>
          </div>
          <p className="profile-hint">
            Current: {userProfile.username || 'Not set'}
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h3>Friend Directory</h3>
        <div className="friend-directory">
          <div className="friend-inputs">
            <input
              type="text"
              placeholder="Username"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
            />
            <input
              type="text"
              placeholder={friendType === 'inbox' ? 'Inbox ID' : 'Wallet Address'}
              value={friendInboxId}
              onChange={(e) => setFriendInboxId(e.target.value)}
            />
            <select
              value={friendType}
              onChange={(e) => setFriendType(e.target.value as 'inbox' | 'address')}
            >
              <option value="inbox">Inbox ID</option>
              <option value="address">Wallet Address</option>
            </select>
            <button onClick={handleAddFriend} className="ghost-action">
              Add Friend
            </button>
          </div>

          <div className="friend-list">
            <h4>Your Friends</h4>
            {friendDirectory.length === 0 ? (
              <p>No friends added yet.</p>
            ) : (
              friendDirectory.map((friend) => (
                <div key={friend.id} className="friend-item">
                  <span>@{friend.username}</span>
                  <span>{friend.value}</span>
                  <span className="friend-type">{friend.type}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
