'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ProfileService } from '../services/profile.service';

const LandingProfileSetup: React.FC = () => {
  const { userProfile, updateUserProfile } = useAppStore();
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing username on mount
  useEffect(() => {
    if (userProfile.username) {
      setDisplayName(userProfile.username);
    }
  }, [userProfile.username]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      alert('Display name cannot be empty.');
      return;
    }

    const validation = ProfileService.getInstance().validateUsername(displayName);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    try {
      setIsSaving(true);
      const normalized = ProfileService.getInstance().normalizeUsername(displayName);
      updateUserProfile({ username: normalized });
      await ProfileService.getInstance().saveProfile();
      
      // Update local state to show the saved name
      setDisplayName(normalized);
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `🪪 Display name set to @${normalized}`, type: 'success' }
      }));
    } catch (error) {
      console.error('Failed to save display name:', error);
      alert('Failed to save display name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="profile-setup">
      <label htmlFor="displayNameInput">Choose your display name</label>
      <div className="profile-input">
        <input
          id="displayNameInput"
          type="text"
          placeholder="e.g. orbitlabs"
          autoComplete="off"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button
          id="saveDisplayNameBtn"
          className="ghost-action profile-save"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <p className="profile-hint">Save a name your friends recognize and share it alongside your inbox ID.</p>
    </div>
  );
};

export default LandingProfileSetup;

